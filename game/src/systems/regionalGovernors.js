/**
 * T206: Regional Governors System
 *
 * Appoint governors to administer territory sectors, each generating passive
 * gold income. Governor slots unlock as territory expands.
 *
 * state.governors = {
 *   active:         number,  // currently active governors
 *   totalAppointed: number,  // lifetime total appointed
 * } | null
 *
 * Slots: 1 per 8 player tiles, max 5.
 * Income: +1.0 gold/s per active governor (added in recalcRates).
 * Appoint cost: 150 gold. Dismiss is free.
 */

import { state }    from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';

export const GOVERNOR_APPOINT_COST = 150;  // gold
export const GOVERNOR_INCOME       = 1.0;  // gold/s per governor
export const GOVERNOR_TILES_PER_SLOT = 8;  // player tiles needed per slot
export const GOVERNOR_MAX_SLOTS     = 5;

export function initGovernors() {
  if (!state.governors) {
    state.governors = { active: 0, totalAppointed: 0 };
  }
}

export function getGovernors() {
  return state.governors ?? { active: 0, totalAppointed: 0 };
}

/** How many governor slots are currently available based on territory. */
export function getGovernorMaxSlots() {
  if (!state.map) return 0;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  return Math.min(GOVERNOR_MAX_SLOTS, Math.floor(playerTiles / GOVERNOR_TILES_PER_SLOT));
}

/** Total passive gold/s from all active governors. */
export function getGovernorIncome() {
  return (state.governors?.active ?? 0) * GOVERNOR_INCOME;
}

/**
 * Appoint one governor.
 * Returns { ok: bool, reason?: string }
 */
export function appointGovernor() {
  if (!state.governors) initGovernors();
  const gov = state.governors;
  const maxSlots = getGovernorMaxSlots();

  if (maxSlots === 0) {
    return { ok: false, reason: `Capture ${GOVERNOR_TILES_PER_SLOT} tiles to unlock governor slots.` };
  }
  if (gov.active >= maxSlots) {
    return { ok: false, reason: `All ${maxSlots} governor slots are filled.` };
  }
  if ((state.resources.gold ?? 0) < GOVERNOR_APPOINT_COST) {
    return { ok: false, reason: `Need ${GOVERNOR_APPOINT_COST} gold to appoint a governor.` };
  }

  state.resources.gold -= GOVERNOR_APPOINT_COST;
  gov.active++;
  gov.totalAppointed++;

  addMessage(`🏛️ Regional Governor appointed. +${GOVERNOR_INCOME} gold/s per governor (${gov.active} active).`, 'achievement');
  emit(Events.GOVERNORS_CHANGED, { active: gov.active });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

/**
 * Dismiss one governor (free).
 * Returns { ok: bool, reason?: string }
 */
export function dismissGovernor() {
  if (!state.governors || state.governors.active <= 0) {
    return { ok: false, reason: 'No active governors to dismiss.' };
  }
  state.governors.active--;
  addMessage(`🏛️ Governor dismissed. ${state.governors.active} governor${state.governors.active !== 1 ? 's' : ''} remaining.`, 'info');
  emit(Events.GOVERNORS_CHANGED, { active: state.governors.active });
  return { ok: true };
}
