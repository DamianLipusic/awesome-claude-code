/**
 * EmpireOS — Wandering Net Maker (T418).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering net maker
 * arrives at the palace with bolts of twisted linen cordage, wooden netting
 * needles, mesh gauges of varying sizes, and lead sinkers — offering to
 * commission a complete set of imperial fishing nets for the river fisheries
 * and coastal harbours, or to sell the net-making secrets compendium
 * detailing the sheet-bend knot sequences, mesh-gauge selection, and cordage-
 * soaking schedules that produce nets lasting many seasons.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🎣 Commission Imperial Fishing Nets — pay 20 wood + 10 food
 *        → +0.22 food/s for 2.5 min · +15 prestige · +10 morale
 *   📖 Purchase Net-Making Secrets      — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                         — dismiss (no reward)
 *
 * state.wanderingNetMaker = {
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
export const COMMISSION_FOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingNetMaker() {
  if (!state.wanderingNetMaker) {
    state.wanderingNetMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingNetMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingNetMakerTick() {
  const a = state.wanderingNetMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_NET_MAKER_CHANGED, { expired: true });
      addMessage('🎣 The wandering net maker rolls the unused cordage bolts back onto their wooden cores, tucks the netting needles and mesh gauges into the canvas satchel, and departs the palace — the faint smell of river-water and linseed oil fading as the cart disappears around the gatehouse wall.', 'info');
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
  emit(Events.WANDERING_NET_MAKER_CHANGED, { spawned: true });
  addMessage('🎣 A wandering net maker arrives at the palace with bolts of twisted linen cordage, wooden netting needles, mesh gauges of varying sizes, and lead sinkers — offering to commission a complete set of imperial fishing nets for the river fisheries and coastal harbours, or to sell the net-making secrets compendium detailing sheet-bend knot sequences, mesh-gauge selection, and cordage-soaking schedules that produce nets lasting many seasons. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingNetMaker() { return state.wanderingNetMaker?.active ?? null; }
export function getNetMakerSecsLeft() {
  const a = state.wanderingNetMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialFishingNets() {
  const a = state.wanderingNetMaker;
  if (!a?.active) return { ok: false, reason: 'No net maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The net maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial fishing nets from the wandering net maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'netMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'netMakerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_NET_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎣 The net maker splits the linen cordage into three-strand twisted lengths, works each cord through the wooden netting needle in the traditional sheet-bend knot sequence, and hangs the completed mesh panels on the palace courtyard rope to dry — delivering deep-set river seine nets, weighted coastal drag-nets, and finely meshed reed-pool scoop-nets to every imperial fishery, ensuring the catches that fill the palace larders, feed the garrison, and supply the market stalls swell with the season's fullest bounty! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseNetMakingSecrets() {
  const a = state.wanderingNetMaker;
  if (!a?.active) return { ok: false, reason: 'No net maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The net maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased net-making secrets from the wandering net maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'netMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'netMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_NET_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The net maker opens the secrets compendium and explains the correct cordage-soaking schedule in linseed oil that prevents rot in both fresh and salt water, the mesh-gauge selection that optimises catch-size for each fish species, the lead-sinker spacing that keeps the lower net edge vertical against a current, and the repair-splice knot that restores a torn panel's full strength — the imperial market traders absorb the material-quality standards and apply the same meticulous soaking, sizing, and splicing discipline to every rope, cord, and textile commission they broker through the palace market! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendNetMakerAway() {
  const a = state.wanderingNetMaker;
  if (!a?.active) return { ok: false, reason: 'No net maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_NET_MAKER_CHANGED, { dismissed: true });
  addMessage('🎣 The wandering net maker rolls the cordage bolts and tucks away the netting needles, bows respectfully, and departs the palace — the quiet swish of the canvas satchel and the clink of lead sinkers fading as the cart moves down the gatehouse road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
