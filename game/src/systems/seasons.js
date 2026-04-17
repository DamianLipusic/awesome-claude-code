/**
 * EmpireOS — Seasons system.
 *
 * Cycles Spring → Summer → Autumn → Winter every 90 real seconds (360 ticks).
 * Season modifiers are applied to positive resource production rates in
 * resources.js recalcRates() by reading state.season and data/seasons.js.
 *
 * T092: A special seasonal event fires once per season at the midpoint (tick 180).
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { recalcRates } from './resources.js';
import { SEASONS } from '../data/seasons.js';
import { UNITS } from '../data/units.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { changeMorale } from './morale.js';

const SEASON_DURATION = 90 * TICKS_PER_SECOND;  // 360 ticks per season
const SEASON_MID      = Math.floor(SEASON_DURATION / 2);  // 180 ticks — mid-season event

// XP thresholds (mirrored from combat.js to avoid circular import)
const VETERAN_XP = 3;
const ELITE_XP   = 6;

/**
 * Called once during boot. Initialises state.season for a new game,
 * or leaves existing save data intact.
 */
export function initSeasons() {
  if (!state.season) {
    state.season = {
      index: 0,  // 0=Spring, 1=Summer, 2=Autumn, 3=Winter
      tick:  0,  // ticks elapsed in current season
      seasonalEventFired: false,
    };
  } else {
    // Migration guard for saves created before T092
    if (state.season.seasonalEventFired === undefined) {
      state.season.seasonalEventFired = false;
    }
  }
}

/**
 * Registered as a tick system. Advances season timer; triggers season change.
 * T092: Also fires the mid-season special event once per season.
 */
export function seasonTick() {
  if (!state.season) return;

  state.season.tick++;

  // T092: fire mid-season special event exactly once per season
  if (state.season.tick === SEASON_MID && !state.season.seasonalEventFired) {
    state.season.seasonalEventFired = true;
    _fireSeasonalEvent(state.season.index);
  }

  if (state.season.tick >= SEASON_DURATION) {
    state.season.index = (state.season.index + 1) % 4;
    state.season.tick  = 0;
    state.season.seasonalEventFired = false;  // reset for next cycle
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

// ── T092: Seasonal special events ─────────────────────────────────────────

/**
 * Fire the special event for the given season index.
 * All events are one-time immediate effects (no duration tracking needed).
 */
function _fireSeasonalEvent(seasonIndex) {
  switch (seasonIndex) {
    case 0:  // Spring — Festival
      _addCapped('food', 60);
      _addCapped('wood', 40);
      changeMorale(2);
      addMessage('🌸 Spring Festival! The people celebrate the new growth. +60 🍞 +40 🪵 +2 morale', 'windfall');
      break;

    case 1:  // Summer — Grand Tournament
      _grantTournamentXP();
      changeMorale(4);
      addMessage('🏆 Grand Tournament! Warriors compete across the empire. +1 XP to all units, +4 morale', 'windfall');
      break;

    case 2:  // Autumn — Harvest Moon
      _addCapped('food', 80);
      _addCapped('gold', 60);
      _addCapped('stone', 40);
      addMessage('🍁 Harvest Moon! Abundant yields flow into the storehouses. +80 🍞 +60 💰 +40 🪨', 'windfall');
      break;

    case 3:  // Winter — Solstice
      changeMorale(8);
      _addCapped('mana', 30);
      addMessage('🕯️ Winter Solstice! Hearth fires kindle the spirit. +8 morale, +30 ✨', 'windfall');
      break;
  }

  emit(Events.SEASONAL_EVENT, { season: seasonIndex });
  emit(Events.RESOURCE_CHANGED, {});
}

/** Add an amount to a resource, capped at its current storage cap. */
function _addCapped(res, amount) {
  state.resources[res] = Math.min(
    state.caps[res] ?? 9999,
    (state.resources[res] ?? 0) + amount,
  );
}

/**
 * Grant +1 XP to every trained unit type (Summer Tournament).
 * Promotes units that cross the veteran (3 XP) or elite (6 XP) threshold.
 */
function _grantTournamentXP() {
  if (!state.unitXP)    state.unitXP    = {};
  if (!state.unitRanks) state.unitRanks = {};

  let anyChange = false;
  for (const [unitId, count] of Object.entries(state.units)) {
    if ((count ?? 0) <= 0) continue;

    state.unitXP[unitId] = (state.unitXP[unitId] ?? 0) + 1;
    const xp   = state.unitXP[unitId];
    const name = UNITS[unitId]?.name ?? unitId;

    if (xp >= ELITE_XP && state.unitRanks[unitId] !== 'elite') {
      state.unitRanks[unitId] = 'elite';
      addMessage(`⭐⭐ ${name}s promoted to Elite rank!`, 'achievement');
      anyChange = true;
    } else if (xp >= VETERAN_XP && !state.unitRanks[unitId]) {
      state.unitRanks[unitId] = 'veteran';
      addMessage(`⭐ ${name}s promoted to Veteran rank!`, 'achievement');
      anyChange = true;
    }
  }

  if (anyChange) emit(Events.UNIT_CHANGED, {});
}
