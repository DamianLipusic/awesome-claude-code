/**
 * EmpireOS — Exiled Prince (T255).
 *
 * Every 14–18 minutes (Bronze Age+, 8+ player tiles), a dispossessed prince
 * from a fallen neighboring kingdom arrives seeking refuge and counsel.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🏰 Grant Asylum   — free → +12 morale, +10 prestige,
 *                         +0.12 gold/s for 3 min (prince's treasury trickles in)
 *   ⚔️  Accept as Advisor — pay 40 gold → +30 prestige, +15 morale,
 *                          +0.1 iron/s for 2 min (military insight)
 *   🚪 Turn Away       — no cost, no reward
 *
 * state.exiledPrince = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalArrivals:    number,
 *   totalGranted:     number,
 *   totalAdvisors:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 4  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;
const MIN_PLAYER_TILES = 8;

export const ASYLUM_MORALE_REWARD    = 12;
export const ASYLUM_PRESTIGE_REWARD  = 10;
export const ASYLUM_GOLD_RATE        = 0.12;
export const ASYLUM_DURATION_TICKS   = 3 * 60 * TICKS_PER_SECOND;

export const ADVISOR_GOLD_COST       = 40;
export const ADVISOR_PRESTIGE_REWARD = 30;
export const ADVISOR_MORALE_REWARD   = 15;
export const ADVISOR_IRON_RATE       = 0.1;
export const ADVISOR_DURATION_TICKS  = 2 * 60 * TICKS_PER_SECOND;

export function initExiledPrince() {
  if (!state.exiledPrince) {
    state.exiledPrince = {
      active:        null,
      nextSpawnTick: _nextSpawnTick(),
      totalArrivals: 0,
      totalGranted:  0,
      totalAdvisors: 0,
    };
  }
  if (state.exiledPrince.nextSpawnTick  === undefined) state.exiledPrince.nextSpawnTick  = _nextSpawnTick();
  if (state.exiledPrince.totalArrivals  === undefined) state.exiledPrince.totalArrivals  = 0;
  if (state.exiledPrince.totalGranted   === undefined) state.exiledPrince.totalGranted   = 0;
  if (state.exiledPrince.totalAdvisors  === undefined) state.exiledPrince.totalAdvisors  = 0;
}

export function exiledPrinceTick() {
  const ep = state.exiledPrince;
  if (!ep) return;
  if (ep.active) {
    if (state.tick >= ep.active.expiresAt) {
      ep.active        = null;
      ep.nextSpawnTick = _nextSpawnTick();
      emit(Events.EXILED_PRINCE_CHANGED, { expired: true });
      addMessage('🚪 The exiled prince has departed, his fate unknown to your empire.', 'info');
    }
    return;
  }
  if (state.tick < ep.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  ep.active        = { expiresAt: state.tick + WINDOW_TICKS };
  ep.totalArrivals = (ep.totalArrivals ?? 0) + 1;
  emit(Events.EXILED_PRINCE_CHANGED, { spawned: true });
  addMessage('🏰 An exiled prince from a fallen kingdom has arrived at the imperial gates seeking refuge. Decide his fate within 80 seconds.', 'info');
}

export function getActiveExiledPrince() { return state.exiledPrince?.active ?? null; }
export function getExiledPrinceSecsLeft() {
  const a = state.exiledPrince?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function grantAsylum() {
  const ep = state.exiledPrince;
  if (!ep?.active) return { ok: false, reason: 'No prince present.' };
  if (state.tick >= ep.active.expiresAt) return { ok: false, reason: 'The prince has departed.' };
  changeMorale(ASYLUM_MORALE_REWARD);
  awardPrestige(ASYLUM_PRESTIGE_REWARD, "Imperial generosity in granting royal asylum");
  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'exiledPrinceAsylum');
    state.randomEvents.activeModifiers.push({ id: 'exiledPrinceAsylum', resource: 'gold', rateMult: 1 + (ASYLUM_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))), expiresAt: state.tick + ASYLUM_DURATION_TICKS });
  }
  ep.active       = null; ep.nextSpawnTick = _nextSpawnTick(); ep.totalGranted = (ep.totalGranted ?? 0) + 1;
  emit(Events.EXILED_PRINCE_CHANGED, { granted: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏰 The empire opens its gates! +${ASYLUM_MORALE_REWARD} morale, +${ASYLUM_PRESTIGE_REWARD} prestige. The prince's treasury flows: +${ASYLUM_GOLD_RATE} gold/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

export function acceptPrinceAdvisor() {
  const ep = state.exiledPrince;
  if (!ep?.active) return { ok: false, reason: 'No prince present.' };
  if (state.tick >= ep.active.expiresAt) return { ok: false, reason: 'The prince has departed.' };
  if ((state.resources.gold ?? 0) < ADVISOR_GOLD_COST) return { ok: false, reason: `Need ${ADVISOR_GOLD_COST} gold.` };
  state.resources.gold -= ADVISOR_GOLD_COST;
  changeMorale(ADVISOR_MORALE_REWARD);
  awardPrestige(ADVISOR_PRESTIGE_REWARD, "Exiled prince joins imperial council as military advisor");
  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'exiledPrinceAdvisor');
    state.randomEvents.activeModifiers.push({ id: 'exiledPrinceAdvisor', resource: 'iron', rateMult: 1 + (ADVISOR_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))), expiresAt: state.tick + ADVISOR_DURATION_TICKS });
  }
  ep.active        = null; ep.nextSpawnTick = _nextSpawnTick(); ep.totalAdvisors = (ep.totalAdvisors ?? 0) + 1;
  emit(Events.EXILED_PRINCE_CHANGED, { advisor: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚔️ The prince joins the imperial council! +${ADVISOR_PRESTIGE_REWARD} prestige, +${ADVISOR_MORALE_REWARD} morale. Military knowledge flows: +${ADVISOR_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function turnPrinceAway() {
  const ep = state.exiledPrince;
  if (!ep?.active) return { ok: false, reason: 'No prince present.' };
  ep.active        = null; ep.nextSpawnTick = _nextSpawnTick();
  emit(Events.EXILED_PRINCE_CHANGED, { dismissed: true });
  addMessage('🚪 The imperial guards turn the exiled prince away. He departs into the unknown.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }