/**
 * EmpireOS — Imperial Grain Merchant (T392).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), an imperial grain
 * merchant arrives at the capital accompanied by a train of ox-carts laden
 * with sacks of prime winter wheat, barley, and millet — offering to
 * establish a long-term grain storage arrangement for the imperial
 * granaries, or to sell exclusive milling rights and grain-drying techniques
 * to the realm's mill operators.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🌾 Establish Grain Stores   — pay 25 food + 15 gold
 *        → +0.25 food/s for 2.5 min · +20 prestige · +12 morale
 *   🪵 Purchase Milling Rights  — pay 20 wood
 *        → +0.18 wood/s for 2 min · +15 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.imperialGrainMerchant = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
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

export const COMMISSION_FOOD_COST        = 25;
export const COMMISSION_GOLD_COST        = 15;
export const COMMISSION_FOOD_RATE        = 0.25;
export const COMMISSION_PRESTIGE_REWARD  = 20;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST          = 20;
export const PURCHASE_WOOD_RATE          = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialGrainMerchant() {
  if (!state.imperialGrainMerchant) {
    state.imperialGrainMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialGrainMerchant;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function imperialGrainMerchantTick() {
  const a = state.imperialGrainMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_GRAIN_MERCHANT_CHANGED, { expired: true });
      addMessage('🌾 The imperial grain merchant cinches the ox-cart covers back over the grain sacks, whistles to the drovers, and wheels the heavily laden carts away from the capital — the rumble of wooden wheels fading as the merchant sets off toward the next province.', 'info');
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
  emit(Events.IMPERIAL_GRAIN_MERCHANT_CHANGED, { spawned: true });
  addMessage('🌾 An imperial grain merchant arrives at the capital accompanied by a long train of ox-carts laden with sacks of prime winter wheat, barley, and millet — offering to establish a long-term grain storage arrangement for the imperial granaries, or to sell exclusive milling rights and advanced grain-drying techniques to the realm\'s mill operators. Respond within 80 seconds.', 'info');
}

export function getActiveImperialGrainMerchant() { return state.imperialGrainMerchant?.active ?? null; }
export function getGrainMerchantSecsLeft() {
  const a = state.imperialGrainMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishGrainStores() {
  const a = state.imperialGrainMerchant;
  if (!a?.active) return { ok: false, reason: 'No grain merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The grain merchant has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Established grain stores with the imperial grain merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'grainMerchantCommission');
    state.randomEvents.activeModifiers.push({
      id: 'grainMerchantCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_GRAIN_MERCHANT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌾 The grain merchant's ox-carts are unloaded with great efficiency — mountains of prime wheat, barley, and millet filling the imperial granaries to overflowing, as the merchant's network of farming contacts and seasonal purchasing arrangements deliver a steady flood of grain that keeps the entire realm well-fed and the people's spirits high! −${COMMISSION_FOOD_COST} food · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseMillingRights() {
  const a = state.imperialGrainMerchant;
  if (!a?.active) return { ok: false, reason: 'No grain merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The grain merchant has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased milling rights from the imperial grain merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'grainMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'grainMerchantPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_GRAIN_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The grain merchant transfers the milling rights and discloses a detailed manual of grain-drying and windmill construction techniques — advanced millstone dressing methods, optimal paddle-wheel timber selection, and efficient hopper design that the imperial carpenters and millwrights eagerly adopt, dramatically improving timber processing and lumber yields across the realm! −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGrainMerchantAway() {
  const a = state.imperialGrainMerchant;
  if (!a?.active) return { ok: false, reason: 'No grain merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_GRAIN_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🌾 The grain merchant cinches the ox-cart covers back over the grain sacks, whistles to the drovers, and wheels the heavily laden carts away from the capital — the rumble of wooden wheels fading as the merchant sets off toward the next province.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
