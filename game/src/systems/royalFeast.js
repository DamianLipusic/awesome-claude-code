/**
 * EmpireOS — Royal Feast (T261).
 *
 * Every 14–19 minutes (Medieval Age+, 12+ player tiles), the imperial court
 * announces a Royal Feast. The player has 85 seconds to decide.
 *
 * Choices:
 *   🍖 Grand Banquet — pay 50 food + 30 gold → +0.15 food/s for 3 min + 25 morale + 20 prestige
 *   🥂 Modest Celebration — pay 20 food → +12 morale + 8 prestige
 *   🎭 Holiday Decree — free → +6 morale + 3 prestige
 *
 * state.royalFeast = {
 *   active: { expiresAt: tick } | null,
 *   nextSpawnTick: tick,
 *   totalFeasts: number, totalGrand: number, totalModest: number, totalHoliday: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 85 * TICKS_PER_SECOND;
const MIN_AGE          = 3;
const MIN_PLAYER_TILES = 12;

export const BANQUET_FOOD_COST       = 50;
export const BANQUET_GOLD_COST       = 30;
export const BANQUET_FOOD_RATE       = 0.15;
export const BANQUET_DURATION_TICKS  = 3 * 60 * TICKS_PER_SECOND;
export const BANQUET_MORALE_REWARD   = 25;
export const BANQUET_PRESTIGE_REWARD = 20;

export const MODEST_FOOD_COST        = 20;
export const MODEST_MORALE_REWARD    = 12;
export const MODEST_PRESTIGE_REWARD  = 8;

export const HOLIDAY_MORALE_REWARD   = 6;
export const HOLIDAY_PRESTIGE_REWARD = 3;

export function initRoyalFeast() {
  if (!state.royalFeast) {
    state.royalFeast = { active: null, nextSpawnTick: _nextSpawnTick(), totalFeasts: 0, totalGrand: 0, totalModest: 0, totalHoliday: 0 };
  }
  if (state.royalFeast.nextSpawnTick  === undefined) state.royalFeast.nextSpawnTick  = _nextSpawnTick();
  if (state.royalFeast.totalFeasts    === undefined) state.royalFeast.totalFeasts    = 0;
  if (state.royalFeast.totalGrand     === undefined) state.royalFeast.totalGrand     = 0;
  if (state.royalFeast.totalModest    === undefined) state.royalFeast.totalModest    = 0;
  if (state.royalFeast.totalHoliday   === undefined) state.royalFeast.totalHoliday   = 0;
}

export function royalFeastTick() {
  const rf = state.royalFeast;
  if (!rf) return;
  if (rf.active) {
    if (state.tick >= rf.active.expiresAt) {
      rf.active        = null; rf.nextSpawnTick = _nextSpawnTick();
      emit(Events.ROYAL_FEAST_CHANGED, { expired: true });
      addMessage('🍖 The Royal Feast preparations are called off as the opportunity passes.', 'info');
    }
    return;
  }
  if (state.tick < rf.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  rf.active      = { expiresAt: state.tick + WINDOW_TICKS };
  rf.totalFeasts = (rf.totalFeasts ?? 0) + 1;
  emit(Events.ROYAL_FEAST_CHANGED, { spawned: true });
  addMessage('🍖 The imperial court calls for a Royal Feast to celebrate the empire\'s glory! How shall the feast be conducted? Respond within 85 seconds.', 'info');
}

export function getActiveRoyalFeast() { return state.royalFeast?.active ?? null; }
export function getRoyalFeastSecsLeft() {
  const a = state.royalFeast?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function declareGrandBanquet() {
  const rf = state.royalFeast;
  if (!rf?.active) return { ok: false, reason: 'No feast pending.' };
  if (state.tick >= rf.active.expiresAt) return { ok: false, reason: 'The feast opportunity has passed.' };
  if ((state.resources.food ?? 0) < BANQUET_FOOD_COST) return { ok: false, reason: `Need ${BANQUET_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < BANQUET_GOLD_COST) return { ok: false, reason: `Need ${BANQUET_GOLD_COST} gold.` };
  state.resources.food -= BANQUET_FOOD_COST; state.resources.gold -= BANQUET_GOLD_COST;
  changeMorale(BANQUET_MORALE_REWARD);
  awardPrestige(BANQUET_PRESTIGE_REWARD, 'Hosted a magnificent Grand Banquet for the empire');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'royalFeastBanquet');
    state.randomEvents.activeModifiers.push({ id: 'royalFeastBanquet', resource: 'food', rateMult: 1 + (BANQUET_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))), expiresAt: state.tick + BANQUET_DURATION_TICKS });
  }
  rf.active      = null; rf.nextSpawnTick = _nextSpawnTick(); rf.totalGrand  = (rf.totalGrand ?? 0) + 1;
  emit(Events.ROYAL_FEAST_CHANGED, { grand: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍖 The Grand Banquet fills the empire with joy! +${BANQUET_MORALE_REWARD} morale, +${BANQUET_PRESTIGE_REWARD} prestige. Abundant food flows: +${BANQUET_FOOD_RATE} food/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

export function declareModestCelebration() {
  const rf = state.royalFeast;
  if (!rf?.active) return { ok: false, reason: 'No feast pending.' };
  if (state.tick >= rf.active.expiresAt) return { ok: false, reason: 'The feast opportunity has passed.' };
  if ((state.resources.food ?? 0) < MODEST_FOOD_COST) return { ok: false, reason: `Need ${MODEST_FOOD_COST} food.` };
  state.resources.food -= MODEST_FOOD_COST;
  changeMorale(MODEST_MORALE_REWARD);
  awardPrestige(MODEST_PRESTIGE_REWARD, 'Hosted a modest celebration for the empire');
  rf.active        = null; rf.nextSpawnTick = _nextSpawnTick(); rf.totalModest   = (rf.totalModest ?? 0) + 1;
  emit(Events.ROYAL_FEAST_CHANGED, { modest: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🥂 A modest celebration lifts spirits across the realm! +${MODEST_MORALE_REWARD} morale, +${MODEST_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

export function declareHoliday() {
  const rf = state.royalFeast;
  if (!rf?.active) return { ok: false, reason: 'No feast pending.' };
  changeMorale(HOLIDAY_MORALE_REWARD);
  awardPrestige(HOLIDAY_PRESTIGE_REWARD, 'Declared a public holiday for the empire');
  rf.active        = null; rf.nextSpawnTick = _nextSpawnTick(); rf.totalHoliday  = (rf.totalHoliday ?? 0) + 1;
  emit(Events.ROYAL_FEAST_CHANGED, { holiday: true });
  addMessage(`🎭 A public holiday is declared! Citizens rejoice in the streets. +${HOLIDAY_MORALE_REWARD} morale, +${HOLIDAY_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }