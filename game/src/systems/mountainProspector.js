/**
 * EmpireOS — Mountain Prospector (T316).
 *
 * Every 14–18 minutes (Iron Age+, 12+ player tiles), a seasoned mountain
 * prospector arrives with claims of rich ore deposits and geological surveys.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   ⛏️  Fund Mining Expedition    — pay 40 gold
 *        → +0.25 iron/s for 2.5 min · +22 prestige · +8 morale
 *   🗺️  Share Ore Maps            — pay 25 stone
 *        → +0.20 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                 — dismiss (no reward)
 *
 * state.mountainProspector = {
 *   active:               { expiresAt: tick } | null,
 *   nextSpawnTick:        tick,
 *   totalVisits:          number,
 *   totalExpeditions:     number,
 *   totalMaps:            number,
 *   totalDismissals:      number,
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
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const EXPEDITION_GOLD_COST         = 40;
export const EXPEDITION_IRON_RATE         = 0.25;
export const EXPEDITION_PRESTIGE_REWARD   = 22;
export const EXPEDITION_MORALE_REWARD     = 8;
export const EXPEDITION_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const MAPS_STONE_COST              = 25;
export const MAPS_STONE_RATE             = 0.20;
export const MAPS_PRESTIGE_REWARD         = 15;
export const MAPS_DURATION_TICKS          = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initMountainProspector() {
  if (!state.mountainProspector) {
    state.mountainProspector = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalExpeditions: 0,
      totalMaps:        0,
      totalDismissals:  0,
    };
  }
  const s = state.mountainProspector;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalExpeditions === undefined) s.totalExpeditions = 0;
  if (s.totalMaps        === undefined) s.totalMaps        = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function mountainProspectorTick() {
  const a = state.mountainProspector;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.MOUNTAIN_PROSPECTOR_CHANGED, { expired: true });
      addMessage('⛏️ The mountain prospector rolls up their geological surveys, packs away the ore samples and assay tools, and heads back into the highlands to seek more promising ground.', 'info');
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
  emit(Events.MOUNTAIN_PROSPECTOR_CHANGED, { spawned: true });
  addMessage('⛏️ A weathered mountain prospector arrives at the imperial court, carrying saddlebags heavy with ore samples, geological surveys, and maps of rich mineral deposits in the nearby highlands. They seek imperial backing for a major mining expedition. Respond within 75 seconds.', 'info');
}

export function getActiveMountainProspector() { return state.mountainProspector?.active ?? null; }
export function getMountainProspectorSecsLeft() {
  const a = state.mountainProspector?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function fundMiningExpedition() {
  const a = state.mountainProspector;
  if (!a?.active) return { ok: false, reason: 'No prospector present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The prospector has departed.' };
  if ((state.resources.gold ?? 0) < EXPEDITION_GOLD_COST) return { ok: false, reason: `Need ${EXPEDITION_GOLD_COST} gold.` };
  state.resources.gold -= EXPEDITION_GOLD_COST;
  changeMorale(EXPEDITION_MORALE_REWARD);
  awardPrestige(EXPEDITION_PRESTIGE_REWARD, 'Funded a mining expedition with the mountain prospector');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'prospectorExpedition');
    state.randomEvents.activeModifiers.push({
      id: 'prospectorExpedition', resource: 'iron',
      rateMult: 1 + (EXPEDITION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + EXPEDITION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalExpeditions = (a.totalExpeditions ?? 0) + 1;
  emit(Events.MOUNTAIN_PROSPECTOR_CHANGED, { expedition: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⛏️ The prospector leads an imperial mining team deep into the highland veins, revealing rich seams of iron ore that were previously unknown. The imperial forges roar with the surge of high-quality raw materials! −${EXPEDITION_GOLD_COST} gold · +${EXPEDITION_PRESTIGE_REWARD} prestige · +${EXPEDITION_MORALE_REWARD} morale. Iron surge: +${EXPEDITION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function shareOreMaps() {
  const a = state.mountainProspector;
  if (!a?.active) return { ok: false, reason: 'No prospector present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The prospector has departed.' };
  if ((state.resources.stone ?? 0) < MAPS_STONE_COST) return { ok: false, reason: `Need ${MAPS_STONE_COST} stone.` };
  state.resources.stone -= MAPS_STONE_COST;
  awardPrestige(MAPS_PRESTIGE_REWARD, 'Exchanged ore maps with the mountain prospector');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'prospectorMaps');
    state.randomEvents.activeModifiers.push({
      id: 'prospectorMaps', resource: 'stone',
      rateMult: 1 + (MAPS_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + MAPS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalMaps = (a.totalMaps ?? 0) + 1;
  emit(Events.MOUNTAIN_PROSPECTOR_CHANGED, { maps: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ The geological surveys reveal previously unknown quarrying sites throughout the imperial highlands. Stone masons and quarry teams immediately begin extracting superior building materials from the newly discovered outcrops! −${MAPS_STONE_COST} stone · +${MAPS_PRESTIGE_REWARD} prestige. Stone surge: +${MAPS_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendProspectorAway() {
  const a = state.mountainProspector;
  if (!a?.active) return { ok: false, reason: 'No prospector present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.MOUNTAIN_PROSPECTOR_CHANGED, { dismissed: true });
  addMessage('⛏️ The mountain prospector nods respectfully, gathers their geological samples and survey maps, and sets off back into the highlands to find another empire willing to back their mining ventures.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
