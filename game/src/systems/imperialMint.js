/**
 * EmpireOS — T191: Imperial Mint system.
 *
 * When the imperialMint building is present:
 *   - Passive +0.3 gold/s (handled in resources.js via buildings.production).
 *   - Once per season the player may convert surplus wood, stone, or iron into
 *     gold at fixed rates, up to MINT_CONVERSION_MAX gold per operation.
 *
 * Exchange rates (gold per 1 unit of resource):
 *   wood  × 1.5   stone × 2.0   iron × 3.0
 *
 * state.mint = { usedThisSeason: false, totalConverted: 0 }
 * usedThisSeason resets to false on each SEASON_CHANGED event.
 */

import { state } from '../core/state.js';
import { on, emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';

export const MINT_RATES = Object.freeze({
  wood:  1.5,
  stone: 2.0,
  iron:  3.0,
});

export const MINT_CONVERSION_MAX = 150;  // max gold gained per conversion

// ── Init ───────────────────────────────────────────────────────────────────

export function initImperialMint() {
  if (!state.mint) {
    state.mint = { usedThisSeason: false, totalConverted: 0 };
  } else {
    if (state.mint.usedThisSeason === undefined) state.mint.usedThisSeason = false;
    if (state.mint.totalConverted === undefined) state.mint.totalConverted = 0;
  }
  on(Events.SEASON_CHANGED, _onSeasonChanged);
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns true when the Imperial Mint building is built. */
export function isMintActive() {
  return (state.buildings?.imperialMint ?? 0) > 0;
}

/** Returns display info used by the market panel. */
export function getMintInfo() {
  return {
    active:         isMintActive(),
    canConvert:     isMintActive() && !(state.mint?.usedThisSeason ?? false),
    usedThisSeason: state.mint?.usedThisSeason ?? false,
    totalConverted: state.mint?.totalConverted ?? 0,
    rates:          MINT_RATES,
    maxGold:        MINT_CONVERSION_MAX,
  };
}

/**
 * Convert up to `amount` units of `resourceId` into gold.
 * Actual amount used is capped by available stock and MINT_CONVERSION_MAX.
 * Returns { ok, goldGained?, resUsed?, reason? }
 */
export function performMintConversion(resourceId, amount) {
  if (!isMintActive())
    return { ok: false, reason: 'Imperial Mint not built.' };
  if (state.mint?.usedThisSeason)
    return { ok: false, reason: 'Already converted this season. Wait for the next season.' };

  const rate = MINT_RATES[resourceId];
  if (!rate)
    return { ok: false, reason: `Cannot mint ${resourceId}.` };

  const available = Math.floor(state.resources?.[resourceId] ?? 0);
  if (available <= 0)
    return { ok: false, reason: `No ${resourceId} available to convert.` };

  // Gold gained is limited by: requested units × rate, resource stock, and cap
  const goldFromAmount = Math.floor(Math.min(amount, available) * rate);
  const goldGained     = Math.min(goldFromAmount, MINT_CONVERSION_MAX);
  const resUsed        = Math.ceil(goldGained / rate);

  if (goldGained <= 0)
    return { ok: false, reason: `Not enough ${resourceId} to convert (need at least 1 unit).` };

  state.resources[resourceId] = Math.max(0, available - resUsed);
  const goldCap = state.caps?.gold ?? 500;
  state.resources.gold = Math.min(goldCap, (state.resources.gold ?? 0) + goldGained);
  state.mint.usedThisSeason  = true;
  state.mint.totalConverted += goldGained;

  emit(Events.MINT_CONVERSION, { resource: resourceId, amount: resUsed, goldGained });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏛️ Imperial Mint: Coined ${resUsed} ${resourceId} into ${goldGained} gold!`, 'build');
  return { ok: true, goldGained, resUsed };
}

// ── Internal ───────────────────────────────────────────────────────────────

function _onSeasonChanged() {
  if (state.mint) state.mint.usedThisSeason = false;
}
