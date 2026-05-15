/**
 * EmpireOS — Wandering Cartomancer (T277).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), a wandering
 * cartomancer skilled in celestial charts and stellar navigation arrives,
 * offering rare astronomical knowledge. The player has 80 seconds to decide.
 *
 * Choices:
 *   🗺️ Commission Celestial Map  — pay 30 mana
 *        → +0.25 mana/s for 2.5 min · +25 prestige
 *   ⭐ Exchange Stellar Knowledge — pay 20 gold
 *        → +0.15 gold/s for 2 min · +18 prestige
 *   👋 Send Away                 — dismiss (no reward)
 *
 * state.wanderingCartomancer = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalMaps:        number,
 *   totalExchanges:   number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const MAP_MANA_COST         = 30;
export const MAP_MANA_RATE         = 0.25;
export const MAP_PRESTIGE_REWARD   = 25;
export const MAP_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_GOLD_COST      = 20;
export const EXCHANGE_GOLD_RATE      = 0.15;
export const EXCHANGE_PRESTIGE_REWARD = 18;
export const EXCHANGE_DURATION_TICKS  = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCartomancer() {
  if (!state.wanderingCartomancer) {
    state.wanderingCartomancer = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalMaps:       0,
      totalExchanges:  0,
      totalDismissals: 0,
    };
  }
  if (state.wanderingCartomancer.nextSpawnTick    === undefined) state.wanderingCartomancer.nextSpawnTick    = _nextSpawnTick();
  if (state.wanderingCartomancer.totalVisits      === undefined) state.wanderingCartomancer.totalVisits      = 0;
  if (state.wanderingCartomancer.totalMaps        === undefined) state.wanderingCartomancer.totalMaps        = 0;
  if (state.wanderingCartomancer.totalExchanges   === undefined) state.wanderingCartomancer.totalExchanges   = 0;
  if (state.wanderingCartomancer.totalDismissals  === undefined) state.wanderingCartomancer.totalDismissals  = 0;
}

export function wanderingCartomancerTick() {
  const wc = state.wanderingCartomancer;
  if (!wc) return;
  if (wc.active) {
    if (state.tick >= wc.active.expiresAt) {
      wc.active = null; wc.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_CARTOMANCER_CHANGED, { expired: true });
      addMessage('🗺️ The wandering cartomancer rolls up their celestial charts and departs on the next wind.', 'info');
    }
    return;
  }
  if (state.tick < wc.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  wc.active      = { expiresAt: state.tick + WINDOW_TICKS };
  wc.totalVisits = (wc.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_CARTOMANCER_CHANGED, { spawned: true });
  addMessage('🗺️ A wandering cartomancer bearing celestial charts and star-maps has arrived, their knowledge of the heavens legendary among scholars. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingCartomancer() { return state.wanderingCartomancer?.active ?? null; }
export function getCartomancerSecsLeft() {
  const a = state.wanderingCartomancer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCelestialMap() {
  const wc = state.wanderingCartomancer;
  if (!wc?.active) return { ok: false, reason: 'No cartomancer present.' };
  if (state.tick >= wc.active.expiresAt) return { ok: false, reason: 'The cartomancer has departed.' };
  if ((state.resources.mana ?? 0) < MAP_MANA_COST) return { ok: false, reason: `Need ${MAP_MANA_COST} mana.` };
  state.resources.mana -= MAP_MANA_COST;
  awardPrestige(MAP_PRESTIGE_REWARD, 'Commissioned a celestial map from a wandering cartomancer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartomancerMap');
    state.randomEvents.activeModifiers.push({
      id: 'cartomancerMap', resource: 'mana',
      rateMult: 1 + (MAP_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + MAP_DURATION_TICKS,
    });
  }
  wc.active = null; wc.nextSpawnTick = _nextSpawnTick(); wc.totalMaps = (wc.totalMaps ?? 0) + 1;
  emit(Events.WANDERING_CARTOMANCER_CHANGED, { mapped: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ Celestial charts of extraordinary precision now guide your scholars! −${MAP_MANA_COST} mana · +${MAP_PRESTIGE_REWARD} prestige. Astronomical insight deepens: +${MAP_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeStellarKnowledge() {
  const wc = state.wanderingCartomancer;
  if (!wc?.active) return { ok: false, reason: 'No cartomancer present.' };
  if (state.tick >= wc.active.expiresAt) return { ok: false, reason: 'The cartomancer has departed.' };
  if ((state.resources.gold ?? 0) < EXCHANGE_GOLD_COST) return { ok: false, reason: `Need ${EXCHANGE_GOLD_COST} gold.` };
  state.resources.gold -= EXCHANGE_GOLD_COST;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged stellar knowledge with a wandering cartomancer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartomancerExchange');
    state.randomEvents.activeModifiers.push({
      id: 'cartomancerExchange', resource: 'gold',
      rateMult: 1 + (EXCHANGE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  wc.active = null; wc.nextSpawnTick = _nextSpawnTick(); wc.totalExchanges = (wc.totalExchanges ?? 0) + 1;
  emit(Events.WANDERING_CARTOMANCER_CHANGED, { exchanged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⭐ Navigation routes refined by stellar knowledge open new trade opportunities! −${EXCHANGE_GOLD_COST} gold · +${EXCHANGE_PRESTIGE_REWARD} prestige. Improved trade routes: +${EXCHANGE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCartomancerAway() {
  const wc = state.wanderingCartomancer;
  if (!wc?.active) return { ok: false, reason: 'No cartomancer present.' };
  wc.active = null; wc.nextSpawnTick = _nextSpawnTick(); wc.totalDismissals = (wc.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_CARTOMANCER_CHANGED, { dismissed: true });
  addMessage('🗺️ The wandering cartomancer is thanked and sets their course for the next horizon.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
