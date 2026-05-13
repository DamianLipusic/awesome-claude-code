/**
 * EmpireOS — Wandering Blacksmith (T262).
 *
 * Every 11–16 minutes (Iron Age+, 10+ player tiles), a wandering master
 * blacksmith arrives. The player has 75 seconds to decide.
 *
 * Choices:
 *   ⚔️ Commission Elite Weapons — pay 40 iron → +0.2 iron/s for 2 min + 20 prestige
 *   🛡️ Forge Iron Tools         — pay 20 iron + 15 gold → +20 iron + 15 prestige
 *   🤝 Offer Lodging            — pay 10 food → +6 morale + 5 prestige
 *
 * state.wanderingBlacksmith = {
 *   active: { expiresAt: tick } | null,
 *   nextSpawnTick: tick,
 *   totalVisits: number, totalCommissions: number, totalForged: number, totalLodged: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;
const MIN_PLAYER_TILES = 10;

export const WEAPONS_IRON_COST       = 40;
export const WEAPONS_IRON_RATE       = 0.2;
export const WEAPONS_DURATION_TICKS  = 2 * 60 * TICKS_PER_SECOND;
export const WEAPONS_PRESTIGE_REWARD = 20;

export const TOOLS_IRON_COST         = 20;
export const TOOLS_GOLD_COST         = 15;
export const TOOLS_IRON_REWARD       = 20;
export const TOOLS_PRESTIGE_REWARD   = 15;

export const LODGING_FOOD_COST       = 10;
export const LODGING_MORALE_REWARD   = 6;
export const LODGING_PRESTIGE_REWARD = 5;

export function initWanderingBlacksmith() {
  if (!state.wanderingBlacksmith) {
    state.wanderingBlacksmith = { active: null, nextSpawnTick: _nextSpawnTick(), totalVisits: 0, totalCommissions: 0, totalForged: 0, totalLodged: 0 };
  }
  if (state.wanderingBlacksmith.nextSpawnTick    === undefined) state.wanderingBlacksmith.nextSpawnTick    = _nextSpawnTick();
  if (state.wanderingBlacksmith.totalVisits      === undefined) state.wanderingBlacksmith.totalVisits      = 0;
  if (state.wanderingBlacksmith.totalCommissions === undefined) state.wanderingBlacksmith.totalCommissions = 0;
  if (state.wanderingBlacksmith.totalForged      === undefined) state.wanderingBlacksmith.totalForged      = 0;
  if (state.wanderingBlacksmith.totalLodged      === undefined) state.wanderingBlacksmith.totalLodged      = 0;
}

export function wanderingBlacksmithTick() {
  const wb = state.wanderingBlacksmith;
  if (!wb) return;
  if (wb.active) {
    if (state.tick >= wb.active.expiresAt) {
      wb.active        = null; wb.nextSpawnTick = _nextSpawnTick();
      emit(Events.BLACKSMITH_CHANGED, { expired: true });
      addMessage('⚒️ The wandering blacksmith packs their tools and moves on, finding no work in the empire.', 'info');
    }
    return;
  }
  if (state.tick < wb.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  wb.active      = { expiresAt: state.tick + WINDOW_TICKS };
  wb.totalVisits = (wb.totalVisits ?? 0) + 1;
  emit(Events.BLACKSMITH_CHANGED, { spawned: true });
  addMessage('⚒️ A wandering blacksmith of great renown has arrived at the imperial forge district! Their craft could strengthen the empire. Respond within 75 seconds.', 'info');
}

export function getActiveWanderingBlacksmith() { return state.wanderingBlacksmith?.active ?? null; }
export function getBlacksmithSecsLeft() {
  const a = state.wanderingBlacksmith?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionEliteWeapons() {
  const wb = state.wanderingBlacksmith;
  if (!wb?.active) return { ok: false, reason: 'No blacksmith present.' };
  if (state.tick >= wb.active.expiresAt) return { ok: false, reason: 'The blacksmith has moved on.' };
  if ((state.resources.iron ?? 0) < WEAPONS_IRON_COST) return { ok: false, reason: `Need ${WEAPONS_IRON_COST} iron.` };
  state.resources.iron -= WEAPONS_IRON_COST;
  awardPrestige(WEAPONS_PRESTIGE_REWARD, 'Commissioned elite weapons from a wandering blacksmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'blacksmithWeapons');
    state.randomEvents.activeModifiers.push({ id: 'blacksmithWeapons', resource: 'iron', rateMult: 1 + (WEAPONS_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))), expiresAt: state.tick + WEAPONS_DURATION_TICKS });
  }
  wb.active           = null; wb.nextSpawnTick    = _nextSpawnTick(); wb.totalCommissions = (wb.totalCommissions ?? 0) + 1;
  emit(Events.BLACKSMITH_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚔️ The blacksmith reveals elite forging techniques! +${WEAPONS_PRESTIGE_REWARD} prestige. Imperial foundries surge: +${WEAPONS_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function forgeIronTools() {
  const wb = state.wanderingBlacksmith;
  if (!wb?.active) return { ok: false, reason: 'No blacksmith present.' };
  if (state.tick >= wb.active.expiresAt) return { ok: false, reason: 'The blacksmith has moved on.' };
  if ((state.resources.iron ?? 0) < TOOLS_IRON_COST) return { ok: false, reason: `Need ${TOOLS_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < TOOLS_GOLD_COST) return { ok: false, reason: `Need ${TOOLS_GOLD_COST} gold.` };
  state.resources.iron -= TOOLS_IRON_COST; state.resources.gold -= TOOLS_GOLD_COST;
  const ironCap = state.caps?.iron ?? 9999;
  state.resources.iron = Math.min(ironCap, (state.resources.iron ?? 0) + TOOLS_IRON_REWARD);
  awardPrestige(TOOLS_PRESTIGE_REWARD, 'Had iron tools forged by a wandering blacksmith');
  wb.active        = null; wb.nextSpawnTick = _nextSpawnTick(); wb.totalForged   = (wb.totalForged ?? 0) + 1;
  emit(Events.BLACKSMITH_CHANGED, { forged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🛡️ The blacksmith forges a fine set of iron tools! +${TOOLS_IRON_REWARD} iron, +${TOOLS_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

export function offerBlacksmithLodging() {
  const wb = state.wanderingBlacksmith;
  if (!wb?.active) return { ok: false, reason: 'No blacksmith present.' };
  if (state.tick >= wb.active.expiresAt) return { ok: false, reason: 'The blacksmith has moved on.' };
  if ((state.resources.food ?? 0) < LODGING_FOOD_COST) return { ok: false, reason: `Need ${LODGING_FOOD_COST} food.` };
  state.resources.food -= LODGING_FOOD_COST;
  changeMorale(LODGING_MORALE_REWARD);
  awardPrestige(LODGING_PRESTIGE_REWARD, 'Offered warm lodging to a wandering blacksmith');
  wb.active        = null; wb.nextSpawnTick = _nextSpawnTick(); wb.totalLodged   = (wb.totalLodged ?? 0) + 1;
  emit(Events.BLACKSMITH_CHANGED, { lodged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🤝 The blacksmith departs with heartfelt gratitude for the empire's hospitality! +${LODGING_MORALE_REWARD} morale, +${LODGING_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }