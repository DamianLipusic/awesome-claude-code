/**
 * EmpireOS — Traveling Circus System (T249).
 *
 * Every 11–15 minutes (Bronze Age+, 6+ player tiles), a traveling circus
 * rolls into the empire. The player has 80 seconds to decide.
 *
 * Choices:
 *   🎪 Welcome Show       — pay 30 gold → +15 morale, +10 prestige
 *   🤹 Recruit Performers — pay 50 gold → +25 morale, +0.2 food/s for 2 min
 *   👋 Dismiss Circus     — no cost, no reward
 *
 * state.circus = {
 *   active: { expiresAt: tick } | null,
 *   nextSpawnTick: tick,
 *   totalVisits: number, totalWelcomed: number, totalRecruited: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 4  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;
const MIN_PLAYER_TILES = 6;

export const SHOW_GOLD_COST       = 30;
export const SHOW_MORALE_REWARD   = 15;
export const SHOW_PRESTIGE_REWARD = 10;

export const RECRUIT_GOLD_COST      = 50;
export const RECRUIT_MORALE_REWARD  = 25;
export const RECRUIT_FOOD_RATE      = 0.2;
export const RECRUIT_DURATION_TICKS = 2 * 60 * TICKS_PER_SECOND;

export function initCircus() {
  if (!state.circus) {
    state.circus = { active: null, nextSpawnTick: _nextSpawnTick(), totalVisits: 0, totalWelcomed: 0, totalRecruited: 0 };
  }
  if (state.circus.nextSpawnTick  === undefined) state.circus.nextSpawnTick  = _nextSpawnTick();
  if (state.circus.totalVisits    === undefined) state.circus.totalVisits    = 0;
  if (state.circus.totalWelcomed  === undefined) state.circus.totalWelcomed  = 0;
  if (state.circus.totalRecruited === undefined) state.circus.totalRecruited = 0;
}

export function circusTick() {
  const c = state.circus;
  if (!c) return;
  if (c.active) {
    if (state.tick >= c.active.expiresAt) {
      c.active        = null; c.nextSpawnTick = _nextSpawnTick();
      emit(Events.CIRCUS_CHANGED, { expired: true });
      addMessage('🎪 The traveling circus has packed up and moved on without a response.', 'info');
    }
    return;
  }
  if (state.tick < c.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  c.active      = { expiresAt: state.tick + WINDOW_TICKS };
  c.totalVisits = (c.totalVisits ?? 0) + 1;
  emit(Events.CIRCUS_CHANGED, { spawned: true });
  addMessage('🎪 A traveling circus arrives at the empire gates! Acrobats, exotic animals, and performers await your decision. Respond within 80 seconds.', 'info');
}

export function getActiveCircus() { return state.circus?.active ?? null; }
export function getCircusSecsLeft() {
  const a = state.circus?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function circusWelcomeShow() {
  const c = state.circus;
  if (!c?.active) return { ok: false, reason: 'No circus present.' };
  if (state.tick >= c.active.expiresAt) return { ok: false, reason: 'The circus has departed.' };
  if ((state.resources.gold ?? 0) < SHOW_GOLD_COST) return { ok: false, reason: `Need ${SHOW_GOLD_COST} gold.` };
  state.resources.gold -= SHOW_GOLD_COST;
  changeMorale(SHOW_MORALE_REWARD);
  awardPrestige(SHOW_PRESTIGE_REWARD, 'Circus performance delighted the populace');
  c.active        = null; c.nextSpawnTick = _nextSpawnTick(); c.totalWelcomed = (c.totalWelcomed ?? 0) + 1;
  emit(Events.CIRCUS_CHANGED, { welcomed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎪 The circus performs to a packed crowd! +${SHOW_MORALE_REWARD} morale, +${SHOW_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

export function circusRecruitPerformers() {
  const c = state.circus;
  if (!c?.active) return { ok: false, reason: 'No circus present.' };
  if (state.tick >= c.active.expiresAt) return { ok: false, reason: 'The circus has departed.' };
  if ((state.resources.gold ?? 0) < RECRUIT_GOLD_COST) return { ok: false, reason: `Need ${RECRUIT_GOLD_COST} gold.` };
  state.resources.gold -= RECRUIT_GOLD_COST;
  changeMorale(RECRUIT_MORALE_REWARD);
  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'circusRecruit');
    state.randomEvents.activeModifiers.push({ id: 'circusRecruit', resource: 'food', rateMult: 1 + (RECRUIT_FOOD_RATE / Math.max(0.001, (state.rates?.food ?? 1))), expiresAt: state.tick + RECRUIT_DURATION_TICKS });
  }
  c.active        = null; c.nextSpawnTick = _nextSpawnTick(); c.totalRecruited = (c.totalRecruited ?? 0) + 1;
  emit(Events.CIRCUS_CHANGED, { recruited: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🤹 Performers settle in the empire! +${RECRUIT_MORALE_REWARD} morale, +${RECRUIT_FOOD_RATE} food/s for 2 minutes as settlers are attracted.`, 'windfall');
  return { ok: true };
}

export function dismissCircus() {
  const c = state.circus;
  if (!c?.active) return { ok: false, reason: 'No circus present.' };
  c.active        = null; c.nextSpawnTick = _nextSpawnTick();
  emit(Events.CIRCUS_CHANGED, { dismissed: true });
  addMessage('🎪 The traveling circus moves on to entertain elsewhere.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }