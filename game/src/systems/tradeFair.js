/**
 * EmpireOS — Annual Trade Fair System (T196).
 *
 * Every 4 seasons (one game-year) a Trade Fair opens for exactly one full
 * season.  The fair improves all market prices and offers three unique
 * bulk-purchase "Fair Deals" drawn at random from the deal pool.
 *
 * Market effects while fair is active:
 *   • Buy prices  ×0.80  (−20%)
 *   • Sell prices ×1.20  (+20%)
 *
 * Fair Deals — one-shot bulk purchases at extra-favourable rates (3 per fair):
 *   grain_surplus   120g → 200 food
 *   timber_lot      160g → 200 wood
 *   stone_cache     180g → 150 stone
 *   iron_haul       250g → 100 iron
 *   mana_crystals   200g →  50 mana
 *
 * Participation bonus: complete 5+ market trades during the fair
 * → +80 gold, +15 prestige (awarded once per fair).
 *
 * State: state.tradeFair = {
 *   active:          bool,
 *   seasonCount:     number,   // total SEASON_CHANGED events received
 *   currentDeals:   [dealId],  // 3 IDs sampled at fair start
 *   dealsUsed:      [dealId],  // deals already claimed this fair
 *   tradesDuringFair: number,
 *   bonusClaimed:   bool,
 *   totalFairs:     number,
 *   totalDealsUsed: number,
 * }
 *
 * Event: Events.TRADE_FAIR_CHANGED
 * Save:  version 65
 */

import { state }           from '../core/state.js';
import { on, emit, Events } from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ─────────────────────────────────────────────────────────────

export const FAIR_CYCLE_SEASONS  = 4;   // fair fires every N season transitions
export const FAIR_BUY_MULT       = 0.80;
export const FAIR_SELL_MULT      = 1.20;
const FAIR_PARTICIPATION_GOAL    = 5;   // trades for the bonus
const FAIR_BONUS_GOLD            = 80;
const FAIR_BONUS_PRESTIGE        = 15;

// ── Deal pool ─────────────────────────────────────────────────────────────

export const FAIR_DEALS = Object.freeze({
  grain_surplus: {
    id:      'grain_surplus',
    icon:    '🌾',
    title:   'Grain Surplus',
    desc:    'Travelling merchants offload surplus grain at clearance prices.',
    cost:    { gold: 120 },
    reward:  { food: 200 },
  },
  timber_lot: {
    id:      'timber_lot',
    icon:    '🪵',
    title:   'Timber Lot',
    desc:    'A lumber convoy arrives with seasoned hardwood to sell in bulk.',
    cost:    { gold: 160 },
    reward:  { wood: 200 },
  },
  stone_cache: {
    id:      'stone_cache',
    icon:    '🪨',
    title:   'Stone Cache',
    desc:    'Quarry surplus — ready-dressed stone at a festival discount.',
    cost:    { gold: 180 },
    reward:  { stone: 150 },
  },
  iron_haul: {
    id:      'iron_haul',
    icon:    '⚙️',
    title:   'Iron Haul',
    desc:    'Smiths clear forge stockpiles to fund the journey home.',
    cost:    { gold: 250 },
    reward:  { iron: 100 },
  },
  mana_crystals: {
    id:      'mana_crystals',
    icon:    '✨',
    title:   'Mana Crystals',
    desc:    'Wandering mages sell crystallised mana at the fair price.',
    cost:    { gold: 200 },
    reward:  { mana: 50 },
  },
});

export const FAIR_DEAL_ORDER = ['grain_surplus', 'timber_lot', 'stone_cache', 'iron_haul', 'mana_crystals'];

// ── Init ──────────────────────────────────────────────────────────────────

export function initTradeFair() {
  if (!state.tradeFair) {
    state.tradeFair = {
      active:           false,
      seasonCount:      0,
      currentDeals:     [],
      dealsUsed:        [],
      tradesDuringFair: 0,
      bonusClaimed:     false,
      totalFairs:       0,
      totalDealsUsed:   0,
    };
  }
  on(Events.SEASON_CHANGED, _onSeasonChanged);
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns true when the Trade Fair is currently open. */
export function isFairActive() {
  return !!(state.tradeFair?.active);
}

/** Buy price multiplier during the fair (0.80; 1.0 otherwise). */
export function getFairBuyMult() {
  return state.tradeFair?.active ? FAIR_BUY_MULT : 1.0;
}

/** Sell price multiplier during the fair (1.20; 1.0 otherwise). */
export function getFairSellMult() {
  return state.tradeFair?.active ? FAIR_SELL_MULT : 1.0;
}

/** Returns the current fair deal definitions (empty array when no fair). */
export function getFairDeals() {
  if (!state.tradeFair?.active) return [];
  return (state.tradeFair.currentDeals ?? []).map(id => FAIR_DEALS[id]).filter(Boolean);
}

/** Check whether a deal ID has already been claimed this fair. */
export function isDealUsed(dealId) {
  return (state.tradeFair?.dealsUsed ?? []).includes(dealId);
}

/**
 * Claim a fair deal.
 * @param {string} dealId
 * @returns {{ ok: boolean, reason?: string }}
 */
export function useFairDeal(dealId) {
  if (!state.tradeFair?.active) return { ok: false, reason: 'No trade fair is active.' };
  const def = FAIR_DEALS[dealId];
  if (!def) return { ok: false, reason: 'Unknown deal.' };
  if (!state.tradeFair.currentDeals.includes(dealId)) {
    return { ok: false, reason: 'This deal is not available at the current fair.' };
  }
  if (isDealUsed(dealId)) return { ok: false, reason: 'Deal already claimed.' };

  for (const [res, amt] of Object.entries(def.cost)) {
    if ((state.resources[res] ?? 0) < amt) {
      const needed = Object.entries(def.cost).map(([r, a]) => `${a} ${r}`).join(', ');
      return { ok: false, reason: `Need ${needed}.` };
    }
  }

  for (const [res, amt] of Object.entries(def.cost))   state.resources[res] -= amt;
  for (const [res, amt] of Object.entries(def.reward)) {
    const cap = state.caps?.[res] ?? 500;
    state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
  }

  state.tradeFair.dealsUsed.push(dealId);
  state.tradeFair.totalDealsUsed++;

  const rewardStr = Object.entries(def.reward).map(([r, a]) => `+${a} ${r}`).join(', ');
  addMessage(`${def.icon} Fair Deal: ${rewardStr} for ${Object.entries(def.cost).map(([r,a])=>`${a}g`).join('')}`, 'market');
  emit(Events.TRADE_FAIR_CHANGED, { dealUsed: dealId });
  return { ok: true };
}

/**
 * Called by market.js after each completed trade when the fair is active.
 * Tracks participation toward the participation bonus.
 */
export function tradeFairTradeMade() {
  if (!state.tradeFair?.active) return;
  state.tradeFair.tradesDuringFair++;

  if (!state.tradeFair.bonusClaimed && state.tradeFair.tradesDuringFair >= FAIR_PARTICIPATION_GOAL) {
    state.tradeFair.bonusClaimed = true;
    const goldCap = state.caps?.gold ?? 500;
    state.resources.gold = Math.min(goldCap, (state.resources.gold ?? 0) + FAIR_BONUS_GOLD);
    awardPrestige(FAIR_BONUS_PRESTIGE, 'trade fair participation');
    addMessage(`🎪 Trade Fair Bonus: +${FAIR_BONUS_GOLD}g and +${FAIR_BONUS_PRESTIGE} prestige for active trading!`, 'market');
    emit(Events.TRADE_FAIR_CHANGED, { bonusClaimed: true });
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

function _onSeasonChanged() {
  if (!state.tradeFair) initTradeFair();
  const tf = state.tradeFair;

  tf.seasonCount++;

  // End the fair that ran during the season that just ended (no new fair on same transition)
  if (tf.active) {
    tf.active = false;
    tf.currentDeals = [];
    tf.dealsUsed = [];
    addMessage('🎪 The Trade Fair has ended for this year.', 'market');
    emit(Events.TRADE_FAIR_CHANGED, { ended: true });
    return;
  }

  // Start a new fair every FAIR_CYCLE_SEASONS season transitions (first at 4, then 8, 12 …)
  if (tf.seasonCount % FAIR_CYCLE_SEASONS === 0) {
    _startFair();
  }
}

function _startFair() {
  const tf = state.tradeFair;
  tf.active           = true;
  tf.tradesDuringFair = 0;
  tf.bonusClaimed     = false;
  tf.dealsUsed        = [];
  tf.totalFairs++;

  // Sample 3 random deals from the pool
  const pool    = [...FAIR_DEAL_ORDER];
  const picked  = [];
  while (picked.length < 3 && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  tf.currentDeals = picked;

  addMessage('🎪 The Annual Trade Fair has opened! Buy prices −20%, sell prices +20%. Check the Market tab!', 'market');
  emit(Events.TRADE_FAIR_CHANGED, { started: true });
}
