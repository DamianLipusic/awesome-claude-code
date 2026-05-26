/**
 * EmpireOS — Imperial Cheese Merchant (T412).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), an imperial cheese
 * merchant arrives at the palace bearing waxed rounds of aged hard cheese,
 * ceramic crocks of brine-cured soft varieties, and ledgers of dairy-guild
 * production contracts — offering to establish a permanent imperial dairy
 * supplying the palace kitchens and garrison mess halls with the finest
 * aged cheeses in the realm, or to sell a curated selection of aged varieties
 * from distant provinces renowned for their rich grazing pastures and
 * time-honoured curing traditions. The player has 80 seconds to decide.
 *
 * Choices:
 *   🧀 Establish Imperial Dairy        — pay 25 food + 15 gold
 *        → +0.25 food/s for 2.5 min · +20 prestige · +12 morale
 *   🥛 Purchase Aged Varieties         — pay 20 food
 *        → +0.18 food/s for 2 min · +12 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.imperialCheeseMerchant = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalEstablished:   number,
 *   totalPurchased:     number,
 *   totalDismissals:    number,
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

export const ESTABLISH_FOOD_COST           = 25;
export const ESTABLISH_GOLD_COST           = 15;
export const ESTABLISH_FOOD_RATE           = 0.25;
export const ESTABLISH_PRESTIGE_REWARD     = 20;
export const ESTABLISH_MORALE_REWARD       = 12;
export const ESTABLISH_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST            = 20;
export const PURCHASE_FOOD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialCheeseMerchant() {
  if (!state.imperialCheeseMerchant) {
    state.imperialCheeseMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalEstablished: 0,
      totalPurchased:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialCheeseMerchant;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalEstablished === undefined) s.totalEstablished = 0;
  if (s.totalPurchased   === undefined) s.totalPurchased   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialCheeseMerchantTick() {
  const a = state.imperialCheeseMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_CHEESE_MERCHANT_CHANGED, { expired: true });
      addMessage('🧀 The imperial cheese merchant rewraps the waxed rounds in their linen cloths, seals the ceramic crocks of brine-cured varieties back in their travelling crates, and departs the palace — the dairy establishment and aged-varieties offer passing unrealised as the merchant\'s cart of cheese and dairy ledgers disappears through the gatehouse.', 'info');
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
  emit(Events.IMPERIAL_CHEESE_MERCHANT_CHANGED, { spawned: true });
  addMessage('🧀 An imperial cheese merchant arrives at the palace bearing waxed rounds of aged hard cheese, ceramic crocks of brine-cured soft varieties, and ledgers of dairy-guild production contracts — offering to establish a permanent imperial dairy supplying the palace kitchens and garrison mess halls with the finest aged cheeses in the realm, or to sell a curated selection of aged varieties from distant provinces renowned for their rich grazing pastures and time-honoured curing traditions. Respond within 80 seconds.', 'info');
}

export function getActiveImperialCheeseMerchant() { return state.imperialCheeseMerchant?.active ?? null; }
export function getCheeseMerchantSecsLeft() {
  const a = state.imperialCheeseMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishImperialDairy() {
  const a = state.imperialCheeseMerchant;
  if (!a?.active) return { ok: false, reason: 'No cheese merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cheese merchant has departed.' };
  if ((state.resources.food ?? 0) < ESTABLISH_FOOD_COST) return { ok: false, reason: `Need ${ESTABLISH_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < ESTABLISH_GOLD_COST) return { ok: false, reason: `Need ${ESTABLISH_GOLD_COST} gold.` };
  state.resources.food -= ESTABLISH_FOOD_COST;
  state.resources.gold -= ESTABLISH_GOLD_COST;
  changeMorale(ESTABLISH_MORALE_REWARD);
  awardPrestige(ESTABLISH_PRESTIGE_REWARD, 'Established an imperial dairy with the cheese merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cheeseEstablish');
    state.randomEvents.activeModifiers.push({
      id: 'cheeseEstablish', resource: 'food',
      rateMult: 1 + (ESTABLISH_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + ESTABLISH_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalEstablished = (a.totalEstablished ?? 0) + 1;
  emit(Events.IMPERIAL_CHEESE_MERCHANT_CHANGED, { established: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧀 The merchant signs the dairy-guild charter and immediately dispatches a team of experienced cheesemakers to the palace outbuildings, where they install copper vats, wooden curing racks, and salt-brine cellars — fresh milk from the imperial herds is cultured, pressed, and aged in carefully controlled cellars to produce an unending stream of hard and soft cheeses that fill the palace larders, sustain the garrison troops through long campaigns, and delight every dignitary who dines at the imperial table! −${ESTABLISH_FOOD_COST} food · −${ESTABLISH_GOLD_COST} gold · +${ESTABLISH_PRESTIGE_REWARD} prestige · +${ESTABLISH_MORALE_REWARD} morale. Food surge: +${ESTABLISH_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseAgedVarieties() {
  const a = state.imperialCheeseMerchant;
  if (!a?.active) return { ok: false, reason: 'No cheese merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cheese merchant has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased aged cheese varieties from the imperial cheese merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cheesePurchase');
    state.randomEvents.activeModifiers.push({
      id: 'cheesePurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.IMPERIAL_CHEESE_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🥛 The merchant opens the travelling crates to reveal whole wheels of cave-aged alpine hard cheese, terracotta crocks of herb-brined soft varieties, and waxed cylinders of smoke-cured mountain cheese from provinces famous for their rich clover meadows and centuries-old curing traditions — the palace kitchens distribute the varied cheeses to the guard barracks, treasury scribes, and great hall serving staff, whose improved nutrition and elevated spirits ripple outward through every productive activity across the imperial household! −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCheeseMerchantAway() {
  const a = state.imperialCheeseMerchant;
  if (!a?.active) return { ok: false, reason: 'No cheese merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_CHEESE_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🧀 The imperial cheese merchant rewraps the waxed rounds and seals the ceramic crocks of brine-cured soft varieties back into their straw-packed travelling crates, then departs the palace — the faint aroma of aged cheese and hay lingering briefly in the courtyard as the merchant\'s cart rolls through the gatehouse arch.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
