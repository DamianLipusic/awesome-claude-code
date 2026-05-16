/**
 * EmpireOS — Imperial Siege Engineer (T294).
 *
 * Every 14–18 minutes (Iron Age+, 12+ player tiles), a master siege engineer
 * arrives bearing battle-tested fortification designs, trebuchet blueprints,
 * and the secrets of imperial siege warfare. The player has 75 seconds to
 * decide.
 *
 * Choices:
 *   🏰 Commission Battle Fortifications — pay 30 iron + 20 stone
 *        → +0.2 stone/s for 2.5 min · +25 prestige · +10 morale
 *   📐 Study Engineering Designs        — pay 20 gold
 *        → +0.15 iron/s for 2 min · +15 prestige
 *   👋 Send Away                        — dismiss (no reward)
 *
 * state.imperialSiegeEngineer = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalFortifications: number,
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const FORTIFY_IRON_COST         = 30;
export const FORTIFY_STONE_COST        = 20;
export const FORTIFY_STONE_RATE        = 0.2;
export const FORTIFY_PRESTIGE_REWARD   = 25;
export const FORTIFY_MORALE_REWARD     = 10;
export const FORTIFY_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const DESIGNS_GOLD_COST         = 20;
export const DESIGNS_IRON_RATE         = 0.15;
export const DESIGNS_PRESTIGE_REWARD   = 15;
export const DESIGNS_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSiegeEngineer() {
  if (!state.imperialSiegeEngineer) {
    state.imperialSiegeEngineer = {
      active:              null,
      nextSpawnTick:       _nextSpawnTick(),
      totalVisits:         0,
      totalFortifications: 0,
      totalDesigns:        0,
      totalDismissals:     0,
    };
  }
  const s = state.imperialSiegeEngineer;
  if (s.nextSpawnTick       === undefined) s.nextSpawnTick       = _nextSpawnTick();
  if (s.totalVisits         === undefined) s.totalVisits         = 0;
  if (s.totalFortifications === undefined) s.totalFortifications = 0;
  if (s.totalDesigns        === undefined) s.totalDesigns        = 0;
  if (s.totalDismissals     === undefined) s.totalDismissals     = 0;
}

export function imperialSiegeEngineerTick() {
  const e = state.imperialSiegeEngineer;
  if (!e) return;
  if (e.active) {
    if (state.tick >= e.active.expiresAt) {
      e.active = null; e.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SIEGE_ENGINEER_CHANGED, { expired: true });
      addMessage('🏰 The siege engineer folds their blueprints, loads their instruments onto a heavy cart, and rides out through the imperial gates toward their next commission.', 'info');
    }
    return;
  }
  if (state.tick < e.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  e.active      = { expiresAt: state.tick + WINDOW_TICKS };
  e.totalVisits = (e.totalVisits ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_ENGINEER_CHANGED, { spawned: true });
  addMessage('🏰 A master siege engineer rides into the imperial capital, their saddlebags brimming with trebuchet blueprints, siege tower schematics, and battle-tested fortification designs honed across a dozen campaigns. Respond within 75 seconds.', 'info');
}

export function getActiveSiegeEngineer() { return state.imperialSiegeEngineer?.active ?? null; }
export function getSiegeEngineerSecsLeft() {
  const a = state.imperialSiegeEngineer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionBattleFortifications() {
  const e = state.imperialSiegeEngineer;
  if (!e?.active) return { ok: false, reason: 'No engineer present.' };
  if (state.tick >= e.active.expiresAt) return { ok: false, reason: 'The engineer has departed.' };
  if ((state.resources.iron  ?? 0) < FORTIFY_IRON_COST)  return { ok: false, reason: `Need ${FORTIFY_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < FORTIFY_STONE_COST) return { ok: false, reason: `Need ${FORTIFY_STONE_COST} stone.` };
  state.resources.iron  -= FORTIFY_IRON_COST;
  state.resources.stone -= FORTIFY_STONE_COST;
  changeMorale(FORTIFY_MORALE_REWARD);
  awardPrestige(FORTIFY_PRESTIGE_REWARD, 'Commissioned battle fortifications from a siege engineer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'siegeFortify');
    state.randomEvents.activeModifiers.push({
      id: 'siegeFortify', resource: 'stone',
      rateMult: 1 + (FORTIFY_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + FORTIFY_DURATION_TICKS,
    });
  }
  e.active = null; e.nextSpawnTick = _nextSpawnTick(); e.totalFortifications = (e.totalFortifications ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_ENGINEER_CHANGED, { fortified: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏰 The siege engineer directs imperial stonemasons with military precision, raising formidable battlements and watchtowers that inspire awe across the realm! −${FORTIFY_IRON_COST} iron · −${FORTIFY_STONE_COST} stone · +${FORTIFY_PRESTIGE_REWARD} prestige · +${FORTIFY_MORALE_REWARD} morale. Construction surge: +${FORTIFY_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyEngineeringDesigns() {
  const e = state.imperialSiegeEngineer;
  if (!e?.active) return { ok: false, reason: 'No engineer present.' };
  if (state.tick >= e.active.expiresAt) return { ok: false, reason: 'The engineer has departed.' };
  if ((state.resources.gold ?? 0) < DESIGNS_GOLD_COST) return { ok: false, reason: `Need ${DESIGNS_GOLD_COST} gold.` };
  state.resources.gold -= DESIGNS_GOLD_COST;
  awardPrestige(DESIGNS_PRESTIGE_REWARD, 'Studied engineering designs from a siege engineer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'siegeDesigns');
    state.randomEvents.activeModifiers.push({
      id: 'siegeDesigns', resource: 'iron',
      rateMult: 1 + (DESIGNS_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + DESIGNS_DURATION_TICKS,
    });
  }
  e.active = null; e.nextSpawnTick = _nextSpawnTick(); e.totalDesigns = (e.totalDesigns ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_ENGINEER_CHANGED, { designed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📐 The engineer's precision diagrams inspire imperial smiths to forge weapons and tools with unprecedented efficiency, driving iron production to new heights! −${DESIGNS_GOLD_COST} gold · +${DESIGNS_PRESTIGE_REWARD} prestige. Foundry surge: +${DESIGNS_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSiegeEngineerAway() {
  const e = state.imperialSiegeEngineer;
  if (!e?.active) return { ok: false, reason: 'No engineer present.' };
  e.active = null; e.nextSpawnTick = _nextSpawnTick(); e.totalDismissals = (e.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_ENGINEER_CHANGED, { dismissed: true });
  addMessage('🏰 The siege engineer rolls their blueprints with a soldier\'s efficiency and departs, boots clattering on the imperial cobblestones as they seek a more receptive patron.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
