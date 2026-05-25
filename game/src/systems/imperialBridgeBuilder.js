/**
 * EmpireOS — Imperial Bridge Builder (T406).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), an imperial bridge builder
 * arrives at the palace bearing detailed parchment plans for stone arch bridges,
 * timber trestle crossings, and rope suspension spans — offering to commission
 * a grand network of imperial bridges across the river crossings and ravines of
 * the empire, or to sell the latest engineering drawings for bridge foundations
 * and load-bearing arch calculations.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🌉 Commission Imperial Bridges     — pay 30 stone + 20 gold
 *        → +0.25 stone/s for 2.5 min · +25 prestige · +12 morale
 *   📐 Study Bridge Engineering         — pay 25 iron
 *        → +0.20 iron/s for 2 min · +18 prestige
 *   🚶 Send Away                         — dismiss (no reward)
 *
 * state.imperialBridgeBuilder = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalStudies:       number,
 *   totalDismissals:    number,
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

export const COMMISSION_STONE_COST         = 30;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_STONE_RATE         = 0.25;
export const COMMISSION_PRESTIGE_REWARD    = 25;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const STUDY_IRON_COST               = 25;
export const STUDY_IRON_RATE               = 0.20;
export const STUDY_PRESTIGE_REWARD         = 18;
export const STUDY_DURATION_TICKS          = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialBridgeBuilder() {
  if (!state.imperialBridgeBuilder) {
    state.imperialBridgeBuilder = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudies:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialBridgeBuilder;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalStudies      === undefined) s.totalStudies      = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialBridgeBuilderTick() {
  const a = state.imperialBridgeBuilder;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_BRIDGE_BUILDER_CHANGED, { expired: true });
      addMessage('🌉 The imperial bridge builder rolls up the detailed parchment plans and departs the palace courtyard — the sound of the engineering team\'s cartwheel fading as the bridge-building commission passes unrealised.', 'info');
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
  emit(Events.IMPERIAL_BRIDGE_BUILDER_CHANGED, { spawned: true });
  addMessage('🌉 An imperial bridge builder arrives at the palace bearing detailed parchment plans for stone arch bridges, timber trestle crossings, and rope suspension spans — offering to commission a grand network of imperial bridges across the river crossings and ravines of the empire, or to sell the latest engineering drawings for bridge foundations and load-bearing arch calculations. Respond within 80 seconds.', 'info');
}

export function getActiveImperialBridgeBuilder() { return state.imperialBridgeBuilder?.active ?? null; }
export function getBridgeBuilderSecsLeft() {
  const a = state.imperialBridgeBuilder?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialBridges() {
  const a = state.imperialBridgeBuilder;
  if (!a?.active) return { ok: false, reason: 'No bridge builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bridge builder has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST)   return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial bridges from the imperial bridge builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bridgeBuilderCommission');
    state.randomEvents.activeModifiers.push({
      id: 'bridgeBuilderCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_BRIDGE_BUILDER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌉 The bridge builder's engineering team surveys the empire's river crossings and deep ravines, laying dressed-stone abutments and precision-cut arch voussoirs — the finished imperial bridges cut days from supply line routes, inspire the quarry teams to dress stone to new tolerances, and fill the citizens with pride at the soaring spans visible for leagues across the empire! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyBridgeEngineering() {
  const a = state.imperialBridgeBuilder;
  if (!a?.active) return { ok: false, reason: 'No bridge builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bridge builder has departed.' };
  if ((state.resources.iron ?? 0) < STUDY_IRON_COST) return { ok: false, reason: `Need ${STUDY_IRON_COST} iron.` };
  state.resources.iron -= STUDY_IRON_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied bridge engineering from the imperial bridge builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bridgeBuilderStudy');
    state.randomEvents.activeModifiers.push({
      id: 'bridgeBuilderStudy', resource: 'iron',
      rateMult: 1 + (STUDY_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudies = (a.totalStudies ?? 0) + 1;
  emit(Events.IMPERIAL_BRIDGE_BUILDER_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📐 The bridge builder presents detailed engineering drawings for arch-centring jigs, iron tie-bar tensioning rigs, and load-spreading foundation grillages — the palace ironmasters study the sophisticated use of wrought-iron tension rods and reinforcing straps within masonry structures, applying the same principles to their forge tooling and lifting equipment to sharply increase the efficiency of iron production and metalworking throughout the empire! −${STUDY_IRON_COST} iron · +${STUDY_PRESTIGE_REWARD} prestige. Iron surge: +${STUDY_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBridgeBuilderAway() {
  const a = state.imperialBridgeBuilder;
  if (!a?.active) return { ok: false, reason: 'No bridge builder present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_BRIDGE_BUILDER_CHANGED, { dismissed: true });
  addMessage('🌉 The imperial bridge builder rolls up the parchment plans and departs the palace — the engineering commission for the grand arch bridges receding with the creak of the loaded survey cart on the cobblestones.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
