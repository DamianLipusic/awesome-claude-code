/**
 * EmpireOS — Black Market System (T167).
 *
 * Underground traders become available at Iron Age. The Market panel shows
 * up to 3 deals (refreshed every 5 min): bulk-buy a resource at a flat gold
 * cost, bulk-sell a resource for bonus gold, or swap one resource for another.
 * Each trade carries a 10% seizure risk — contraband can be confiscated,
 * costing a portion of the from-resource and prestige.
 *
 * Deal types:
 *   buy   — Pay gold to receive a resource (bypasses market price volatility)
 *   sell  — Trade a resource for gold at 1.8× its base value
 *   swap  — Trade one resource for another at a 20% bonus rate
 *
 * Seizure (10% chance): lose 50% of fromAmt + −30 prestige; deal slot removed.
 * Success: resources transferred; deal slot removed; no cooldown.
 *
 * state.blackMarket = {
 *   deals:           [{ id, type, fromRes, fromAmt, toRes, toAmt }],
 *   nextRefreshTick: tick,
 *   totalTrades:     number,
 *   seizedCount:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const REFRESH_TICKS  = 5 * 60 * TICKS_PER_SECOND;  // 5 min
const MIN_AGE        = 2;   // Iron Age+
const SEIZE_CHANCE   = 0.10;
const SEIZE_PRESTIGE = 30;
const DEAL_COUNT     = 3;

const RESOURCES = ['food', 'wood', 'stone', 'iron', 'mana'];

// Base gold equivalent per resource unit — drives deal pricing
const BASE_VALS = { food: 1.0, wood: 1.2, stone: 1.5, iron: 2.0, mana: 2.5 };

// ── Public API ──────────────────────────────────────────────────────────────

export function initBlackMarket() {
  if (!state.blackMarket) {
    state.blackMarket = {
      deals:           [],
      nextRefreshTick: 0,
      totalTrades:     0,
      seizedCount:     0,
    };
  }
}

export function blackMarketTick() {
  if (!state.blackMarket) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  const bm = state.blackMarket;

  // First activation or all deals consumed — generate immediately
  if (bm.nextRefreshTick === 0 || bm.deals.length === 0) {
    bm.deals           = _generateDeals();
    bm.nextRefreshTick = state.tick + REFRESH_TICKS;
    emit(Events.BLACK_MARKET_CHANGED, {});
    return;
  }

  if (state.tick >= bm.nextRefreshTick) {
    bm.deals           = _generateDeals();
    bm.nextRefreshTick = state.tick + REFRESH_TICKS;
    addMessage('🕵️ Black market contacts have new deals available.', 'info');
    emit(Events.BLACK_MARKET_CHANGED, {});
  }
}

/**
 * Execute a black market deal by its index in state.blackMarket.deals.
 * Returns { ok: boolean, reason?: string }.
 */
export function executeDeal(dealIdx) {
  if (!state.blackMarket) return { ok: false, reason: 'No black market' };
  if ((state.age ?? 0) < MIN_AGE) return { ok: false, reason: 'Requires Iron Age' };

  const deals = state.blackMarket.deals;
  if (dealIdx < 0 || dealIdx >= deals.length) return { ok: false, reason: 'Invalid deal' };

  const deal    = deals[dealIdx];
  const fromRes = deal.fromRes;
  const fromAmt = deal.fromAmt;

  if ((state.resources[fromRes] ?? 0) < fromAmt) {
    return { ok: false, reason: `Not enough ${fromRes}` };
  }

  // Seizure risk — 10% chance
  if (Math.random() < SEIZE_CHANCE) {
    const lost = Math.floor(fromAmt / 2);
    state.resources[fromRes] = Math.max(0, (state.resources[fromRes] ?? 0) - lost);
    if (state.prestige) {
      state.prestige.score = Math.max(0, (state.prestige.score ?? 0) - SEIZE_PRESTIGE);
    }
    state.blackMarket.seizedCount++;
    state.blackMarket.deals.splice(dealIdx, 1);
    addMessage(`🚨 Contraband seized! Lost ${lost} ${fromRes} and ${SEIZE_PRESTIGE} prestige.`, 'crisis');
    emit(Events.PRESTIGE_CHANGED, { score: state.prestige?.score ?? 0 });
    emit(Events.RESOURCE_CHANGED, {});
    emit(Events.BLACK_MARKET_CHANGED, {});
    return { ok: false, reason: 'Trade seized by authorities' };
  }

  // Execute trade — deduct from-resource
  state.resources[fromRes] = Math.max(0, (state.resources[fromRes] ?? 0) - fromAmt);

  // Credit to-resource (black market allows up to 20% over cap)
  const toRes = deal.toRes;
  const toAmt = deal.toAmt;
  const toCap = Math.floor((state.caps[toRes] ?? 500) * 1.2);
  state.resources[toRes] = Math.min(toCap, (state.resources[toRes] ?? 0) + toAmt);

  state.blackMarket.totalTrades++;
  state.blackMarket.deals.splice(dealIdx, 1);
  addMessage(`🕵️ Black market deal complete! −${fromAmt} ${fromRes} → +${toAmt} ${toRes}.`, 'windfall');
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.BLACK_MARKET_CHANGED, {});
  return { ok: true };
}

/** Seconds until the next deal refresh (0 if unknown or freshly generated). */
export function getBlackMarketRefreshSecs() {
  if (!state.blackMarket || state.blackMarket.nextRefreshTick === 0) return 0;
  return Math.max(0, Math.ceil((state.blackMarket.nextRefreshTick - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ────────────────────────────────────────────────────────

function _generateDeals() {
  const deals    = [];
  const usedFrom = new Set();

  for (let attempt = 0; deals.length < DEAL_COUNT && attempt < 20; attempt++) {
    const type = _pickType();

    if (type === 'buy') {
      const toRes    = _pick(RESOURCES, []);
      if (!toRes) continue;
      const toAmt    = 60 + Math.floor(Math.random() * 40);
      const goldCost = Math.round(toAmt * BASE_VALS[toRes] * 1.5);
      deals.push({
        id: `buy_${toRes}_${state.tick}`,
        type,
        fromRes: 'gold', fromAmt: goldCost,
        toRes,           toAmt,
      });

    } else if (type === 'sell') {
      const fromRes = _pick(RESOURCES, [...usedFrom]);
      if (!fromRes) continue;
      usedFrom.add(fromRes);
      const fromAmt  = 60 + Math.floor(Math.random() * 40);
      const goldGain = Math.round(fromAmt * BASE_VALS[fromRes] * 1.8);
      deals.push({
        id: `sell_${fromRes}_${state.tick}`,
        type,
        fromRes, fromAmt,
        toRes: 'gold', toAmt: goldGain,
      });

    } else { // swap
      const fromRes = _pick(RESOURCES, [...usedFrom]);
      if (!fromRes) continue;
      usedFrom.add(fromRes);
      const pool    = RESOURCES.filter(r => r !== fromRes);
      const toRes   = pool[Math.floor(Math.random() * pool.length)];
      const fromAmt = 50 + Math.floor(Math.random() * 30);
      const toAmt   = Math.max(1, Math.round(fromAmt * BASE_VALS[fromRes] / BASE_VALS[toRes] * 1.2));
      deals.push({
        id: `swap_${fromRes}_${toRes}_${state.tick}`,
        type,
        fromRes, fromAmt,
        toRes,   toAmt,
      });
    }
  }
  return deals;
}

function _pickType() {
  const r = Math.random();
  if (r < 0.35) return 'buy';
  if (r < 0.70) return 'sell';
  return 'swap';
}

function _pick(arr, exclude) {
  const pool = arr.filter(r => !exclude.includes(r));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
