/**
 * EmpireOS — Imperial Well Builder (T442).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), an imperial well builder
 * arrives at the settlement carrying a roll of architectural drawings for the
 * standard imperial-specification deep well — the round shaft sunk through the
 * overburden to the water-bearing gravel or fractured limestone aquifer below,
 * lined with voussoir stone rings fitted dry without mortar so that groundwater
 * can enter freely through every joint from the full depth of the aquifer
 * rather than only at the base, the upper five courses above the water table
 * mortared in lime against surface contamination, the stone curb at the top
 * fitted with the standard iron-banded hardwood windlass frame and rope drum
 * that allows the bucket to be raised smoothly without the rope fouling on the
 * shaft walls, the whole structure covered by the octagonal canopy on four
 * stone corner posts that sheds rain and prevents organic material from blowing
 * into the shaft and fouling the water supply over decades of use — offering to
 * commission a full well sinking and lining to imperial specification at the
 * optimal location identified by the divining and test-boring survey, or to
 * share the complete well-sinking methods including the shaft survey technique,
 * the voussoir ring cutting and fitting sequence, and the water quality
 * assessment tests that allow the settlement's builders to sink reliable wells
 * in new locations as the settlement expands. The player has 80 seconds to
 * decide.
 *
 * Choices:
 *   🏗️ Commission Well Construction   — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +20 prestige · +12 morale
 *   📖 Purchase Well-Sinking Methods  — pay 20 food
 *        → +0.18 food/s for 2 min · +15 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.imperialWellBuilder = {
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

export const COMMISSION_STONE_COST       = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_STONE_RATE       = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 20;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST          = 20;
export const PURCHASE_FOOD_RATE          = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialWellBuilder() {
  if (!state.imperialWellBuilder) {
    state.imperialWellBuilder = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialWellBuilder;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialWellBuilderTick() {
  const a = state.imperialWellBuilder;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_WELL_BUILDER_CHANGED, { expired: true });
      addMessage('🏗️ The imperial well builder re-rolls the architectural drawings and departs along the road to the next commission.', 'info');
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
  emit(Events.IMPERIAL_WELL_BUILDER_CHANGED, { spawned: true });
  addMessage('🏗️ An imperial well builder arrives at the settlement carrying architectural drawings for the standard imperial-specification deep well — voussoir stone rings, lime-mortared upper courses, iron-banded windlass frame, and octagonal canopy — offering to commission a full well sinking to imperial specification at the optimal aquifer location identified by test-boring survey, or to share the complete well-sinking methods for reliable water supply as the settlement expands. Respond within 80 seconds.', 'info');
}

export function getActiveImperialWellBuilder() { return state.imperialWellBuilder?.active ?? null; }
export function getWellBuilderSecsLeft() {
  const a = state.imperialWellBuilder?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionWellConstruction() {
  const a = state.imperialWellBuilder;
  if (!a?.active) return { ok: false, reason: 'No well builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The well builder has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned well construction from the imperial well builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'wellBuilderCommission');
    state.randomEvents.activeModifiers.push({
      id: 'wellBuilderCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_WELL_BUILDER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏗️ The well builder conducts the test-boring survey with the iron-tipped probe rod to locate the optimal shaft position over the water-bearing gravel layer — marking the centre point, setting out the shaft circle with the compasses and marking iron, and beginning the excavation with a team of diggers working in shifts to sink the shaft through the clay overburden to the gravel aquifer below — lining the completed shaft with the pre-cut voussoir stone rings fitted dry from the base upward to allow groundwater entry through every joint, then mortaring the upper five courses above the water table in lime against surface contamination, completing the iron-banded hardwood windlass frame and rope drum on the stone curb, and finishing with the octagonal canopy on four dressed corner posts — delivering a clean reliable water supply that eliminates the daily carrying task from the distant stream and raises the health and productivity of every household and workshop in the settlement, generating immediate and lasting gratitude and prestige! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseWellSinkingMethods() {
  const a = state.imperialWellBuilder;
  if (!a?.active) return { ok: false, reason: 'No well builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The well builder has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased well-sinking methods from the imperial well builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'wellBuilderPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'wellBuilderPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_WELL_BUILDER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The well builder shares the complete well-sinking methods — the test-boring procedure using the iron-tipped probe rod that identifies the depth and angle of the water-bearing gravel layer from multiple bore points before committing to a shaft location, the shaft survey technique using the plumb bob and boning rods that keeps the excavation perfectly vertical from surface to depth, the voussoir ring cutting dimensions for different shaft diameters calculated from the stone available at the local quarry, the dry-laid fitting sequence from the base upward that produces the self-supporting ring stack without mortar in the saturated lower courses, the water quality assessment tests using the copper and silver immersion rods that identify contamination from surface drainage or mineral load from the aquifer rock, and the windlass frame sizing ratios that match the rope drum diameter to the anticipated shaft depth for smooth reliable bucket retrieval — knowledge that allows the settlement's builders to sink clean reliable wells in new locations as the settlement grows and reduces dependence on surface water collection. −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendWellBuilderAway() {
  const a = state.imperialWellBuilder;
  if (!a?.active) return { ok: false, reason: 'No well builder present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_WELL_BUILDER_CHANGED, { dismissed: true });
  addMessage('🏗️ The imperial well builder re-rolls the architectural drawings and departs along the road with a respectful nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
