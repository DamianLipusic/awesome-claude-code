/**
 * EmpireOS — Imperial Rope Walk Master (T462).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), an imperial rope walk
 * master arrives at the settlement carrying a sample coil of three-strand
 * hawser — thirty feet of tightly twisted hemp rope with the characteristic
 * smooth, even lay of rope worked on a professional rope walk rather than the
 * irregular, kinked product of hand-twisting — along with a set of tools and
 * detailed specifications for establishing a full rope walk: the long, narrow
 * building or covered alley required to give the laying-engine room to draw
 * out the full length of a cable in a single pass; the strand hooks that hold
 * the prepared yarns under controlled tension as they are twisted together
 * into strands; the top — a conical wooden device that simultaneously
 * maintains the correct helix angle on all three strands as the laying-engine
 * closes them into a finished rope; and the tarring cauldron in which the
 * finished rope is immersed to force hot tar into every interstice between
 * the fibres to protect them from water and rot — offering to commission a
 * full imperial rope walk installation complete with equipment and initial
 * production run, or to sell the complete specification drawings and
 * calculation tables for establishing a rope walk independently. The player
 * has 80 seconds to decide.
 *
 * Choices:
 *   ⚓ Commission Imperial Rope Walk  — pay 25 iron + 20 gold
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +12 morale
 *   📐 Purchase Rope-Making Lore     — pay 20 wood
 *        → +0.18 wood/s for 2 min · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.imperialRopeWalkMaster = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST           = 25;
export const COMMISSION_GOLD_COST           = 20;
export const COMMISSION_IRON_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD     = 22;
export const COMMISSION_MORALE_REWARD       = 12;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST             = 20;
export const PURCHASE_WOOD_RATE             = 0.18;
export const PURCHASE_PRESTIGE_REWARD       = 15;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialRopeWalkMaster() {
  if (!state.imperialRopeWalkMaster) {
    state.imperialRopeWalkMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialRopeWalkMaster;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialRopeWalkMasterTick() {
  const a = state.imperialRopeWalkMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_ROPE_WALK_MASTER_CHANGED, { expired: true });
      addMessage('⚓ The imperial rope walk master coils up the sample hawser and departs to the next settlement requiring rope walk expertise.', 'info');
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
  emit(Events.IMPERIAL_ROPE_WALK_MASTER_CHANGED, { spawned: true });
  addMessage('⚓ An imperial rope walk master arrives at the settlement carrying a sample coil of three-strand hawser — thirty feet of tightly twisted hemp rope with the characteristic smooth, even lay of rope worked on a professional rope walk — along with tools and detailed specifications for establishing a full rope walk: the long, narrow alley required for the laying-engine, the strand hooks, the top that maintains the correct helix angle on all three strands, and the tarring cauldron for forcing hot tar into every interstice between fibres to protect against water and rot. The master offers to commission a full imperial rope walk installation, or to sell the complete specification drawings and calculation tables for establishing one independently. Respond within 80 seconds.', 'info');
}

export function getActiveImperialRopeWalkMaster() { return state.imperialRopeWalkMaster?.active ?? null; }
export function getRopeWalkMasterSecsLeft() {
  const a = state.imperialRopeWalkMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialRopeWalk() {
  const a = state.imperialRopeWalkMaster;
  if (!a?.active) return { ok: false, reason: 'No rope walk master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The rope walk master has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned an imperial rope walk from the imperial rope walk master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'ropeWalkCommission');
    state.randomEvents.activeModifiers.push({
      id: 'ropeWalkCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_ROPE_WALK_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚓ The rope walk master surveys the available ground with practiced efficiency — pacing out the required length, marking the post positions for the strand hooks with stakes driven at precise intervals, checking the alignment against a stretched cord to ensure the walk runs dead straight so the rope will lay evenly without a corkscrew twist, then directing the construction of the laying house at the far end where the engine will be mounted: a low timber building just wide enough to house the geared drum and the operator's seat, with a slot cut through the end wall to pass the rope out to the full length of the walk. The iron components are drawn from stock — the hook spindles that will rotate the individual strands under the engine's drive, the metal sheave of the top that rides down the walk maintaining the lay angle as the three strands close into a finished rope — fitted and adjusted until the master is satisfied that the mechanism will produce rope to imperial specification: three-strand hawser-laid, right-hand over left-hand twist, uniform diameter from end to end. The tarring cauldron is set up alongside, heated to the temperature where pine tar flows freely into the rope under gentle squeezing between the tarring boards. −${COMMISSION_IRON_COST} iron −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRopeMakingLore() {
  const a = state.imperialRopeWalkMaster;
  if (!a?.active) return { ok: false, reason: 'No rope walk master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The rope walk master has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased rope-making lore from the imperial rope walk master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'ropeWalkPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'ropeWalkPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_ROPE_WALK_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📐 The rope walk master spreads the specification sheets across the table and explains each element in methodical sequence — beginning with the fibre selection and preparation: how to assess hemp for the long, uniform staple length that produces strong, smooth-lying yarn; the retting process where bundles of hemp are submerged in standing water for the calculated number of days to loosen the woody shive from the fibre without rotting the fibre itself; the hackling boards that draw the retted fibre through rows of iron spikes of progressively finer spacing to align the staples into long, parallel slivers ready for spinning. The spinning calculations follow: the required twist per unit length for yarn of the specified breaking strength, the number of yarns in each strand for the finished rope diameter, the helix angle at each stage of the twisting that determines whether the finished rope will be stiff and hard-laid or pliable and easy-coiling. The walk dimensions are specified precisely: the required length for the rope being produced, the post spacing, the gear ratio of the laying engine that controls the closing speed relative to the draw-back speed as the top walks towards the hooks. Finally the tarring schedule: the temperature of the tar bath, the time the rope spends immersed, the squeeze pressure applied at the tarring boards that forces the tar in while removing the excess, and the drying time before the rope is coiled for storage or use. −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendRopeWalkMasterAway() {
  const a = state.imperialRopeWalkMaster;
  if (!a?.active) return { ok: false, reason: 'No rope walk master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_ROPE_WALK_MASTER_CHANGED, { dismissed: true });
  addMessage('⚓ The imperial rope walk master coils up the sample hawser and departs to the next settlement requiring rope walk expertise.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
