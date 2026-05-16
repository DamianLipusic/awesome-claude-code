/**
 * EmpireOS — Traveling Architect (T296).
 *
 * Every 15–20 minutes (Iron Age+, 12+ player tiles), a renowned architect
 * arrives bearing elaborate imperial blueprints, structural innovations, and
 * construction mastery earned across a dozen great cities. The player has
 * 80 seconds to decide.
 *
 * Choices:
 *   🏛️ Commission Imperial Blueprint — pay 35 gold + 20 stone
 *        → +0.2 stone/s for 2.5 min · +28 prestige · +10 morale
 *   📏 Study Design Principles       — pay 15 mana
 *        → +0.12 iron/s for 2 min · +15 prestige
 *   👋 Send Away                     — dismiss (no reward)
 *
 * state.travelingArchitect = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalBlueprints:     number,
 *   totalDesigns:        number,
 *   totalDismissals:     number,
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

export const BLUEPRINT_GOLD_COST         = 35;
export const BLUEPRINT_STONE_COST        = 20;
export const BLUEPRINT_STONE_RATE        = 0.2;
export const BLUEPRINT_PRESTIGE_REWARD   = 28;
export const BLUEPRINT_MORALE_REWARD     = 10;
export const BLUEPRINT_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const DESIGN_MANA_COST            = 15;
export const DESIGN_IRON_RATE            = 0.12;
export const DESIGN_PRESTIGE_REWARD      = 15;
export const DESIGN_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initTravelingArchitect() {
  if (!state.travelingArchitect) {
    state.travelingArchitect = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalBlueprints: 0,
      totalDesigns:    0,
      totalDismissals: 0,
    };
  }
  const s = state.travelingArchitect;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalBlueprints === undefined) s.totalBlueprints = 0;
  if (s.totalDesigns    === undefined) s.totalDesigns    = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function travelingArchitectTick() {
  const a = state.travelingArchitect;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.TRAVELING_ARCHITECT_CHANGED, { expired: true });
      addMessage('🏛️ The traveling architect rolls their blueprints into a leather case, mounts their horse, and rides toward the horizon in search of a patron worthy of their grand visions.', 'info');
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
  emit(Events.TRAVELING_ARCHITECT_CHANGED, { spawned: true });
  addMessage('🏛️ A celebrated traveling architect arrives at court, their saddlebags stuffed with ambitious blueprints for aqueducts, amphitheaters, and soaring stone towers inspired by the mightiest civilizations of the known world. Respond within 80 seconds.', 'info');
}

export function getActiveArchitect() { return state.travelingArchitect?.active ?? null; }
export function getArchitectSecsLeft() {
  const a = state.travelingArchitect?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialBlueprint() {
  const a = state.travelingArchitect;
  if (!a?.active) return { ok: false, reason: 'No architect present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The architect has departed.' };
  if ((state.resources.gold  ?? 0) < BLUEPRINT_GOLD_COST)  return { ok: false, reason: `Need ${BLUEPRINT_GOLD_COST} gold.` };
  if ((state.resources.stone ?? 0) < BLUEPRINT_STONE_COST) return { ok: false, reason: `Need ${BLUEPRINT_STONE_COST} stone.` };
  state.resources.gold  -= BLUEPRINT_GOLD_COST;
  state.resources.stone -= BLUEPRINT_STONE_COST;
  changeMorale(BLUEPRINT_MORALE_REWARD);
  awardPrestige(BLUEPRINT_PRESTIGE_REWARD, 'Commissioned an imperial blueprint from a traveling architect');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'architectBlueprint');
    state.randomEvents.activeModifiers.push({
      id: 'architectBlueprint', resource: 'stone',
      rateMult: 1 + (BLUEPRINT_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + BLUEPRINT_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalBlueprints = (a.totalBlueprints ?? 0) + 1;
  emit(Events.TRAVELING_ARCHITECT_CHANGED, { blueprint: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏛️ The architect's sweeping vision transforms the imperial capital's quarries and construction crews into a marvel of organized efficiency, with stone flowing from mountain to building at unprecedented speed! −${BLUEPRINT_GOLD_COST} gold · −${BLUEPRINT_STONE_COST} stone · +${BLUEPRINT_PRESTIGE_REWARD} prestige · +${BLUEPRINT_MORALE_REWARD} morale. Quarry surge: +${BLUEPRINT_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyDesignPrinciples() {
  const a = state.travelingArchitect;
  if (!a?.active) return { ok: false, reason: 'No architect present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The architect has departed.' };
  if ((state.resources.mana ?? 0) < DESIGN_MANA_COST) return { ok: false, reason: `Need ${DESIGN_MANA_COST} mana.` };
  state.resources.mana -= DESIGN_MANA_COST;
  awardPrestige(DESIGN_PRESTIGE_REWARD, 'Studied design principles from a traveling architect');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'architectDesign');
    state.randomEvents.activeModifiers.push({
      id: 'architectDesign', resource: 'iron',
      rateMult: 1 + (DESIGN_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + DESIGN_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDesigns = (a.totalDesigns ?? 0) + 1;
  emit(Events.TRAVELING_ARCHITECT_CHANGED, { design: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📏 The architect's revolutionary structural techniques inspire imperial smiths and engineers to refine their methods, driving iron production and tool quality to remarkable new heights! −${DESIGN_MANA_COST} mana · +${DESIGN_PRESTIGE_REWARD} prestige. Forge surge: +${DESIGN_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendArchitectAway() {
  const a = state.travelingArchitect;
  if (!a?.active) return { ok: false, reason: 'No architect present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.TRAVELING_ARCHITECT_CHANGED, { dismissed: true });
  addMessage('🏛️ The traveling architect nods with dignified acceptance, gathers their rolled blueprints and surveying instruments, and departs to seek a more ambitious patron elsewhere.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
