/**
 * EmpireOS — Wandering Sail Maker (T425).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering sail maker
 * arrives at the settlement carrying bolts of tightly-woven heavy linen
 * canvas bleached pale and dressed with a mixture of tallow and beeswax
 * to shed rain and resist mildew, rolls of lighter ripstop weave for small
 * boat sails and river-barge canopies, coils of tarred hemp rope for
 * bolt-ropes along every leech and luff, brass sail-rings punched through
 * reinforced corner patches, and a sail-panel layout pattern fitted to the
 * most common river-barge and coastal fishing-boat mast configurations
 * used by the empire's waterway traders — offering to commission a full
 * supply of rigged sails for the empire's river fleet and coastal fishers,
 * or to share the sail-making craft that keeps every canvas workshop
 * producing durable, wind-tight sails without specialist instruction.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ⛵ Commission Sailing Canvas    — pay 20 wood + 10 food
 *        → +0.22 wood/s for 2.5 min · +15 prestige · +8 morale
 *   📖 Purchase Sail-Making Lore    — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingSailMaker = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_WOOD_COST          = 20;
export const COMMISSION_FOOD_COST          = 10;
export const COMMISSION_WOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingSailMaker() {
  if (!state.wanderingSailMaker) {
    state.wanderingSailMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingSailMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingSailMakerTick() {
  const a = state.wanderingSailMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SAIL_MAKER_CHANGED, { expired: true });
      addMessage('⛵ The wandering sail maker re-rolls the canvas bolts, coils the tarred hemp rope, and departs along the riverside path — the creak of the laden handcart and scent of tallow-dressed canvas fading as the figure rounds the waterfront bend.', 'info');
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
  emit(Events.WANDERING_SAIL_MAKER_CHANGED, { spawned: true });
  addMessage('⛵ A wandering sail maker arrives at the settlement carrying bolts of tightly-woven heavy linen canvas dressed with tallow and beeswax to shed rain and resist mildew, rolls of lighter ripstop weave for river-barge canopies, coils of tarred hemp rope for bolt-ropes, brass sail-rings for corner patches, and sail-panel layout patterns fitted to the empire\'s river-barge and coastal fishing-boat mast configurations — offering to commission a full supply of rigged sails for the empire\'s waterway fleet, or to share the sail-making craft that keeps every workshop producing durable wind-tight sails. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingSailMaker() { return state.wanderingSailMaker?.active ?? null; }
export function getSailMakerSecsLeft() {
  const a = state.wanderingSailMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionSailingCanvas() {
  const a = state.wanderingSailMaker;
  if (!a?.active) return { ok: false, reason: 'No sail maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The sail maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned sailing canvas from the wandering sail maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sailMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'sailMakerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_SAIL_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⛵ The sail maker selects the most tightly-woven canvas bolts from the cart, measures each panel against the layout pattern fitted to the empire's river-barge mast configuration, cuts the cloth along the thread-line to prevent fraying, rounds the corners before punching brass rings through triple-layered reinforced patches, runs tarred hemp rope along every leech and luff with a sailor's whipping knot at each ring, and delivers the completed set of rigged sails to the river-fleet dock master and coastal fishing-boat quarter — the new durable canvas enabling longer trading voyages and more productive fishing runs along the empire's entire waterway network! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSailMakingLore() {
  const a = state.wanderingSailMaker;
  if (!a?.active) return { ok: false, reason: 'No sail maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The sail maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased sail-making lore from the wandering sail maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sailMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'sailMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_SAIL_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The sail maker shares the canvas selection criteria — looking for a tight, even weave with no loose threads or thin spots that would tear in a strong wind — the tallow-and-beeswax dressing formula that keeps the cloth supple, water-resistant, and mildew-free through repeated wetting and drying, the panel-cutting method that always cuts along a thread-line to prevent fraying at the edge, the three-layer patch technique at every corner and ring point that prevents brass rings from tearing out under sail load, and the bolt-rope whipping pattern that locks each ring to the sail perimeter without gaps — knowledge that allows every canvas workshop to produce well-fitted, long-lasting sails from locally-sourced linen without specialist guidance! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSailMakerAway() {
  const a = state.wanderingSailMaker;
  if (!a?.active) return { ok: false, reason: 'No sail maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SAIL_MAKER_CHANGED, { dismissed: true });
  addMessage('⛵ The wandering sail maker re-rolls the canvas bolts, coils the tarred rope, and departs along the riverside path — nodding respectfully before the laden cart rounds the waterfront bend.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
