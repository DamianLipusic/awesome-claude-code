/**
 * EmpireOS — Lost Merchant Caravan (T259).
 *
 * Every 13–18 minutes (Bronze Age+, 8+ player tiles), a merchant caravan that
 * has lost its way arrives at the empire's borders seeking shelter and aid.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🏕️ Offer Shelter  — pay 30 food → +0.15 gold/s for 3 min + 15 morale + 15 prestige
 *                         (merchants repay the empire with trade goods)
 *   💰 Hire as Guides — pay 25 gold → +12 iron + 20 prestige + 8 morale
 *                         (caravan scouts lead soldiers to hidden ore deposits)
 *   🚶 Turn Away      — free, no effect
 *                         (caravan moves on)
 *
 * state.lostCaravan = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalEncounters: number,
 *   totalSheltered:  number,
 *   totalHired:      number,
 *   totalTurnedAway: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND; // 13 min
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND; // +0–5 min jitter
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;       // 75-second decision window
const MIN_AGE          = 1;                            // Bronze Age
const MIN_PLAYER_TILES = 8;

export const SHELTER_FOOD_COST       = 30;
export const SHELTER_GOLD_RATE       = 0.15; // +0.15 gold/s
export const SHELTER_DURATION_TICKS  = 3 * 60 * TICKS_PER_SECOND; // 3 min
export const SHELTER_MORALE_REWARD   = 15;
export const SHELTER_PRESTIGE_REWARD = 15;

export const HIRE_GOLD_COST          = 25;
export const HIRE_IRON_REWARD        = 12;
export const HIRE_PRESTIGE_REWARD    = 20;
export const HIRE_MORALE_REWARD      = 8;

// ── Init ──────────────────────────────────────────────────────────────────

export function initLostCaravan() {
  if (!state.lostCaravan) {
    state.lostCaravan = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalEncounters: 0,
      totalSheltered:  0,
      totalHired:      0,
      totalTurnedAway: 0,
    };
  }
  if (state.lostCaravan.nextSpawnTick   === undefined) state.lostCaravan.nextSpawnTick   = _nextSpawnTick();
  if (state.lostCaravan.totalEncounters === undefined) state.lostCaravan.totalEncounters = 0;
  if (state.lostCaravan.totalSheltered  === undefined) state.lostCaravan.totalSheltered  = 0;
  if (state.lostCaravan.totalHired      === undefined) state.lostCaravan.totalHired      = 0;
  if (state.lostCaravan.totalTurnedAway === undefined) state.lostCaravan.totalTurnedAway = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function lostCaravanTick() {
  const lc = state.lostCaravan;
  if (!lc) return;

  // Expire active window
  if (lc.active) {
    if (state.tick >= lc.active.expiresAt) {
      lc.active          = null;
      lc.nextSpawnTick   = _nextSpawnTick();
      lc.totalTurnedAway = (lc.totalTurnedAway ?? 0) + 1;
      emit(Events.LOST_CARAVAN_CHANGED, { expired: true });
      addMessage('🚶 The lost merchant caravan moves on, finding no aid from the empire.', 'info');
    }
    return;
  }

  if (state.tick < lc.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  lc.active          = { expiresAt: state.tick + WINDOW_TICKS };
  lc.totalEncounters = (lc.totalEncounters ?? 0) + 1;

  emit(Events.LOST_CARAVAN_CHANGED, { spawned: true });
  addMessage('🏕️ A lost merchant caravan has appeared at the empire\'s border seeking shelter! Respond within 75 seconds.', 'info');
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getActiveLostCaravan() {
  return state.lostCaravan?.active ?? null;
}

export function getLostCaravanSecsLeft() {
  const a = state.lostCaravan?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Offer Shelter — pay 30 food; +0.15 gold/s for 3 min + 15 morale + 15 prestige.
 */
export function offerCaravanShelter() {
  const lc = state.lostCaravan;
  if (!lc?.active) return { ok: false, reason: 'No caravan present.' };
  if (state.tick >= lc.active.expiresAt) return { ok: false, reason: 'The caravan has moved on.' };
  if ((state.resources.food ?? 0) < SHELTER_FOOD_COST) {
    return { ok: false, reason: `Need ${SHELTER_FOOD_COST} food.` };
  }

  state.resources.food -= SHELTER_FOOD_COST;
  awardPrestige(SHELTER_PRESTIGE_REWARD, 'Sheltered a lost merchant caravan at the empire\'s border');
  changeMorale(SHELTER_MORALE_REWARD);

  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'caravanShelter');
    state.randomEvents.activeModifiers.push({
      id:        'caravanShelter',
      resource:  'gold',
      rateMult:  1 + (SHELTER_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + SHELTER_DURATION_TICKS,
    });
  }

  lc.active         = null;
  lc.nextSpawnTick  = _nextSpawnTick();
  lc.totalSheltered = (lc.totalSheltered ?? 0) + 1;

  emit(Events.LOST_CARAVAN_CHANGED, { sheltered: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏕️ The caravan rests and recovers, then opens their wares to the empire! +${SHELTER_PRESTIGE_REWARD} prestige, +${SHELTER_MORALE_REWARD} morale. Trade flourishes: +${SHELTER_GOLD_RATE} gold/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

/**
 * Hire as Guides — pay 25 gold; +12 iron + 20 prestige + 8 morale.
 */
export function hireCaravanGuides() {
  const lc = state.lostCaravan;
  if (!lc?.active) return { ok: false, reason: 'No caravan present.' };
  if (state.tick >= lc.active.expiresAt) return { ok: false, reason: 'The caravan has moved on.' };
  if ((state.resources.gold ?? 0) < HIRE_GOLD_COST) {
    return { ok: false, reason: `Need ${HIRE_GOLD_COST} gold.` };
  }

  state.resources.gold -= HIRE_GOLD_COST;
  state.resources.iron  = (state.resources.iron ?? 0) + HIRE_IRON_REWARD;
  awardPrestige(HIRE_PRESTIGE_REWARD, 'Hired caravan scouts to locate frontier ore deposits');
  changeMorale(HIRE_MORALE_REWARD);

  lc.active        = null;
  lc.nextSpawnTick = _nextSpawnTick();
  lc.totalHired    = (lc.totalHired ?? 0) + 1;

  emit(Events.LOST_CARAVAN_CHANGED, { hired: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💰 The merchants guide imperial scouts to hidden ore veins! +${HIRE_IRON_REWARD} iron, +${HIRE_PRESTIGE_REWARD} prestige, +${HIRE_MORALE_REWARD} morale.`, 'windfall');
  return { ok: true };
}

/**
 * Turn Away — free; caravan departs without incident.
 */
export function turnCaravanAway() {
  const lc = state.lostCaravan;
  if (!lc?.active) return { ok: false, reason: 'No caravan present.' };

  lc.active          = null;
  lc.nextSpawnTick   = _nextSpawnTick();
  lc.totalTurnedAway = (lc.totalTurnedAway ?? 0) + 1;

  emit(Events.LOST_CARAVAN_CHANGED, { turnedAway: true });
  addMessage('🚶 The merchant caravan is turned away from the empire\'s borders.', 'info');
  return { ok: true };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}
