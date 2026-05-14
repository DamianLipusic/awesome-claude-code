/**
 * EmpireOS — Market Economy Cycle System (T245).
 *
 * The market periodically shifts between Boom and Bust phases. Each phase
 * lasts 5–8 minutes and affects all buy/sell prices. Between phases there is
 * a 2–3 minute neutral transition window.
 *
 * Boom  — sell prices ×1.15, buy prices ×0.85 (strong economy)
 * Bust  — sell prices ×0.85, buy prices ×1.15 (weak economy)
 *
 * Requires at least one Market building to enter a phase.
 *
 * state.economyCycle = {
 *   phase:        'boom' | 'bust' | null,
 *   phaseEndsAt:  tick,
 *   nextPhaseTick: tick,
 *   nextPhase:    'boom' | 'bust',
 *   totalCycles:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const PHASE_MIN        = 5 * 60 * TICKS_PER_SECOND;   // 5 min minimum phase duration
const PHASE_RANGE      = 3 * 60 * TICKS_PER_SECOND;   // +0–3 min jitter
const TRANSITION_MIN   = 2 * 60 * TICKS_PER_SECOND;   // 2 min neutral gap
const TRANSITION_RANGE = 1 * 60 * TICKS_PER_SECOND;   // +0–1 min jitter

export const BOOM_SELL_MULT = 1.15;
export const BOOM_BUY_MULT  = 0.85;
export const BUST_SELL_MULT = 0.85;
export const BUST_BUY_MULT  = 1.15;

// ── Init ──────────────────────────────────────────────────────────────

export function initEconomyCycle() {
  if (!state.economyCycle) {
    state.economyCycle = {
      phase:         null,
      phaseEndsAt:   0,
      nextPhaseTick: _nextTransitionTick(),
      nextPhase:     Math.random() < 0.5 ? 'boom' : 'bust',
      totalCycles:   0,
    };
  }
  if (state.economyCycle.nextPhaseTick === undefined) state.economyCycle.nextPhaseTick = _nextTransitionTick();
  if (state.economyCycle.nextPhase     === undefined) state.economyCycle.nextPhase     = 'boom';
  if (state.economyCycle.totalCycles   === undefined) state.economyCycle.totalCycles   = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────

export function economyCycleTick() {
  const ec = state.economyCycle;
  if (!ec) return;
  if ((state.buildings?.market ?? 0) < 1) return;

  // Expire active phase
  if (ec.phase !== null) {
    if (state.tick >= ec.phaseEndsAt) {
      const ended = ec.phase;
      ec.phase         = null;
      ec.nextPhaseTick = _nextTransitionTick();
      ec.nextPhase     = ended === 'boom' ? 'bust' : 'boom';
      emit(Events.ECONOMY_CYCLE_CHANGED, { ended });
      const icon = ended === 'boom' ? '📈' : '📉';
      addMessage(`${icon} The ${ended === 'boom' ? 'economic boom' : 'market downturn'} has ended. Markets return to normal.`, 'info');
    }
    return;
  }

  // Check if next phase should start
  if (state.tick < ec.nextPhaseTick) return;

  ec.phase       = ec.nextPhase;
  ec.phaseEndsAt = state.tick + PHASE_MIN + Math.floor(Math.random() * PHASE_RANGE);
  ec.totalCycles = (ec.totalCycles ?? 0) + 1;

  emit(Events.ECONOMY_CYCLE_CHANGED, { started: ec.phase });
  if (ec.phase === 'boom') {
    addMessage('📈 Economic Boom! Markets are thriving — sell prices +15%, buy prices −15%.', 'windfall');
  } else {
    addMessage('📉 Market Downturn. Trade slows — sell prices −15%, buy prices +15%.', 'info');
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/** Returns 'boom', 'bust', or null. */
export function getEconomyCyclePhase() {
  return state.economyCycle?.phase ?? null;
}

/**
 * Returns { sellMult, buyMult } based on the current phase.
 * Both are 1.0 when neutral.
 */
export function getEconomyCycleMults() {
  const phase = state.economyCycle?.phase ?? null;
  if (phase === 'boom') return { sellMult: BOOM_SELL_MULT, buyMult: BOOM_BUY_MULT };
  if (phase === 'bust') return { sellMult: BUST_SELL_MULT, buyMult: BUST_BUY_MULT };
  return { sellMult: 1.0, buyMult: 1.0 };
}

/** Seconds remaining in the current phase (0 if neutral). */
export function getEconomyCycleSecsLeft() {
  const ec = state.economyCycle;
  if (!ec?.phase) return 0;
  return Math.max(0, Math.ceil((ec.phaseEndsAt - state.tick) / TICKS_PER_SECOND));
}

/** Seconds until the next phase begins (0 if a phase is already active). */
export function getEconomyCycleNextSecs() {
  const ec = state.economyCycle;
  if (!ec || ec.phase !== null) return 0;
  return Math.max(0, Math.ceil((ec.nextPhaseTick - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ────────────────────────────────────────────────

function _nextTransitionTick() {
  return state.tick + TRANSITION_MIN + Math.floor(Math.random() * TRANSITION_RANGE);
}