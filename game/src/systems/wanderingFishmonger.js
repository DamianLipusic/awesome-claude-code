/**
 * EmpireOS — Wandering Fishmonger (T319).
 *
 * Every 11–16 minutes (Stone Age+, 6+ player tiles), a wandering fishmonger
 * arrives at the imperial gates, offering fresh catches and preserved fish
 * from distant rivers and coastlines. The player has 80 seconds to decide.
 *
 * Choices:
 *   🐟 Purchase Fresh Catch — pay 20 gold
 *        → +0.25 food/s for 2.5 min · +12 prestige · +8 morale
 *   🐠 Trade for Dried Fish  — pay 25 wood
 *        → +0.20 food/s for 2 min   · +8 prestige
 *   🚶 Send Away             — dismiss (no reward)
 *
 * state.wanderingFishmonger = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalPurchases:     number,
 *   totalTrades:        number,
 *   totalDismissals:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const PURCHASE_GOLD_COST           = 20;
export const PURCHASE_FOOD_RATE           = 0.25;
export const PURCHASE_PRESTIGE_REWARD     = 12;
export const PURCHASE_MORALE_REWARD       = 8;
export const PURCHASE_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TRADE_WOOD_COST              = 25;
export const TRADE_FOOD_RATE              = 0.20;
export const TRADE_PRESTIGE_REWARD        = 8;
export const TRADE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingFishmonger() {
  if (!state.wanderingFishmonger) {
    state.wanderingFishmonger = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalPurchases:   0,
      totalTrades:      0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingFishmonger;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalPurchases  === undefined) s.totalPurchases  = 0;
  if (s.totalTrades     === undefined) s.totalTrades     = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingFishmongerTick() {
  const a = state.wanderingFishmonger;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_FISHMONGER_CHANGED, { expired: true });
      addMessage('🐟 The wandering fishmonger packs up their baskets of unsold fish, hoists their carrying pole, and trudges off down the road to sell their wares in the next town.', 'info');
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
  emit(Events.WANDERING_FISHMONGER_CHANGED, { spawned: true });
  addMessage('🐟 A wandering fishmonger arrives at the imperial gates, carrying laden baskets of fresh river fish and expertly cured dried seafood gathered from distant waterways. They seek a buyer for their finest catch. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingFishmonger() { return state.wanderingFishmonger?.active ?? null; }
export function getWanderingFishmongerSecsLeft() {
  const a = state.wanderingFishmonger?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function purchaseFreshCatch() {
  const a = state.wanderingFishmonger;
  if (!a?.active) return { ok: false, reason: 'No fishmonger present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The fishmonger has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  changeMorale(PURCHASE_MORALE_REWARD);
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased a fresh catch from the wandering fishmonger');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'fishmongerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'fishmongerPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_FISHMONGER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🐟 The fishmonger's gleaming fresh catch is distributed across the imperial kitchens and market stalls. The people delight in the abundant seafood, and rations improve noticeably! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige · +${PURCHASE_MORALE_REWARD} morale. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function tradeForDriedFish() {
  const a = state.wanderingFishmonger;
  if (!a?.active) return { ok: false, reason: 'No fishmonger present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The fishmonger has departed.' };
  if ((state.resources.wood ?? 0) < TRADE_WOOD_COST) return { ok: false, reason: `Need ${TRADE_WOOD_COST} wood.` };
  state.resources.wood -= TRADE_WOOD_COST;
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Traded wood for dried fish with the wandering fishmonger');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'fishmongerTrade');
    state.randomEvents.activeModifiers.push({
      id: 'fishmongerTrade', resource: 'food',
      rateMult: 1 + (TRADE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.WANDERING_FISHMONGER_CHANGED, { traded: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🐠 Barrels of expertly salted and dried fish are exchanged for timber planks. The preserved seafood supplements food stores across the empire's storehouses and granaries! −${TRADE_WOOD_COST} wood · +${TRADE_PRESTIGE_REWARD} prestige. Food surge: +${TRADE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFishmongerAway() {
  const a = state.wanderingFishmonger;
  if (!a?.active) return { ok: false, reason: 'No fishmonger present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_FISHMONGER_CHANGED, { dismissed: true });
  addMessage('🐟 The wandering fishmonger nods respectfully, rearranges their baskets of wares, and continues down the road in search of more willing customers across the realm.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
