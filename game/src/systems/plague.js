/**
 * EmpireOS — Plague Outbreak System (T161).
 *
 * When population > 600 at Bronze Age+, a plague can break out every ~10 min.
 * - Lasts 3 minutes (720 ticks); reduces food production by 35%.
 * - Population slowly falls during outbreak (−1 citizen every 30 s).
 * - Player can quarantine early: costs 100 gold + 50 food.
 * - 15-min immunity period after recovery.
 *
 * state.plague = {
 *   active:        { expiresAt: tick } | null,
 *   immuneUntil:   tick,          // no new outbreak before this tick
 *   nextCheckTick: tick,          // earliest tick to roll for a new outbreak
 *   totalPlagued:  number,
 * }
 */

import { state }          from '../core/state.js';
import { emit, Events }   from '../core/events.js';
import { addMessage }     from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const PLAGUE_DURATION_TICKS  = 3 * 60 * TICKS_PER_SECOND;  // 720 ticks = 3 min
const IMMUNITY_TICKS          = 15 * 60 * TICKS_PER_SECOND; // 900 ticks = 15 min
const CHECK_INTERVAL_MIN      = 8  * 60 * TICKS_PER_SECOND; // 8 min
const CHECK_INTERVAL_MAX      = 12 * 60 * TICKS_PER_SECOND; // 12 min
const POP_DAMAGE_INTERVAL     = 30 * TICKS_PER_SECOND;       // −1 citizen every 30 s
const QUARANTINE_GOLD_COST    = 100;
const QUARANTINE_FOOD_COST    = 50;
const MIN_POP_FOR_PLAGUE      = 600;
const MIN_AGE_FOR_PLAGUE      = 1; // Bronze Age+

// ── Public API ──────────────────────────────────────────────────────────────

export function initPlague() {
  if (!state.plague) {
    state.plague = {
      active:        null,
      immuneUntil:   0,
      nextCheckTick: _nextCheckTick(),
      totalPlagued:  0,
    };
  }
  // Migration guard
  if (state.plague.nextCheckTick === undefined) state.plague.nextCheckTick = _nextCheckTick();
  if (state.plague.totalPlagued  === undefined) state.plague.totalPlagued  = 0;
}

export function plagueTick() {
  if (!state.plague) return;

  const p = state.plague;

  // ── Handle active plague ──────────────────────────────────────────────────
  if (p.active) {
    // Population damage: remove 1 citizen every 30 s
    if (state.population && state.tick % POP_DAMAGE_INTERVAL === 0) {
      state.population.count = Math.max(0, state.population.count - 1);
      emit(Events.POPULATION_CHANGED, {});
    }

    // Plague expiry
    if (state.tick >= p.active.expiresAt) {
      _endPlague(false);
    }
    return;
  }

  // ── Check for new outbreak ────────────────────────────────────────────────
  if (state.tick < p.nextCheckTick) return;
  if (state.tick < p.immuneUntil)   return;
  if ((state.age ?? 0) < MIN_AGE_FOR_PLAGUE) return;
  if ((state.population?.count ?? 0) < MIN_POP_FOR_PLAGUE) return;

  // 40% chance per check window
  if (Math.random() < 0.40) {
    _startPlague();
  } else {
    p.nextCheckTick = _nextCheckTick();
  }
}

/**
 * Player-triggered quarantine action.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function quarantinePlague() {
  if (!state.plague?.active) return { ok: false, reason: 'No active plague to quarantine.' };
  if ((state.resources?.gold ?? 0) < QUARANTINE_GOLD_COST)
    return { ok: false, reason: `Need ${QUARANTINE_GOLD_COST} gold to quarantine.` };
  if ((state.resources?.food ?? 0) < QUARANTINE_FOOD_COST)
    return { ok: false, reason: `Need ${QUARANTINE_FOOD_COST} food to quarantine.` };

  state.resources.gold -= QUARANTINE_GOLD_COST;
  state.resources.food -= QUARANTINE_FOOD_COST;
  emit(Events.RESOURCE_CHANGED, {});
  _endPlague(true);
  return { ok: true };
}

export function getActivePlague() {
  return state.plague?.active ?? null;
}

export function getPlagueSecsLeft() {
  if (!state.plague?.active) return 0;
  return Math.max(0, Math.ceil((state.plague.active.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function getImmunitySecsLeft() {
  if (!state.plague) return 0;
  return Math.max(0, Math.ceil((state.plague.immuneUntil - state.tick) / TICKS_PER_SECOND));
}

export { QUARANTINE_GOLD_COST, QUARANTINE_FOOD_COST };

// ── Internal helpers ────────────────────────────────────────────────────────

function _startPlague() {
  state.plague.active       = { expiresAt: state.tick + PLAGUE_DURATION_TICKS };
  state.plague.totalPlagued += 1;
  // schedule next check: after duration + immunity + random gap
  state.plague.nextCheckTick = state.tick + PLAGUE_DURATION_TICKS + IMMUNITY_TICKS + _randomCheckOffset();
  addMessage('🦠 A plague has broken out! Food production −35%. Quarantine to contain the spread.', 'crisis');
  emit(Events.PLAGUE_STARTED, {});
}

function _endPlague(quarantined) {
  state.plague.active      = null;
  state.plague.immuneUntil = state.tick + IMMUNITY_TICKS;
  state.plague.nextCheckTick = state.tick + IMMUNITY_TICKS + _randomCheckOffset();
  if (quarantined) {
    addMessage('🏥 Quarantine successful! The plague has been contained. 15-min immunity granted.', 'info');
  } else {
    addMessage('🌿 The plague has run its course. Your empire recovers. 15-min immunity granted.', 'info');
  }
  emit(Events.PLAGUE_ENDED, {});
}

function _randomCheckOffset() {
  return CHECK_INTERVAL_MIN + Math.floor(Math.random() * (CHECK_INTERVAL_MAX - CHECK_INTERVAL_MIN));
}

function _nextCheckTick() {
  return state.tick + _randomCheckOffset();
}
