/**
 * EmpireOS — Wandering Navigator (T313).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a wandering navigator
 * arrives bearing sea charts and maritime knowledge from distant shores.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🧭 Commission Sea Charts        — pay 25 wood + 20 gold
 *        → +0.2 wood/s for 2.5 min · +22 prestige · +10 morale
 *   🌊 Exchange Navigation Secrets  — pay 20 mana
 *        → +0.15 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingNavigator = {
 *   active:               { expiresAt: tick } | null,
 *   nextSpawnTick:        tick,
 *   totalVisits:          number,
 *   totalCommissions:     number,
 *   totalExchanges:       number,
 *   totalDismissals:      number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const NAV_WOOD_COST           = 25;
export const NAV_GOLD_COST           = 20;
export const NAV_WOOD_RATE           = 0.2;
export const NAV_PRESTIGE_REWARD     = 22;
export const NAV_MORALE_REWARD       = 10;
export const NAV_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const SECRETS_MANA_COST       = 20;
export const SECRETS_MANA_RATE       = 0.15;
export const SECRETS_PRESTIGE_REWARD = 15;
export const SECRETS_DURATION_TICKS  = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingNavigator() {
  if (!state.wanderingNavigator) {
    state.wanderingNavigator = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalExchanges:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingNavigator;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalExchanges   === undefined) s.totalExchanges   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingNavigatorTick() {
  const a = state.wanderingNavigator;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_NAVIGATOR_CHANGED, { expired: true });
      addMessage('🧭 The wandering navigator rolls up their sea charts, stows the brass sextant in a worn leather satchel, and sets off along the coastal road toward the next port.', 'info');
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
  emit(Events.WANDERING_NAVIGATOR_CHANGED, { spawned: true });
  addMessage('🧭 A wandering navigator arrives at the imperial docks, bearing hand-drawn sea charts of uncharted waters and tales of lucrative trade routes beyond the horizon. Their hard-won maritime knowledge could greatly benefit the empire\'s expansion. Respond within 80 seconds.', 'info');
}

export function getActiveNavigator() { return state.wanderingNavigator?.active ?? null; }
export function getNavigatorSecsLeft() {
  const a = state.wanderingNavigator?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionSeaCharts() {
  const a = state.wanderingNavigator;
  if (!a?.active) return { ok: false, reason: 'No navigator present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The navigator has departed.' };
  if ((state.resources.wood ?? 0) < NAV_WOOD_COST) return { ok: false, reason: `Need ${NAV_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < NAV_GOLD_COST) return { ok: false, reason: `Need ${NAV_GOLD_COST} gold.` };
  state.resources.wood -= NAV_WOOD_COST;
  state.resources.gold -= NAV_GOLD_COST;
  changeMorale(NAV_MORALE_REWARD);
  awardPrestige(NAV_PRESTIGE_REWARD, 'Commissioned sea charts from the wandering navigator');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'navigatorCharts');
    state.randomEvents.activeModifiers.push({
      id: 'navigatorCharts', resource: 'wood',
      rateMult: 1 + (NAV_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + NAV_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_NAVIGATOR_CHANGED, { charts: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧭 The navigator spreads their magnificent sea charts across the imperial planning table, revealing new timber-rich coastlines and forested river delta routes. Imperial woodcutters are dispatched to these rich new territories with great enthusiasm! −${NAV_WOOD_COST} wood · −${NAV_GOLD_COST} gold · +${NAV_PRESTIGE_REWARD} prestige · +${NAV_MORALE_REWARD} morale. Lumber surge: +${NAV_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeNavigationSecrets() {
  const a = state.wanderingNavigator;
  if (!a?.active) return { ok: false, reason: 'No navigator present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The navigator has departed.' };
  if ((state.resources.mana ?? 0) < SECRETS_MANA_COST) return { ok: false, reason: `Need ${SECRETS_MANA_COST} mana.` };
  state.resources.mana -= SECRETS_MANA_COST;
  awardPrestige(SECRETS_PRESTIGE_REWARD, 'Exchanged navigation secrets with the wandering navigator');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'navigatorSecrets');
    state.randomEvents.activeModifiers.push({
      id: 'navigatorSecrets', resource: 'mana',
      rateMult: 1 + (SECRETS_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + SECRETS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalExchanges = (a.totalExchanges ?? 0) + 1;
  emit(Events.WANDERING_NAVIGATOR_CHANGED, { secrets: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌊 In exchange for a portion of the empire's arcane knowledge, the navigator reveals the celestial navigation techniques used by ancient mariners to harness mystical sea currents. Imperial scholars eagerly integrate these star-reading methods into their arcane studies! −${SECRETS_MANA_COST} mana · +${SECRETS_PRESTIGE_REWARD} prestige. Arcane surge: +${SECRETS_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendNavigatorAway() {
  const a = state.wanderingNavigator;
  if (!a?.active) return { ok: false, reason: 'No navigator present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_NAVIGATOR_CHANGED, { dismissed: true });
  addMessage('🧭 The wandering navigator tucks the sea charts back into a waterproof oilskin case and departs with a sailor\'s farewell, their compass already pointing toward distant shores.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
