/**
 * EmpireOS — Ancient Monument System (T176).
 *
 * When the unique `ancientMonument` building is constructed (Medieval Age),
 * every DEDICATION_INTERVAL ticks a "Dedication Ceremony" fires, awarding:
 *   +100 gold, +50 mana, +25 prestige, and a story log entry.
 *
 * The first ceremony is delayed by one full interval after construction.
 * State: state.monument = { nextDedicationTick, totalDedications } | null
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';
import { awardPrestige } from './prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const DEDICATION_INTERVAL = 8 * 60 * TICKS_PER_SECOND;   // 8 minutes

export function initMonument() {
  if (!state.monument) {
    state.monument = {
      nextDedicationTick: state.tick + DEDICATION_INTERVAL,
      totalDedications:   0,
    };
  }
}

/**
 * Called each tick. Fires dedication ceremony when the monument is built
 * and the timer has elapsed.
 */
export function monumentTick() {
  if (!(state.buildings?.ancientMonument >= 1)) return;
  if (!state.monument) initMonument();

  if (state.tick < state.monument.nextDedicationTick) return;

  // Award ceremony bonuses
  const goldAmt = 100;
  const manaAmt = 50;
  state.resources.gold = Math.min(state.caps.gold, (state.resources.gold ?? 0) + goldAmt);
  state.resources.mana = Math.min(state.caps.mana, (state.resources.mana ?? 0) + manaAmt);

  state.monument.nextDedicationTick = state.tick + DEDICATION_INTERVAL;
  state.monument.totalDedications++;

  awardPrestige(25, 'monument');
  emit(Events.MONUMENT_DEDICATION, { total: state.monument.totalDedications });
  emit(Events.RESOURCE_CHANGED, {});

  addMessage(
    `🏛️ Dedication Ceremony! Citizens gather at the Ancient Monument — +${goldAmt} gold, +${manaAmt} mana, +25 prestige.`,
    'windfall',
  );
}

/**
 * Called from a BUILDING_CHANGED listener in main.js when ancientMonument
 * is first constructed. Awards a one-time morale boost.
 */
export function onMonumentBuilt() {
  initMonument();
}
