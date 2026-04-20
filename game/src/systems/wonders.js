/**
 * EmpireOS — Wonder Projects system (T133).
 *
 * initWonders()        — idempotent setup; called in boot() and _newGame().
 * wonderTick()         — advances build timer; called every game tick.
 * startWonder(id)      — validates + starts construction; costs resources.
 * getWonderProgress()  — returns { pct, secsLeft } for active build.
 * getCompletedWonder() — returns the wonder def for the completed wonder or null.
 * isWonderBuilding()   — true while construction is in progress.
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';
import { changeMorale } from './morale.js';
import { recalcRates }  from './resources.js';
import { WONDERS }      from '../data/wonders.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Public API ─────────────────────────────────────────────────────────────

export function initWonders() {
  if (state.wonder) return;
  state.wonder = {
    buildingId:   null,  // wonder id currently under construction
    startTick:    0,
    endsAt:       0,
    completedId:  null,  // id of the completed wonder (null if none)
  };
}

export function wonderTick() {
  if (!state.wonder?.buildingId) return;
  if (state.tick >= state.wonder.endsAt) {
    _completeWonder();
  }
}

/**
 * Returns build progress (0–1) and seconds remaining, or null if not building.
 */
export function getWonderProgress() {
  if (!state.wonder?.buildingId) return null;
  const def      = WONDERS[state.wonder.buildingId];
  const elapsed  = state.tick - state.wonder.startTick;
  const total    = def.buildTicks;
  const pct      = Math.min(1, elapsed / total);
  const ticksLeft = Math.max(0, state.wonder.endsAt - state.tick);
  return { pct, secsLeft: Math.ceil(ticksLeft / TICKS_PER_SECOND) };
}

/** Returns the def of the completed wonder, or null. */
export function getCompletedWonder() {
  const id = state.wonder?.completedId;
  return id ? WONDERS[id] : null;
}

/** True while a wonder is being built. */
export function isWonderBuilding() {
  return !!(state.wonder?.buildingId);
}

/**
 * Attempt to start construction of a wonder.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function startWonder(wonderId) {
  const def = WONDERS[wonderId];
  if (!def) return { ok: false, reason: 'Unknown wonder.' };

  if (!state.wonder) initWonders();

  if (state.wonder.completedId)
    return { ok: false, reason: 'You have already built a Wonder this game.' };
  if (state.wonder.buildingId)
    return { ok: false, reason: 'A Wonder is already under construction.' };

  // Age check
  if ((state.age ?? 0) < (def.requires?.age ?? 0))
    return { ok: false, reason: `Requires ${def.requires.age === 3 ? 'Medieval' : 'Iron'} Age.` };

  // Tech check
  if (def.requires?.tech && !state.techs?.[def.requires.tech])
    return { ok: false, reason: `Requires the ${def.requires.tech} technology.` };

  // Affordability
  for (const [res, amt] of Object.entries(def.cost)) {
    if ((state.resources[res] ?? 0) < amt)
      return { ok: false, reason: `Need ${amt} ${res}.` };
  }

  // Deduct cost
  for (const [res, amt] of Object.entries(def.cost)) {
    state.resources[res] -= amt;
  }

  state.wonder.buildingId = wonderId;
  state.wonder.startTick  = state.tick;
  state.wonder.endsAt     = state.tick + def.buildTicks;

  addMessage(`🏗️ Construction begins on the ${def.icon} ${def.name}! Completes in 4 minutes.`, 'info');
  emit(Events.WONDER_CHANGED, { phase: 'started', wonderId });
  emit(Events.RESOURCE_CHANGED, {});

  return { ok: true };
}

// ── Internal ───────────────────────────────────────────────────────────────

function _completeWonder() {
  const id  = state.wonder.buildingId;
  const def = WONDERS[id];

  state.wonder.buildingId  = null;
  state.wonder.completedId = id;

  // Apply one-time morale bonus for colosseum
  if (id === 'colosseum') {
    changeMorale(10, 'Wonder of the ages — the Grand Colosseum is complete!');
  }

  // Rate bonuses (grand_bazaar gold, tower_of_babel mana) applied in recalcRates()
  recalcRates();

  addMessage(`🎉 ${def.icon} ${def.name} is complete! ${def.bonusLabel}`, 'achievement');
  emit(Events.WONDER_CHANGED, { phase: 'completed', wonderId: id });
  emit(Events.RESOURCE_CHANGED, {});
}
