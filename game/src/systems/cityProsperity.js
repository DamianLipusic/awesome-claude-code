/**
 * EmpireOS — City Prosperity Windfall (T235).
 *
 * Every 10–12 minutes (Bronze Age+, ≥1 founded city), a random player-owned
 * city fires a terrain-based windfall event.  Terrain rewards:
 *   grass / capital → +50 food  + 25 gold
 *   river           → +60 gold  + 20 food
 *   forest          → +50 wood  + 20 gold
 *   hills           → +40 stone + 20 iron
 *   mountain        → +35 iron  + 30 stone
 * Also awards +15 prestige each time.
 *
 * state.cityProsperity = {
 *   nextWindfallTick: number,
 *   totalWindfalls:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { awardPrestige }    from './prestige.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN  = 10 * 60 * TICKS_PER_SECOND; // 2400 ticks (10 min)
const SPAWN_RAND =  2 * 60 * TICKS_PER_SECOND; //  480 ticks (± 2 min)
const PRESTIGE   = 15;

const TERRAIN_REWARDS = {
  grass:    { food: 50, gold: 25 },
  capital:  { food: 50, gold: 25 },
  river:    { gold: 60, food: 20 },
  forest:   { wood: 50, gold: 20 },
  hills:    { stone: 40, iron: 20 },
  mountain: { iron: 35, stone: 30 },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function _nextTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RAND);
}

// ── Init ──────────────────────────────────────────────────────────────────

export function initCityProsperity() {
  if (!state.cityProsperity) {
    state.cityProsperity = {
      nextWindfallTick: _nextTick(),
      totalWindfalls:   0,
    };
  }
  if (state.cityProsperity.totalWindfalls === undefined) state.cityProsperity.totalWindfalls = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function cityProsperityTick() {
  if (!state.cityProsperity || !state.map) return;
  const cp = state.cityProsperity;
  if (state.tick < cp.nextWindfallTick) return;

  // Bronze Age+ required
  if ((state.age ?? 0) < 1) { cp.nextWindfallTick = _nextTick(); return; }

  // Collect all player-owned city tiles
  const cities = [];
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player' && tile.hasCity) cities.push(tile);
    }
  }
  if (cities.length === 0) { cp.nextWindfallTick = _nextTick(); return; }

  // Pick a random city tile
  const tile    = cities[Math.floor(Math.random() * cities.length)];
  const rewards = TERRAIN_REWARDS[tile.type] ?? { gold: 30 };

  // Grant capped resources
  for (const [res, amt] of Object.entries(rewards)) {
    const cap = state.caps[res] ?? 500;
    state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
  }
  awardPrestige(PRESTIGE, 'city prosperity windfall');

  cp.totalWindfalls   = (cp.totalWindfalls ?? 0) + 1;
  cp.nextWindfallTick = _nextTick();

  const rewardStr = Object.entries(rewards).map(([r, v]) => `+${v} ${r}`).join(', ');
  emit(Events.CITY_PROSPERITY_EVENT, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏙️ City prosperity windfall! ${rewardStr}, +${PRESTIGE} prestige.`, 'windfall');
}
