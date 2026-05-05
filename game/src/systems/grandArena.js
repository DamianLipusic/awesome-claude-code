/**
 * EmpireOS — T204: Grand Arena Events.
 *
 * Once the empire reaches the Bronze Age, a Grand Arena begins hosting
 * periodic competitions every 18 minutes.  The player may enter their units
 * to compete for gold, prestige, and morale boosts.
 *
 * State shape:
 *   state.arena = {
 *     nextEventTick: number,
 *     current: {
 *       type:          'melee'|'archery'|'cavalry'|'arcane',
 *       icon:          string,
 *       name:          string,
 *       desc:          string,
 *       unitId:        string,
 *       unitCost:      number,   // units consumed on entry
 *       minToWin:      number,   // units of that type needed for full win chance
 *       prize:         { gold, prestige, morale },
 *       expiresAt:     number,   // tick when offer auto-expires
 *     } | null,
 *     eventsWon:    number,
 *     eventsLost:   number,
 *     totalEntered: number,
 *   } | null
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from './morale.js';
import { awardPrestige }    from './prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_AGE           = 1; // Bronze Age
const SPAWN_INTERVAL    = 18 * 60 * TICKS_PER_SECOND; // 18 minutes
const OFFER_DURATION    = 90 * TICKS_PER_SECOND;       // 90 seconds to decide

// ── Event pool ─────────────────────────────────────────────────────────────

const ARENA_EVENTS = [
  {
    type:     'melee',
    icon:     '⚔️',
    name:     'Grand Melee',
    desc:     'Soldiers clash in open-field combat. Enter your finest warriors!',
    unitId:   'soldier',
    unitCost: 2,
    minToWin: 5,
    prize:    { gold: 120, prestige: 20, morale: 10 },
  },
  {
    type:     'archery',
    icon:     '🏹',
    name:     'Archery Tournament',
    desc:     'Archers compete for precision and range across the arena grounds.',
    unitId:   'archer',
    unitCost: 2,
    minToWin: 5,
    prize:    { gold: 100, prestige: 15, morale: 8 },
  },
  {
    type:     'cavalry',
    icon:     '🐎',
    name:     'Cavalry Joust',
    desc:     'Knights mounted on war horses charge for glory and honour.',
    unitId:   'knight',
    unitCost: 2,
    minToWin: 4,
    prize:    { gold: 200, prestige: 30, morale: 12 },
    minAge:   2, // Iron Age+
  },
  {
    type:     'arcane',
    icon:     '🔮',
    name:     'Sorcerers\' Duel',
    desc:     'Mages demonstrate their mastery of the arcane arts before the crowd.',
    unitId:   'mage',
    unitCost: 2,
    minToWin: 3,
    prize:    { gold: 150, prestige: 35, morale: 15 },
    minAge:   3, // Medieval+
  },
];

// ── Public API ─────────────────────────────────────────────────────────────

export function initArena() {
  if (!state.arena) {
    state.arena = {
      nextEventTick: SPAWN_INTERVAL,
      current:       null,
      eventsWon:     0,
      eventsLost:    0,
      totalEntered:  0,
    };
  }
}

/** Returns the current arena event, or null if none is active. */
export function getArenaEvent() {
  return state.arena?.current ?? null;
}

/** Seconds until the current event expires (0 if no event). */
export function getArenaSecsLeft() {
  const cur = state.arena?.current;
  if (!cur) return 0;
  return Math.max(0, Math.ceil((cur.expiresAt - (state.tick ?? 0)) / TICKS_PER_SECOND));
}

/** Seconds until the next arena event spawns (when no event is active). */
export function getArenaNextSecs() {
  const a = state.arena;
  if (!a || a.current) return 0;
  return Math.max(0, Math.ceil((a.nextEventTick - (state.tick ?? 0)) / TICKS_PER_SECOND));
}

/**
 * Enter the current arena event.
 * Deducts unitCost units, resolves win/loss, applies prizes.
 */
export function enterArena() {
  const a = state.arena;
  if (!a?.current) return { ok: false, reason: 'No arena event active.' };

  const ev  = a.current;
  const has = state.units[ev.unitId] ?? 0;
  if (has < ev.unitCost) {
    return { ok: false, reason: `Need ${ev.unitCost} ${ev.unitId}s to enter.` };
  }

  // Deduct entry units
  state.units[ev.unitId] = has - ev.unitCost;

  // Win probability: base 50% + 15% per unit above cost (max 95%)
  const extra = Math.max(0, has - ev.unitCost);
  const chance = Math.min(0.95, 0.50 + extra * 0.15);
  const won    = Math.random() < chance;

  a.totalEntered++;
  a.current = null;
  a.nextEventTick = (state.tick ?? 0) + SPAWN_INTERVAL;

  emit(Events.UNIT_CHANGED, { unitId: ev.unitId });

  if (won) {
    a.eventsWon++;
    state.resources.gold = Math.min(
      state.caps?.gold ?? 500,
      (state.resources.gold ?? 0) + ev.prize.gold,
    );
    awardPrestige(ev.prize.prestige, `arena victory: ${ev.name}`);
    changeMorale(ev.prize.morale);
    addMessage(
      `🏆 Victory at the ${ev.name}! Your ${ev.unitId}s triumphed! ` +
      `+${ev.prize.gold}g +${ev.prize.prestige} prestige +${ev.prize.morale} morale`,
      'windfall',
    );
    emit(Events.RESOURCE_CHANGED, {});
  } else {
    a.eventsLost++;
    // Consolation prize: 50 gold
    const consolation = 50;
    state.resources.gold = Math.min(
      state.caps?.gold ?? 500,
      (state.resources.gold ?? 0) + consolation,
    );
    addMessage(
      `😤 Defeat at the ${ev.name}. A valiant effort. +${consolation}g consolation prize.`,
      'info',
    );
    emit(Events.RESOURCE_CHANGED, {});
  }

  emit(Events.ARENA_CHANGED, { won, type: ev.type });
  return { ok: true, won };
}

/**
 * Skip / dismiss the current arena event without penalty.
 */
export function skipArena() {
  const a = state.arena;
  if (!a?.current) return { ok: false, reason: 'No arena event to skip.' };
  const type = a.current.type;
  a.current       = null;
  a.nextEventTick = (state.tick ?? 0) + SPAWN_INTERVAL;
  addMessage('🏟️ Arena event passed. The crowd disperses.', 'info');
  emit(Events.ARENA_CHANGED, { won: null, type });
  return { ok: true };
}

// ── Tick ───────────────────────────────────────────────────────────────────

export function arenaTick() {
  const a = state.arena;
  if (!a) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  const tick = state.tick ?? 0;

  // Expire active event
  if (a.current && tick >= a.current.expiresAt) {
    const type = a.current.type;
    a.current       = null;
    a.nextEventTick = tick + SPAWN_INTERVAL;
    addMessage('🏟️ The arena event has concluded without a challenger.', 'info');
    emit(Events.ARENA_CHANGED, { won: null, type, expired: true });
    return;
  }

  // Spawn new event
  if (!a.current && tick >= a.nextEventTick) {
    _spawnEvent();
  }
}

// ── Private helpers ────────────────────────────────────────────────────────

function _spawnEvent() {
  const a    = state.arena;
  const age  = state.age ?? 0;
  const tick = state.tick ?? 0;

  // Filter events available at current age
  const pool = ARENA_EVENTS.filter(ev => (ev.minAge ?? 1) <= age);
  if (pool.length === 0) return;

  const ev = pool[Math.floor(Math.random() * pool.length)];

  a.current = {
    type:      ev.type,
    icon:      ev.icon,
    name:      ev.name,
    desc:      ev.desc,
    unitId:    ev.unitId,
    unitCost:  ev.unitCost,
    minToWin:  ev.minToWin,
    prize:     { ...ev.prize },
    expiresAt: tick + OFFER_DURATION,
  };

  addMessage(
    `🏟️ Grand Arena: ${ev.icon} ${ev.name} now open! Enter ${ev.unitCost} ${ev.unitId}s to compete. ` +
    `Prize: +${ev.prize.gold}g +${ev.prize.prestige} prestige +${ev.prize.morale} morale`,
    'windfall',
  );
  emit(Events.ARENA_CHANGED, { type: ev.type, spawned: true });
}
