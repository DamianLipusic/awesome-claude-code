/**
 * EmpireOS — Empire Festival system (T103).
 *
 * initFestivals()    — idempotent setup; called in boot() and _newGame().
 * useFestival(type)  — validates and activates a festival.
 * festivalTick()     — expires timed festivals; called every game tick.
 * getActiveFestival()       — returns active festival object or null.
 * getFestivalSecsLeft()     — seconds remaining on timed festival.
 * getFestivalCooldownSecs() — seconds remaining on post-festival cooldown.
 */

import { state }  from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';
import { changeMorale } from './morale.js';
import { recalcRates }  from './resources.js';
import { FESTIVALS, FESTIVAL_COOLDOWN_TICKS } from '../data/festivals.js';

export function initFestivals() {
  if (state.festivals) return;   // idempotent
  state.festivals = {
    active:        null,   // { type, expiresAt? (timed) or chargesLeft? (parade) }
    cooldownUntil: 0,      // tick when post-festival cooldown expires
    totalUsed:     0,
  };
}

/** Returns the active festival object or null. */
export function getActiveFestival() {
  return state.festivals?.active ?? null;
}

/** Returns seconds remaining on a timed festival (0 if not timed or expired). */
export function getFestivalSecsLeft() {
  const active = state.festivals?.active;
  if (!active?.expiresAt) return 0;
  return Math.max(0, Math.ceil((active.expiresAt - state.tick) / 4));
}

/** Returns seconds remaining on the post-festival cooldown (0 if ready). */
export function getFestivalCooldownSecs() {
  if (!state.festivals) return 0;
  const until = state.festivals.cooldownUntil ?? 0;
  if (state.tick >= until) return 0;
  return Math.ceil((until - state.tick) / 4);
}

/**
 * Attempt to declare a festival of the given type.
 * Validates: no active festival, not on cooldown, can afford cost.
 */
export function useFestival(type) {
  if (!state.festivals) return;

  const def = FESTIVALS[type];
  if (!def) return;

  // Guard: another festival already running
  if (state.festivals.active) {
    addMessage('A festival is already underway.', 'info');
    return;
  }

  // Guard: cooldown
  const cdSecs = getFestivalCooldownSecs();
  if (cdSecs > 0) {
    addMessage(`Festival cooldown: ${cdSecs}s remaining.`, 'info');
    return;
  }

  // Guard: resources
  for (const [res, amt] of Object.entries(def.cost)) {
    if ((state.resources[res] ?? 0) < amt) {
      addMessage(`Not enough ${res} to declare ${def.name}.`, 'info');
      return;
    }
  }

  // Deduct cost
  for (const [res, amt] of Object.entries(def.cost)) {
    state.resources[res] -= amt;
  }

  // Apply immediate morale bonus
  if (def.moraleDelta) changeMorale(def.moraleDelta);

  // Build active record
  const active = { type };
  if (def.durationTicks) {
    active.expiresAt = state.tick + def.durationTicks;
  } else if (def.charges) {
    active.chargesLeft = def.charges;
  }

  state.festivals.active    = active;
  state.festivals.totalUsed = (state.festivals.totalUsed ?? 0) + 1;

  addMessage(`🎉 ${def.icon} ${def.name} declared!`, 'windfall');
  emit(Events.FESTIVAL_CHANGED, { type, started: true });
  recalcRates();
}

/**
 * Called every tick.  Expires timed festivals; the parade is expired by
 * combat.js when all charges are consumed.
 */
export function festivalTick() {
  const active = state.festivals?.active;
  if (!active) return;

  const def = FESTIVALS[active.type];
  if (!def?.durationTicks) return;  // charge-based festivals handled in combat.js

  if (state.tick >= active.expiresAt) {
    const name = def.name;
    state.festivals.active        = null;
    state.festivals.cooldownUntil = state.tick + FESTIVAL_COOLDOWN_TICKS;
    addMessage(`🎉 ${name} has ended. Next festival in 8 minutes.`, 'info');
    emit(Events.FESTIVAL_CHANGED, { ended: true, type: active.type });
    recalcRates();
  }
}
