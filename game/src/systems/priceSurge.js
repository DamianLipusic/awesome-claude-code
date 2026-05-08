/**
 * EmpireOS — Market Price Surge System (T232).
 *
 * Every 12–15 minutes, the market enters a Price Surge for 3 minutes.
 * While active, all resource sell orders yield 2× gold.
 * A bright orange banner appears at the top of the Market panel.
 *
 * The surge only spawns when the player has at least one Market building.
 *
 * state.priceSurge = {
 *   active:        { expiresAt: tick } | null,
 *   nextSurgeTick: tick,
 *   totalSurges:   number,
 * }
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SURGE_DURATION     = 3  * 60 * TICKS_PER_SECOND;  // 3 min
const SPAWN_MIN          = 12 * 60 * TICKS_PER_SECOND;  // 12 min minimum interval
const SPAWN_RANGE        = 3  * 60 * TICKS_PER_SECOND;  // +0–3 min random jitter
export const SURGE_SELL_MULT = 2;                        // 2× sell gold while active

// ── Init ──────────────────────────────────────────────────────────────────

export function initPriceSurge() {
  if (!state.priceSurge) {
    state.priceSurge = {
      active:        null,
      nextSurgeTick: _nextSpawnTick(),
      totalSurges:   0,
    };
  }
  if (state.priceSurge.nextSurgeTick === undefined) {
    state.priceSurge.nextSurgeTick = _nextSpawnTick();
  }
  if (state.priceSurge.totalSurges === undefined) {
    state.priceSurge.totalSurges = 0;
  }
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function priceSurgeTick() {
  if (!state.priceSurge) return;

  const ps = state.priceSurge;

  if (ps.active) {
    if (state.tick >= ps.active.expiresAt) {
      ps.active          = null;
      ps.nextSurgeTick   = _nextSpawnTick();
      emit(Events.PRICE_SURGE_CHANGED, { ended: true });
      addMessage('📉 Market price surge has ended. Sell prices return to normal.', 'market');
    }
    return;
  }

  // Only spawn when player has a market building
  if (state.tick >= ps.nextSurgeTick && (state.buildings?.market ?? 0) >= 1) {
    ps.active       = { expiresAt: state.tick + SURGE_DURATION };
    ps.totalSurges  = (ps.totalSurges ?? 0) + 1;
    emit(Events.PRICE_SURGE_CHANGED, { started: true });
    addMessage('📈 Market Price Surge! All sell orders yield ×2 gold for 3 minutes!', 'market');
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** True when a price surge is currently active. */
export function isPriceSurgeActive() {
  return !!(state.priceSurge?.active);
}

/** Seconds remaining in the current surge (0 when inactive). */
export function getPriceSurgeSecsLeft() {
  const a = state.priceSurge?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/** Seconds until the next surge (0 when active). */
export function getPriceSurgeNextSecs() {
  if (state.priceSurge?.active) return 0;
  const next = state.priceSurge?.nextSurgeTick ?? 0;
  return state.tick >= next ? 0 : Math.ceil((next - state.tick) / TICKS_PER_SECOND);
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}
