/**
 * EmpireOS — Imperial Road Builder (T338).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), a master imperial road
 * builder arrives bearing survey rods, rolled parchment blueprints, and
 * offers to construct durable road networks and stone-paved causeways that
 * will knit the empire's territories together and increase trade flows.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🛤️ Commission Imperial Roads  — pay 25 stone + 15 iron
 *        → +0.20 stone/s for 2.5 min · +22 prestige · +12 morale
 *   🗺️ Exchange Road Maps         — pay 20 gold
 *        → +0.15 gold/s for 2 min   · +15 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.imperialRoadBuilder = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalBuilt:       number,
 *   totalExchanged:   number,
 *   totalDismissals:  number,
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

export const BUILD_STONE_COST           = 25;
export const BUILD_IRON_COST            = 15;
export const BUILD_STONE_RATE           = 0.20;
export const BUILD_PRESTIGE_REWARD      = 22;
export const BUILD_MORALE_REWARD        = 12;
export const BUILD_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_GOLD_COST         = 20;
export const EXCHANGE_GOLD_RATE         = 0.15;
export const EXCHANGE_PRESTIGE_REWARD   = 15;
export const EXCHANGE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialRoadBuilder() {
  if (!state.imperialRoadBuilder) {
    state.imperialRoadBuilder = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalBuilt:      0,
      totalExchanged:  0,
      totalDismissals: 0,
    };
  }
  const s = state.imperialRoadBuilder;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalBuilt      === undefined) s.totalBuilt      = 0;
  if (s.totalExchanged  === undefined) s.totalExchanged  = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function imperialRoadBuilderTick() {
  const a = state.imperialRoadBuilder;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_ROAD_BUILDER_CHANGED, { expired: true });
      addMessage('🛤️ The imperial road builder rolls up their survey rods and parchment blueprints, loads the equipment onto a wagon, and departs to survey the next stretch of the empire\'s great road network.', 'info');
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
  emit(Events.IMPERIAL_ROAD_BUILDER_CHANGED, { spawned: true });
  addMessage('🛤️ A master imperial road builder arrives bearing precision survey rods, rolled parchment blueprints, and detailed topographic maps. They offer to commission durable stone-paved roads across imperial territories or share their road-building expertise with the empire\'s engineers. Respond within 80 seconds.', 'info');
}

export function getActiveImperialRoadBuilder() { return state.imperialRoadBuilder?.active ?? null; }
export function getRoadBuilderSecsLeft() {
  const a = state.imperialRoadBuilder?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialRoads() {
  const a = state.imperialRoadBuilder;
  if (!a?.active) return { ok: false, reason: 'No road builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The road builder has departed.' };
  if ((state.resources.stone ?? 0) < BUILD_STONE_COST) return { ok: false, reason: `Need ${BUILD_STONE_COST} stone.` };
  if ((state.resources.iron ?? 0) < BUILD_IRON_COST) return { ok: false, reason: `Need ${BUILD_IRON_COST} iron.` };
  state.resources.stone -= BUILD_STONE_COST;
  state.resources.iron  -= BUILD_IRON_COST;
  changeMorale(BUILD_MORALE_REWARD);
  awardPrestige(BUILD_PRESTIGE_REWARD, 'Commissioned imperial road construction from the road builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'roadBuilderBuild');
    state.randomEvents.activeModifiers.push({
      id: 'roadBuilderBuild', resource: 'stone',
      rateMult: 1 + (BUILD_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + BUILD_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalBuilt = (a.totalBuilt ?? 0) + 1;
  emit(Events.IMPERIAL_ROAD_BUILDER_CHANGED, { built: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🛤️ The road builder deploys a crew of skilled engineers and laborers, laying stone-paved causeways across the empire's territories. Trade caravans move swiftly, supply lines shorten, and citizens celebrate the new infrastructure! −${BUILD_STONE_COST} stone · −${BUILD_IRON_COST} iron · +${BUILD_PRESTIGE_REWARD} prestige · +${BUILD_MORALE_REWARD} morale. Stone surge: +${BUILD_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeRoadMaps() {
  const a = state.imperialRoadBuilder;
  if (!a?.active) return { ok: false, reason: 'No road builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The road builder has departed.' };
  if ((state.resources.gold ?? 0) < EXCHANGE_GOLD_COST) return { ok: false, reason: `Need ${EXCHANGE_GOLD_COST} gold.` };
  state.resources.gold -= EXCHANGE_GOLD_COST;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged road maps with the imperial road builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'roadBuilderExchange');
    state.randomEvents.activeModifiers.push({
      id: 'roadBuilderExchange', resource: 'gold',
      rateMult: 1 + (EXCHANGE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalExchanged = (a.totalExchanged ?? 0) + 1;
  emit(Events.IMPERIAL_ROAD_BUILDER_CHANGED, { exchanged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ The road builder hands over precisely surveyed road maps marking optimal trade routes, mountain passes, and river crossing points throughout the region. Imperial merchants begin exploiting these routes for faster, more profitable caravans! −${EXCHANGE_GOLD_COST} gold · +${EXCHANGE_PRESTIGE_REWARD} prestige. Gold surge: +${EXCHANGE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendRoadBuilderAway() {
  const a = state.imperialRoadBuilder;
  if (!a?.active) return { ok: false, reason: 'No road builder present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_ROAD_BUILDER_CHANGED, { dismissed: true });
  addMessage('🛤️ The imperial road builder bows respectfully, secures their survey equipment, and departs to assess road-building opportunities in neighboring territories.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
