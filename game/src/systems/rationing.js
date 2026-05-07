/**
 * EmpireOS — Wartime Rationing (T228).
 *
 * During active wars (Bronze Age+), the player can declare strict rationing.
 * While active, three effects apply (computed in resources.js recalcRates):
 *   - Food consumption reduced by 30% (net negative food rate ×0.70)
 *   - All non-food positive production rates reduced by 15% (×0.85)
 *   - Army morale drains −1 every 30 seconds
 *
 * Duration: 5 minutes. Cooldown: 12 minutes.
 *
 * state.rationing = {
 *   active:        { expiresAt: tick } | null,
 *   cooldownUntil: tick,
 *   totalDeclared: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const RATION_DURATION         = 5  * 60 * TICKS_PER_SECOND;   // 5 min
export const RATION_COOLDOWN         = 12 * 60 * TICKS_PER_SECOND;   // 12 min
export const RATION_MORALE_INTERVAL  = 30 * TICKS_PER_SECOND;        // drain every 30 s
export const RATION_MIN_AGE          = 1;

// Rate modifiers applied in resources.js (read from state, no import needed there)
export const RATION_FOOD_MULT        = 0.70;  // ×0.70 on negative food rate → -30% consumption
export const RATION_PROD_MULT        = 0.85;  // ×0.85 on non-food positive rates → -15%

// ── Init ──────────────────────────────────────────────────────────────────────

export function initRationing() {
  if (!state.rationing) {
    state.rationing = { active: null, cooldownUntil: 0, totalDeclared: 0 };
  }
  if (state.rationing.totalDeclared === undefined) state.rationing.totalDeclared = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────────

let _lastMoraleDrainTick = 0;

export function rationingTick() {
  if (!state.rationing?.active) return;

  const r = state.rationing;

  // Check expiry
  if (state.tick >= r.active.expiresAt) {
    r.active        = null;
    r.cooldownUntil = state.tick + RATION_COOLDOWN;
    emit(Events.RATIONING_CHANGED, { action: 'expired' });
    emit(Events.RESOURCE_CHANGED, {});
    addMessage('📦 Wartime rationing lifted. Production returns to normal.', 'info');
    return;
  }

  // Morale drain every 30 s
  if (state.tick - _lastMoraleDrainTick >= RATION_MORALE_INTERVAL) {
    _lastMoraleDrainTick = state.tick;
    changeMorale(-1);
  }
}

// ── Action ────────────────────────────────────────────────────────────────────

export function declareRationing() {
  const check = canDeclareRationing();
  if (!check.ok) return check;

  const r = state.rationing;
  r.active = { expiresAt: state.tick + RATION_DURATION };
  r.totalDeclared++;
  _lastMoraleDrainTick = state.tick;

  emit(Events.RATIONING_CHANGED, { action: 'declared' });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    '📦 Wartime rationing declared! Food consumption −30%, production −15%, morale −1/30 s for 5 minutes.',
    'info',
  );
  return { ok: true };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function canDeclareRationing() {
  if ((state.age ?? 0) < RATION_MIN_AGE) {
    return { ok: false, reason: 'Requires Bronze Age.' };
  }
  if (isRationingActive()) {
    return { ok: false, reason: 'Rationing already active.' };
  }
  if ((state.rationing?.cooldownUntil ?? 0) > state.tick) {
    return { ok: false, reason: 'Rationing on cooldown.' };
  }
  if (!_isAtWar()) {
    return { ok: false, reason: 'Only available during active wars.' };
  }
  return { ok: true };
}

export function isRationingActive() {
  return !!(state.rationing?.active && state.rationing.active.expiresAt > state.tick);
}

export function getRationingSecsLeft() {
  if (!isRationingActive()) return 0;
  return Math.max(0, Math.ceil((state.rationing.active.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function getRationingCooldownSecs() {
  if (isRationingActive()) return 0;
  const cd = state.rationing?.cooldownUntil ?? 0;
  return Math.max(0, Math.ceil((cd - state.tick) / TICKS_PER_SECOND));
}

function _isAtWar() {
  return state.diplomacy?.empires?.some(e => e.relations === 'war') ?? false;
}
