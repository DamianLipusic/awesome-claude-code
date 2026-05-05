/**
 * EmpireOS — T199: Imperial Tax Collector.
 *
 * Once per season, the player can collect imperial taxes from their controlled
 * territory. Three rate tiers offer a gold vs. morale trade-off:
 *
 *   Lenient  — 70% of base yield, no morale penalty
 *   Standard — 100% of base yield, -2 morale
 *   Heavy    — 150% of base yield, -5 morale
 *
 * Base yield = controlled_tiles × (10 + age × 5) gold, capped at 1000.
 * Collection resets each season. Available from the start (Stone Age).
 *
 * state.taxCollection = {
 *   usedThisSeason: boolean,
 *   lastRate:       null | 'lenient' | 'standard' | 'heavy',
 *   totalCollected: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, on, Events } from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from './morale.js';

export const TAX_RATES = {
  lenient:  { id: 'lenient',  icon: '🌿', label: 'Lenient',  mult: 0.70, moraleChange:  0, desc: '70% yield — citizens are content.'        },
  standard: { id: 'standard', icon: '⚖️', label: 'Standard', mult: 1.00, moraleChange: -2, desc: '100% yield — modest unrest.'               },
  heavy:    { id: 'heavy',    icon: '⚙️', label: 'Heavy',    mult: 1.50, moraleChange: -5, desc: '150% yield — citizens are disgruntled.'    },
};
export const TAX_RATE_ORDER = ['lenient', 'standard', 'heavy'];
const TAX_BASE_PER_TILE = 10;
const TAX_BASE_PER_AGE  = 5;
const TAX_CAP           = 1000;

// ── Init ───────────────────────────────────────────────────────────────────

export function initTaxCollection() {
  if (!state.taxCollection) {
    state.taxCollection = { usedThisSeason: false, lastRate: null, totalCollected: 0 };
  } else {
    if (state.taxCollection.totalCollected === undefined) state.taxCollection.totalCollected = 0;
  }
  on(Events.SEASON_CHANGED, _onSeasonChanged);
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns computed base gold yield (before rate multiplier). */
export function getTaxBaseYield() {
  const tiles = _countPlayerTiles();
  const age   = state.age ?? 0;
  return Math.min(TAX_CAP, Math.round(tiles * (TAX_BASE_PER_TILE + age * TAX_BASE_PER_AGE)));
}

/** Returns the gold yield for a specific rate id (post-multiplier). */
export function getTaxYieldForRate(rateId) {
  const def = TAX_RATES[rateId];
  if (!def) return 0;
  return Math.floor(getTaxBaseYield() * def.mult);
}

/** Returns current taxCollection state, or null if uninitialised. */
export function getTaxInfo() {
  return state.taxCollection ?? null;
}

/**
 * Collect taxes at the given rate.
 * @param {'lenient'|'standard'|'heavy'} rateId
 * @returns {{ ok: boolean, gold?: number, reason?: string }}
 */
export function collectTax(rateId) {
  if (!state.taxCollection) initTaxCollection();

  const tc = state.taxCollection;
  if (tc.usedThisSeason) {
    return { ok: false, reason: 'Taxes already collected this season.' };
  }

  const def = TAX_RATES[rateId];
  if (!def) return { ok: false, reason: 'Unknown tax rate.' };

  const yield_ = getTaxYieldForRate(rateId);
  const cap    = state.caps?.gold ?? 500;
  const gained = Math.min(yield_, Math.max(0, cap - (state.resources.gold ?? 0)));

  state.resources.gold = Math.min(cap, (state.resources.gold ?? 0) + gained);
  tc.usedThisSeason   = true;
  tc.lastRate         = rateId;
  tc.totalCollected  += gained;

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.TAX_COLLECTED, { rateId, gold: gained });

  if (def.moraleChange !== 0) changeMorale(def.moraleChange);

  const moraleNote = def.moraleChange < 0 ? ` (${def.moraleChange} morale)` : '';
  addMessage(`🏛️ Imperial taxes collected — ${def.icon} ${def.label} rate: +${gained} gold${moraleNote}.`, 'windfall');

  return { ok: true, gold: gained };
}

// ── Internal ───────────────────────────────────────────────────────────────

function _onSeasonChanged() {
  if (state.taxCollection) {
    state.taxCollection.usedThisSeason = false;
  }
}

function _countPlayerTiles() {
  if (!state.map) return 1;
  let count = 0;
  for (const row of state.map.tiles)
    for (const t of row)
      if (t.owner === 'player') count++;
  return Math.max(1, count);
}
