/**
 * EmpireOS — Seasons system.
 *
 * Cycles Spring → Summer → Autumn → Winter every 90 real seconds (360 ticks).
 * Season modifiers are applied to positive resource production rates in
 * resources.js recalcRates() by reading state.season and data/seasons.js.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { recalcRates } from './resources.js';
import { SEASONS } from '../data/seasons.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SEASON_DURATION = 90 * TICKS_PER_SECOND;  // 360 ticks per season

/**
 * Called once during boot. Initialises state.season for a new game,
 * or leaves existing save data intact.
 */
export function initSeasons() {
  if (!state.season) {
    state.season = {
      index: 0,  // 0=Spring, 1=Summer, 2=Autumn, 3=Winter
      tick:  0,  // ticks elapsed in current season
    };
  }
}

/**
 * Registered as a tick system. Advances season timer; triggers season change.
 */
export function seasonTick() {
  if (!state.season) return;

  state.season.tick++;

  if (state.season.tick >= SEASON_DURATION) {
    state.season.index = (state.season.index + 1) % 4;
    state.season.tick  = 0;
    recalcRates();
    const s = SEASONS[state.season.index];
    addMessage(`${s.icon} Season changed to ${s.name}. ${s.desc}`, 'season');
    emit(Events.SEASON_CHANGED, { index: state.season.index });
  }
}

/** Returns the current season definition object. */
export function currentSeason() {
  if (!state.season) return SEASONS[0];
  return SEASONS[state.season.index] ?? SEASONS[0];
}

/** Returns how many ticks remain in the current season. */
export function seasonTicksRemaining() {
  if (!state.season) return SEASON_DURATION;
  return SEASON_DURATION - state.season.tick;
}
