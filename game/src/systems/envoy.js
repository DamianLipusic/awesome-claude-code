/**
 * EmpireOS — T192: Diplomatic Envoy system.
 *
 * Dispatch a single envoy to any empire to improve relations over time.
 * Travel time: 8 minutes (1920 ticks).  Cost: 80 gold.
 * Recall refund: 40 gold (any time before arrival).
 *
 * Effect on arrival:
 *   war     → neutral   (peace + warScore reset)
 *   neutral → allied    (free alliance + recalcRates)
 *   allied  → +15 favor (capped at FAVOR_MAX)
 *
 * Only one envoy may be active at a time.
 *
 * state.envoy = {
 *   active: { empireId, arrivalTick, sentAtTick } | null,
 *   totalDispatched: number,
 *   totalArrived:    number,
 * }
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { EMPIRES } from '../data/empires.js';
import { FAVOR_MAX } from './diplomacy.js';
import { recalcRates } from './resources.js';

export const ENVOY_COST          = 80;                              // gold to dispatch
export const ENVOY_TRAVEL_TICKS  = 8 * 60 * TICKS_PER_SECOND;     // 1920 ticks = 8 min
export const ENVOY_RECALL_REFUND = 40;                              // gold returned on recall

// ── Init ───────────────────────────────────────────────────────────────────

export function initEnvoy() {
  if (!state.envoy) {
    state.envoy = { active: null, totalDispatched: 0, totalArrived: 0 };
  } else {
    if (state.envoy.totalDispatched === undefined) state.envoy.totalDispatched = 0;
    if (state.envoy.totalArrived   === undefined) state.envoy.totalArrived   = 0;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** True when an envoy is currently travelling. */
export function isEnvoyActive() {
  return !!state.envoy?.active;
}

/**
 * Returns display info for the diplomacy panel.
 * { active, travelSecsLeft, progressPct }
 */
export function getEnvoyInfo() {
  const active = state.envoy?.active ?? null;
  if (!active) return { active: null, travelSecsLeft: 0, progressPct: 0 };
  const secsLeft  = Math.max(0, Math.ceil((active.arrivalTick - state.tick) / TICKS_PER_SECOND));
  const progressPct = Math.max(0, Math.min(100, Math.round(
    (state.tick - active.sentAtTick) / ENVOY_TRAVEL_TICKS * 100
  )));
  return { active, travelSecsLeft: secsLeft, progressPct };
}

/**
 * Dispatch an envoy to the given empire.
 * Returns { ok, reason? }
 */
export function dispatchEnvoy(empireId) {
  if (isEnvoyActive())
    return { ok: false, reason: 'An envoy is already on a diplomatic mission.' };

  const emp = state.diplomacy?.empires?.find(e => e.id === empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };

  const gold = state.resources?.gold ?? 0;
  if (gold < ENVOY_COST)
    return { ok: false, reason: `Need ${ENVOY_COST} gold to dispatch an envoy.` };

  const def = EMPIRES[empireId];
  state.resources.gold -= ENVOY_COST;
  state.envoy.active = {
    empireId,
    arrivalTick: state.tick + ENVOY_TRAVEL_TICKS,
    sentAtTick:  state.tick,
  };
  state.envoy.totalDispatched++;

  emit(Events.ENVOY_DISPATCHED, { empireId });
  emit(Events.RESOURCE_CHANGED, {});
  const travelMins = Math.ceil(ENVOY_TRAVEL_TICKS / TICKS_PER_SECOND / 60);
  addMessage(`✉️ Envoy dispatched to ${def?.name ?? empireId}. Arrives in ~${travelMins} min.`, 'info');
  return { ok: true };
}

/**
 * Recall the active envoy, refunding ENVOY_RECALL_REFUND gold.
 * Returns { ok, reason? }
 */
export function recallEnvoy() {
  if (!isEnvoyActive())
    return { ok: false, reason: 'No active envoy to recall.' };

  const { empireId } = state.envoy.active;
  const def = EMPIRES[empireId];
  const goldCap = state.caps?.gold ?? 500;

  state.resources.gold = Math.min(goldCap, (state.resources.gold ?? 0) + ENVOY_RECALL_REFUND);
  state.envoy.active = null;

  emit(Events.ENVOY_RECALLED, { empireId });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`✉️ Envoy recalled from ${def?.name ?? empireId}. Refunded ${ENVOY_RECALL_REFUND} gold.`, 'info');
  return { ok: true };
}

// ── Tick ───────────────────────────────────────────────────────────────────

/** Registered as a tick system — checks for envoy arrival each tick. */
export function envoyTick() {
  const active = state.envoy?.active;
  if (!active || state.tick < active.arrivalTick) return;

  const { empireId } = active;
  const emp = state.diplomacy?.empires?.find(e => e.id === empireId);
  const def = EMPIRES[empireId];

  state.envoy.active = null;
  state.envoy.totalArrived++;

  if (!emp) {
    addMessage(`✉️ Envoy returned — ${def?.name ?? empireId} could not be reached.`, 'info');
    emit(Events.ENVOY_ARRIVED, { empireId, effect: 'none' });
    return;
  }

  let effect = '';
  if (emp.relations === 'war') {
    emp.relations = 'neutral';
    emp.warScore  = 0;
    effect = 'opened peace negotiations — now Neutral';
    recalcRates();
    emit(Events.DIPLOMACY_CHANGED, { empireId, relations: 'neutral', reason: 'envoy' });
  } else if (emp.relations === 'neutral') {
    emp.relations = 'allied';
    effect = 'forged an alliance — now Allied';
    recalcRates();
    emit(Events.DIPLOMACY_CHANGED, { empireId, relations: 'allied', reason: 'envoy' });
  } else {
    const gain = 15;
    emp.favor = Math.min(FAVOR_MAX, (emp.favor ?? 0) + gain);
    effect = `strengthened the alliance — +${gain} favor`;
    emit(Events.ALLIANCE_FAVOR_CHANGED, { empireId, favor: emp.favor });
  }

  emit(Events.ENVOY_ARRIVED, { empireId, effect });
  addMessage(`✉️ Envoy arrived at ${def?.name ?? empireId}: ${effect}!`, 'quest');
}
