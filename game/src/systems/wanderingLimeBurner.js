/**
 * EmpireOS — Wandering Lime Burner (T437).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering lime burner
 * arrives at the settlement leading a pack mule loaded with rough-quarried
 * limestone chunks broken with a hammer and wedge from an outcrop worked along
 * the road — the stone freshly chipped to expose the white calcium carbonate
 * faces that calcine cleanly in the kiln built from fieldstone and clay mortar
 * lined with a charge of fuel wood stacked carefully around the limestone
 * charge to sustain the sustained high temperature of eight hundred to nine
 * hundred degrees needed to drive off carbon dioxide and convert the calcium
 * carbonate to quicklime that slakes exothermically when water is added to
 * produce the calcium hydroxide putty that hardens with atmospheric carbon
 * dioxide into the calcium carbonate mortar that binds stone courses in walls,
 * vaults, and foundations through the centuries — offering to commission a full
 * run of lime mortar produced in a kiln built at the edge of the settlement and
 * burned over three days using the settlement's own stone and wood fuel, or to
 * share the complete calcination and slaking sequence that allows the
 * settlement's masons to produce building lime reliably from local limestone
 * outcrops without dependence on imported mortar. The player has 80 seconds to
 * decide.
 *
 * Choices:
 *   🪨 Commission Lime Mortar Works  — pay 20 stone + 15 food
 *        → +0.20 stone/s for 2.5 min · +15 prestige · +8 morale
 *   📖 Purchase Kiln Techniques      — pay 18 gold
 *        → +0.15 food/s for 2 min · +10 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingLimeBurner = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_STONE_COST       = 20;
export const COMMISSION_FOOD_COST        = 15;
export const COMMISSION_STONE_RATE       = 0.20;
export const COMMISSION_PRESTIGE_REWARD  = 15;
export const COMMISSION_MORALE_REWARD    = 8;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_FOOD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 10;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingLimeBurner() {
  if (!state.wanderingLimeBurner) {
    state.wanderingLimeBurner = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingLimeBurner;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingLimeBurnerTick() {
  const a = state.wanderingLimeBurner;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_LIME_BURNER_CHANGED, { expired: true });
      addMessage('🪨 The wandering lime burner re-loads the unslaked quicklime into sealed clay jars on the pack mule and departs along the road before the exothermic reaction can cause damage to the load.', 'info');
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
  emit(Events.WANDERING_LIME_BURNER_CHANGED, { spawned: true });
  addMessage('🪨 A wandering lime burner arrives at the settlement leading a pack mule loaded with rough-quarried limestone chunks — offering to commission a full run of lime mortar burned in a fieldstone kiln built at the edge of the settlement over three days using local stone and wood fuel, producing the calcium hydroxide putty that hardens into lasting building mortar, or to share the complete calcination and slaking sequence for reliable lime production from local limestone outcrops. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingLimeBurner() { return state.wanderingLimeBurner?.active ?? null; }
export function getLimeBurnerSecsLeft() {
  const a = state.wanderingLimeBurner?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionLimeMortarWorks() {
  const a = state.wanderingLimeBurner;
  if (!a?.active) return { ok: false, reason: 'No lime burner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lime burner has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.food  -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned lime mortar works from the wandering lime burner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'limeBurnerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'limeBurnerCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_LIME_BURNER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪨 The lime burner selects a sheltered site at the edge of the settlement and builds the fieldstone kiln with a clay-lined interior — stacking alternating courses of limestone and fuel wood in the traditional draw kiln pattern that sustains the calcination temperature evenly across the entire charge — burning for three days until the limestone charge converts completely to quicklime then slaking the product carefully with measured water to produce the smooth calcium hydroxide putty of highest quality that sets into strong lasting mortar for the settlement's masonry works, raising confidence among the masons and bringing notable prestige to the construction programme! −${COMMISSION_STONE_COST} stone · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseKilnTechniques() {
  const a = state.wanderingLimeBurner;
  if (!a?.active) return { ok: false, reason: 'No lime burner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lime burner has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased kiln techniques from the wandering lime burner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'limeBurnerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'limeBurnerPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_LIME_BURNER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The lime burner shares the complete calcination and slaking sequence — the quarry selection criteria that identifies limestone with the highest calcium carbonate content and lowest clay impurities that produce the cleanest quicklime, the kiln construction dimensions that achieve the optimal ratio of fuel bed to stone charge for sustained calcination temperature, the draw cycle timing that prevents over-burning the base courses while ensuring the top courses reach full conversion, and the slaking water temperature and addition rate that produces the smoothest most plastic putty rather than a gritty or granular product — knowledge that allows the settlement's masons to produce building lime reliably from local limestone outcrops and ensure steady foundation and wall construction. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLimeBurnerAway() {
  const a = state.wanderingLimeBurner;
  if (!a?.active) return { ok: false, reason: 'No lime burner present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_LIME_BURNER_CHANGED, { dismissed: true });
  addMessage('🪨 The wandering lime burner re-loads the limestone chunks onto the pack mule and departs along the road with a respectful nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
