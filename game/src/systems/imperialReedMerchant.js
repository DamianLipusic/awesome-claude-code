/**
 * EmpireOS — Imperial Reed Merchant (T446).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), an imperial reed
 * merchant arrives at the settlement with a flat-bottomed barge stacked
 * high with bundles of dried marsh reed cut and cured across the summer
 * from the river delta shallows and seasonal wetland pools that fringe the
 * lowland farmland — each bundle graded by thickness and straightness into
 * thatching grade for roof covering, weaving grade for basket and mat
 * manufacture, writing grade for producing papyrus-style sheets by cross-
 * laying thin strips of split pith, and construction grade for bundling into
 * tight columns used as form-work for poured earth construction and as
 * lightweight insulating fill for cavity wall panels — a single merchant
 * barge capable of supplying a year's worth of thatching material for a
 * village or three months of basket-weaving raw material for an active
 * workshop producing storage containers, sieves, and carrying trays for the
 * harvest and market — offering to establish a standing reed supply route
 * that delivers monthly barge loads of sorted reed bundles to the
 * settlement's storehouse gate, or to share the complete methods for
 * identifying, cutting, and curing the highest-grade reed from the
 * settlement's own wetland margins. The player has 80 seconds to decide.
 *
 * Choices:
 *   🌿 Establish Reed Trade Route    — pay 25 wood + 20 gold
 *        → +0.22 wood/s for 2.5 min · +20 prestige · +12 morale
 *   📖 Purchase Reed Harvest Techniques — pay 20 food
 *        → +0.18 food/s for 2 min · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.imperialReedMerchant = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
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

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_WOOD_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_WOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 20;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST            = 20;
export const PURCHASE_FOOD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialReedMerchant() {
  if (!state.imperialReedMerchant) {
    state.imperialReedMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialReedMerchant;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialReedMerchantTick() {
  const a = state.imperialReedMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_REED_MERCHANT_CHANGED, { expired: true });
      addMessage('🌿 The imperial reed merchant poles the barge back out into the main channel and continues along the river route to the next trading post.', 'info');
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
  emit(Events.IMPERIAL_REED_MERCHANT_CHANGED, { spawned: true });
  addMessage('🌿 An imperial reed merchant arrives at the settlement landing with a flat-bottomed barge stacked high with graded bundles of cured marsh reed — thatching grade, weaving grade, writing grade, and construction grade — offering to establish a standing monthly supply route or to share the complete methods for harvesting and curing the highest-grade reed from local wetland margins. Respond within 80 seconds.', 'info');
}

export function getActiveImperialReedMerchant() { return state.imperialReedMerchant?.active ?? null; }
export function getReedMerchantSecsLeft() {
  const a = state.imperialReedMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishReedTradeRoute() {
  const a = state.imperialReedMerchant;
  if (!a?.active) return { ok: false, reason: 'No reed merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The reed merchant has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Established a reed trade route with the imperial reed merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'reedmerchantCommission');
    state.randomEvents.activeModifiers.push({
      id: 'reedmerchantCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_REED_MERCHANT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The reed merchant signs the supply agreement and unloads the first consignment directly onto the settlement's storehouse platform — thatching bundles sorted by length and taper and stacked under the eaves out of reach of summer rain, weaving bundles divided by stem diameter and set aside for the basket-weavers and mat-makers, writing-grade pith strips dampened and pressed under weighted boards to begin the cross-lay sheets that will serve the scribes and record-keepers, and construction bundles roped into tight columns for the builders' yard — establishing a reliable monthly barge delivery of sorted, cured, and graded marsh reed from the delta cutters to supply all the settlement's thatching, weaving, and building reed requirements without the settlement having to maintain its own cutting crews in the distant wetland margins. −${COMMISSION_WOOD_COST} wood · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseReedHarvestTechniques() {
  const a = state.imperialReedMerchant;
  if (!a?.active) return { ok: false, reason: 'No reed merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The reed merchant has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased reed harvest techniques from the imperial reed merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'reedmerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'reedmerchantPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_REED_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The reed merchant shares the complete harvest and curing methods — the late-summer cutting calendar that catches the reed stems at peak silica content after the seed head has fully matured and just before the first autumn frosts begin to collapse the cellular structure that gives the stem its rigidity, the water-level indicators in the wetland margins that show where the submerged rootstock is producing the straightest and longest stems free of the lateral branching that weakens a thatching bundle, the small sickle angle and cutting height above the mud surface that allows the rootstock to regenerate a full crop by the following summer without over-harvesting the marsh, the field drying and bundling technique that prevents mould in the centre of the bundle during the six-week curing period, and the grade-sorting method by stem diameter and straightness that separates thatching, weaving, writing, and construction grades from a single cutting — allowing the settlement's own workers to harvest and process high-quality reed from local wetland margins across the growing season. −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendReedMerchantAway() {
  const a = state.imperialReedMerchant;
  if (!a?.active) return { ok: false, reason: 'No reed merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_REED_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🌿 The imperial reed merchant poles the barge back out into the current and continues along the river route with a respectful wave.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
