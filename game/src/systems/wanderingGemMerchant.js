/**
 * EmpireOS — Wandering Gem Merchant (T361).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), a gem merchant
 * arrives with a collection of rare gemstones and precious minerals.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   💎 Trade Precious Gems — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +20 prestige · +10 morale
 *   💰 Purchase Gem Collection — pay 22 gold
 *        → +0.18 gold/s for 2 min · +15 prestige
 *   👋 Send Away              — dismiss (no reward)
 *
 * state.wanderingGemMerchant = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalTrades:      number,
 *   totalPurchases:   number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const TRADE_STONE_COST         = 25;
export const TRADE_GOLD_COST          = 20;
export const TRADE_STONE_RATE         = 0.22;
export const TRADE_PRESTIGE_REWARD    = 20;
export const TRADE_MORALE_REWARD      = 10;
export const TRADE_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST       = 22;
export const PURCHASE_GOLD_RATE       = 0.18;
export const PURCHASE_PRESTIGE_REWARD = 15;
export const PURCHASE_DURATION_TICKS  = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingGemMerchant() {
  if (!state.wanderingGemMerchant) {
    state.wanderingGemMerchant = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalTrades:     0,
      totalPurchases:  0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingGemMerchant;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalTrades      === undefined) s.totalTrades      = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingGemMerchantTick() {
  const a = state.wanderingGemMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_GEM_MERCHANT_CHANGED, { expired: true });
      addMessage('💎 The gem merchant carefully wraps each stone in silk cloth, closes the lacquered display case, and departs down the road — the glitter of precious gems fades as they round the bend, the opportunity lost.', 'info');
    }
    return;
  }
  if (state.tick < a.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  a.active      = { expiresAt: state.tick + WINDOW_TICKS };
  a.totalVisits = (a.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_GEM_MERCHANT_CHANGED, { spawned: true });
  addMessage('💎 A wandering gem merchant arrives at the gates carrying a lacquered mahogany case lined with velvet, displaying rubies, sapphires, emeralds, and exotic stones from distant mountain ranges. They offer to trade raw gem consignments for stoneworking partnership or simply sell their collection outright. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingGemMerchant() { return state.wanderingGemMerchant?.active ?? null; }
export function getGemMerchantSecsLeft() {
  const a = state.wanderingGemMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function tradeGemConsignment() {
  const a = state.wanderingGemMerchant;
  if (!a?.active) return { ok: false, reason: 'No gem merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The gem merchant has departed.' };
  if ((state.resources.stone ?? 0) < TRADE_STONE_COST) return { ok: false, reason: `Need ${TRADE_STONE_COST} stone.` };
  if ((state.resources.gold  ?? 0) < TRADE_GOLD_COST)  return { ok: false, reason: `Need ${TRADE_GOLD_COST} gold.` };
  state.resources.stone -= TRADE_STONE_COST;
  state.resources.gold  -= TRADE_GOLD_COST;
  changeMorale(TRADE_MORALE_REWARD);
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Traded precious gems with the wandering gem merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'gemMerchantTrade');
    state.randomEvents.activeModifiers.push({
      id: 'gemMerchantTrade', resource: 'stone',
      rateMult: 1 + (TRADE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.WANDERING_GEM_MERCHANT_CHANGED, { trade: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💎 The gem merchant opens a trade partnership, directing expert gem cutters to the quarries where they identify hidden mineral veins and teach precision extraction techniques — the stoneworkers refine their craft dramatically, unlocking new productivity from the same rock faces! −${TRADE_STONE_COST} stone · −${TRADE_GOLD_COST} gold · +${TRADE_PRESTIGE_REWARD} prestige · +${TRADE_MORALE_REWARD} morale. Stone surge: +${TRADE_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseGemCollection() {
  const a = state.wanderingGemMerchant;
  if (!a?.active) return { ok: false, reason: 'No gem merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The gem merchant has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased gem collection from the wandering gem merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'gemMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'gemMerchantPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_GEM_MERCHANT_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💰 The gem collection is distributed among the imperial jewelers and court artisans, who craft exquisite pieces that command extraordinary prices at the market — wealthy foreign buyers bid lavishly for imperial jewellery, pouring a steady stream of gold coins into the treasury coffers! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGemMerchantAway() {
  const a = state.wanderingGemMerchant;
  if (!a?.active) return { ok: false, reason: 'No gem merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_GEM_MERCHANT_CHANGED, { dismissed: true });
  addMessage('💎 The gem merchant closes the lacquered case with a soft click, bows respectfully, and makes their way back to the road — the gleam of precious stones vanishes into the afternoon light.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
