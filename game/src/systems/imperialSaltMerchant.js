/**
 * EmpireOS — Imperial Salt Merchant (T324).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), a prosperous imperial
 * salt merchant arrives at court, offering lucrative trade deals and
 * preserved provisions. The player has 80 seconds to decide.
 *
 * Choices:
 *   🧂 Establish Salt Trade Route — pay 30 food + 20 gold
 *        → +0.25 food/s for 2.5 min · +20 prestige · +10 morale
 *   💰 Purchase Salt Reserves    — pay 25 gold
 *        → +0.18 gold/s for 2 min   · +15 prestige
 *   🚶 Send Away                 — dismiss (no reward)
 *
 * state.imperialSaltMerchant = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalRoutes:        number,
 *   totalPurchases:     number,
 *   totalDismissals:    number,
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

export const ROUTE_FOOD_COST           = 30;
export const ROUTE_GOLD_COST           = 20;
export const ROUTE_FOOD_RATE           = 0.25;
export const ROUTE_PRESTIGE_REWARD     = 20;
export const ROUTE_MORALE_REWARD       = 10;
export const ROUTE_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const RESERVES_GOLD_COST        = 25;
export const RESERVES_GOLD_RATE        = 0.18;
export const RESERVES_PRESTIGE_REWARD  = 15;
export const RESERVES_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSaltMerchant() {
  if (!state.imperialSaltMerchant) {
    state.imperialSaltMerchant = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalRoutes:     0,
      totalPurchases:  0,
      totalDismissals: 0,
    };
  }
  const s = state.imperialSaltMerchant;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalRoutes     === undefined) s.totalRoutes     = 0;
  if (s.totalPurchases  === undefined) s.totalPurchases  = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function imperialSaltMerchantTick() {
  const a = state.imperialSaltMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SALT_MERCHANT_CHANGED, { expired: true });
      addMessage('🧂 The imperial salt merchant loads their remaining salt casks back onto the wagon and departs for more willing trading partners.', 'info');
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
  emit(Events.IMPERIAL_SALT_MERCHANT_CHANGED, { spawned: true });
  addMessage('🧂 An imperial salt merchant arrives at court with a caravan of salt-filled casks from distant coastal mines and inland deposits. They offer to establish a profitable salt trade route or sell premium reserves. Respond within 80 seconds.', 'info');
}

export function getActiveImperialSaltMerchant() { return state.imperialSaltMerchant?.active ?? null; }
export function getImperialSaltMerchantSecsLeft() {
  const a = state.imperialSaltMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishSaltTradeRoute() {
  const a = state.imperialSaltMerchant;
  if (!a?.active) return { ok: false, reason: 'No salt merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The merchant has departed.' };
  if ((state.resources.food ?? 0) < ROUTE_FOOD_COST) return { ok: false, reason: `Need ${ROUTE_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < ROUTE_GOLD_COST) return { ok: false, reason: `Need ${ROUTE_GOLD_COST} gold.` };
  state.resources.food -= ROUTE_FOOD_COST;
  state.resources.gold -= ROUTE_GOLD_COST;
  changeMorale(ROUTE_MORALE_REWARD);
  awardPrestige(ROUTE_PRESTIGE_REWARD, 'Established a salt trade route with the imperial merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'saltRoute');
    state.randomEvents.activeModifiers.push({
      id: 'saltRoute', resource: 'food',
      rateMult: 1 + (ROUTE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + ROUTE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalRoutes = (a.totalRoutes ?? 0) + 1;
  emit(Events.IMPERIAL_SALT_MERCHANT_CHANGED, { routed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧂 A profitable salt trade route is established between the empire and the merchant's coastal salt pans. Salt preserves food stocks and enables longer campaigns — imperial granaries report record harvest yields! −${ROUTE_FOOD_COST} food · −${ROUTE_GOLD_COST} gold · +${ROUTE_PRESTIGE_REWARD} prestige · +${ROUTE_MORALE_REWARD} morale. Food surge: +${ROUTE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSaltReserves() {
  const a = state.imperialSaltMerchant;
  if (!a?.active) return { ok: false, reason: 'No salt merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The merchant has departed.' };
  if ((state.resources.gold ?? 0) < RESERVES_GOLD_COST) return { ok: false, reason: `Need ${RESERVES_GOLD_COST} gold.` };
  state.resources.gold -= RESERVES_GOLD_COST;
  awardPrestige(RESERVES_PRESTIGE_REWARD, 'Purchased salt reserves from the imperial merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'saltReserves');
    state.randomEvents.activeModifiers.push({
      id: 'saltReserves', resource: 'gold',
      rateMult: 1 + (RESERVES_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + RESERVES_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SALT_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💰 The empire acquires a large cache of premium salt reserves. Salt taxes and the imperial salt monopoly generate a reliable stream of revenue flowing into the treasury! −${RESERVES_GOLD_COST} gold · +${RESERVES_PRESTIGE_REWARD} prestige. Gold surge: +${RESERVES_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSaltMerchantAway() {
  const a = state.imperialSaltMerchant;
  if (!a?.active) return { ok: false, reason: 'No salt merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SALT_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🧂 The imperial salt merchant bows graciously, loads their casks, and sets off to offer their wares to another empire.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
