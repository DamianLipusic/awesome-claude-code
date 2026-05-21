/**
 * EmpireOS — Imperial Wool Merchant (T358).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a traveling wool
 * merchant arrives with bales of raw wool and spun yarn ready for trade
 * or commission. The player has 80 seconds to decide.
 *
 * Choices:
 *   🐑 Trade Wool Supplies — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +8 morale
 *   🪵 Purchase Wool Goods — pay 18 gold
 *        → +0.15 wood/s for 2 min · +12 prestige
 *   👋 Send Away           — dismiss (no reward)
 *
 * state.imperialWoolMerchant = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalTrades:       number,
 *   totalPurchases:    number,
 *   totalDismissals:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const TRADE_FOOD_COST          = 20;
export const TRADE_WOOD_COST          = 15;
export const TRADE_FOOD_RATE          = 0.22;
export const TRADE_PRESTIGE_REWARD    = 18;
export const TRADE_MORALE_REWARD      = 8;
export const TRADE_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST       = 18;
export const PURCHASE_WOOD_RATE       = 0.15;
export const PURCHASE_PRESTIGE_REWARD = 12;
export const PURCHASE_DURATION_TICKS  = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialWoolMerchant() {
  if (!state.imperialWoolMerchant) {
    state.imperialWoolMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalTrades:      0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialWoolMerchant;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalTrades     === undefined) s.totalTrades     = 0;
  if (s.totalPurchases  === undefined) s.totalPurchases  = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function imperialWoolMerchantTick() {
  const a = state.imperialWoolMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_WOOL_MERCHANT_CHANGED, { expired: true });
      addMessage('🐑 The wool merchant re-seals the bales with jute twine, loads them back onto the cart, and clicks the horses forward along the road toward the next market town — perhaps better prices await elsewhere.', 'info');
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
  emit(Events.IMPERIAL_WOOL_MERCHANT_CHANGED, { spawned: true });
  addMessage('🐑 A traveling wool merchant arrives with a cart stacked high with fleece bales, fine spun yarn, and bolts of undyed woollen cloth — the raw material of warm cloaks, farmers\' tunics, and soldiers\' winter gear. They offer to arrange a bulk wool trade supplying the empire\'s workshops or to sell a collection of finished wool goods outright. Respond within 80 seconds.', 'info');
}

export function getActiveImperialWoolMerchant() { return state.imperialWoolMerchant?.active ?? null; }
export function getWoolMerchantSecsLeft() {
  const a = state.imperialWoolMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function tradeWoolSupplies() {
  const a = state.imperialWoolMerchant;
  if (!a?.active) return { ok: false, reason: 'No wool merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The wool merchant has departed.' };
  if ((state.resources.food ?? 0) < TRADE_FOOD_COST) return { ok: false, reason: `Need ${TRADE_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < TRADE_WOOD_COST) return { ok: false, reason: `Need ${TRADE_WOOD_COST} wood.` };
  state.resources.food -= TRADE_FOOD_COST;
  state.resources.wood -= TRADE_WOOD_COST;
  changeMorale(TRADE_MORALE_REWARD);
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Arranged wool trade with the traveling wool merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'woolMerchantTrade');
    state.randomEvents.activeModifiers.push({
      id: 'woolMerchantTrade', resource: 'food',
      rateMult: 1 + (TRADE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.IMPERIAL_WOOL_MERCHANT_CHANGED, { trade: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🐑 The merchant opens the bales and sets up a temporary spinning and carding workshop — citizens learn to work raw fleece into usable yarn and cloth, shepherds bring their own flocks to be shorn at fair prices, and the whole empire's textile output surges as warm garments fill the markets and storehouses! −${TRADE_FOOD_COST} food · −${TRADE_WOOD_COST} wood · +${TRADE_PRESTIGE_REWARD} prestige · +${TRADE_MORALE_REWARD} morale. Food surge: +${TRADE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseWoolGoods() {
  const a = state.imperialWoolMerchant;
  if (!a?.active) return { ok: false, reason: 'No wool merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The wool merchant has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased wool goods from the traveling wool merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'woolMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'woolMerchantPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_WOOL_MERCHANT_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The merchant unloads bolts of tightly-woven woollen cloth and bundles of prime spinning wool — carpenters and woodworkers prize the sturdy cloth for workshop aprons and tool-roll wraps, while the surplus yarn is woven into carrying nets and rope substitutes that free up wood for other uses! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendWoolMerchantAway() {
  const a = state.imperialWoolMerchant;
  if (!a?.active) return { ok: false, reason: 'No wool merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_WOOL_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🐑 The wool merchant nods politely, covers the fleece bales against the afternoon sun, and guides the cart out through the gates — the smell of lanolin fades as they disappear down the road toward the next trading post.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
