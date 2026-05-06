/**
 * EmpireOS — T211: Imperial Reputation System.
 *
 * Tracks a 0-100 honor/fear score for the player empire.
 *   Noble  (≥70): +8% market sell prices, +15% gift acceptance
 *   Feared (≤30): +15% raid loot, 25% faster barbarian spawns
 *   Neutral (31-69): no modifiers
 *
 * Score changes on diplomatic and military actions; see changeReputation().
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

export const NOBLE_THRESHOLD  = 70;
export const FEARED_THRESHOLD = 30;
const MAX_HISTORY = 10;

export function initReputation() {
  if (!state.reputation) {
    state.reputation = { score: 50, history: [] };
  }
}

export function getReputationScore() {
  return state.reputation?.score ?? 50;
}

export function getReputationTier() {
  const s = getReputationScore();
  if (s >= NOBLE_THRESHOLD)  return 'noble';
  if (s <= FEARED_THRESHOLD) return 'feared';
  return 'neutral';
}

export function changeReputation(delta, reason) {
  if (!state.reputation) return;
  const prev = state.reputation.score;
  state.reputation.score = Math.max(0, Math.min(100, prev + delta));
  state.reputation.history.unshift({ tick: state.tick, delta, reason });
  if (state.reputation.history.length > MAX_HISTORY) state.reputation.history.length = MAX_HISTORY;
  emit(Events.REPUTATION_CHANGED, { score: state.reputation.score, delta, reason });
}

/** +8% market sell prices when Noble. */
export function getReputationSellBonus() {
  return getReputationTier() === 'noble' ? 1.08 : 1.0;
}

/** +15% raid loot when Feared. */
export function getReputationRaidBonus() {
  return getReputationTier() === 'feared' ? 1.15 : 1.0;
}

/** 0.75 when Feared (25% faster barbarian spawns); 1.0 otherwise. */
export function getReputationSpawnMult() {
  return getReputationTier() === 'feared' ? 0.75 : 1.0;
}
