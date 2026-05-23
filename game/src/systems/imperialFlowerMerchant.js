/**
 * EmpireOS — Imperial Flower Merchant (T382).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a renowned flower
 * merchant arrives at court bearing fragrant garlands, rare seed packets,
 * and a cart of seasonal blooms — offering to arrange a magnificent imperial
 * garden with exotic plantings, or to sell a collection of rare seasonal
 * flowers and blossoms to enhance the palace grounds.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🌸 Arrange Imperial Gardens — pay 25 food + 15 gold
 *        → +0.22 food/s for 2.5 min · +20 prestige · +12 morale
 *   🌺 Purchase Seasonal Blooms — pay 20 food
 *        → +0.15 food/s for 2 min · +12 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.imperialFlowerMerchant = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalArrangements:   number,
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

export const ARRANGE_FOOD_COST              = 25;
export const ARRANGE_GOLD_COST              = 15;
export const ARRANGE_FOOD_RATE              = 0.22;
export const ARRANGE_PRESTIGE_REWARD        = 20;
export const ARRANGE_MORALE_REWARD          = 12;
export const ARRANGE_DURATION_TICKS         = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST             = 20;
export const PURCHASE_FOOD_RATE             = 0.15;
export const PURCHASE_PRESTIGE_REWARD       = 12;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialFlowerMerchant() {
  if (!state.imperialFlowerMerchant) {
    state.imperialFlowerMerchant = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalArrangements: 0,
      totalPurchases:    0,
      totalDismissals:   0,
    };
  }
  const s = state.imperialFlowerMerchant;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalArrangements  === undefined) s.totalArrangements  = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialFlowerMerchantTick() {
  const a = state.imperialFlowerMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_FLOWER_MERCHANT_CHANGED, { expired: true });
      addMessage('🌸 The imperial flower merchant carefully gathers the unsold garlands and seed packets, covers the cart of seasonal blooms with a cloth, and departs the palace grounds — leaving only a sweet floral fragrance drifting on the breeze.', 'info');
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
  emit(Events.IMPERIAL_FLOWER_MERCHANT_CHANGED, { spawned: true });
  addMessage('🌸 A renowned imperial flower merchant arrives at court bearing fragrant garlands, rare seed packets, and a cart overflowing with exotic seasonal blooms — offering to arrange a magnificent imperial garden with rare plantings throughout the palace grounds, or to sell a collection of prized seasonal flowers to the court gardeners. Respond within 80 seconds.', 'info');
}

export function getActiveImperialFlowerMerchant() { return state.imperialFlowerMerchant?.active ?? null; }
export function getFlowerMerchantSecsLeft() {
  const a = state.imperialFlowerMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function arrangeImperialGardens() {
  const a = state.imperialFlowerMerchant;
  if (!a?.active) return { ok: false, reason: 'No flower merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The flower merchant has departed.' };
  if ((state.resources.food ?? 0) < ARRANGE_FOOD_COST) return { ok: false, reason: `Need ${ARRANGE_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < ARRANGE_GOLD_COST) return { ok: false, reason: `Need ${ARRANGE_GOLD_COST} gold.` };
  state.resources.food -= ARRANGE_FOOD_COST;
  state.resources.gold -= ARRANGE_GOLD_COST;
  changeMorale(ARRANGE_MORALE_REWARD);
  awardPrestige(ARRANGE_PRESTIGE_REWARD, 'Arranged imperial gardens with the imperial flower merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'flowerMerchantArrange');
    state.randomEvents.activeModifiers.push({
      id: 'flowerMerchantArrange', resource: 'food',
      rateMult: 1 + (ARRANGE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + ARRANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalArrangements = (a.totalArrangements ?? 0) + 1;
  emit(Events.IMPERIAL_FLOWER_MERCHANT_CHANGED, { arranged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌸 The flower merchant transforms the palace grounds into a breathtaking botanical paradise — the carefully arranged beds of exotic herbs, edible blossoms, and medicinal plants attract bees and beneficial insects that dramatically increase the fertility of nearby farmland, boosting crop yields across the entire empire! −${ARRANGE_FOOD_COST} food · −${ARRANGE_GOLD_COST} gold · +${ARRANGE_PRESTIGE_REWARD} prestige · +${ARRANGE_MORALE_REWARD} morale. Food surge: +${ARRANGE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSeasonalBlooms() {
  const a = state.imperialFlowerMerchant;
  if (!a?.active) return { ok: false, reason: 'No flower merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The flower merchant has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased seasonal blooms from the imperial flower merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'flowerMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'flowerMerchantPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_FLOWER_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌺 The flower merchant presents a magnificent collection of rare seasonal blooms — the court gardeners plant the edible flowers and aromatic herbs throughout the palace kitchen gardens, where their companion planting properties naturally enrich the soil and protect neighbouring crops, producing a sustained harvest boon! −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFlowerMerchantAway() {
  const a = state.imperialFlowerMerchant;
  if (!a?.active) return { ok: false, reason: 'No flower merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_FLOWER_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🌸 The imperial flower merchant bows graciously, covers the cart of seasonal blooms, tucks the seed packets into a satchel, and departs through the palace gates — the sweet fragrance of flowers gradually fades as the merchant rounds the corner and disappears from view.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
