/**
 * EmpireOS — Resource Trading Market system.
 *
 * Allows players to buy/sell food, wood, stone, iron, and mana for gold.
 * Prices fluctuate via a bounded random walk every UPDATE_INTERVAL ticks.
 * Requires at least one Market building to access trading.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { anyEmbargoActive } from './diplomacy.js'; // T159
import { getFairBuyMult, getFairSellMult, tradeFairTradeMade } from './tradeFair.js'; // T196
import { getReputationSellBonus } from './reputation.js'; // T211

// Base gold value per 1 unit of each resource
const BASE_PRICES = Object.freeze({
  food:  1.5,
  wood:  2.0,
  stone: 3.0,
  iron:  5.0,
  mana:  10.0,
});

// Resources tradeable on the market (gold is the currency, not tradeable)
export const MARKET_RESOURCES = ['food', 'wood', 'stone', 'iron', 'mana'];

// Price multiplier bounds
const MIN_MULT = 0.4;
const MAX_MULT = 2.5;

// Price drift per update: random ±DRIFT_RANGE applied to multiplier
const DRIFT_RANGE = 0.15;

// How often prices update (ticks)
const UPDATE_INTERVAL = 15 * TICKS_PER_SECOND; // every 15s

// Buy/sell spread: buyers pay more, sellers receive less than spot
const SPREAD = 0.20; // 20%

// T115: Seasonal commodity pricing — one or two resources trade at premium each season
const SEASONAL_COMMODITIES = Object.freeze({
  0: ['food'],           // Spring  — food is freshly harvested; demand surges
  1: ['wood'],           // Summer  — logging season at peak; woodworkers pay premium
  2: ['stone', 'iron'],  // Autumn  — mining season; quarries and forges in high demand
  3: ['mana'],           // Winter  — magical introspection; mana fetches top gold
});
const SEASONAL_SELL_MULT = 2.0;  // ×2 gold when selling a seasonal resource
const SEASONAL_BUY_MULT  = 0.5;  // ×0.5 gold when buying a seasonal resource (stock-up opportunity)

/** Returns the list of seasonal commodity resource ids for the current season. */
export function getSeasonalCommodities() {
  const index = state.season?.index ?? 0;
  return SEASONAL_COMMODITIES[index] ?? [];
}

// Lifetime trade counter key (in state.market)
// Used by achievements system

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

export function initMarket() {
  const prices = {};
  const trends = {};
  for (const res of MARKET_RESOURCES) {
    prices[res] = 1.0;
    trends[res] = 0;  // 0=stable, 1=up, -1=down
  }
  state.market = {
    prices,
    trends,
    lastUpdateTick: 0,
    totalTrades: 0,
  };
}

// ---------------------------------------------------------------------------
// Tick — called every game tick via registerSystem
// ---------------------------------------------------------------------------

export function marketTick() {
  if (!state.market) return;
  if (state.tick - state.market.lastUpdateTick < UPDATE_INTERVAL) return;

  state.market.lastUpdateTick = state.tick;

  for (const res of MARKET_RESOURCES) {
    const prev = state.market.prices[res];
    const drift = (Math.random() - 0.5) * DRIFT_RANGE * 2;
    const next  = Math.min(MAX_MULT, Math.max(MIN_MULT, prev + drift));
    state.market.prices[res] = next;
    state.market.trends[res] = next > prev + 0.005 ? 1 : next < prev - 0.005 ? -1 : 0;
  }

  emit(Events.MARKET_CHANGED, {});
}

// ---------------------------------------------------------------------------
// Price helpers
// ---------------------------------------------------------------------------

/** Gold cost to buy `amount` units of `resource`. */
export function buyPrice(resource, amount = 1) {
  if (!state.market) return Infinity;
  const base     = BASE_PRICES[resource] ?? 1;
  const mult     = state.market.prices[resource] ?? 1;
  const seasonal = getSeasonalCommodities().includes(resource) ? SEASONAL_BUY_MULT : 1.0;
  const fair     = getFairBuyMult(); // T196: trade fair discount
  return Math.ceil(base * mult * seasonal * fair * (1 + SPREAD) * amount);
}

/** Gold earned for selling `amount` units of `resource`. */
export function sellPrice(resource, amount = 1) {
  if (!state.market) return 0;
  const base     = BASE_PRICES[resource] ?? 1;
  const mult     = state.market.prices[resource] ?? 1;
  const seasonal = getSeasonalCommodities().includes(resource) ? SEASONAL_SELL_MULT : 1.0;
  const fair     = getFairSellMult(); // T196: trade fair bonus
  return Math.floor(base * mult * seasonal * fair * (1 - SPREAD) * amount);
}

// ---------------------------------------------------------------------------
// Trade actions
// ---------------------------------------------------------------------------

/**
 * Sell `amount` units of `resource` for gold.
 * Returns { ok, reason? }
 */
export function sellResources(resource, amount) {
  if (!state.market) return { ok: false, reason: 'Market not ready.' };
  if ((state.buildings?.market ?? 0) < 1) {
    return { ok: false, reason: 'Build a Market to access trading.' };
  }

  const available = state.resources[resource] ?? 0;
  const actual    = Math.min(amount, Math.floor(available));

  if (actual <= 0) {
    return { ok: false, reason: `No ${resource} to sell.` };
  }

  let earned = sellPrice(resource, actual);
  // T133: Grand Bazaar wonder — market trades yield 50% more gold
  if (state.wonder?.completedId === 'grand_bazaar') earned = Math.floor(earned * 1.5);
  // T150: Grand Theory Economic Mastery — ×1.5 market sell prices
  if (state.grandTheory === 'economic_mastery') earned = Math.floor(earned * 1.5);
  // T134: Scholar Trade Secrets — +50% sell gold for next 3 sells
  const _ts = state.scholar?.activeEffect;
  if (_ts?.type === 'trade_secrets' && (_ts.chargesLeft ?? 0) > 0) {
    earned = Math.floor(earned * 1.5);
    _ts.chargesLeft--;
    if (_ts.chargesLeft <= 0) state.scholar.activeEffect = null;
  }
  // T155: Global Trade Network — +25% sell gold when all 3 empires are allied with trade routes
  const _allTradeActive = state.diplomacy &&
    ['ironHorde', 'mageCouncil', 'seaWolves'].every(id => {
      const e = state.diplomacy.empires?.find(emp => emp.id === id);
      return e && e.relations === 'allied' && e.tradeRoutes > 0;
    });
  if (_allTradeActive) earned = Math.floor(earned * 1.25);
  // T159: Trade Embargo — +15% sell prices while any empire is embargoed
  if (anyEmbargoActive()) earned = Math.floor(earned * 1.15);
  // T195: Chancellor Vizier — +10% sell prices
  if (state.vizier?.active === 'chancellor') earned = Math.floor(earned * 1.10);
  // T211: Noble reputation — +8% sell prices
  earned = Math.floor(earned * getReputationSellBonus());
  state.resources[resource]  = available - actual;
  state.resources.gold = Math.min(state.caps.gold, (state.resources.gold ?? 0) + earned);
  state.market.totalTrades++;
  tradeFairTradeMade(); // T196: track fair participation

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.MARKET_CHANGED, {});
  addMessage(`Sold ${actual} ${resource} for ${earned}g.`, 'market');
  return { ok: true };
}

/**
 * Buy `amount` units of `resource` using gold.
 * Returns { ok, reason? }
 */
export function buyResources(resource, amount) {
  if (!state.market) return { ok: false, reason: 'Market not ready.' };
  if ((state.buildings?.market ?? 0) < 1) {
    return { ok: false, reason: 'Build a Market to access trading.' };
  }

  const cap     = state.caps[resource] ?? 500;
  const current = state.resources[resource] ?? 0;
  const room    = Math.floor(cap - current);

  if (room <= 0) {
    return { ok: false, reason: `${resource} storage is full.` };
  }

  let actual      = Math.min(amount, room);
  // T133: Grand Bazaar wonder — buy 50% more resource for the same gold
  const _bazaarMult = state.wonder?.completedId === 'grand_bazaar' ? 1.5 : 1.0;
  const totalCost   = buyPrice(resource, actual);

  if ((state.resources.gold ?? 0) < totalCost) {
    return { ok: false, reason: `Need ${totalCost}g (have ${Math.floor(state.resources.gold)}g).` };
  }

  const finalAmount = Math.min(room, Math.floor(actual * _bazaarMult));
  state.resources.gold -= totalCost;
  state.resources[resource] = current + finalAmount;
  state.market.totalTrades++;
  tradeFairTradeMade(); // T196: track fair participation

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.MARKET_CHANGED, {});
  addMessage(`Bought ${finalAmount} ${resource} for ${totalCost}g.`, 'market');
  return { ok: true };
}
