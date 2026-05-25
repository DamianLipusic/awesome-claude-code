/**
 * EmpireOS — Wandering Wool Spinner (T403).
 *
 * Every 11–16 minutes (Stone Age+, 6+ player tiles), a wandering wool spinner
 * arrives at the palace courtyard bearing a drop spindle, fleece-filled baskets,
 * and dyed skeins of fine wool — offering to commission a supply of royal wool
 * cloth for the imperial wardrobe and tapestry looms, or to share the ancient
 * spinning and dyeing techniques with the palace weavers and cloth merchants.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🐑 Commission Royal Wool Cloth       — pay 20 food + 15 gold
 *        → +0.20 food/s for 2.5 min · +18 prestige · +10 morale
 *   🧵 Purchase Spinning Techniques      — pay 15 wood
 *        → +0.15 wood/s for 2 min · +12 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.wanderingWoolSpinner = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissions: number,
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST        = 20;
export const COMMISSION_GOLD_COST        = 15;
export const COMMISSION_FOOD_RATE        = 0.20;
export const COMMISSION_PRESTIGE_REWARD  = 18;
export const COMMISSION_MORALE_REWARD    = 10;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST          = 15;
export const PURCHASE_WOOD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingWoolSpinner() {
  if (!state.wanderingWoolSpinner) {
    state.wanderingWoolSpinner = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingWoolSpinner;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function wanderingWoolSpinnerTick() {
  const a = state.wanderingWoolSpinner;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_WOOL_SPINNER_CHANGED, { expired: true });
      addMessage('🐑 The wandering wool spinner packs the drop spindle and fleece baskets back into the cart, ties the dyed skeins in bundles, and departs the palace courtyard — the soft hum of spinning wheels fading with the creak of the departing wagon.', 'info');
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
  emit(Events.WANDERING_WOOL_SPINNER_CHANGED, { spawned: true });
  addMessage('🐑 A wandering wool spinner arrives at the palace courtyard bearing a drop spindle, fleece-filled baskets, and dyed skeins of fine wool — offering to commission a supply of royal wool cloth for the imperial wardrobe, or to share ancient spinning and dyeing techniques with the palace weavers. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingWoolSpinner() { return state.wanderingWoolSpinner?.active ?? null; }
export function getWoolSpinnerSecsLeft() {
  const a = state.wanderingWoolSpinner?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalWoolCloth() {
  const a = state.wanderingWoolSpinner;
  if (!a?.active) return { ok: false, reason: 'No wool spinner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The wool spinner has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned royal wool cloth from the wandering wool spinner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'woolSpinnerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'woolSpinnerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_WOOL_SPINNER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🐑 The wool spinner sets the palace weavers to work carding, spinning, and dyeing great bales of imperial fleece — bolts of fine ivory, crimson, and gold cloth piling up in the royal storerooms while the cheerful rhythm of spinning wheels and the scent of lanolin and dye pots inspires the kitchen staff and farm workers to redouble their efforts! −${COMMISSION_FOOD_COST} food · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSpinningTechniques() {
  const a = state.wanderingWoolSpinner;
  if (!a?.active) return { ok: false, reason: 'No wool spinner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The wool spinner has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased spinning techniques from the wandering wool spinner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'woolSpinnerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'woolSpinnerPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_WOOL_SPINNER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧵 The wool spinner demonstrates how to cut and size drop spindles from seasoned hardwood, how to carve the whorls for optimal twist ratio, and how to build lightweight but rigid warping frames from ash and oak — the palace carpenters immediately begin producing superior spinning equipment for the cloth districts, stimulating a brisk demand for quality timber! −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendWoolSpinnerAway() {
  const a = state.wanderingWoolSpinner;
  if (!a?.active) return { ok: false, reason: 'No wool spinner present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_WOOL_SPINNER_CHANGED, { dismissed: true });
  addMessage('🐑 The wandering wool spinner packs the fleece and spindles back into the cart and departs the palace courtyard — the quiet hum of the spinning wheel fading into the distance.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
