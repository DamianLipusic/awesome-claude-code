/**
 * EmpireOS — Traveling Astrologer (T263).
 *
 * Every 15–20 minutes (Medieval Age+, 8+ player tiles), a learned traveling
 * astrologer arrives bearing celestial knowledge. The player has 80 seconds.
 *
 * Choices:
 *   🌟 Commission Star Chart   — pay 20 gold + 15 mana → +0.3 mana/s for 2.5 min + 18 prestige
 *   📚 Seek Celestial Wisdom   — pay 10 mana → +12 morale + 10 prestige
 *   🍵 Offer Refreshments      — pay 15 food → +5 morale + 5 prestige
 *
 * state.travelingAstrologer = {
 *   active: { expiresAt: tick } | null,
 *   nextSpawnTick: tick,
 *   totalVisits: number, totalCommissioned: number, totalConsulted: number, totalRefreshed: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;
const MIN_PLAYER_TILES = 8;

export const CHART_GOLD_COST        = 20;
export const CHART_MANA_COST        = 15;
export const CHART_MANA_RATE        = 0.3;
export const CHART_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);
export const CHART_PRESTIGE_REWARD  = 18;

export const WISDOM_MANA_COST       = 10;
export const WISDOM_MORALE_REWARD   = 12;
export const WISDOM_PRESTIGE_REWARD = 10;

export const REFRESH_FOOD_COST      = 15;
export const REFRESH_MORALE_REWARD  = 5;
export const REFRESH_PRESTIGE_REWARD = 5;

export function initTravelingAstrologer() {
  if (!state.travelingAstrologer) {
    state.travelingAstrologer = { active: null, nextSpawnTick: _nextSpawnTick(), totalVisits: 0, totalCommissioned: 0, totalConsulted: 0, totalRefreshed: 0 };
  }
  if (state.travelingAstrologer.nextSpawnTick      === undefined) state.travelingAstrologer.nextSpawnTick      = _nextSpawnTick();
  if (state.travelingAstrologer.totalVisits        === undefined) state.travelingAstrologer.totalVisits        = 0;
  if (state.travelingAstrologer.totalCommissioned  === undefined) state.travelingAstrologer.totalCommissioned  = 0;
  if (state.travelingAstrologer.totalConsulted     === undefined) state.travelingAstrologer.totalConsulted     = 0;
  if (state.travelingAstrologer.totalRefreshed     === undefined) state.travelingAstrologer.totalRefreshed     = 0;
}

export function travelingAstrologerTick() {
  const ta = state.travelingAstrologer;
  if (!ta) return;
  if (ta.active) {
    if (state.tick >= ta.active.expiresAt) {
      ta.active        = null; ta.nextSpawnTick = _nextSpawnTick();
      emit(Events.ASTROLOGER_CHANGED, { expired: true });
      addMessage('🌟 The traveling astrologer rolls up their star charts and continues on their journey, finding no audience in the empire.', 'info');
    }
    return;
  }
  if (state.tick < ta.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  ta.active      = { expiresAt: state.tick + WINDOW_TICKS };
  ta.totalVisits = (ta.totalVisits ?? 0) + 1;
  emit(Events.ASTROLOGER_CHANGED, { spawned: true });
  addMessage('🌟 A traveling astrologer of great renown has arrived at the imperial court, bearing celestial charts and cosmic wisdom! Respond within 80 seconds.', 'info');
}

export function getActiveTravelingAstrologer() { return state.travelingAstrologer?.active ?? null; }
export function getAstrologerSecsLeft() {
  const a = state.travelingAstrologer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionStarChart() {
  const ta = state.travelingAstrologer;
  if (!ta?.active) return { ok: false, reason: 'No astrologer present.' };
  if (state.tick >= ta.active.expiresAt) return { ok: false, reason: 'The astrologer has departed.' };
  if ((state.resources.gold ?? 0) < CHART_GOLD_COST) return { ok: false, reason: `Need ${CHART_GOLD_COST} gold.` };
  if ((state.resources.mana ?? 0) < CHART_MANA_COST) return { ok: false, reason: `Need ${CHART_MANA_COST} mana.` };
  state.resources.gold -= CHART_GOLD_COST; state.resources.mana -= CHART_MANA_COST;
  awardPrestige(CHART_PRESTIGE_REWARD, 'Commissioned a celestial star chart from a traveling astrologer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'astrologerChart');
    state.randomEvents.activeModifiers.push({ id: 'astrologerChart', resource: 'mana', rateMult: 1 + (CHART_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))), expiresAt: state.tick + CHART_DURATION_TICKS });
  }
  ta.active            = null; ta.nextSpawnTick     = _nextSpawnTick(); ta.totalCommissioned = (ta.totalCommissioned ?? 0) + 1;
  emit(Events.ASTROLOGER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌟 The astrologer maps the celestial sphere above the empire! +${CHART_PRESTIGE_REWARD} prestige. The stars guide the arcane arts: +${CHART_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function seekCelestialWisdom() {
  const ta = state.travelingAstrologer;
  if (!ta?.active) return { ok: false, reason: 'No astrologer present.' };
  if (state.tick >= ta.active.expiresAt) return { ok: false, reason: 'The astrologer has departed.' };
  if ((state.resources.mana ?? 0) < WISDOM_MANA_COST) return { ok: false, reason: `Need ${WISDOM_MANA_COST} mana.` };
  state.resources.mana -= WISDOM_MANA_COST;
  changeMorale(WISDOM_MORALE_REWARD);
  awardPrestige(WISDOM_PRESTIGE_REWARD, 'Sought celestial wisdom from a traveling astrologer');
  ta.active         = null; ta.nextSpawnTick  = _nextSpawnTick(); ta.totalConsulted = (ta.totalConsulted ?? 0) + 1;
  emit(Events.ASTROLOGER_CHANGED, { consulted: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📚 The astrologer shares profound cosmic insights and ancient prophecy! +${WISDOM_MORALE_REWARD} morale, +${WISDOM_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

export function offerAstrologerRefreshments() {
  const ta = state.travelingAstrologer;
  if (!ta?.active) return { ok: false, reason: 'No astrologer present.' };
  if (state.tick >= ta.active.expiresAt) return { ok: false, reason: 'The astrologer has departed.' };
  if ((state.resources.food ?? 0) < REFRESH_FOOD_COST) return { ok: false, reason: `Need ${REFRESH_FOOD_COST} food.` };
  state.resources.food -= REFRESH_FOOD_COST;
  changeMorale(REFRESH_MORALE_REWARD);
  awardPrestige(REFRESH_PRESTIGE_REWARD, 'Offered refreshments to a traveling astrologer');
  ta.active         = null; ta.nextSpawnTick  = _nextSpawnTick(); ta.totalRefreshed = (ta.totalRefreshed ?? 0) + 1;
  emit(Events.ASTROLOGER_CHANGED, { refreshed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍵 The astrologer departs with gratitude, blessing the empire under the stars! +${REFRESH_MORALE_REWARD} morale, +${REFRESH_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }