/**
 * EmpireOS — Resource system.
 *
 * Responsibilities:
 *   - recalcRates(): recompute state.rates and state.caps from buildings + techs
 *   - resourceTick(): apply rates to resources each tick (called by tick loop)
 *   - advance training queue
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { AGES } from '../data/ages.js';
import { EMPIRES } from '../data/empires.js';
import { SEASONS } from '../data/seasons.js';
import { HERO_DEF } from '../data/hero.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { territoryRateBonus } from './map.js';

const RESOURCE_KEYS = ['gold', 'food', 'wood', 'stone', 'iron', 'mana'];

/**
 * Recalculate rates and caps from current buildings and techs.
 * Call whenever buildings or techs change.
 */
export function recalcRates() {
  // Reset to zero
  const rates = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0, mana: 0 };
  const caps  = { gold: 500, food: 500, wood: 500, stone: 500, iron: 500, mana: 500 };

  // Baseline income (tiny passive income so new players aren't stuck)
  rates.gold += 0.5;
  rates.food += 0.5;

  // Age production multiplier (applies to all building output)
  const ageMult = AGES[state.age ?? 0]?.productionMult ?? 1.0;

  // Sum building contributions
  for (const [id, count] of Object.entries(state.buildings)) {
    if (count <= 0) continue;
    const def = BUILDINGS[id];
    if (!def) continue;

    // Tech + age multipliers
    const prodMult = _buildingProdMultiplier(id) * ageMult;

    for (const res of RESOURCE_KEYS) {
      if (def.production[res]) rates[res] += def.production[res] * count * prodMult;
      if (def.consumption[res]) rates[res] -= def.consumption[res] * count;
      if (def.capBonus[res])   caps[res]  += def.capBonus[res] * count;
    }
  }

  // Territory bonuses from captured map tiles
  const territory = territoryRateBonus();
  for (const res of RESOURCE_KEYS) {
    if (territory[res]) rates[res] += territory[res];
  }

  // Trade route income from allied empires (reads state directly — no circular import)
  if (state.diplomacy) {
    for (const emp of state.diplomacy.empires) {
      if (emp.relations !== 'allied' || emp.tradeRoutes <= 0) continue;
      const gift = EMPIRES[emp.id]?.tradeGift ?? {};
      for (const [res, rate] of Object.entries(gift)) {
        if (rates[res] !== undefined) rates[res] += rate * emp.tradeRoutes;
      }
    }
  }

  // Season multipliers — applied to positive rates only (production, not upkeep)
  if (state.season) {
    const mods = SEASONS[state.season.index]?.modifiers ?? {};
    for (const res of RESOURCE_KEYS) {
      if (mods[res] !== undefined && rates[res] > 0) {
        rates[res] *= mods[res];
      }
    }
  }

  // Unit upkeep
  for (const [id, count] of Object.entries(state.units)) {
    if (count <= 0) continue;
    const def = UNITS[id];
    if (!def || !def.upkeep) continue;
    for (const [res, amt] of Object.entries(def.upkeep)) {
      rates[res] = (rates[res] ?? 0) - amt * count;
    }
  }

  // Hero upkeep (flat, not scaled by count)
  if (state.hero?.recruited) {
    for (const [res, amt] of Object.entries(HERO_DEF.upkeep)) {
      rates[res] = (rates[res] ?? 0) - amt;
    }
  }

  // Apply active disaster modifiers (from random event system)
  // Grand Cathedral wonder: halves disaster severity (attenuates penalty by 50%)
  const cathedralBuilt = (state.buildings?.grandCathedral ?? 0) >= 1;
  const mods = state.randomEvents?.activeModifiers ?? [];
  for (const mod of mods) {
    if (mod.expiresAt > state.tick && rates[mod.resource] !== undefined) {
      const effectiveMult = cathedralBuilt
        ? 1 - (1 - mod.rateMult) * 0.5   // half the penalty
        : mod.rateMult;
      rates[mod.resource] *= effectiveMult;
    }
  }

  Object.assign(state.rates, rates);
  Object.assign(state.caps, caps);
}

/**
 * Called once per tick. Applies rates (adjusted for tick interval) to resources.
 */
export function resourceTick() {
  let changed = false;

  for (const res of RESOURCE_KEYS) {
    const rate  = state.rates[res] ?? 0;
    const delta = rate / TICKS_PER_SECOND;
    const current = state.resources[res] ?? 0;
    const cap   = state.caps[res] ?? 500;

    const next = Math.max(0, Math.min(cap, current + delta));
    if (next !== current) {
      state.resources[res] = next;
      changed = true;
    }
  }

  // Advance training queue
  _advanceTrainingQueue();

  // Track lifetime gold earned for leaderboard
  if (state.stats) {
    const goldDelta = (state.rates.gold ?? 0) / TICKS_PER_SECOND;
    if (goldDelta > 0) state.stats.goldEarned += goldDelta;
  }

  if (changed) emit(Events.RESOURCE_CHANGED, {});
}

function _advanceTrainingQueue() {
  if (state.trainingQueue.length === 0) return;

  const entry = state.trainingQueue[0];
  // Inspire ability: double training speed while active
  const inspireActive = state.hero?.recruited &&
    state.hero.activeEffects?.inspire > state.tick;
  entry.remaining -= inspireActive ? 2 : 1;

  if (entry.remaining <= 0) {
    state.trainingQueue.shift();
    state.units[entry.unitId] = (state.units[entry.unitId] ?? 0) + 1;
    recalcRates();
    emit(Events.UNIT_CHANGED, { unitId: entry.unitId });
  }
}

function _buildingProdMultiplier(buildingId) {
  let mult = 1;
  const techs = state.techs;

  if (buildingId === 'farm'        && techs.agriculture) mult *= 1.5;
  if (buildingId === 'quarry'      && techs.masonry)     mult *= 1.5;
  if (buildingId === 'ironFoundry' && techs.metalworking) mult *= 1.5;
  if (buildingId === 'market'      && techs.tradeRoutes) mult *= 1.75;
  if (buildingId === 'manaWell'    && techs.arcane)      mult *= 2.0;

  return mult;
}
