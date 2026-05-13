/**
 * EmpireOS — Sacred Spring Discovery (T250).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), scouts discover a
 * sacred spring hidden in the empire's territory. The player has 80 seconds.
 *
 * Choices:
 *   🌊 Bless the Waters  — pay 20 mana → +35 food, +12 morale, +10 prestige
 *   💰 Sell Water Rights — −8 prestige → +100 gold
 *   🌿 Protect the Spring — free → +6 morale, +4 prestige
 *
 * state.sacredSpring = {
 *   active: { expiresAt: tick } | null,
 *   nextSpawnTick: tick,
 *   totalVisits: number, totalBlessed: number, totalSold: number, totalProtected: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 4  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;
const MIN_PLAYER_TILES = 8;

export const BLESS_MANA_COST       = 20;
export const BLESS_FOOD_REWARD     = 35;
export const BLESS_MORALE_REWARD   = 12;
export const BLESS_PRESTIGE_REWARD = 10;

export const SELL_PRESTIGE_COST  = 8;
export const SELL_GOLD_REWARD    = 100;

export const PROTECT_MORALE_REWARD   = 6;
export const PROTECT_PRESTIGE_REWARD = 4;

export function initSacredSpring() {
  if (!state.sacredSpring) {
    state.sacredSpring = { active: null, nextSpawnTick: _nextSpawnTick(), totalVisits: 0, totalBlessed: 0, totalSold: 0, totalProtected: 0 };
  }
  if (state.sacredSpring.nextSpawnTick  === undefined) state.sacredSpring.nextSpawnTick  = _nextSpawnTick();
  if (state.sacredSpring.totalVisits    === undefined) state.sacredSpring.totalVisits    = 0;
  if (state.sacredSpring.totalBlessed   === undefined) state.sacredSpring.totalBlessed   = 0;
  if (state.sacredSpring.totalSold      === undefined) state.sacredSpring.totalSold      = 0;
  if (state.sacredSpring.totalProtected === undefined) state.sacredSpring.totalProtected = 0;
}

export function sacredSpringTick() {
  const ss = state.sacredSpring;
  if (!ss) return;
  if (ss.active) {
    if (state.tick >= ss.active.expiresAt) {
      ss.active        = null; ss.nextSpawnTick = _nextSpawnTick();
      emit(Events.SACRED_SPRING_CHANGED, { expired: true });
      addMessage('🌊 The sacred spring remains untouched as the opportunity passes.', 'info');
    }
    return;
  }
  if (state.tick < ss.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  ss.active      = { expiresAt: state.tick + WINDOW_TICKS };
  ss.totalVisits = (ss.totalVisits ?? 0) + 1;
  emit(Events.SACRED_SPRING_CHANGED, { spawned: true });
  addMessage('🌊 Scouts have discovered a sacred spring within the empire\'s borders! Its waters are said to carry divine blessings. Respond within 80 seconds.', 'info');
}

export function getActiveSacredSpring() { return state.sacredSpring?.active ?? null; }
export function getSacredSpringSecsLeft() {
  const a = state.sacredSpring?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function blessSpringWaters() {
  const ss = state.sacredSpring;
  if (!ss?.active) return { ok: false, reason: 'No sacred spring active.' };
  if (state.tick >= ss.active.expiresAt) return { ok: false, reason: 'The spring opportunity has passed.' };
  if ((state.resources.mana ?? 0) < BLESS_MANA_COST) return { ok: false, reason: `Need ${BLESS_MANA_COST} mana.` };
  state.resources.mana -= BLESS_MANA_COST;
  const foodCap = state.caps?.food ?? 9999;
  state.resources.food = Math.min(foodCap, (state.resources.food ?? 0) + BLESS_FOOD_REWARD);
  changeMorale(BLESS_MORALE_REWARD);
  awardPrestige(BLESS_PRESTIGE_REWARD, 'Sacred spring blessing ceremony performed');
  ss.active       = null; ss.nextSpawnTick = _nextSpawnTick(); ss.totalBlessed = (ss.totalBlessed ?? 0) + 1;
  emit(Events.SACRED_SPRING_CHANGED, { blessed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌊 The sacred spring is consecrated! +${BLESS_FOOD_REWARD} food, +${BLESS_MORALE_REWARD} morale, +${BLESS_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

export function sellSpringWaterRights() {
  const ss = state.sacredSpring;
  if (!ss?.active) return { ok: false, reason: 'No sacred spring active.' };
  if (state.tick >= ss.active.expiresAt) return { ok: false, reason: 'The spring opportunity has passed.' };
  const goldCap = state.caps?.gold ?? 9999;
  state.resources.gold = Math.min(goldCap, (state.resources.gold ?? 0) + SELL_GOLD_REWARD);
  awardPrestige(-SELL_PRESTIGE_COST, 'Selling sacred spring water rights (prestige cost)');
  ss.active       = null; ss.nextSpawnTick = _nextSpawnTick(); ss.totalSold    = (ss.totalSold ?? 0) + 1;
  emit(Events.SACRED_SPRING_CHANGED, { sold: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💰 Water rights sold to merchants! +${SELL_GOLD_REWARD} gold (−${SELL_PRESTIGE_COST} prestige — the people are displeased).`, 'info');
  return { ok: true };
}

export function protectSacredSpring() {
  const ss = state.sacredSpring;
  if (!ss?.active) return { ok: false, reason: 'No sacred spring active.' };
  changeMorale(PROTECT_MORALE_REWARD);
  awardPrestige(PROTECT_PRESTIGE_REWARD, 'Sacred spring preserved for the people');
  ss.active       = null; ss.nextSpawnTick = _nextSpawnTick(); ss.totalProtected = (ss.totalProtected ?? 0) + 1;
  emit(Events.SACRED_SPRING_CHANGED, { protected: true });
  addMessage(`🌿 The sacred spring is preserved! +${PROTECT_MORALE_REWARD} morale, +${PROTECT_PRESTIGE_REWARD} prestige as citizens appreciate the gesture.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }