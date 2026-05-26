/**
 * EmpireOS — Wandering Peat Cutter (T415).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering peat cutter
 * arrives at the palace with iron-shod peat spades, curved breast-spades, and
 * stacked blocks of air-dried blanket peat harvested from high moorland bogs —
 * offering to commission a network of peat hearths across the imperial granaries,
 * barracks, and longhouses to provide steady low-smoke warmth through every
 * season, or to share the centuries-old peat-cutting and stacking techniques
 * for identifying prime-grade sphagnum bog, reading the blade-crumble of
 * well-dried peat, and building compact footing-stacks that shed rain and cure
 * in half the usual time. The player has 80 seconds to decide.
 *
 * Choices:
 *   🪵 Commission Peat Hearths     — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +15 prestige · +10 morale
 *   🌿 Purchase Peat-Cutting Lore  — pay 18 gold
 *        → +0.15 wood/s for 2 min · +12 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.wanderingPeatCutter = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissioned:  number,
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST          = 20;
export const COMMISSION_WOOD_COST          = 15;
export const COMMISSION_FOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_WOOD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingPeatCutter() {
  if (!state.wanderingPeatCutter) {
    state.wanderingPeatCutter = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalCommissioned: 0,
      totalPurchased:    0,
      totalDismissals:   0,
    };
  }
  const s = state.wanderingPeatCutter;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissioned=== undefined) s.totalCommissioned= 0;
  if (s.totalPurchased   === undefined) s.totalPurchased   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingPeatCutterTick() {
  const a = state.wanderingPeatCutter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_PEAT_CUTTER_CHANGED, { expired: true });
      addMessage('🪵 The wandering peat cutter reloads the air-dried blanket peat blocks onto the barrow, tucks the iron-shod spades and curved breast-spades into the tool roll, and departs the palace — the faint scent of moorland bog fading as the loaded barrow rolls through the gatehouse arch and the imperial hearth commission passes unrealised.', 'info');
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
  emit(Events.WANDERING_PEAT_CUTTER_CHANGED, { spawned: true });
  addMessage('🪵 A wandering peat cutter arrives at the palace with iron-shod peat spades, curved breast-spades, and stacked blocks of air-dried blanket peat harvested from high moorland bogs — offering to commission a network of peat hearths across the imperial granaries, barracks, and longhouses, or to share centuries-old peat-cutting techniques for harvesting and stacking prime-grade sphagnum peat. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingPeatCutter() { return state.wanderingPeatCutter?.active ?? null; }
export function getPeatCutterSecsLeft() {
  const a = state.wanderingPeatCutter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionPeatHearths() {
  const a = state.wanderingPeatCutter;
  if (!a?.active) return { ok: false, reason: 'No peat cutter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The peat cutter has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned peat hearths with the wandering peat cutter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'peatCutterHearths');
    state.randomEvents.activeModifiers.push({
      id: 'peatCutterHearths', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.WANDERING_PEAT_CUTTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The peat cutter sets to work installing compact stone-lined hearth bases in every granary, barracks longhouse, and garrison hall — laying iron fire-backs and peat-grate brackets, stacking the first ring of dried blanket peat in the measured radial pattern that maximises combustion and minimises smoke, and teaching the imperial stores keepers the art of feeding a peat fire to hold a steady low-temperature warmth all night without constant tending, filling every building in the imperial compound with the soft, clean heat of well-burned moorland peat! −${COMMISSION_FOOD_COST} food · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchasePeatCuttingLore() {
  const a = state.wanderingPeatCutter;
  if (!a?.active) return { ok: false, reason: 'No peat cutter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The peat cutter has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased peat-cutting lore from the wandering peat cutter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'peatCutterLore');
    state.randomEvents.activeModifiers.push({
      id: 'peatCutterLore', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.WANDERING_PEAT_CUTTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The peat cutter opens the worn field notebook and teaches how to read the surface vegetation for sub-surface peat quality, how to cut clean slabs with a single angled breast-spade stroke, and how to stack the cut blocks in the open-sided footing pattern that allows wind-drying from all four sides without rain penetration — the imperial woodcutters and foresters absorb the moisture-management and precise stacking principles and apply the same disciplined harvesting approach to every timber operation across the empire! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendPeatCutterAway() {
  const a = state.wanderingPeatCutter;
  if (!a?.active) return { ok: false, reason: 'No peat cutter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_PEAT_CUTTER_CHANGED, { dismissed: true });
  addMessage('🪵 The wandering peat cutter reloads the blanket peat blocks and peat spades onto the barrow and departs the palace — the quiet creak of the loaded barrow wheel fading down the gatehouse road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
