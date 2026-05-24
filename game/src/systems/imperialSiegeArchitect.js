/**
 * EmpireOS — Imperial Siege Architect (T388).
 *
 * Every 15–20 minutes (Iron Age+, 12+ player tiles), a renowned imperial siege
 * architect arrives at court carrying detailed engineering blueprints for
 * advanced siege towers and fortification designs — offering to commission a
 * set of powerful siege tower constructions, or to sell valuable fortification
 * design secrets to the imperial engineers.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🏰 Commission Siege Towers       — pay 30 iron + 20 stone
 *        → +0.22 iron/s for 2.5 min · +25 prestige · +12 morale
 *   📐 Study Fortification Designs   — pay 25 gold
 *        → +0.18 stone/s for 2 min · +18 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.imperialSiegeArchitect = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
 *   totalPurchases:    number,
 *   totalDismissals:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_IRON_COST        = 30;
export const COMMISSION_STONE_COST       = 20;
export const COMMISSION_IRON_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 25;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 25;
export const PURCHASE_STONE_RATE         = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 18;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSiegeArchitect() {
  if (!state.imperialSiegeArchitect) {
    state.imperialSiegeArchitect = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialSiegeArchitect;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function imperialSiegeArchitectTick() {
  const a = state.imperialSiegeArchitect;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SIEGE_ARCHITECT_CHANGED, { expired: true });
      addMessage('🏰 The imperial siege architect carefully rolls the engineering blueprints back into the leather tube, and departs from the capital with professional courtesy — the faint creak of the blueprint case closing echoes as the renowned architect strides away through the gate.', 'info');
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
  emit(Events.IMPERIAL_SIEGE_ARCHITECT_CHANGED, { spawned: true });
  addMessage('🏰 A renowned imperial siege architect arrives at the capital bearing rolled engineering blueprints, detailed siege tower schematics, and classified fortification designs — offering to commission a set of powerful siege tower constructions for the imperial army, or to share valuable fortification design secrets with the imperial engineers. Respond within 80 seconds.', 'info');
}

export function getActiveImperialSiegeArchitect() { return state.imperialSiegeArchitect?.active ?? null; }
export function getSiegeArchitectSecsLeft() {
  const a = state.imperialSiegeArchitect?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionSiegeTowers() {
  const a = state.imperialSiegeArchitect;
  if (!a?.active) return { ok: false, reason: 'No siege architect present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The siege architect has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.iron  -= COMMISSION_IRON_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned siege towers from the imperial siege architect');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'siegeArchitectCommission');
    state.randomEvents.activeModifiers.push({
      id: 'siegeArchitectCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_ARCHITECT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏰 The siege architect oversees the construction of a formidable battery of siege towers — massive wheeled platforms reinforced with iron brackets, equipped with drawbridges and protective screens that project imperial military power and inspire the iron workers and engineers of the realm to push production to remarkable new heights! −${COMMISSION_IRON_COST} iron · −${COMMISSION_STONE_COST} stone · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyFortificationDesigns() {
  const a = state.imperialSiegeArchitect;
  if (!a?.active) return { ok: false, reason: 'No siege architect present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The siege architect has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Studied fortification designs from the imperial siege architect');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'siegeArchitectStudy');
    state.randomEvents.activeModifiers.push({
      id: 'siegeArchitectStudy', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_ARCHITECT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📐 The siege architect presents a comprehensive collection of fortification designs — advanced wall configurations, reinforced gatehouse blueprints, and optimised quarry extraction methods that the imperial engineers and quarrymen apply immediately to dramatically boost stone production throughout the realm! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSiegeArchitectAway() {
  const a = state.imperialSiegeArchitect;
  if (!a?.active) return { ok: false, reason: 'No siege architect present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_ARCHITECT_CHANGED, { dismissed: true });
  addMessage('🏰 The imperial siege architect rolls the engineering blueprints back into the travel case, and departs from the capital with professional courtesy — the faint sound of armored boots on stone steps fading as the renowned architect disappears through the gate.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
