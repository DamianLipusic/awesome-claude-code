/**
 * EmpireOS — War Exhaustion System (T175).
 *
 * Tracks combat intensity. Each battle raises exhaustion level (0–100).
 * Exhaustion decays passively over time. High exhaustion penalises resource
 * production, discouraging non-stop warfare.
 *
 * Penalty tiers (applied in resources.js recalcRates):
 *   0–24  : none
 *   25–49 : −0.3 gold/s
 *   50–74 : −0.8 gold/s, −0.6 food/s
 *   75–100: −1.5 gold/s, −1.0 food/s, −0.5 iron/s
 *
 * Recovery: 1 point per 20 ticks (~5 seconds real-time).
 * Each battle adds GAIN_PER_BATTLE (15) exhaustion.
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { recalcRates }  from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const GAIN_PER_BATTLE = 15;
const MAX_EXHAUSTION  = 100;
const DECAY_TICKS     = 20;   // 1 point recovered every 20 ticks ≈ 5 s

export function initWarExhaustion() {
  state.warExhaustion = { level: 0, totalBattles: 0 };
}

/**
 * Called from combat.js after every attack (win or loss).
 */
export function addWarExhaustion() {
  if (!state.warExhaustion) initWarExhaustion();
  const prev = state.warExhaustion.level;
  state.warExhaustion.level = Math.min(MAX_EXHAUSTION, prev + GAIN_PER_BATTLE);
  state.warExhaustion.totalBattles++;
  recalcRates();
  emit(Events.WAR_EXHAUSTION_CHANGED, { level: state.warExhaustion.level });
}

/**
 * Called each tick. Decays exhaustion passively.
 */
export function warExhaustionTick() {
  if (!state.warExhaustion || state.warExhaustion.level <= 0) return;
  if (state.tick % DECAY_TICKS !== 0) return;
  const prev = state.warExhaustion.level;
  state.warExhaustion.level = Math.max(0, prev - 1);
  // Recalc rates and notify every 4 decay steps (every 80 ticks ≈ 20 s)
  // to avoid per-tick recalcRates calls but keep HUD responsive.
  if (state.tick % (DECAY_TICKS * 4) === 0 || state.warExhaustion.level === 0) {
    recalcRates();
    emit(Events.WAR_EXHAUSTION_CHANGED, { level: state.warExhaustion.level });
  }
}

/**
 * Returns the current exhaustion level (0–100).
 */
export function getExhaustionLevel() {
  return state.warExhaustion?.level ?? 0;
}

/**
 * Returns penalty tier for the given level:
 *   0 = none, 1 = mild, 2 = moderate, 3 = severe
 */
export function getExhaustionTier(level = getExhaustionLevel()) {
  if (level >= 75) return 3;
  if (level >= 50) return 2;
  if (level >= 25) return 1;
  return 0;
}

/** Human-readable label for the current tier. */
export const EXHAUSTION_LABELS = ['', 'Battle-Weary', 'War-Strained', 'Exhausted'];
