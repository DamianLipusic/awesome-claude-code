/**
 * EmpireOS — T193: Oracle of Fate — Seasonal Omen System.
 *
 * Every 6 minutes (OMEN_INTERVAL) the Oracle of Fate reveals one Prophetic
 * Vision (omen) drawn at random from OMEN_POOL. The player has 60 seconds to:
 *
 *   Avert  — pay gold (avertCost) to cancel the omen, no negative effect.
 *   Channel — pay mana (channelCost) to convert the omen into a positive boon.
 *   Ignore  — do nothing; when the timer expires the omen's penalty fires.
 *
 * Available from Bronze Age (age ≥ 1). One omen may be active at a time.
 *
 * state.oracle = {
 *   nextOmenTick:   number,
 *   activeOmen:     null | { id, icon, title, desc, avertCost, channelCost,
 *                             avertDesc, channelDesc, expiresAt },
 *   totalOmens:     number,
 *   totalAverted:   number,
 *   totalChanneled: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { changeMorale }     from './morale.js';
import { awardPrestige }    from './prestige.js';

export const OMEN_INTERVAL       = 6 * 60 * TICKS_PER_SECOND;  // 1 440 ticks = 6 min
const        OMEN_DECISION_TICKS = 60 * TICKS_PER_SECOND;       // 240 ticks  = 60 s

const MIN_AGE = 1;  // Bronze Age

// ── Omen pool ─────────────────────────────────────────────────────────────────

export const OMEN_POOL = Object.freeze([
  {
    id:          'war_drums',
    icon:        '⚔️',
    title:       'War Drums',
    desc:        'Distant drums echo across the frontier — raiders gather to strike.',
    avertCost:   { gold: 50 },
    channelCost: { mana: 30 },
    avertDesc:   'Pay 50 gold to bribe the raiders and disperse the threat.',
    channelDesc: 'Spend 30 mana to turn war-lust into morale (+20 morale).',
    ignore(s) {
      const loss = Math.round(200 + Math.random() * 150);
      s.resources.gold = Math.max(0, (s.resources.gold ?? 0) - loss);
      emit(Events.RESOURCE_CHANGED, {});
      addMessage(`⚔️ Omen fulfilled! Raiders struck — lost ${loss} gold.`, 'raid');
    },
    channel() {
      changeMorale(20);
      addMessage('🔮 Oracle channeled War Drums — troops are inspired! +20 morale.', 'quest');
    },
  },
  {
    id:          'flood_tide',
    icon:        '🌊',
    title:       'Flood Tide',
    desc:        'Dark waters rise in visions — crops and timber face imminent ruin.',
    avertCost:   { gold: 40 },
    channelCost: { mana: 25 },
    avertDesc:   'Pay 40 gold to divert irrigation and save the harvest.',
    channelDesc: 'Spend 25 mana to redirect floodwaters — receive +200 food.',
    ignore(s) {
      const foodLoss = Math.round(150 + Math.random() * 100);
      const woodLoss = Math.round(80  + Math.random() * 70);
      s.resources.food = Math.max(0, (s.resources.food ?? 0) - foodLoss);
      s.resources.wood = Math.max(0, (s.resources.wood ?? 0) - woodLoss);
      emit(Events.RESOURCE_CHANGED, {});
      addMessage(`🌊 Omen fulfilled! Floods ruined the fields — lost ${foodLoss} food and ${woodLoss} wood.`, 'disaster');
    },
    channel(s) {
      const gain = 200;
      const cap  = s.caps?.food ?? 500;
      s.resources.food = Math.min(cap, (s.resources.food ?? 0) + gain);
      emit(Events.RESOURCE_CHANGED, {});
      addMessage(`🔮 Oracle channeled Flood Tide — fertile silt remains. +${gain} food.`, 'quest');
    },
  },
  {
    id:          'dark_eclipse',
    icon:        '🌑',
    title:       'Dark Eclipse',
    desc:        'The sun dims and shadows lengthen — misfortune lurks at the city gates.',
    avertCost:   { gold: 60 },
    channelCost: { mana: 40 },
    avertDesc:   'Pay 60 gold for ritual cleansing to drive away the dark omen.',
    channelDesc: 'Spend 40 mana to read celestial wisdom — gain prestige and gold.',
    ignore(s) {
      const loss = Math.round(300 + Math.random() * 200);
      s.resources.gold = Math.max(0, (s.resources.gold ?? 0) - loss);
      emit(Events.RESOURCE_CHANGED, {});
      addMessage(`🌑 Omen fulfilled! The dark eclipse brought calamity — lost ${loss} gold.`, 'disaster');
    },
    channel(s) {
      awardPrestige(50);
      const gain = 150;
      const cap  = s.caps?.gold ?? 500;
      s.resources.gold = Math.min(cap, (s.resources.gold ?? 0) + gain);
      emit(Events.RESOURCE_CHANGED, {});
      addMessage('🔮 Oracle channeled Dark Eclipse — celestial wisdom revealed! +50 prestige, +150 gold.', 'quest');
    },
  },
  {
    id:          'viper_counsel',
    icon:        '🐍',
    title:       'Viper in the Council',
    desc:        'A serpent coils around the throne — treachery stirs among your advisors.',
    avertCost:   { gold: 50 },
    channelCost: { mana: 30 },
    avertDesc:   'Pay 50 gold to purge the conspirators before they act.',
    channelDesc: 'Spend 30 mana to expose the traitors for public acclaim — gain prestige.',
    ignore(s) {
      changeMorale(-20);
      const ironLoss = Math.round(60 + Math.random() * 60);
      s.resources.iron = Math.max(0, (s.resources.iron ?? 0) - ironLoss);
      emit(Events.RESOURCE_CHANGED, {});
      addMessage(`🐍 Omen fulfilled! Court intrigue succeeded — morale −20, lost ${ironLoss} iron.`, 'raid');
    },
    channel() {
      awardPrestige(60);
      changeMorale(5);
      addMessage('🔮 Oracle channeled Viper in the Council — traitors exposed! +60 prestige, +5 morale.', 'quest');
    },
  },
  {
    id:          'frost_blight',
    icon:        '❄️',
    title:       'Frost Blight',
    desc:        'Ice creeps through the arcane channels — magical reserves may crystallize.',
    avertCost:   { gold: 30, mana: 20 },
    channelCost: { mana: 20 },
    avertDesc:   'Pay 30 gold + 20 mana to counter the blight with protective wards.',
    channelDesc: 'Spend 20 mana to crystallize the frost into arcane energy — gain 150 mana.',
    ignore(s) {
      const manaLoss  = Math.round(100 + Math.random() * 80);
      const stoneLoss = Math.round(60  + Math.random() * 60);
      s.resources.mana  = Math.max(0, (s.resources.mana  ?? 0) - manaLoss);
      s.resources.stone = Math.max(0, (s.resources.stone ?? 0) - stoneLoss);
      emit(Events.RESOURCE_CHANGED, {});
      addMessage(`❄️ Omen fulfilled! Frost blight struck — lost ${manaLoss} mana and ${stoneLoss} stone.`, 'disaster');
    },
    channel(s) {
      const gain = 150;
      const cap  = s.caps?.mana ?? 500;
      s.resources.mana = Math.min(cap, (s.resources.mana ?? 0) + gain);
      emit(Events.RESOURCE_CHANGED, {});
      addMessage(`🔮 Oracle channeled Frost Blight — arcane energy crystallized. +${gain} mana.`, 'quest');
    },
  },
]);

// ── Init ───────────────────────────────────────────────────────────────────────

export function initOracle() {
  if (!state.oracle) {
    state.oracle = {
      nextOmenTick:   OMEN_INTERVAL,
      activeOmen:     null,
      totalOmens:     0,
      totalAverted:   0,
      totalChanneled: 0,
    };
  } else {
    if (state.oracle.totalAverted   === undefined) state.oracle.totalAverted   = 0;
    if (state.oracle.totalChanneled === undefined) state.oracle.totalChanneled = 0;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Returns the active omen data object, or null. */
export function getActiveOmen() {
  return state.oracle?.activeOmen ?? null;
}

/** Seconds until the active omen fires (0 if none). */
export function getOmenSecsLeft() {
  const omen = state.oracle?.activeOmen;
  if (!omen) return 0;
  return Math.max(0, Math.ceil((omen.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Avert the active omen — spend gold to cancel its negative effect.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function avertOmen() {
  const omen = state.oracle?.activeOmen;
  if (!omen) return { ok: false, reason: 'No active omen.' };

  const def = OMEN_POOL.find(o => o.id === omen.id);
  if (!def)  return { ok: false, reason: 'Unknown omen type.' };

  for (const [res, amount] of Object.entries(def.avertCost)) {
    if ((state.resources?.[res] ?? 0) < amount)
      return { ok: false, reason: `Need ${amount} ${res} to avert the omen.` };
  }

  for (const [res, amount] of Object.entries(def.avertCost))
    state.resources[res] = Math.max(0, (state.resources[res] ?? 0) - amount);
  emit(Events.RESOURCE_CHANGED, {});

  const id = omen.id;
  state.oracle.activeOmen    = null;
  state.oracle.totalAverted += 1;
  state.oracle.nextOmenTick  = state.tick + OMEN_INTERVAL;

  emit(Events.OMEN_AVERTED, { id });
  addMessage(`🔮 Oracle omen averted — the prophecy has been undone.`, 'info');
  return { ok: true };
}

/**
 * Channel the active omen — spend mana to convert it into a positive effect.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function channelOmen() {
  const omen = state.oracle?.activeOmen;
  if (!omen) return { ok: false, reason: 'No active omen.' };

  const def = OMEN_POOL.find(o => o.id === omen.id);
  if (!def)  return { ok: false, reason: 'Unknown omen type.' };

  for (const [res, amount] of Object.entries(def.channelCost)) {
    if ((state.resources?.[res] ?? 0) < amount)
      return { ok: false, reason: `Need ${amount} ${res} to channel the omen.` };
  }

  for (const [res, amount] of Object.entries(def.channelCost))
    state.resources[res] = Math.max(0, (state.resources[res] ?? 0) - amount);
  emit(Events.RESOURCE_CHANGED, {});

  def.channel(state);

  const id = omen.id;
  state.oracle.activeOmen      = null;
  state.oracle.totalChanneled += 1;
  state.oracle.nextOmenTick    = state.tick + OMEN_INTERVAL;

  emit(Events.OMEN_CHANNELED, { id });
  return { ok: true };
}

// ── Tick ───────────────────────────────────────────────────────────────────────

/** Registered as a tick system — manages omen lifecycle. */
export function oracleTick() {
  if (!state.oracle) initOracle();

  const oracle = state.oracle;

  // Oracle only activates at Bronze Age+
  if ((state.age ?? 0) < MIN_AGE) return;

  // Check if active omen expired without player action → fire penalty
  if (oracle.activeOmen && state.tick >= oracle.activeOmen.expiresAt) {
    const firedId = oracle.activeOmen.id;
    const def     = OMEN_POOL.find(o => o.id === firedId);
    oracle.activeOmen    = null;
    oracle.nextOmenTick  = state.tick + OMEN_INTERVAL;
    if (def) def.ignore(state);
    emit(Events.OMEN_FIRED, { id: firedId });
    return;
  }

  // Spawn new omen when interval reached and none active
  if (!oracle.activeOmen && state.tick >= oracle.nextOmenTick) {
    _spawnOmen();
  }
}

// ── Internal ───────────────────────────────────────────────────────────────────

function _spawnOmen() {
  const def = OMEN_POOL[Math.floor(Math.random() * OMEN_POOL.length)];
  state.oracle.activeOmen = {
    id:          def.id,
    icon:        def.icon,
    title:       def.title,
    desc:        def.desc,
    avertCost:   def.avertCost,
    channelCost: def.channelCost,
    avertDesc:   def.avertDesc,
    channelDesc: def.channelDesc,
    expiresAt:   state.tick + OMEN_DECISION_TICKS,
  };
  state.oracle.totalOmens += 1;
  emit(Events.OMEN_APPEARED, { id: def.id });
  addMessage(`🔮 Oracle Vision: ${def.icon} ${def.title} — ${def.desc} (60s to respond)`, 'quest');
}
