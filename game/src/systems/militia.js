/**
 * EmpireOS — Peasant Militia System (T229).
 *
 * At Bronze Age+ during an active war, the player can conscript peasants
 * as temporary militia fighters.
 *
 * Militia size = min(floor(population / 100), 10)
 * Attack bonus  = size × 3  (up to +30 flat)
 * Food penalty  = size × 0.15 /s  (removed from food rate while active)
 *
 * Cost:     50 food + 30 gold
 * Duration: 5 minutes (1 200 ticks at 4 tps)
 * Cooldown: 15 minutes after disbandment
 * Min Age:  Bronze (age ≥ 1)
 *
 * state.militia = {
 *   active:        { expiresAt: tick, attackBonus: number, foodPenalty: number } | null,
 *   cooldownUntil: tick,
 *   totalCalled:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { recalcRates }      from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const MILITIA_DURATION    = 5  * 60 * TICKS_PER_SECOND; // 5 min
const MILITIA_COOLDOWN    = 15 * 60 * TICKS_PER_SECOND; // 15 min
const MIN_AGE             = 1;
export const MILITIA_FOOD_COST = 50;
export const MILITIA_GOLD_COST = 30;
const ATTACK_PER_SIZE     = 3;
const FOOD_PENALTY_PER    = 0.15;
const MAX_SIZE            = 10;

// ── Init ──────────────────────────────────────────────────────────────────

export function initMilitia() {
  if (!state.militia) {
    state.militia = { active: null, cooldownUntil: 0, totalCalled: 0 };
  }
  if (state.militia.cooldownUntil === undefined) state.militia.cooldownUntil = 0;
  if (state.militia.totalCalled   === undefined) state.militia.totalCalled   = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function militiaTick() {
  if (!state.militia?.active) return;
  if (state.tick < state.militia.active.expiresAt) return;

  const bonus = state.militia.active.attackBonus;
  state.militia.active        = null;
  state.militia.cooldownUntil = state.tick + MILITIA_COOLDOWN;

  recalcRates();
  emit(Events.MILITIA_CHANGED, { disbanded: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🏘️ The militia has been stood down. Attack bonus (${bonus > 0 ? '+' : ''}${bonus}) lifted.`,
    'info',
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Attempt to conscript a peasant militia.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function conscriptMilitia() {
  if (!state.militia) initMilitia();

  if ((state.age ?? 0) < MIN_AGE) {
    return { ok: false, reason: 'Requires Bronze Age.' };
  }
  if (!_isAtWar()) {
    return { ok: false, reason: 'Militia can only be raised during wartime.' };
  }
  if (state.militia.active) {
    return { ok: false, reason: 'Militia already active.' };
  }
  if (state.tick < (state.militia.cooldownUntil ?? 0)) {
    const secs = getMilitiaCooldownSecs();
    return { ok: false, reason: `Cooldown: ${secs}s remaining.` };
  }
  if ((state.resources.food ?? 0) < MILITIA_FOOD_COST) {
    return { ok: false, reason: `Need ${MILITIA_FOOD_COST} food.` };
  }
  if ((state.resources.gold ?? 0) < MILITIA_GOLD_COST) {
    return { ok: false, reason: `Need ${MILITIA_GOLD_COST} gold.` };
  }

  const size        = _militiaSize();
  const attackBonus = size * ATTACK_PER_SIZE;
  const foodPenalty = +(size * FOOD_PENALTY_PER).toFixed(2);

  state.resources.food         -= MILITIA_FOOD_COST;
  state.resources.gold         -= MILITIA_GOLD_COST;
  state.militia.active          = { expiresAt: state.tick + MILITIA_DURATION, attackBonus, foodPenalty };
  state.militia.totalCalled     = (state.militia.totalCalled ?? 0) + 1;

  recalcRates();
  emit(Events.MILITIA_CHANGED, { conscripted: true, size, attackBonus });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🏘️ Militia conscripted! ${size * 100} citizens armed — +${attackBonus} attack, ` +
    `-${foodPenalty} food/s for 5 minutes.`,
    'battle',
  );
  return { ok: true };
}

/** True when militia is currently active. */
export function isMilitiaActive() {
  return !!(state.militia?.active);
}

/** Flat attack bonus granted by an active militia (0 when inactive). */
export function getMilitiaAttackBonus() {
  return state.militia?.active?.attackBonus ?? 0;
}

/** Food rate penalty from an active militia (positive number = loss). */
export function getMilitiaFoodPenalty() {
  return state.militia?.active?.foodPenalty ?? 0;
}

/** Seconds until the active militia disbands (0 when inactive). */
export function getMilitiaSecsLeft() {
  const a = state.militia?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/** Seconds remaining on cooldown (0 when ready). */
export function getMilitiaCooldownSecs() {
  if (!state.militia) return 0;
  const until = state.militia.cooldownUntil ?? 0;
  return state.tick >= until ? 0 : Math.ceil((until - state.tick) / TICKS_PER_SECOND);
}

/** { ok, reason } for whether conscription is currently possible. */
export function canConscriptMilitia() {
  if ((state.age ?? 0) < MIN_AGE)           return { ok: false, reason: 'Bronze Age required' };
  if (!_isAtWar())                           return { ok: false, reason: 'No active war' };
  if (state.militia?.active)                 return { ok: false, reason: 'Already active' };
  if (getMilitiaCooldownSecs() > 0)          return { ok: false, reason: `Cooldown ${getMilitiaCooldownSecs()}s` };
  if ((state.resources.food ?? 0) < MILITIA_FOOD_COST) return { ok: false, reason: `Need ${MILITIA_FOOD_COST} food` };
  if ((state.resources.gold ?? 0) < MILITIA_GOLD_COST) return { ok: false, reason: `Need ${MILITIA_GOLD_COST} gold` };
  return { ok: true };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _isAtWar() {
  return (state.diplomacy?.empires ?? []).some(e => e.relations === 'war');
}

function _militiaSize() {
  const pop = Math.floor(state.population?.count ?? 0);
  return Math.min(Math.floor(pop / 100), MAX_SIZE);
}
