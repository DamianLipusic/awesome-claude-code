/**
 * EmpireOS — Empire Crisis Response System (T117).
 *
 * Periodic emergencies fire every 8–12 minutes. The player has 90 seconds
 * to resolve each crisis by paying a resource cost.  If ignored, a rate
 * penalty modifier is pushed to state.randomEvents.activeModifiers for
 * 6–12 minutes depending on crisis type.
 *
 * state.crises shape:
 *   {
 *     active:          { typeId: string, expiresAt: number } | null,
 *     nextCrisisTick:  number,
 *     resolved:        number,  // total crises resolved this game
 *     failed:          number,  // total crises that applied their penalty
 *   }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { recalcRates }      from './resources.js';
import { awardPrestige }    from './prestige.js';

import { CRISIS_TYPES } from '../data/crises.js';

// ── Timing ─────────────────────────────────────────────────────────────────

const SPAWN_MIN_TICKS   = 8  * 60 * TICKS_PER_SECOND;  // 8 min
const SPAWN_MAX_TICKS   = 12 * 60 * TICKS_PER_SECOND;  // 12 min
const CRISIS_WINDOW     = 90 * TICKS_PER_SECOND;        // 90 s to respond

// ── Init ───────────────────────────────────────────────────────────────────

/** Initialise (or migrate) crisis state. Called on boot and new game. */
export function initCrises() {
  if (!state.crises) {
    state.crises = {
      active:         null,
      nextCrisisTick: state.tick + _nextInterval(),
      resolved:       0,
      failed:         0,
    };
  } else {
    if (state.crises.resolved === undefined) state.crises.resolved = 0;
    if (state.crises.failed   === undefined) state.crises.failed   = 0;
  }
}

// ── Tick ───────────────────────────────────────────────────────────────────

/** Registered as a tick system. */
export function crisisTick() {
  if (!state.crises || state.gameOver) return;
  const cs = state.crises;

  // Expire an active crisis the player ignored → apply penalty
  if (cs.active && state.tick >= cs.active.expiresAt) {
    const def = CRISIS_TYPES.find(t => t.id === cs.active.typeId);
    cs.active = null;
    cs.failed++;

    if (def && state.randomEvents) {
      state.randomEvents.activeModifiers.push({
        id:        `crisis_${def.id}`,
        resource:  def.penalty.resource,
        rateMult:  def.penalty.rateMult,
        expiresAt: state.tick + def.penalty.durationTicks,
      });
      recalcRates();
      addMessage(def.failMsg, 'danger');
    }

    cs.nextCrisisTick = state.tick + _nextInterval();
    emit(Events.CRISIS_RESOLVED, { outcome: 'failed', typeId: def?.id });
    return;
  }

  // Don't spawn while one is active, or before the schedule fires
  if (cs.active) return;
  if (state.tick < cs.nextCrisisTick) return;

  // Pick a random crisis type
  const def = CRISIS_TYPES[Math.floor(Math.random() * CRISIS_TYPES.length)];
  cs.active = { typeId: def.id, expiresAt: state.tick + CRISIS_WINDOW };

  addMessage(`${def.icon} CRISIS: ${def.name} — ${def.desc}`, 'danger');
  emit(Events.CRISIS_SPAWNED, { typeId: def.id });
}

// ── Public API ─────────────────────────────────────────────────────────────

/** True if the active crisis can be resolved with current resources. */
export function canResolveCrisis() {
  const cs = state.crises;
  if (!cs?.active) return false;
  const def = CRISIS_TYPES.find(t => t.id === cs.active.typeId);
  if (!def) return false;
  return Object.entries(def.resolveCost).every(
    ([res, amt]) => (state.resources[res] ?? 0) >= amt,
  );
}

/** Resolve the active crisis, paying its cost. Returns { ok, reason }. */
export function resolveCrisis() {
  const cs = state.crises;
  if (!cs?.active) return { ok: false, reason: 'No active crisis.' };

  const def = CRISIS_TYPES.find(t => t.id === cs.active.typeId);
  if (!def) return { ok: false, reason: 'Unknown crisis type.' };

  for (const [res, amt] of Object.entries(def.resolveCost)) {
    if ((state.resources[res] ?? 0) < amt) {
      return { ok: false, reason: `Not enough ${res} (need ${amt}).` };
    }
  }

  for (const [res, amt] of Object.entries(def.resolveCost)) {
    state.resources[res] -= amt;
  }

  const typeId = cs.active.typeId;
  cs.active = null;
  cs.resolved++;
  cs.nextCrisisTick = state.tick + _nextInterval();

  emit(Events.RESOURCE_CHANGED);
  emit(Events.CRISIS_RESOLVED, { outcome: 'resolved', typeId });

  addMessage(def.resolveMsg, 'success');
  awardPrestige(def.prestigeReward, `crisis resolved: ${def.name}`);

  return { ok: true };
}

/** Returns the active crisis definition + seconds remaining, or null. */
export function getActiveCrisis() {
  const cs = state.crises;
  if (!cs?.active) return null;
  const def = CRISIS_TYPES.find(t => t.id === cs.active.typeId);
  if (!def) return null;
  const secsLeft = Math.max(0, Math.ceil((cs.active.expiresAt - state.tick) / TICKS_PER_SECOND));
  return { def, secsLeft, canResolve: canResolveCrisis() };
}

// ── Private ────────────────────────────────────────────────────────────────

function _nextInterval() {
  return SPAWN_MIN_TICKS + Math.floor(Math.random() * (SPAWN_MAX_TICKS - SPAWN_MIN_TICKS));
}
