/**
 * EmpireOS — Imperial Ferryman (T350).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), an imperial ferryman
 * arrives offering to establish efficient river crossing routes and share
 * hard-won navigation charts of the empire's waterways. The player has
 * 80 seconds to decide.
 *
 * Choices:
 *   ⛵ Establish Ferry Routes     — pay 20 wood + 15 gold
 *        → +0.22 wood/s for 2.5 min · +18 prestige · +10 morale
 *   🗺️ Purchase River Charts      — pay 20 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   👋 Send Away                  — dismiss (no reward)
 *
 * state.imperialFerryman = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalRoutes:      number,
 *   totalCharts:      number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const ROUTES_WOOD_COST         = 20;
export const ROUTES_GOLD_COST         = 15;
export const ROUTES_WOOD_RATE         = 0.22;
export const ROUTES_PRESTIGE_REWARD   = 18;
export const ROUTES_MORALE_REWARD     = 10;
export const ROUTES_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const CHARTS_GOLD_COST         = 20;
export const CHARTS_GOLD_RATE         = 0.15;
export const CHARTS_PRESTIGE_REWARD   = 12;
export const CHARTS_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialFerryman() {
  if (!state.imperialFerryman) {
    state.imperialFerryman = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalRoutes:     0,
      totalCharts:     0,
      totalDismissals: 0,
    };
  }
  const s = state.imperialFerryman;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalRoutes      === undefined) s.totalRoutes      = 0;
  if (s.totalCharts      === undefined) s.totalCharts      = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialFerrymanTick() {
  const a = state.imperialFerryman;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_FERRYMAN_CHANGED, { expired: true });
      addMessage('⛵ The imperial ferryman rolls up the waterway charts, coils the mooring ropes, and poles the flat-bottomed ferry back out onto the river, disappearing into the morning mist.', 'info');
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
  emit(Events.IMPERIAL_FERRYMAN_CHANGED, { spawned: true });
  addMessage('⛵ An imperial ferryman arrives at the imperial docks bearing well-worn river charts, precise tide tables, and decades of navigational wisdom from the empire\'s waterways. They offer to establish permanent ferry crossing routes to accelerate the movement of timber and trade goods, or sell detailed river charts with hidden channels and safe harbours. Respond within 80 seconds.', 'info');
}

export function getActiveImperialFerryman() { return state.imperialFerryman?.active ?? null; }
export function getFerrymanSecsLeft() {
  const a = state.imperialFerryman?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishFerryRoutes() {
  const a = state.imperialFerryman;
  if (!a?.active) return { ok: false, reason: 'No ferryman present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The ferryman has departed.' };
  if ((state.resources.wood ?? 0) < ROUTES_WOOD_COST) return { ok: false, reason: `Need ${ROUTES_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < ROUTES_GOLD_COST) return { ok: false, reason: `Need ${ROUTES_GOLD_COST} gold.` };
  state.resources.wood -= ROUTES_WOOD_COST;
  state.resources.gold -= ROUTES_GOLD_COST;
  changeMorale(ROUTES_MORALE_REWARD);
  awardPrestige(ROUTES_PRESTIGE_REWARD, 'Established ferry routes with the imperial ferryman');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'ferrymanroutes');
    state.randomEvents.activeModifiers.push({
      id: 'ferrymanroutes', resource: 'wood',
      rateMult: 1 + (ROUTES_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + ROUTES_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalRoutes = (a.totalRoutes ?? 0) + 1;
  emit(Events.IMPERIAL_FERRYMAN_CHANGED, { routes: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⛵ The ferryman establishes a network of flat-bottomed ferry crossings across the empire's rivers, dramatically speeding the transport of lumber, stone, and trade goods between distant regions. Timber merchants celebrate the reduced travel times and begin shipping larger loads! −${ROUTES_WOOD_COST} wood · −${ROUTES_GOLD_COST} gold · +${ROUTES_PRESTIGE_REWARD} prestige · +${ROUTES_MORALE_REWARD} morale. Timber surge: +${ROUTES_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRiverCharts() {
  const a = state.imperialFerryman;
  if (!a?.active) return { ok: false, reason: 'No ferryman present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The ferryman has departed.' };
  if ((state.resources.gold ?? 0) < CHARTS_GOLD_COST) return { ok: false, reason: `Need ${CHARTS_GOLD_COST} gold.` };
  state.resources.gold -= CHARTS_GOLD_COST;
  awardPrestige(CHARTS_PRESTIGE_REWARD, 'Purchased river charts from the imperial ferryman');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'ferrymanCharts');
    state.randomEvents.activeModifiers.push({
      id: 'ferrymanCharts', resource: 'gold',
      rateMult: 1 + (CHARTS_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + CHARTS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCharts = (a.totalCharts ?? 0) + 1;
  emit(Events.IMPERIAL_FERRYMAN_CHANGED, { charts: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ The ferryman unfurls meticulously drawn river charts showing hidden channels, seasonal flood plains, and forgotten trade harbours that bypass the notorious river toll stations. Imperial merchants immediately exploit the secret routes, diverting profitable cargoes through previously unknown waterways! −${CHARTS_GOLD_COST} gold · +${CHARTS_PRESTIGE_REWARD} prestige. Commerce surge: +${CHARTS_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFerrymanAway() {
  const a = state.imperialFerryman;
  if (!a?.active) return { ok: false, reason: 'No ferryman present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_FERRYMAN_CHANGED, { dismissed: true });
  addMessage('⛵ The imperial ferryman tips a weathered cap respectfully, carefully stows the river charts in a waterproof leather satchel, and poles the sturdy ferry back into the current, disappearing around the river bend.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
