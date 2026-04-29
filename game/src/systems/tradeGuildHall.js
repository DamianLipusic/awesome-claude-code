/**
 * EmpireOS — T190: Trade Guild Hall system.
 *
 * When the tradeGuildHall building is present:
 *   - Each open trade route grants +0.3 extra gold/s (applied in resources.js recalcRates).
 *   - Players can boost individual empire routes: costs 50 gold, grants ×1.5 income
 *     for 5 minutes (300 seconds / 1200 ticks). One boost per empire at a time.
 *
 * state.tradeGuild = { boosts: { [empireId]: expiresAtTick } }
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { recalcRates } from './resources.js';

export const GUILD_ROUTE_BONUS    = 0.3;   // extra gold/s per open trade route
export const BOOST_COST           = 50;    // gold cost per boost
export const BOOST_MULT           = 1.5;   // income multiplier during boost
export const BOOST_DURATION_TICKS = 5 * 60 * TICKS_PER_SECOND; // 1200 ticks = 5 min

// ── Init ───────────────────────────────────────────────────────────────────

export function initTradeGuildHall() {
  if (!state.tradeGuild) {
    state.tradeGuild = { boosts: {} };
  } else {
    if (!state.tradeGuild.boosts) state.tradeGuild.boosts = {};
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns true when the Trade Guild Hall building is built. */
export function isGuildActive() {
  return (state.buildings?.tradeGuildHall ?? 0) > 0;
}

/**
 * Returns the active boost expiry tick for the given empire, or 0 if none.
 */
export function getBoostExpiry(empireId) {
  return state.tradeGuild?.boosts?.[empireId] ?? 0;
}

/**
 * Seconds remaining on the boost for the given empire (0 if none/expired).
 */
export function getBoostSecs(empireId) {
  const expiry = getBoostExpiry(empireId);
  if (!expiry || state.tick >= expiry) return 0;
  return Math.ceil((expiry - state.tick) / TICKS_PER_SECOND);
}

/**
 * Returns true if the boost is currently active for the given empire.
 */
export function isBoostActive(empireId) {
  return getBoostSecs(empireId) > 0;
}

/**
 * Returns the boost multiplier for a given empire's trade routes.
 * Used by resources.js recalcRates().
 */
export function getTradeBoostMult(empireId) {
  return isBoostActive(empireId) ? BOOST_MULT : 1.0;
}

/**
 * Activate a 5-minute trade boost for an allied empire's routes.
 * Costs BOOST_COST gold. Requires: guild built, empire allied + has trade routes.
 */
export function boostTradeRoute(empireId) {
  if (!isGuildActive()) {
    return { ok: false, reason: 'Trade Guild Hall not built.' };
  }
  const emp = state.diplomacy?.empires?.find(e => e.id === empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'allied') {
    return { ok: false, reason: 'Can only boost trade routes with allied empires.' };
  }
  if ((emp.tradeRoutes ?? 0) <= 0) {
    return { ok: false, reason: 'No open trade routes with this empire.' };
  }
  if (isBoostActive(empireId)) {
    const secs = getBoostSecs(empireId);
    return { ok: false, reason: `Already boosted — ${secs}s remaining.` };
  }
  if ((state.resources.gold ?? 0) < BOOST_COST) {
    return { ok: false, reason: `Need ${BOOST_COST} gold to boost this route.` };
  }

  state.resources.gold -= BOOST_COST;
  state.tradeGuild.boosts[empireId] = state.tick + BOOST_DURATION_TICKS;

  recalcRates();
  addMessage(`🏦 Guild Boost: ${emp.id} trade routes at ×${BOOST_MULT} income for 5 min!`, 'build');
  emit(Events.TRADE_GUILD_BOOSTED, { empireId });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

/**
 * Called each tick to expire elapsed boosts.
 * Exposed for registration in main.js.
 */
export function tradeGuildTick() {
  const g = state.tradeGuild;
  if (!g?.boosts) return;

  let anyExpired = false;
  for (const [empId, expiry] of Object.entries(g.boosts)) {
    if (state.tick >= expiry) {
      delete g.boosts[empId];
      anyExpired = true;
      addMessage(`🏦 Trade route boost for ${empId} has expired.`, 'info');
    }
  }
  if (anyExpired) {
    recalcRates();
    emit(Events.TRADE_GUILD_BOOSTED, { expired: true });
    emit(Events.RESOURCE_CHANGED, {});
  }
}
