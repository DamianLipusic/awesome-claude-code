/**
 * EmpireOS — Tribute Demand System (T166).
 *
 * After capturing an AI empire's faction capital, the player may demand tribute.
 * Cost: 20 prestige. Payment: 40 gold every 90 seconds for 6 instalments (240g total).
 * One-time per empire per game. Allied empires drop to neutral when tribute is demanded.
 *
 * state.tributes = {
 *   capturedCapitals: { [empireId]: tick },        // set on faction capital capture
 *   demanded: {
 *     [empireId]: { nextPaymentTick, paymentsLeft, totalPaid }
 *   },
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { EMPIRES }          from '../data/empires.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

export const TRIBUTE_GOLD       = 40;
export const TRIBUTE_INTERVAL   = 90 * TICKS_PER_SECOND;   // 360 ticks = 90 s
export const TRIBUTE_PAYMENTS   = 6;                        // 240 gold total
export const TRIBUTE_PRESTIGE   = 20;                       // cost to demand

// ── Public API ──────────────────────────────────────────────────────────────

export function initTributes() {
  if (!state.tributes) {
    state.tributes = { capturedCapitals: {}, demanded: {} };
  }
  if (!state.tributes.capturedCapitals) state.tributes.capturedCapitals = {};
  if (!state.tributes.demanded)         state.tributes.demanded         = {};
}

/**
 * Per-tick: process scheduled tribute payments.
 */
export function tributeTick() {
  if (!state.tributes) return;

  const demanded = state.tributes.demanded;

  for (const [empireId, tribute] of Object.entries(demanded)) {
    if (tribute.paymentsLeft <= 0) continue;
    if (state.tick < tribute.nextPaymentTick) continue;

    // Process one payment
    const goldCap       = state.caps?.gold ?? 500;
    state.resources.gold = Math.min(goldCap, (state.resources.gold ?? 0) + TRIBUTE_GOLD);
    tribute.totalPaid    += TRIBUTE_GOLD;
    tribute.paymentsLeft -= 1;
    tribute.nextPaymentTick = state.tick + TRIBUTE_INTERVAL;

    const empName = EMPIRES[empireId]?.name ?? empireId;

    if (tribute.paymentsLeft > 0) {
      addMessage(
        `💰 ${empName} paid ${TRIBUTE_GOLD}g tribute. (${tribute.paymentsLeft} payments remaining)`,
        'windfall',
      );
    } else {
      // Final payment — tribute obligation fulfilled
      addMessage(
        `📜 ${empName} has fulfilled their tribute obligation. Relations restored to neutral.`,
        'info',
      );
      const emp = state.diplomacy?.empires?.find(e => e.id === empireId);
      if (emp && emp.relations !== 'war') emp.relations = 'neutral';
      emit(Events.DIPLOMACY_CHANGED, { empireId });
    }

    emit(Events.TRIBUTE_CHANGED,  { empireId, paymentsLeft: tribute.paymentsLeft });
    emit(Events.RESOURCE_CHANGED, {});
  }
}

/**
 * Called by combat._victory() when a faction capital is captured.
 * Marks the empire as tribute-eligible.
 */
export function recordCapturedCapital(empireId) {
  if (!empireId) return;
  if (!state.tributes) initTributes();
  state.tributes.capturedCapitals[empireId] = state.tick;
}

/**
 * Demand tribute from an empire whose capital was captured.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function demandTribute(empireId) {
  if (!state.tributes) return { ok: false, reason: 'System not initialised.' };

  if (!state.tributes.capturedCapitals?.[empireId])
    return { ok: false, reason: 'You have not captured their faction capital.' };

  const existing = state.tributes.demanded[empireId];

  if (existing && existing.paymentsLeft > 0)
    return { ok: false, reason: 'This empire is already paying tribute.' };

  // Once fully paid, cannot be demanded again
  if (existing && existing.totalPaid > 0)
    return { ok: false, reason: 'This empire has already fulfilled a tribute obligation.' };

  const score = state.prestige?.score ?? 0;
  if (score < TRIBUTE_PRESTIGE)
    return { ok: false, reason: `Need ${TRIBUTE_PRESTIGE} prestige to demand tribute.` };

  state.prestige.score -= TRIBUTE_PRESTIGE;

  state.tributes.demanded[empireId] = {
    nextPaymentTick: state.tick + TRIBUTE_INTERVAL,
    paymentsLeft:    TRIBUTE_PAYMENTS,
    totalPaid:       0,
  };

  // Allies drop to neutral — demanding tribute strains the relationship
  const emp = state.diplomacy?.empires?.find(e => e.id === empireId);
  if (emp?.relations === 'allied') {
    emp.relations = 'neutral';
    emit(Events.DIPLOMACY_CHANGED, { empireId });
  }

  const empName = EMPIRES[empireId]?.name ?? empireId;
  addMessage(
    `📜 Tribute demanded! ${empName} will pay ${TRIBUTE_GOLD}g every 90s for ${TRIBUTE_PAYMENTS} instalments.`,
    'windfall',
  );
  emit(Events.TRIBUTE_CHANGED, { empireId, started: true });
  return { ok: true };
}

/** Returns tribute state for a given empire, or null. */
export function getTributeStatus(empireId) {
  return state.tributes?.demanded?.[empireId] ?? null;
}

/** Returns true if the player has captured this empire's faction capital. */
export function hasCapturedCapital(empireId) {
  return !!(state.tributes?.capturedCapitals?.[empireId]);
}
