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
import { RELICS } from '../data/relics.js';
import { POLICIES } from '../data/policies.js';

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

  // Merchant archetype: +1.5 gold/s base income
  if (state.archetype === 'merchant') rates.gold += 1.5;

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

  // Economics tech: +500 gold storage cap
  if (state.techs.economics) caps.gold += 500;

  // Territory bonuses from captured map tiles
  const territory = territoryRateBonus();
  for (const res of RESOURCE_KEYS) {
    if (territory[res]) rates[res] += territory[res];
  }

  // Trade route income from allied empires (reads state directly — no circular import)
  // Navigation tech gives +50% to all trade route income.
  // Merchant archetype gives +50% on top of navigation multiplier.
  if (state.diplomacy) {
    const navMult     = state.techs.navigation ? 1.5 : 1.0;
    const merchantMult = state.archetype === 'merchant' ? 1.5 : 1.0;
    for (const emp of state.diplomacy.empires) {
      if (emp.relations !== 'allied' || emp.tradeRoutes <= 0) continue;
      const gift = EMPIRES[emp.id]?.tradeGift ?? {};
      for (const [res, rate] of Object.entries(gift)) {
        if (rates[res] !== undefined) rates[res] += rate * emp.tradeRoutes * navMult * merchantMult;
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

  // T068: Garrison upkeep (units removed from army but still consume resources)
  if (state.garrisons) {
    for (const { unitId, count } of Object.values(state.garrisons)) {
      if (count <= 0) continue;
      const def = UNITS[unitId];
      if (!def?.upkeep) continue;
      for (const [res, amt] of Object.entries(def.upkeep)) {
        rates[res] = (rates[res] ?? 0) - amt * count;
      }
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

  // Active spell: Blessing — +60% food and gold production while active
  if (state.spells?.activeEffects?.blessing > state.tick) {
    if (rates.food > 0) rates.food *= 1.6;
    if (rates.gold > 0) rates.gold *= 1.6;
  }

  // T065: active governance policy — multipliers on positive production rates
  if (state.policy) {
    const pol = POLICIES[state.policy];
    if (pol) {
      // Per-resource multipliers (only applies to positive rates — production)
      if (pol.effects) {
        for (const [res, mult] of Object.entries(pol.effects)) {
          if (rates[res] !== undefined && rates[res] > 0) {
            rates[res] *= mult;
          }
        }
      }
      // Global positive-rate multiplier (e.g. martial law -8% all)
      if (pol.allRatesMult) {
        for (const res of RESOURCE_KEYS) {
          if (rates[res] > 0) rates[res] *= pol.allRatesMult;
        }
      }
    }
  }

  // Population income / consumption
  // Each citizen generates +0.003 gold/s and consumes +0.005 food/s
  if (state.population) {
    const pop = Math.floor(state.population.count ?? 0);
    if (pop > 0) {
      rates.gold += pop * 0.003;
      rates.food -= pop * 0.005;
    }
  }

  // T064: apply ancient relic permanent bonuses
  if (state.relics?.discovered) {
    for (const relicId of Object.keys(state.relics.discovered)) {
      const def = RELICS[relicId];
      if (!def) continue;
      if (def.bonus.rates) {
        for (const [res, val] of Object.entries(def.bonus.rates)) {
          if (rates[res] !== undefined) rates[res] += val;
        }
      }
      if (def.bonus.caps) {
        for (const [res, val] of Object.entries(def.bonus.caps)) {
          if (caps[res] !== undefined) caps[res] += val;
        }
      }
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

/**
 * Returns a breakdown of all rate contributors for a single resource.
 * Used by the HUD tooltip (T034). Mirrors recalcRates() logic.
 *
 * Returns:
 *   lines        — array of { label, value } (value is /s, negative = consumption)
 *   seasonMult   — season multiplier applied to production (1.0 = no effect)
 *   seasonName   — display string e.g. "☀️ Summer ×1.10" (empty string if neutral)
 *   disasters    — array of { label, mult } for active disaster modifiers
 *   total        — state.rates[resId] (ground truth after full recalcRates)
 */
export function getBreakdown(resId) {
  const lines    = [];
  const disasters = [];

  // Baseline income
  if (resId === 'gold') lines.push({ label: 'Baseline',   value: 0.5 });
  if (resId === 'food') lines.push({ label: 'Baseline',   value: 0.5 });

  // Age multiplier
  const ageMult = AGES[state.age ?? 0]?.productionMult ?? 1.0;

  // Building contributions (production and consumption separately)
  for (const [id, count] of Object.entries(state.buildings)) {
    if (count <= 0) continue;
    const def = BUILDINGS[id];
    if (!def) continue;
    const prodMult = _buildingProdMultiplier(id) * ageMult;

    if (def.production[resId]) {
      const val = def.production[resId] * count * prodMult;
      lines.push({ label: `${def.icon ?? ''} ${def.name} ×${count}`, value: val });
    }
    if (def.consumption[resId]) {
      const val = -(def.consumption[resId] * count);
      lines.push({ label: `${def.icon ?? ''} ${def.name} ×${count} upkeep`, value: val });
    }
  }

  // Territory bonuses
  const territory = territoryRateBonus();
  if (territory[resId]) {
    lines.push({ label: '🗺️ Territory', value: territory[resId] });
  }

  // Trade route income from allied empires (navigation tech ×1.5)
  if (state.diplomacy) {
    const navMult = state.techs.navigation ? 1.5 : 1.0;
    for (const emp of state.diplomacy.empires) {
      if (emp.relations !== 'allied' || emp.tradeRoutes <= 0) continue;
      const empDef = EMPIRES[emp.id];
      const gift   = empDef?.tradeGift ?? {};
      if (gift[resId]) {
        lines.push({ label: `🤝 ${empDef.name} trade`, value: gift[resId] * emp.tradeRoutes * navMult });
      }
    }
  }

  // Season multiplier — computed separately (shown as a modifier, not a line)
  let seasonMult = 1.0;
  let seasonName = '';
  if (state.season) {
    const season = SEASONS[state.season.index];
    const mod    = season?.modifiers?.[resId];
    if (mod !== undefined && mod !== 1.0) {
      seasonMult = mod;
      const sign  = mod > 1 ? '+' : '';
      const pct   = Math.round((mod - 1) * 100);
      seasonName  = `${season.icon} ${season.name} ${sign}${pct}%`;
    }
  }

  // Unit upkeep
  for (const [id, count] of Object.entries(state.units)) {
    if (count <= 0) continue;
    const def = UNITS[id];
    if (!def || !def.upkeep?.[resId]) continue;
    lines.push({ label: `${def.icon} ${def.name} ×${count} upkeep`, value: -(def.upkeep[resId] * count) });
  }

  // Hero upkeep
  if (state.hero?.recruited && HERO_DEF.upkeep[resId]) {
    lines.push({ label: '⚔️ Hero upkeep', value: -(HERO_DEF.upkeep[resId]) });
  }

  // Population income / consumption
  if (state.population) {
    const pop = Math.floor(state.population.count ?? 0);
    if (pop > 0) {
      if (resId === 'gold') lines.push({ label: '🏘️ Citizens', value: pop * 0.003 });
      if (resId === 'food') lines.push({ label: '🏘️ Citizens upkeep', value: -(pop * 0.005) });
    }
  }

  // Active disaster modifiers
  const activeMods = state.randomEvents?.activeModifiers ?? [];
  const cathedralBuilt = (state.buildings?.grandCathedral ?? 0) >= 1;
  for (const mod of activeMods) {
    if (mod.resource === resId && mod.expiresAt > state.tick) {
      const effectiveMult = cathedralBuilt
        ? 1 - (1 - mod.rateMult) * 0.5
        : mod.rateMult;
      const pct = Math.round((effectiveMult - 1) * 100);
      disasters.push({ label: mod.id.replace(/_/g, ' '), mult: effectiveMult, pct });
    }
  }

  // T065: active policy modifier (shows as a modifier like season)
  const policyModifiers = [];
  if (state.policy) {
    const pol = POLICIES[state.policy];
    if (pol) {
      const resMult = pol.effects?.[resId];
      if (resMult !== undefined && resMult !== 1.0) {
        const sign = resMult > 1 ? '+' : '';
        const pct  = Math.round((resMult - 1) * 100);
        policyModifiers.push({ label: `${pol.icon} ${pol.name} policy ${sign}${pct}%`, mult: resMult });
      } else if (pol.allRatesMult && pol.allRatesMult !== 1.0) {
        const sign = pol.allRatesMult > 1 ? '+' : '';
        const pct  = Math.round((pol.allRatesMult - 1) * 100);
        policyModifiers.push({ label: `${pol.icon} ${pol.name} policy ${sign}${pct}%`, mult: pol.allRatesMult });
      }
    }
  }

  return {
    lines,
    seasonMult,
    seasonName,
    disasters,
    policyModifiers,
    total: state.rates[resId] ?? 0,
  };
}

function _buildingProdMultiplier(buildingId) {
  let mult = 1;
  const techs = state.techs;

  if (buildingId === 'farm') {
    if (techs.agriculture) mult *= 1.5;
    if (techs.divine_favor) mult *= 1.3;
  }
  if (buildingId === 'quarry') {
    if (techs.masonry) mult *= 1.5;
    if (techs.alchemy) mult *= 1.25;
  }
  if (buildingId === 'ironFoundry' && techs.metalworking) mult *= 1.5;
  if (buildingId === 'market') {
    if (techs.tradeRoutes) mult *= 1.75;
    if (techs.economics)   mult *= 1.5;
  }
  if (buildingId === 'manaWell') {
    if (techs.arcane)              mult *= 2.0;
    if (techs.alchemy)             mult *= 1.75;
    if (techs.divine_favor)        mult *= 1.3;
    if (state.archetype === 'arcane') mult *= 2.0;  // Arcane archetype: ×2 mana well output
  }

  return mult;
}
