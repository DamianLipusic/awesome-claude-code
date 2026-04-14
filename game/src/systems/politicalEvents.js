/**
 * EmpireOS — Political Events system (T072).
 *
 * Random political crises fire every 5–10 minutes. Each event presents two
 * choices with different resource/morale tradeoffs. The pending event is shown
 * in the Quest panel until the player resolves it or it auto-expires (2 min).
 *
 * state.politicalEvents:
 *   { pending: { id, icon, title, desc, choiceA, choiceB, expiresAt } | null,
 *     log: [{ id, icon, title, choiceLabel, effect, tick }],  // newest first
 *     nextEventTick: number }
 */

import { state }     from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { changeMorale } from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN   = 1200; // 5 min in ticks
const SPAWN_MAX   = 2400; // 10 min in ticks
const EXPIRE_TICKS = 480; // 2 min — auto-resolved if player ignores
const MAX_LOG     = 10;

/** Static event templates — mixed tradeoffs so both choices feel meaningful. */
const EVENTS = [
  {
    id:      'harvest_festival',
    icon:    '🌾',
    title:   'Harvest Festival',
    desc:    'Your farmers have had a bumper crop. How shall the empire celebrate?',
    choiceA: { label: 'Grand Feast',  effect: '+100 food, +8 morale',   cost: {},          gain: { food: 100 }, morale: 8  },
    choiceB: { label: 'Store Wisely', effect: '+160 food, −2 morale',   cost: {},          gain: { food: 160 }, morale: -2 },
  },
  {
    id:      'tax_dispute',
    icon:    '💰',
    title:   'Tax Dispute',
    desc:    'Merchants are protesting rising trade levies. The treasury watches closely.',
    choiceA: { label: 'Collect Anyway',  effect: '+100 gold, −10 morale', cost: {},          gain: { gold: 100 }, morale: -10 },
    choiceB: { label: 'Grant Tax Relief', effect: '−60 gold, +5 morale',  cost: { gold: 60 }, gain: {},           morale: 5  },
  },
  {
    id:      'desertion_crisis',
    icon:    '⚔️',
    title:   'Desertion Crisis',
    desc:    'Soldiers weary of endless campaigns are abandoning their posts.',
    choiceA: { label: 'Enforce Discipline', effect: '−8 morale',          cost: {},          gain: {},        morale: -8 },
    choiceB: { label: 'Pay a Bonus',        effect: '−80 gold, +5 morale', cost: { gold: 80 }, gain: {},       morale: 5  },
  },
  {
    id:      'merchant_delegation',
    icon:    '🚢',
    title:   'Merchant Delegation',
    desc:    'A group of foreign merchants seeks a formal trade arrangement with your court.',
    choiceA: { label: 'Negotiate Trade',  effect: '−80 gold, +60 iron + stone', cost: { gold: 80 }, gain: { iron: 60, stone: 60 }, morale: 0 },
    choiceB: { label: 'Demand Tariffs',   effect: '+80 gold, −5 morale',        cost: {},           gain: { gold: 80 },            morale: -5 },
  },
  {
    id:      'plague_rumour',
    icon:    '💀',
    title:   'Plague Rumour',
    desc:    'Whispers of sickness spread through the city. Citizens grow fearful.',
    choiceA: { label: 'Impose Quarantine',   effect: '−80 food, −3 morale',  cost: { food: 80 }, gain: {},        morale: -3 },
    choiceB: { label: 'Dismiss the Rumours', effect: '−30 food, −8 morale',  cost: { food: 30 }, gain: {},        morale: -8 },
  },
  {
    id:      'foreign_gift',
    icon:    '🤝',
    title:   'Foreign Gift',
    desc:    'A neighbouring ruler sends gifts of goodwill to your court.',
    choiceA: { label: 'Accept Graciously', effect: '+80 gold, +5 morale',      cost: {}, gain: { gold: 80 }, morale: 5 },
    choiceB: { label: 'Decline Politely',  effect: '+3 morale (independence)', cost: {}, gain: {},            morale: 3 },
  },
  {
    id:      'mineral_vein',
    icon:    '⛏️',
    title:   'Mineral Vein Discovered',
    desc:    'Prospectors report rich mineral deposits just outside your borders.',
    choiceA: { label: 'Fund the Mining', effect: '−80 gold, −40 wood, +120 iron', cost: { gold: 80, wood: 40 }, gain: { iron: 120 }, morale: 0 },
    choiceB: { label: 'Ignore It',       effect: 'Nothing happens',                cost: {},                      gain: {},            morale: 0 },
  },
  {
    id:      'religious_revival',
    icon:    '⛪',
    title:   'Religious Revival',
    desc:    'A charismatic preacher stirs spiritual fervour among the populace.',
    choiceA: { label: 'Support the Movement', effect: '−50 gold, +12 morale', cost: { gold: 50 }, gain: {},           morale: 12 },
    choiceB: { label: 'Discourage It',        effect: '+30 gold, −8 morale',  cost: {},           gain: { gold: 30 }, morale: -8 },
  },
];

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));
}

/**
 * Initialise the political events state (idempotent).
 */
export function initPoliticalEvents() {
  if (state.politicalEvents) return; // already initialised (from save or prior call)
  state.politicalEvents = {
    pending:       null,
    log:           [],
    nextEventTick: _nextSpawnTick(),
  };
}

/**
 * Called every tick. Expires stale events (auto-resolves to choice B) and
 * spawns new events when the schedule fires.
 */
export function politicalEventTick() {
  if (!state.politicalEvents) return;
  const pe = state.politicalEvents;

  // Auto-expire: player ignored the event → apply choice B silently
  if (pe.pending && state.tick >= pe.pending.expiresAt) {
    const ev = EVENTS.find(e => e.id === pe.pending.id);
    if (ev) _applyChoice(ev, 'b', /*autoResolved=*/ true);
    return;
  }

  // Spawn: cooldown elapsed and no pending event
  if (!pe.pending && state.tick >= pe.nextEventTick) {
    _spawnEvent();
  }
}

/** Pick a random event and push it as pending. */
function _spawnEvent() {
  const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  state.politicalEvents.pending = {
    id:        ev.id,
    icon:      ev.icon,
    title:     ev.title,
    desc:      ev.desc,
    choiceA:   { ...ev.choiceA },
    choiceB:   { ...ev.choiceB },
    expiresAt: state.tick + EXPIRE_TICKS,
  };
  addMessage(`👑 Political event: ${ev.icon} ${ev.title} — check the Quests tab!`, 'info');
  emit(Events.POLITICAL_EVENT, { id: ev.id });
}

/**
 * Player resolves the pending political event.
 * choice: 'a' | 'b'
 * Returns { ok, reason? }
 */
export function resolvePoliticalEvent(choice) {
  const pe = state.politicalEvents;
  if (!pe?.pending) return { ok: false, reason: 'No pending political event.' };

  const ev = EVENTS.find(e => e.id === pe.pending.id);
  if (!ev) return { ok: false, reason: 'Unknown event type.' };

  return _applyChoice(ev, choice, /*autoResolved=*/ false);
}

function _applyChoice(ev, choice, autoResolved) {
  const pe  = state.politicalEvents;
  const opt = choice === 'a' ? ev.choiceA : ev.choiceB;

  // Check cost affordability
  for (const [res, amt] of Object.entries(opt.cost ?? {})) {
    if ((state.resources[res] ?? 0) < amt) {
      return { ok: false, reason: `Need ${amt} ${res} for that choice.` };
    }
  }

  // Deduct costs
  for (const [res, amt] of Object.entries(opt.cost ?? {})) {
    state.resources[res] = Math.max(0, (state.resources[res] ?? 0) - amt);
  }

  // Apply gains (capped at cap)
  for (const [res, amt] of Object.entries(opt.gain ?? {})) {
    if (state.resources[res] !== undefined) {
      state.resources[res] = Math.min(
        state.caps[res] ?? 9999,
        (state.resources[res] ?? 0) + amt,
      );
    }
  }

  // Morale change
  if (opt.morale) changeMorale(opt.morale);

  // Record in log (newest-first, capped)
  const entry = {
    id:          ev.id,
    icon:        ev.icon,
    title:       ev.title,
    choiceLabel: autoResolved ? `${opt.label} (auto)` : opt.label,
    effect:      opt.effect,
    tick:        state.tick,
  };
  pe.log.unshift(entry);
  if (pe.log.length > MAX_LOG) pe.log.pop();

  // Reset state
  pe.pending       = null;
  pe.nextEventTick = _nextSpawnTick();

  const prefix = autoResolved ? '(auto-resolved) ' : '';
  addMessage(`👑 ${prefix}${ev.title}: ${opt.label} — ${opt.effect}`, 'info');
  emit(Events.POLITICAL_EVENT, { resolved: true, id: ev.id });
  emit(Events.RESOURCE_CHANGED, {});

  return { ok: true };
}

/**
 * Returns seconds remaining on the pending event countdown (0 if none).
 */
export function getPoliticalEventSecsLeft() {
  const pending = state.politicalEvents?.pending;
  if (!pending) return 0;
  return Math.max(0, Math.ceil((pending.expiresAt - state.tick) / TICKS_PER_SECOND));
}
