/**
 * EmpireOS — Wandering Salt Merchant (T398).
 *
 * Every 12–16 minutes (Bronze Age+, 8+ player tiles), a wandering salt merchant
 * arrives at the imperial gates hauling heavy canvas sacks and sealed clay amphorae
 * packed with high-quality mineral salts, sea-harvested crystals, and dried salt
 * cakes — offering to establish abundant imperial salt stores that preserve foodstuffs
 * and sustain the population, or to sell surplus salt reserves to build up the city's
 * mineral stockpiles for construction and trade.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🧂 Establish Salt Stores  — pay 25 food + 15 gold
 *        → +0.22 food/s for 2.5 min · +18 prestige · +10 morale
 *   ⛏️ Purchase Salt Reserves  — pay 20 stone
 *        → +0.15 stone/s for 2 min · +12 prestige
 *   🚶 Send Away               — dismiss (no reward)
 *
 * state.wanderingSaltMerchant = {
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_FOOD_COST        = 25;
export const COMMISSION_GOLD_COST        = 15;
export const COMMISSION_FOOD_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 18;
export const COMMISSION_MORALE_REWARD    = 10;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST         = 20;
export const PURCHASE_STONE_RATE         = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingSaltMerchant() {
  if (!state.wanderingSaltMerchant) {
    state.wanderingSaltMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingSaltMerchant;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function wanderingSaltMerchantTick() {
  const a = state.wanderingSaltMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SALT_MERCHANT_CHANGED, { expired: true });
      addMessage('🧂 The wandering salt merchant hoists the heavy canvas sacks back onto broad shoulders, reseals the clay amphorae, and nods respectfully before departing from the imperial gates — the faint mineral tang of sea-salt crystals fading on the breeze.', 'info');
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
  emit(Events.WANDERING_SALT_MERCHANT_CHANGED, { spawned: true });
  addMessage('🧂 A wandering salt merchant arrives at the imperial gates hauling heavy canvas sacks and sealed clay amphorae packed with high-quality mineral salts, sea-harvested crystals, and dried salt cakes — offering to establish abundant imperial salt stores that preserve foodstuffs and sustain the population, or to sell surplus salt reserves to build up the city\'s mineral stockpiles. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingSaltMerchant() { return state.wanderingSaltMerchant?.active ?? null; }
export function getSaltMerchantSecsLeft() {
  const a = state.wanderingSaltMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishSaltStores() {
  const a = state.wanderingSaltMerchant;
  if (!a?.active) return { ok: false, reason: 'No salt merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The salt merchant has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Established imperial salt stores with the wandering salt merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'saltMerchantCommission');
    state.randomEvents.activeModifiers.push({
      id: 'saltMerchantCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_SALT_MERCHANT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧂 The salt merchant oversees the careful distribution of mineral salts and sea crystals throughout the imperial granaries, smokehouses, and preservation cellars — the preserved foodstuffs filling the city's storerooms with dried meats, pickled vegetables, and cured provisions that sustain the population through lean seasons and fuel renewed agricultural vigour! −${COMMISSION_FOOD_COST} food · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSaltReserves() {
  const a = state.wanderingSaltMerchant;
  if (!a?.active) return { ok: false, reason: 'No salt merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The salt merchant has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased salt reserves from the wandering salt merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'saltMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'saltMerchantPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_SALT_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⛏️ The salt merchant exchanges heavy sacks of compressed mineral salt cakes for cut stone — a uniquely valuable barter that opens new quarrying routes and mineral extraction agreements with the highland salt workers, who share their rock-splitting and stone-cleaving expertise with the imperial stonecutters, dramatically boosting quarry output! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSaltMerchantAway() {
  const a = state.wanderingSaltMerchant;
  if (!a?.active) return { ok: false, reason: 'No salt merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SALT_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🧂 The wandering salt merchant hoists the heavy canvas sacks back onto broad shoulders and nods respectfully before departing from the imperial gates — the mineral tang of sea-salt crystals fading on the breeze.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
