/**
 * EmpireOS — Wandering Bellows Maker (T447).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering bellows
 * maker arrives at the settlement carrying a pair of finished forge bellows
 * assembled from thick ox-hide panels stitched around a rigid wooden frame
 * with a tapered iron nozzle at the front and a simple flap valve cut from
 * cured goat skin at the back — each bellows capable of delivering a
 * sustained directed blast of air into a charcoal bed that raises the fire
 * temperature far beyond what any natural draught can achieve, allowing iron
 * to be worked at the correct heat for shaping and welding, bronze to be cast
 * in deep moulds without cold shutting, and ceramic kilns to reach the
 * consistent high temperatures that transform coarse clay bodies into dense,
 * ringing stoneware — offering to commission a full set of forge bellows for
 * the settlement's smiths and kiln operators, or to share the complete
 * methods for selecting and preparing hides, cutting valve flaps, fitting
 * nozzles, and assembling the frame that allow the settlement's own leather-
 * workers and carpenters to produce replacement and spare bellows from local
 * materials without waiting for a travelling specialist. The player has 80
 * seconds to decide.
 *
 * Choices:
 *   🔥 Commission Forge Bellows     — pay 20 wood + 15 food
 *        → +0.22 wood/s for 2.5 min · +15 prestige · +8 morale
 *   📖 Purchase Bellows-Making Lore — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingBellowsMaker = {
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

export const COMMISSION_WOOD_COST          = 20;
export const COMMISSION_FOOD_COST          = 15;
export const COMMISSION_WOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingBellowsMaker() {
  if (!state.wanderingBellowsMaker) {
    state.wanderingBellowsMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingBellowsMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingBellowsMakerTick() {
  const a = state.wanderingBellowsMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_BELLOWS_MAKER_CHANGED, { expired: true });
      addMessage('🔥 The wandering bellows maker ties the finished bellows in oiled canvas and departs down the road toward the next forge settlement.', 'info');
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
  emit(Events.WANDERING_BELLOWS_MAKER_CHANGED, { spawned: true });
  addMessage('🔥 A wandering bellows maker arrives at the settlement carrying a pair of finished forge bellows — thick ox-hide panels stitched around a rigid wooden frame with a tapered iron nozzle — offering to commission a full set of forge bellows for the settlement\'s smiths and kiln operators, or to share the complete methods for making replacement bellows from local materials. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingBellowsMaker() { return state.wanderingBellowsMaker?.active ?? null; }
export function getBellowsMakerSecsLeft() {
  const a = state.wanderingBellowsMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionForgeBellows() {
  const a = state.wanderingBellowsMaker;
  if (!a?.active) return { ok: false, reason: 'No bellows maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bellows maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned forge bellows from the wandering bellows maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bellowsmakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'bellowsmakerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_BELLOWS_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔥 The bellows maker spends the morning at the forge shed fitting the finished bellows to each hearth station — the large paired forge bellows mounted on a pivot frame above the main charcoal bed with foot-pedal linkage so a smith can drive both chambers alternately with heel-and-toe motion while keeping both hands free on the work piece, the smaller single-chamber kiln bellows hung on a swivel bracket beside the pottery kiln with a long flexible nozzle that reaches into the fire box, and a spare pair of hand bellows stored in the tool chest against the wall — each nozzle sealed into the clay tuyere with a ring of fire-clay that protects the iron from the heat of the firebox while directing the blast precisely to the base of the fuel bed where the temperature is highest — along with a bundle of spare valve flap blanks cut from heavy cured hide and a set of replacement nozzle rings in three diameters to fit the existing hearths. −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseBellowsMakingLore() {
  const a = state.wanderingBellowsMaker;
  if (!a?.active) return { ok: false, reason: 'No bellows maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bellows maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased bellows-making lore from the wandering bellows maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bellowsmakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'bellowsmakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_BELLOWS_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The bellows maker shares the full craft methods — the hide selection criteria that identify the sections of an ox hide with the correct combination of thickness and suppleness for a bellows panel that will flex ten thousand times without splitting at the fold line, the stitching pattern that locks each panel to the frame board along all four edges and rounds the corners with a double-pass saddle stitch set in a groove scored into the wood so the thread sits below the surface and cannot be abraded by the frame edge, the valve flap geometry that gives reliable one-way flow at low deflection angles so the valve does not restrict the delivery stroke, the nozzle fitting sequence using fire-clay as a press-fit sealant that can be replaced when the clay degrades from thermal cycling, and the frame-board selection from straight-grained dense hardwood that will not warp from the heat and humidity of forge work — allowing the settlement's own leatherworkers and carpenters to produce and repair forge bellows in-house from the next season forward. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBellowsMakerAway() {
  const a = state.wanderingBellowsMaker;
  if (!a?.active) return { ok: false, reason: 'No bellows maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_BELLOWS_MAKER_CHANGED, { dismissed: true });
  addMessage('🔥 The wandering bellows maker ties the finished bellows in oiled canvas and departs with a courteous nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
