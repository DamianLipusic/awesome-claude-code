/**
 * EmpireOS — Action functions.
 * All state mutations happen here (no direct state writes from UI).
 */

import { state } from './state.js';
import { emit, Events } from './events.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { TECHS } from '../data/techs.js';
import { AGES } from '../data/ages.js';
import { HERO_DEF } from '../data/hero.js';
import { IMPROVEMENTS } from '../data/improvements.js';
import { recalcRates } from '../systems/resources.js';
import { log } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function addMessage(text, type = 'info') {
  state.messages.unshift({ text, type, tick: state.tick });
  if (state.messages.length > 50) state.messages.pop();
  emit(Events.MESSAGE, { text, type });
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

/**
 * Build (or increment) a building by id.
 * Deducts costs from resources and recalculates rates.
 */
export function buildBuilding(id) {
  const def = BUILDINGS[id];
  if (!def) return { ok: false, reason: `Unknown building: ${id}` };

  const count = state.buildings[id] ?? 0;

  // Unique (wonder) buildings can only be built once
  if (def.unique && count >= 1) {
    return { ok: false, reason: `${def.name} has already been built.` };
  }

  const cost  = scaledCost(def.baseCost, count);

  if (!canAfford(cost)) {
    return { ok: false, reason: 'Insufficient resources' };
  }

  deductCost(cost);
  state.buildings[id] = count + 1;
  recalcRates();

  emit(Events.BUILDING_CHANGED, { id, count: state.buildings[id] });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`Built ${def.name}.`, 'build');
  return { ok: true };
}

/**
 * Demolish one instance of a building.
 */
export function demolishBuilding(id) {
  const count = state.buildings[id] ?? 0;
  if (count <= 0) return { ok: false, reason: 'No buildings to demolish' };

  state.buildings[id] = count - 1;
  if (state.buildings[id] === 0) delete state.buildings[id];
  recalcRates();

  emit(Events.BUILDING_CHANGED, { id });
  addMessage(`Demolished a ${BUILDINGS[id]?.name ?? id}.`, 'demolish');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/**
 * Enqueue training of a unit.
 * Deducts cost immediately; unit count increases when training completes.
 */
export function trainUnit(id) {
  const def = UNITS[id];
  if (!def) return { ok: false, reason: `Unknown unit: ${id}` };

  if (!canAfford(def.cost)) {
    return { ok: false, reason: 'Insufficient resources' };
  }

  deductCost(def.cost);
  // Warcraft tech: -25% training time; Colosseum wonder: additional -33%
  let totalTicks = def.trainTicks;
  if (state.techs.warcraft)               totalTicks = Math.ceil(totalTicks * 0.75);
  if ((state.buildings.colosseum ?? 0) >= 1) totalTicks = Math.ceil(totalTicks * 0.67);
  state.trainingQueue.push({ unitId: id, remaining: totalTicks, totalTicks });

  emit(Events.UNIT_CHANGED, {});
  addMessage(`Training ${def.name}…`, 'train');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Age advancement
// ---------------------------------------------------------------------------

/**
 * Attempt to advance to the next age.
 * Returns { ok, reason? }
 */
export function advanceAge() {
  const currentAge = state.age ?? 0;
  const nextAgeDef = AGES[currentAge + 1];

  if (!nextAgeDef) {
    return { ok: false, reason: 'Already at the maximum age.' };
  }

  // Check non-resource requirements
  const reqCheck = _checkAgeRequirements(nextAgeDef);
  if (!reqCheck.ok) return reqCheck;

  // Check resource cost
  if (!canAfford(nextAgeDef.cost)) {
    return { ok: false, reason: 'Insufficient resources to advance.' };
  }

  deductCost(nextAgeDef.cost);
  state.age = currentAge + 1;
  recalcRates();

  emit(Events.AGE_CHANGED, { age: state.age });
  emit(Events.BUILDING_CHANGED, {});   // re-check age-gated building locks
  emit(Events.UNIT_CHANGED, {});       // re-check age-gated unit locks
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚔️ Empire advanced to the ${nextAgeDef.name}! ${nextAgeDef.description}`, 'age');
  log('age advanced to', state.age, nextAgeDef.name);
  return { ok: true };
}

function _checkAgeRequirements(ageDef) {
  for (const req of ageDef.requires) {
    if (req.type === 'totalBuildings') {
      const total = Object.values(state.buildings).reduce((s, c) => s + c, 0);
      if (total < req.count) {
        return { ok: false, reason: `Need ${req.count} buildings (have ${total}).` };
      }
    }
    if (req.type === 'totalUnits') {
      const total = Object.values(state.units).reduce((s, c) => s + c, 0);
      if (total < req.count) {
        return { ok: false, reason: `Need ${req.count} trained units (have ${total}).` };
      }
    }
    if (req.type === 'territory') {
      const count = _countPlayerTiles();
      if (count < req.count) {
        return { ok: false, reason: `Need ${req.count} territories (have ${count}).` };
      }
    }
    if (req.type === 'tech') {
      if (!state.techs[req.id]) {
        const name = TECHS[req.id]?.name ?? req.id;
        return { ok: false, reason: `Requires research: ${name}.` };
      }
    }
  }
  return { ok: true };
}

function _countPlayerTiles() {
  if (!state.map) return 0;
  let count = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

/**
 * Recruit the Champion hero (once per game).
 * Requires Bronze Age and sufficient resources.
 */
export function recruitHero() {
  if (state.hero?.recruited) {
    return { ok: false, reason: 'Your Champion is already with your army.' };
  }

  // Age requirement
  const ageReq = HERO_DEF.requires.find(r => r.type === 'age');
  if (ageReq && (state.age ?? 0) < ageReq.minAge) {
    const ageName = AGES[ageReq.minAge]?.name ?? `Age ${ageReq.minAge}`;
    return { ok: false, reason: `Requires ${ageName} to recruit a Champion.` };
  }

  if (!canAfford(HERO_DEF.cost)) {
    return { ok: false, reason: 'Insufficient resources to recruit Champion.' };
  }

  deductCost(HERO_DEF.cost);
  state.hero = {
    recruited: true,
    abilityCooldowns: { battleCry: 0, inspire: 0, siege: 0 },
    activeEffects:    { battleCry: false, inspire: 0, siege: false },
  };
  recalcRates();

  emit(Events.HERO_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⭐ ${HERO_DEF.name} has joined your empire!`, 'hero');
  log('hero recruited');
  return { ok: true };
}

/**
 * Activate a hero ability by id.
 * Returns { ok, reason? }
 */
export function useHeroAbility(abilityId) {
  if (!state.hero?.recruited) {
    return { ok: false, reason: 'No Champion to command.' };
  }
  const ability = HERO_DEF.abilities[abilityId];
  if (!ability) return { ok: false, reason: `Unknown ability: ${abilityId}` };

  const cdExpires = state.hero.abilityCooldowns[abilityId] ?? 0;
  if (state.tick < cdExpires) {
    const secsLeft = Math.ceil((cdExpires - state.tick) / 4);
    return { ok: false, reason: `${ability.name} is on cooldown (${secsLeft}s remaining).` };
  }

  // Check if effect is already pending (one-shot abilities can't stack)
  if (abilityId === 'battleCry' && state.hero.activeEffects.battleCry) {
    return { ok: false, reason: 'Battle Cry is already primed for the next attack.' };
  }
  if (abilityId === 'siege' && state.hero.activeEffects.siege) {
    return { ok: false, reason: 'Siege Master is already primed for the next attack.' };
  }

  // Activate
  if (abilityId === 'battleCry') {
    state.hero.activeEffects.battleCry = true;
  } else if (abilityId === 'inspire') {
    state.hero.activeEffects.inspire = state.tick + ability.durationTicks;
  } else if (abilityId === 'siege') {
    state.hero.activeEffects.siege = true;
  }

  // Set cooldown from now
  state.hero.abilityCooldowns[abilityId] = state.tick + ability.cooldownTicks;

  emit(Events.HERO_CHANGED, {});
  addMessage(`${ability.icon} ${HERO_DEF.name} used ${ability.name}!`, 'hero');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tile improvements (T051)
// ---------------------------------------------------------------------------

/**
 * Build an improvement on a player-owned tile at (x, y).
 * Each terrain type supports one specific improvement (see data/improvements.js).
 * At most one improvement per tile; enemy capturing the tile destroys it.
 * Returns { ok, reason? }
 */
export function buildTileImprovement(x, y) {
  if (!state.map) return { ok: false, reason: 'No map loaded.' };
  const tile = state.map.tiles[y]?.[x];
  if (!tile)                        return { ok: false, reason: 'Invalid tile.' };
  if (tile.owner !== 'player')      return { ok: false, reason: 'You must own this tile first.' };
  if (tile.type === 'capital')      return { ok: false, reason: 'Cannot build an improvement on the capital.' };
  if (tile.improvement)             return { ok: false, reason: 'This tile already has an improvement.' };

  const def = IMPROVEMENTS[tile.type];
  if (!def) return { ok: false, reason: 'No improvement available for this terrain type.' };

  if (!canAfford(def.cost)) {
    const needs = Object.entries(def.cost).map(([r, a]) => `${a} ${r}`).join(', ');
    return { ok: false, reason: `Insufficient resources. Need: ${needs}.` };
  }

  deductCost(def.cost);
  tile.improvement = def.id;
  recalcRates();

  emit(Events.MAP_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`${def.icon} Built ${def.name} at (${x},${y}). ${def.desc}`, 'build');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Battle formations (T052)
// ---------------------------------------------------------------------------

const VALID_FORMATIONS = ['defensive', 'balanced', 'aggressive'];

/**
 * Set the player's battle formation stance.
 * Affects player attack power in combat and enemy counterattack success.
 */
export function setFormation(type) {
  if (!VALID_FORMATIONS.includes(type)) return { ok: false, reason: `Unknown formation: ${type}` };
  state.formation = type;
  emit(Events.UNIT_CHANGED, {});  // reuse to refresh military panel
  addMessage(`Formation changed to ${type.charAt(0).toUpperCase() + type.slice(1)}.`, 'info');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function scaledCost(base, existing) {
  // Each additional building costs 15% more
  const factor = Math.pow(1.15, existing);
  // Conqueror archetype: −10% building costs
  const archMult = state.archetype === 'conqueror' ? 0.9 : 1.0;
  const scaled = {};
  for (const [res, amt] of Object.entries(base)) {
    scaled[res] = Math.ceil(amt * factor * archMult);
  }
  return scaled;
}

function canAfford(cost) {
  for (const [res, amt] of Object.entries(cost)) {
    if ((state.resources[res] ?? 0) < amt) return false;
  }
  return true;
}

function deductCost(cost) {
  for (const [res, amt] of Object.entries(cost)) {
    state.resources[res] = (state.resources[res] ?? 0) - amt;
  }
}

log('actions module loaded');
