/**
 * EmpireOS — Traveling Potter (T288).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a skilled traveling potter
 * arrives with a cart full of fine earthenware and ancient clay-working knowledge,
 * offering their craft to the empire. The player has 80 seconds to decide.
 *
 * Choices:
 *   🏺 Commission Fine Pottery — pay 20 stone + 15 food
 *        → +0.15 stone/s for 2.5 min · +20 prestige · +8 morale
 *   🎨 Learn Potter's Craft    — pay 15 gold
 *        → +0.12 food/s for 2 min · +12 prestige
 *   👋 Send Away               — dismiss (no reward)
 *
 * state.travelingPotter = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissions: number,
 *   totalLearned:     number,
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

export const COMMISSION_STONE_COST      = 20;
export const COMMISSION_FOOD_COST       = 15;
export const COMMISSION_STONE_RATE      = 0.15;
export const COMMISSION_PRESTIGE_REWARD = 20;
export const COMMISSION_MORALE_REWARD   = 8;
export const COMMISSION_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const LEARN_GOLD_COST            = 15;
export const LEARN_FOOD_RATE            = 0.12;
export const LEARN_PRESTIGE_REWARD      = 12;
export const LEARN_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initTravelingPotter() {
  if (!state.travelingPotter) {
    state.travelingPotter = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalLearned:     0,
      totalDismissals:  0,
    };
  }
  if (state.travelingPotter.nextSpawnTick    === undefined) state.travelingPotter.nextSpawnTick    = _nextSpawnTick();
  if (state.travelingPotter.totalVisits      === undefined) state.travelingPotter.totalVisits      = 0;
  if (state.travelingPotter.totalCommissions === undefined) state.travelingPotter.totalCommissions = 0;
  if (state.travelingPotter.totalLearned     === undefined) state.travelingPotter.totalLearned     = 0;
  if (state.travelingPotter.totalDismissals  === undefined) state.travelingPotter.totalDismissals  = 0;
}

export function travelingPotterTick() {
  const tp = state.travelingPotter;
  if (!tp) return;
  if (tp.active) {
    if (state.tick >= tp.active.expiresAt) {
      tp.active = null; tp.nextSpawnTick = _nextSpawnTick();
      emit(Events.TRAVELING_POTTER_CHANGED, { expired: true });
      addMessage('🏺 The traveling potter packs their wheel and clay, moving on to the next settlement.', 'info');
    }
    return;
  }
  if (state.tick < tp.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  tp.active      = { expiresAt: state.tick + WINDOW_TICKS };
  tp.totalVisits = (tp.totalVisits ?? 0) + 1;
  emit(Events.TRAVELING_POTTER_CHANGED, { spawned: true });
  addMessage('🏺 A skilled traveling potter arrives at the imperial court, their cart laden with exquisite earthenware vessels and ancient clay-working wisdom passed down through generations. Respond within 80 seconds.', 'info');
}

export function getActiveTravelingPotter() { return state.travelingPotter?.active ?? null; }
export function getPotterSecsLeft() {
  const a = state.travelingPotter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionFinePottery() {
  const tp = state.travelingPotter;
  if (!tp?.active) return { ok: false, reason: 'No potter present.' };
  if (state.tick >= tp.active.expiresAt) return { ok: false, reason: 'The potter has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.food  ?? 0) < COMMISSION_FOOD_COST)  return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.food  -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned fine pottery from a traveling artisan');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'potterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'potterCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  tp.active = null; tp.nextSpawnTick = _nextSpawnTick(); tp.totalCommissions = (tp.totalCommissions ?? 0) + 1;
  emit(Events.TRAVELING_POTTER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏺 Magnificent clay vessels grace the imperial halls, inspiring quarry workers to extract stone with renewed artistry! −${COMMISSION_STONE_COST} stone · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone craft: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function learnPottersCraft() {
  const tp = state.travelingPotter;
  if (!tp?.active) return { ok: false, reason: 'No potter present.' };
  if (state.tick >= tp.active.expiresAt) return { ok: false, reason: 'The potter has departed.' };
  if ((state.resources.gold ?? 0) < LEARN_GOLD_COST) return { ok: false, reason: `Need ${LEARN_GOLD_COST} gold.` };
  state.resources.gold -= LEARN_GOLD_COST;
  awardPrestige(LEARN_PRESTIGE_REWARD, 'Learned ancient potter\'s craft techniques');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'potterCraft');
    state.randomEvents.activeModifiers.push({
      id: 'potterCraft', resource: 'food',
      rateMult: 1 + (LEARN_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + LEARN_DURATION_TICKS,
    });
  }
  tp.active = null; tp.nextSpawnTick = _nextSpawnTick(); tp.totalLearned = (tp.totalLearned ?? 0) + 1;
  emit(Events.TRAVELING_POTTER_CHANGED, { learned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 Ancient clay-working wisdom inspires farmers to tend their crops with the same patient artistry, yielding a bountiful harvest! −${LEARN_GOLD_COST} gold · +${LEARN_PRESTIGE_REWARD} prestige. Harvest bounty: +${LEARN_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendPotterAway() {
  const tp = state.travelingPotter;
  if (!tp?.active) return { ok: false, reason: 'No potter present.' };
  tp.active = null; tp.nextSpawnTick = _nextSpawnTick(); tp.totalDismissals = (tp.totalDismissals ?? 0) + 1;
  emit(Events.TRAVELING_POTTER_CHANGED, { dismissed: true });
  addMessage('🏺 The traveling potter is thanked and rolls their cart onward down the imperial road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
