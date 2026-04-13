/**
 * EmpireOS — Army morale system (T057).
 *
 * Morale (0–100) tracks the psychological state of the player's army.
 *
 * Drift (per tick, 4 ticks/s):
 *   - Active wars:        −0.012/war  (~−2.9/min/war)
 *   - Active alliances:   +0.006/ally (~+1.4/min/ally)
 *   - Winter season:      −0.010       (~−2.4/min)
 *   - Spring season:      +0.006       (~+1.4/min)
 *   - Barbarian camps:    −0.003/camp  (~−0.7/min/camp)
 *
 * Flat changes (applied by external systems via changeMorale()):
 *   - Combat victory:     +5
 *   - Combat defeat:      −8
 *   - Enemy captures tile: −3
 *   - Age advance:        +10
 *
 * Combat effects (applied in combat.js):
 *   - Morale ≥80 (Inspired):    attackPower ×1.15
 *   - Morale <25 (Demoralized): attackPower ×0.80
 *
 * Desertion: if morale <15 and units exist, 0.05 %/tick chance to lose 1 unit.
 */

import { state } from '../core/state.js';
import { emit, on, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { recalcRates } from './resources.js';

// ── Constants ──────────────────────────────────────────────────────────────

export const MORALE_MAX = 100;
export const MORALE_MIN = 0;

// Per-tick drift
const WAR_DRAIN   = -0.012;
const ALLY_GAIN   = +0.006;
const WINTER_DRAIN = -0.010;
const SPRING_GAIN  = +0.006;
const CAMP_DRAIN  = -0.003;

// Flat changes (exported so combat.js / enemyAI.js can import them)
export const MORALE_COMBAT_WIN   = +5;
export const MORALE_COMBAT_LOSS  = -8;
export const MORALE_TILE_LOST    = -3;
export const MORALE_AGE_ADVANCE  = +10;

// Combat multipliers
const INSPIRED_MULT    = 1.15;   // morale ≥ 80
const DEMORALIZED_MULT = 0.80;   // morale < 25

// Desertion probability per tick when critically low
const DESERTION_CHANCE = 0.0005;

let _initialized = false;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise morale state. Idempotent — safe to call on every new game.
 * Subscribes to AGE_CHANGED once for the lifetime of the module.
 */
export function initMorale() {
  if (state.morale === null || state.morale === undefined) {
    state.morale = 50;
  }
  if (!_initialized) {
    _initialized = true;
    on(Events.AGE_CHANGED, () => changeMorale(MORALE_AGE_ADVANCE));
  }
}

/**
 * Apply a morale delta, clamped to [MORALE_MIN, MORALE_MAX].
 * Emits MORALE_CHANGED immediately.
 */
export function changeMorale(delta) {
  if (state.morale === null || state.morale === undefined) state.morale = 50;
  state.morale = Math.max(MORALE_MIN, Math.min(MORALE_MAX, state.morale + delta));
  emit(Events.MORALE_CHANGED, { morale: state.morale });
}

/**
 * Returns the attack-power multiplier derived from current morale.
 * Used by combat.js in both attackTile() and getAttackPreview().
 */
export function getMoraleEffect() {
  const m = state.morale ?? 50;
  if (m >= 80) return INSPIRED_MULT;
  if (m < 25)  return DEMORALIZED_MULT;
  return 1.0;
}

/** Human-readable morale tier label. */
export function getMoraleLabel() {
  const m = state.morale ?? 50;
  if (m >= 80) return 'Inspired';
  if (m >= 65) return 'Confident';
  if (m >= 25) return 'Steady';
  if (m >= 10) return 'Demoralized';
  return 'Broken';
}

/**
 * Registered as a tick system in main.js.
 * Applies per-tick morale drift and handles rare desertion events.
 */
export function moraleTick() {
  if (state.morale === null || state.morale === undefined) return;

  let delta = 0;

  // Wars drain morale
  const warCount  = state.diplomacy?.empires?.filter(e => e.relations === 'war').length ?? 0;
  delta += warCount * WAR_DRAIN;

  // Alliances sustain morale
  const allyCount = state.diplomacy?.empires?.filter(e => e.relations === 'allied').length ?? 0;
  delta += allyCount * ALLY_GAIN;

  // Season modifiers (index 0=Spring, 3=Winter)
  if (state.season != null) {
    const idx = state.season.index ?? 0;
    if (idx === 3) delta += WINTER_DRAIN;
    if (idx === 0) delta += SPRING_GAIN;
  }

  // Barbarian camp pressure
  const campCount = _countCamps();
  delta += campCount * CAMP_DRAIN;

  // Apply drift
  if (Math.abs(delta) > 1e-6) {
    const prev = state.morale;
    state.morale = Math.max(MORALE_MIN, Math.min(MORALE_MAX, state.morale + delta));

    // Emit only when morale crosses a 5-point bucket boundary to avoid event storm
    if (Math.floor(prev / 5) !== Math.floor(state.morale / 5)) {
      emit(Events.MORALE_CHANGED, { morale: state.morale });
    }
  }

  // Desertion: critically low morale can cause unit losses
  if (state.morale < 15) {
    const unitIds = Object.keys(state.units ?? {}).filter(id => (state.units[id] ?? 0) > 0);
    if (unitIds.length > 0 && Math.random() < DESERTION_CHANCE) {
      const id = unitIds[Math.floor(Math.random() * unitIds.length)];
      state.units[id]--;
      if (state.units[id] <= 0) delete state.units[id];
      recalcRates();
      emit(Events.UNIT_CHANGED, {});
      emit(Events.MORALE_CHANGED, { morale: state.morale });
      addMessage('😰 A soldier deserted! Restore morale before more units flee.', 'raid');
    }
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

function _countCamps() {
  if (!state.map) return 0;
  let n = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'barbarian') n++;
    }
  }
  return n;
}
