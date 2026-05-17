/**
 * EmpireOS — Imperial Spice Merchant (T306).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), an imperial spice
 * merchant arrives carrying rare aromatic spices and trade connections from
 * distant lands. The player has 80 seconds to decide.
 *
 * Choices:
 *   🌶 Arrange Spice Trade  — pay 30 food + 20 gold
 *        → +0.25 food/s for 2.5 min · +20 prestige · +10 morale
 *   🧂 Purchase Exotic Spices — pay 25 food
 *        → +0.18 food/s for 2 min · +15 prestige
 *   🚶 Send Away             — dismiss (no reward)
 *
 * state.imperialSpiceMerchant = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalTrades:         number,
 *   totalPurchases:      number,
 *   totalDismissals:     number,
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

export const TRADE_FOOD_COST            = 30;
export const TRADE_GOLD_COST            = 20;
export const TRADE_FOOD_RATE            = 0.25;
export const TRADE_PRESTIGE_REWARD      = 20;
export const TRADE_MORALE_REWARD        = 10;
export const TRADE_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST         = 25;
export const PURCHASE_FOOD_RATE         = 0.18;
export const PURCHASE_PRESTIGE_REWARD   = 15;
export const PURCHASE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSpiceMerchant() {
  if (!state.imperialSpiceMerchant) {
    state.imperialSpiceMerchant = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalTrades:     0,
      totalPurchases:  0,
      totalDismissals: 0,
    };
  }
  const s = state.imperialSpiceMerchant;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalTrades      === undefined) s.totalTrades      = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialSpiceMerchantTick() {
  const a = state.imperialSpiceMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SPICE_MERCHANT_CHANGED, { expired: true });
      addMessage('🌶 The imperial spice merchant gathers their aromatic wares into ornately decorated chests and departs, carrying the scent of distant lands away from the imperial court.', 'info');
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
  emit(Events.IMPERIAL_SPICE_MERCHANT_CHANGED, { spawned: true });
  addMessage('🌶 An imperial spice merchant arrives at the empire\'s gates with great caravans laden with saffron, cinnamon, pepper, and rare aromatics sourced from the farthest reaches of the known world. Respond within 80 seconds.', 'info');
}

export function getActiveSpiceMerchant() { return state.imperialSpiceMerchant?.active ?? null; }
export function getSpiceMerchantSecsLeft() {
  const a = state.imperialSpiceMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function arrangeSpiceTrade() {
  const a = state.imperialSpiceMerchant;
  if (!a?.active) return { ok: false, reason: 'No spice merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The merchant has departed.' };
  if ((state.resources.food ?? 0) < TRADE_FOOD_COST) return { ok: false, reason: `Need ${TRADE_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < TRADE_GOLD_COST) return { ok: false, reason: `Need ${TRADE_GOLD_COST} gold.` };
  state.resources.food -= TRADE_FOOD_COST;
  state.resources.gold -= TRADE_GOLD_COST;
  changeMorale(TRADE_MORALE_REWARD);
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Arranged spice trade with the imperial spice merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'spiceTrade');
    state.randomEvents.activeModifiers.push({
      id: 'spiceTrade', resource: 'food',
      rateMult: 1 + (TRADE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.IMPERIAL_SPICE_MERCHANT_CHANGED, { trade: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌶 A comprehensive spice trade agreement is struck! The merchant's exotic seasonings transform the empire's cuisine, reinvigorating agricultural festivals and culinary traditions that boost food production across all provinces! −${TRADE_FOOD_COST} food · −${TRADE_GOLD_COST} gold · +${TRADE_PRESTIGE_REWARD} prestige · +${TRADE_MORALE_REWARD} morale. Harvest surge: +${TRADE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseExoticSpices() {
  const a = state.imperialSpiceMerchant;
  if (!a?.active) return { ok: false, reason: 'No spice merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The merchant has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased exotic spices from the imperial spice merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'spicePurchase');
    state.randomEvents.activeModifiers.push({
      id: 'spicePurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SPICE_MERCHANT_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧂 The exotic spices are distributed to the empire's kitchens and marketplaces, inspiring new recipes and preservative techniques that enhance food cultivation and storage across the lands! −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Cultivation surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSpiceMerchantAway() {
  const a = state.imperialSpiceMerchant;
  if (!a?.active) return { ok: false, reason: 'No spice merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SPICE_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🌶 The imperial spice merchant bows courteously, loads their aromatic cargo back onto the waiting camels, and departs toward other imperial courts along the great trade routes.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
