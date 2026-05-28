/**
 * EmpireOS — Imperial Oilpress Master (T436).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), an imperial oilpress
 * master arrives at the settlement with a detailed knowledge of beam press
 * construction — the upright stone standards, the horizontal pressing beam
 * of seasoned hardwood mortised into the uprights and leveraged down by
 * hanging stone weights on the free end to generate the sustained pressing
 * force needed to extract oil from olive paste, flaxseed crush, or pressed
 * sesame — carrying a set of iron press fittings including the screw head
 * plate, the follower board with its central screw socket, and the
 * collection basin template cut from lead sheet, along with a small
 * amphora of high-quality first-pressing oil drawn off before the
 * second pressing with added weight — offering to commission a complete
 * olive oil press installation that establishes a reliable oil extraction
 * operation for the settlement, or to share the beam press construction
 * method and pressing sequence that allows the settlement's craftspeople
 * to build and operate a press from locally available timber and stone.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🫒 Commission Olive Oil Press  — pay 25 food + 20 gold
 *        → +0.22 food/s for 2.5 min · +20 prestige · +12 morale
 *   📖 Purchase Pressing Techniques — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.imperialOilpressMaster = {
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

export const COMMISSION_FOOD_COST        = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_FOOD_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 20;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST         = 20;
export const PURCHASE_STONE_RATE         = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialOilpressMaster() {
  if (!state.imperialOilpressMaster) {
    state.imperialOilpressMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialOilpressMaster;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialOilpressMasterTick() {
  const a = state.imperialOilpressMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_OILPRESS_MASTER_CHANGED, { expired: true });
      addMessage('🫒 The imperial oilpress master re-packs the iron press fittings into the carrying chest, stoppers the oil amphora, and departs along the road toward the next settlement requiring oil press expertise.', 'info');
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
  emit(Events.IMPERIAL_OILPRESS_MASTER_CHANGED, { spawned: true });
  addMessage('🫒 An imperial oilpress master arrives at the settlement carrying a chest of iron press fittings — the screw head plate, follower board with central screw socket, and lead collection basin template — along with a small amphora of high-quality first-pressing oil, offering to commission a complete olive oil press installation establishing a reliable oil extraction operation, or to share the beam press construction method and pressing sequence for independent oil production from locally-grown oleaginous crops. Respond within 80 seconds.', 'info');
}

export function getActiveImperialOilpressMaster() { return state.imperialOilpressMaster?.active ?? null; }
export function getOilpressMasterSecsLeft() {
  const a = state.imperialOilpressMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionOliveOilPress() {
  const a = state.imperialOilpressMaster;
  if (!a?.active) return { ok: false, reason: 'No oilpress master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The oilpress master has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned olive oil press installation from the imperial oilpress master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'oilpressMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'oilpressMasterCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_OILPRESS_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🫒 The oilpress master selects the press site in the settlement's processing area, positions the upright stone standards, mortises in the horizontal pressing beam of seasoned hardwood, and fits the iron screw fittings to the follower board before conducting the first pressing run — loading the olive paste into woven esparto grass mats stacked in the press cage, lowering the follower board onto the mat stack, and applying the hanging stone weights to lever the press beam down until the golden-green first-quality oil flows freely into the lead-lined collection basin — establishing the settlement's olive oil press that delivers high-quality first-press oil for cooking, lamp fuel, and trade goods! −${COMMISSION_FOOD_COST} food · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchasePressingTechniques() {
  const a = state.imperialOilpressMaster;
  if (!a?.active) return { ok: false, reason: 'No oilpress master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The oilpress master has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased pressing techniques from the imperial oilpress master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'oilpressMasterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'oilpressMasterPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_OILPRESS_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The oilpress master shares the complete beam press construction method and pressing sequence — the standard dimensions for the upright standards in limestone or sandstone, the mortise depth and hardwood species selection for the pressing beam that resists the sustained compression force without cracking, the iron screw thread pitch that provides controlled pressing force without stripping, the esparto mat weave density that retains olive paste while allowing oil flow, the stone weight calculation for the leverage ratio needed for complete first-press extraction, and the two-pressing sequence that extracts maximum oil yield from the harvest — knowledge that allows the settlement's craftspeople to build and operate an effective oil press from locally available timber and stone, producing high-quality oil for culinary, ceremonial, and trade purposes. −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendOilpressMasterAway() {
  const a = state.imperialOilpressMaster;
  if (!a?.active) return { ok: false, reason: 'No oilpress master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_OILPRESS_MASTER_CHANGED, { dismissed: true });
  addMessage('🫒 The imperial oilpress master repacks the iron press fittings and departs along the road with a respectful nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
