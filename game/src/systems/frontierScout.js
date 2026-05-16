/**
 * EmpireOS — Frontier Scout (T290).
 *
 * Every 14–19 minutes (Iron Age+, 10+ player tiles), a seasoned frontier scout
 * arrives with detailed maps, enemy troop movements, and territorial intelligence
 * gathered at great personal risk. The player has 80 seconds to decide.
 *
 * Choices:
 *   🗺️ Commission Scouting Report — pay 30 iron
 *        → +0.18 iron/s for 2.5 min · +22 prestige · +8 morale
 *   📜 Exchange Intelligence Maps  — pay 25 mana
 *        → +0.2 mana/s for 2 min · +18 prestige
 *   👋 Send Away                   — dismiss (no reward)
 *
 * state.frontierScout = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
 *   totalExchanges:      number,
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
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST       = 30;
export const COMMISSION_IRON_RATE       = 0.18;
export const COMMISSION_PRESTIGE_REWARD = 22;
export const COMMISSION_MORALE_REWARD   = 8;
export const COMMISSION_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_MANA_COST         = 25;
export const EXCHANGE_MANA_RATE         = 0.2;
export const EXCHANGE_PRESTIGE_REWARD   = 18;
export const EXCHANGE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initFrontierScout() {
  if (!state.frontierScout) {
    state.frontierScout = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalExchanges:   0,
      totalDismissals:  0,
    };
  }
  if (state.frontierScout.nextSpawnTick    === undefined) state.frontierScout.nextSpawnTick    = _nextSpawnTick();
  if (state.frontierScout.totalVisits      === undefined) state.frontierScout.totalVisits      = 0;
  if (state.frontierScout.totalCommissions === undefined) state.frontierScout.totalCommissions = 0;
  if (state.frontierScout.totalExchanges   === undefined) state.frontierScout.totalExchanges   = 0;
  if (state.frontierScout.totalDismissals  === undefined) state.frontierScout.totalDismissals  = 0;
}

export function frontierScoutTick() {
  const fs = state.frontierScout;
  if (!fs) return;
  if (fs.active) {
    if (state.tick >= fs.active.expiresAt) {
      fs.active = null; fs.nextSpawnTick = _nextSpawnTick();
      emit(Events.FRONTIER_SCOUT_CHANGED, { expired: true });
      addMessage('🗺️ The frontier scout slips back into the wilderness, their intelligence reports expiring with the fading light.', 'info');
    }
    return;
  }
  if (state.tick < fs.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  fs.active      = { expiresAt: state.tick + WINDOW_TICKS };
  fs.totalVisits = (fs.totalVisits ?? 0) + 1;
  emit(Events.FRONTIER_SCOUT_CHANGED, { spawned: true });
  addMessage('🗺️ A weathered frontier scout emerges from the wilderness, bearing detailed maps of enemy positions, resource deposits, and treacherous terrain that could prove invaluable to the empire\'s campaigns. Respond within 80 seconds.', 'info');
}

export function getActiveFrontierScout() { return state.frontierScout?.active ?? null; }
export function getScoutSecsLeft() {
  const a = state.frontierScout?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionScoutingReport() {
  const fs = state.frontierScout;
  if (!fs?.active) return { ok: false, reason: 'No scout present.' };
  if (state.tick >= fs.active.expiresAt) return { ok: false, reason: 'The scout has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned a frontier scouting report');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'scoutReport');
    state.randomEvents.activeModifiers.push({
      id: 'scoutReport', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  fs.active = null; fs.nextSpawnTick = _nextSpawnTick(); fs.totalCommissions = (fs.totalCommissions ?? 0) + 1;
  emit(Events.FRONTIER_SCOUT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ Detailed frontier intelligence reveals rich iron seams, spurring miners to extract ore with renewed efficiency! −${COMMISSION_IRON_COST} iron · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mining surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeIntelligenceMaps() {
  const fs = state.frontierScout;
  if (!fs?.active) return { ok: false, reason: 'No scout present.' };
  if (state.tick >= fs.active.expiresAt) return { ok: false, reason: 'The scout has departed.' };
  if ((state.resources.mana ?? 0) < EXCHANGE_MANA_COST) return { ok: false, reason: `Need ${EXCHANGE_MANA_COST} mana.` };
  state.resources.mana -= EXCHANGE_MANA_COST;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged arcane intelligence maps with a frontier scout');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'scoutMaps');
    state.randomEvents.activeModifiers.push({
      id: 'scoutMaps', resource: 'mana',
      rateMult: 1 + (EXCHANGE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  fs.active = null; fs.nextSpawnTick = _nextSpawnTick(); fs.totalExchanges = (fs.totalExchanges ?? 0) + 1;
  emit(Events.FRONTIER_SCOUT_CHANGED, { exchanged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 Arcane ley lines marked on the scout's maps guide imperial scholars to potent new sources of magical energy! −${EXCHANGE_MANA_COST} mana · +${EXCHANGE_PRESTIGE_REWARD} prestige. Arcane surge: +${EXCHANGE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendScoutAway() {
  const fs = state.frontierScout;
  if (!fs?.active) return { ok: false, reason: 'No scout present.' };
  fs.active = null; fs.nextSpawnTick = _nextSpawnTick(); fs.totalDismissals = (fs.totalDismissals ?? 0) + 1;
  emit(Events.FRONTIER_SCOUT_CHANGED, { dismissed: true });
  addMessage('🗺️ The frontier scout is thanked and vanishes back into the wilderness from whence they came.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
