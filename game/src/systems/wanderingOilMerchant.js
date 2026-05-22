/**
 * EmpireOS — Wandering Oil Merchant (T365).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), a wandering oil merchant
 * arrives with barrels of fine olive oil and lamp supplies.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🫙 Purchase Olive Oil Reserves — pay 25 food
 *        → +0.25 food/s for 2.5 min · +18 prestige · +10 morale
 *   🔦 Trade Oil Lamp Supplies     — pay 15 wood + 15 gold
 *        → +0.18 gold/s for 2 min · +12 prestige
 *   👋 Send Away                   — dismiss (no reward)
 *
 * state.wanderingOilMerchant = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalPurchases:    number,
 *   totalTrades:       number,
 *   totalDismissals:   number,
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

export const PURCHASE_FOOD_COST            = 25;
export const PURCHASE_FOOD_RATE            = 0.25;
export const PURCHASE_PRESTIGE_REWARD      = 18;
export const PURCHASE_MORALE_REWARD        = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TRADE_WOOD_COST               = 15;
export const TRADE_GOLD_COST               = 15;
export const TRADE_GOLD_RATE               = 0.18;
export const TRADE_PRESTIGE_REWARD         = 12;
export const TRADE_DURATION_TICKS          = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingOilMerchant() {
  if (!state.wanderingOilMerchant) {
    state.wanderingOilMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalPurchases:   0,
      totalTrades:      0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingOilMerchant;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalPurchases  === undefined) s.totalPurchases  = 0;
  if (s.totalTrades     === undefined) s.totalTrades     = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingOilMerchantTick() {
  const a = state.wanderingOilMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_OIL_MERCHANT_CHANGED, { expired: true });
      addMessage('🫙 The oil merchant carefully loads the remaining barrels back onto the cart, clicks the ox forward, and rumbles off down the road — the warm scent of olive oil fading on the breeze.', 'info');
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
  emit(Events.WANDERING_OIL_MERCHANT_CHANGED, { spawned: true });
  addMessage('🫙 A wandering oil merchant arrives at the palace gates with a cart laden with oak barrels of fine olive oil and ornate brass lamp supplies from distant sun-drenched groves. They offer to sell premium olive oil reserves that will sustain the palace kitchens and farms, or to trade a set of superior oil lamp supplies that will keep the treasury ledgers filled well into the night. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingOilMerchant() { return state.wanderingOilMerchant?.active ?? null; }
export function getOilMerchantSecsLeft() {
  const a = state.wanderingOilMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function purchaseOliveOilReserves() {
  const a = state.wanderingOilMerchant;
  if (!a?.active) return { ok: false, reason: 'No oil merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The oil merchant has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  changeMorale(PURCHASE_MORALE_REWARD);
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased olive oil reserves from the wandering oil merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'oilMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'oilMerchantPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_OIL_MERCHANT_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🫙 The barrels of golden olive oil are rolled into the palace cellars and distributed to the farms and kitchens — the rich oil improves the soil conditioning, fattens the livestock, and energizes the workers who feast on the finest pressed olives! −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige · +${PURCHASE_MORALE_REWARD} morale. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function tradeOilLampSupplies() {
  const a = state.wanderingOilMerchant;
  if (!a?.active) return { ok: false, reason: 'No oil merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The oil merchant has departed.' };
  if ((state.resources.wood ?? 0) < TRADE_WOOD_COST) return { ok: false, reason: `Need ${TRADE_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < TRADE_GOLD_COST) return { ok: false, reason: `Need ${TRADE_GOLD_COST} gold.` };
  state.resources.wood -= TRADE_WOOD_COST;
  state.resources.gold -= TRADE_GOLD_COST;
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Traded oil lamp supplies with the wandering oil merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'oilMerchantTrade');
    state.randomEvents.activeModifiers.push({
      id: 'oilMerchantTrade', resource: 'gold',
      rateMult: 1 + (TRADE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.WANDERING_OIL_MERCHANT_CHANGED, { trade: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔦 The brass oil lamps and wooden lamp-stands are set up throughout the palace halls and counting rooms — scribes and merchants work long into the night by flickering lamplight, doubling the efficiency of the treasury's accounting and trade ledger work! −${TRADE_WOOD_COST} wood · −${TRADE_GOLD_COST} gold · +${TRADE_PRESTIGE_REWARD} prestige. Gold surge: +${TRADE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendOilMerchantAway() {
  const a = state.wanderingOilMerchant;
  if (!a?.active) return { ok: false, reason: 'No oil merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_OIL_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🫙 The oil merchant nods graciously, secures the barrel lids with leather straps, and wheels the cart back down the road — perhaps the markets of another city will appreciate the finest pressed oil in the region.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
