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
import { HERO_DEF, HERO_SKILLS, HERO_MAX_SKILLS, heroSkillBonus, HERO_TRAITS, COMPANIONS } from '../data/hero.js';
import { IMPROVEMENTS } from '../data/improvements.js';
import { POLICIES, POLICY_COOLDOWN_TICKS } from '../data/policies.js';
import { BOONS } from '../data/ageBoons.js';
import { SPECIALIZATIONS } from '../data/buildingSpecials.js';
import { CAPITAL_PLANS } from '../data/capitalPlans.js';
import { FORGE_ITEMS } from '../data/forgeItems.js';
import { SEASON_UNIT_DISCOUNT } from '../data/seasons.js';
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

  // T130: Seasonal unit discount — 20% off for the season-matched unit type
  const discountUnit = SEASON_UNIT_DISCOUNT[state.season?.index ?? 0];
  const effectiveCost = (discountUnit === id)
    ? Object.fromEntries(Object.entries(def.cost).map(([r, v]) => [r, Math.floor(v * 0.80)]))
    : def.cost;

  if (!canAfford(effectiveCost)) {
    return { ok: false, reason: 'Insufficient resources' };
  }

  deductCost(effectiveCost);
  // Warcraft tech: -25% training time; Colosseum wonder: -33%; Martial Law policy: -30%
  let totalTicks = def.trainTicks;
  if (state.techs.warcraft)                  totalTicks = Math.ceil(totalTicks * 0.75);
  if ((state.buildings.colosseum ?? 0) >= 1) totalTicks = Math.ceil(totalTicks * 0.67);
  if (state.policy === 'martial_law')        totalTicks = Math.ceil(totalTicks * 0.70);
  // T070: hero swift_training skill — -20% training time
  if (state.hero?.recruited && state.hero.skills?.includes('swift_training')) {
    totalTicks = Math.ceil(totalTicks * 0.80);
  }
  // T090: Training Grounds specialization — -25% training time
  const barrSpec = state.buildingSpecials?.barracks;
  if (barrSpec === 'training_grounds') totalTicks = Math.ceil(totalTicks * 0.75);
  // T096: Citizen soldiers reduce training time by 5% per slot (capped at 50%)
  const soldierSlots = state.citizenRoles?.soldiers ?? 0;
  if (soldierSlots > 0) {
    const soldierMult = Math.max(0.50, 1 - soldierSlots * 0.05);
    totalTicks = Math.ceil(totalTicks * soldierMult);
  }
  // T125: War Drums forge item — -20% training time
  if (state.forge?.crafted?.war_drums) totalTicks = Math.ceil(totalTicks * 0.80);

  state.trainingQueue.push({ unitId: id, remaining: totalTicks, totalTicks });

  emit(Events.UNIT_CHANGED, {});
  const discountNote = (discountUnit === id) ? ' (seasonal discount)' : '';
  addMessage(`Training ${def.name}…${discountNote}`, 'train');
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
    abilityCooldowns:  { battleCry: 0, inspire: 0, siege: 0 },
    activeEffects:     { battleCry: false, inspire: 0, siege: false },
    // T070: hero skill tracking
    skills:            [],
    combatWins:        0,
    pendingSkillOffer: null,
    // T112: legendary quest — initialized when hero reaches 10+ combat wins
    legendaryQuest:    null,  // { phase: 0|1|2|3, winsAtPhaseStart: number }
    legendaryAttack:   0,     // permanent flat attack bonus (phase 1 reward)
    cdReduction:       false, // halved ability cooldowns (phase 2 reward)
    supremeCommander:  false, // zero-cooldown abilities (phase 3 reward)
    // T119: commander trait — null until chosen via chooseHeroTrait()
    trait:             null,
    pendingTrait:      true,  // set to false once a trait is chosen
    traitOffer:        _pickTraitOffer(),  // 3 random trait IDs to display
  };
  recalcRates();

  emit(Events.HERO_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⭐ ${HERO_DEF.name} has joined your empire! Choose a commander trait.`, 'hero');
  log('hero recruited');
  return { ok: true };
}

/** Pick 3 unique random trait IDs from the HERO_TRAITS pool for the chooser. */
function _pickTraitOffer() {
  const shuffled = [...HERO_TRAITS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(t => t.id);
}

/**
 * Confirm the chosen commander trait for the hero.
 * Clears pendingTrait and stores the chosen trait ID.
 * @param {string} traitId — one of the HERO_TRAIT_ORDER ids
 */
export function chooseHeroTrait(traitId) {
  if (!state.hero?.recruited) {
    return { ok: false, reason: 'No hero to assign a trait to.' };
  }
  if (!state.hero.pendingTrait) {
    return { ok: false, reason: 'Hero already has a trait.' };
  }
  const trait = HERO_TRAITS.find(t => t.id === traitId);
  if (!trait) return { ok: false, reason: `Unknown trait: ${traitId}` };

  state.hero.trait        = traitId;
  state.hero.pendingTrait = false;
  state.hero.traitOffer   = null;  // clear the offer
  recalcRates();

  emit(Events.HERO_TRAIT_CHOSEN, { traitId });
  emit(Events.HERO_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⭐ Champion trait chosen: ${trait.icon} ${trait.name} — ${trait.desc}`, 'hero');
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

  // T112: Legendary Quest — Supreme Commander (phase 3) removes cooldowns;
  // War Strategist (phase 2) halves cooldowns.
  let cdTicks = ability.cooldownTicks;
  if (state.hero.supremeCommander) {
    cdTicks = 0;
  } else if (state.hero.cdReduction) {
    cdTicks = Math.floor(cdTicks / 2);
  }
  state.hero.abilityCooldowns[abilityId] = state.tick + cdTicks;

  emit(Events.HERO_CHANGED, {});
  addMessage(`${ability.icon} ${HERO_DEF.name} used ${ability.name}!`, 'hero');
  return { ok: true };
}

/**
 * T070: Choose a hero skill from the pending skill offer.
 * Validates the skill ID is in the current offer, adds it to hero.skills,
 * clears the pending offer, and re-calculates resource rates.
 */
export function chooseHeroSkill(skillId) {
  if (!state.hero?.recruited) return { ok: false, reason: 'No hero to assign skills to.' };
  if (!state.hero.pendingSkillOffer?.includes(skillId)) {
    return { ok: false, reason: 'That skill is not in the current offer.' };
  }
  if ((state.hero.skills?.length ?? 0) >= HERO_MAX_SKILLS) {
    return { ok: false, reason: `Champion already has ${HERO_MAX_SKILLS} skills.` };
  }

  if (!state.hero.skills) state.hero.skills = [];
  state.hero.skills.push(skillId);
  state.hero.pendingSkillOffer = null;

  const skill = HERO_SKILLS.find(s => s.id === skillId);
  recalcRates();   // apply resourceRate / ratesMult immediately

  emit(Events.HERO_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `⭐ Champion learned ${skill?.icon ?? ''} ${skill?.name ?? skillId}: ${skill?.desc ?? ''}`,
    'hero',
  );
  log('hero skill chosen:', skillId);
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
// Tile Improvement Upgrade (T095)
// ---------------------------------------------------------------------------

/**
 * Upgrade an existing tile improvement to Level 2.
 * Requires Iron Age (age >= 2) and the tile to already have a level 1 improvement.
 * Level 2 doubles production but costs more resources.
 * Returns { ok, reason? }
 */
export function upgradeTileImprovement(x, y) {
  if (!state.map) return { ok: false, reason: 'No map loaded.' };
  const tile = state.map.tiles[y]?.[x];
  if (!tile)                         return { ok: false, reason: 'Invalid tile.' };
  if (tile.owner !== 'player')       return { ok: false, reason: 'You must own this tile.' };
  if (!tile.improvement)             return { ok: false, reason: 'No improvement on this tile.' };
  if (tile.improvementLevel === 2)   return { ok: false, reason: 'Already at Level 2.' };
  if ((state.age ?? 0) < 2)          return { ok: false, reason: 'Requires Iron Age to upgrade improvements.' };

  const impDef = IMPROVEMENTS[tile.type];
  const lvl2   = impDef?.level2;
  if (!lvl2) return { ok: false, reason: 'No upgrade available for this improvement.' };

  if (!canAfford(lvl2.upgradeCost)) {
    const needs = Object.entries(lvl2.upgradeCost).map(([r, a]) => `${a} ${r}`).join(', ');
    return { ok: false, reason: `Insufficient resources. Need: ${needs}.` };
  }

  deductCost(lvl2.upgradeCost);
  tile.improvementLevel = 2;
  recalcRates();

  emit(Events.MAP_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`${lvl2.icon} Upgraded to ${lvl2.name} at (${x},${y}). ${lvl2.desc}`, 'build');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tile Fortification (T066)
// ---------------------------------------------------------------------------

/**
 * Build a fortification on a player-owned map tile at (x, y).
 * Costs 40 stone + 25 iron. Adds +15 defense. One fortification per tile.
 * Fortifications are lost if the enemy captures the tile.
 */
export function fortifyTile(x, y) {
  if (!state.map) return { ok: false, reason: 'No map loaded.' };
  const tile = state.map.tiles[y]?.[x];
  if (!tile)                   return { ok: false, reason: 'Invalid tile.' };
  if (tile.owner !== 'player') return { ok: false, reason: 'You must own this tile.' };
  if (tile.type === 'capital') return { ok: false, reason: 'Capital is already fortified.' };
  if (tile.fortified)          return { ok: false, reason: 'This tile is already fortified.' };

  const cost = { stone: 40, iron: 25 };
  if (!canAfford(cost)) {
    return { ok: false, reason: 'Need 40 stone and 25 iron to fortify.' };
  }

  deductCost(cost);
  tile.fortified = true;
  // T129: chokepoint tiles get +40 defense bonus instead of the standard +15
  const defBonus = tile.isChokepoint ? 40 : 15;
  tile.fortifyBonus = defBonus;
  tile.defense = (tile.defense ?? 10) + defBonus;

  emit(Events.MAP_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  const msg = tile.isChokepoint
    ? `◈ Chokepoint fortified (${x},${y})! Defense +40.`
    : `🏰 Fortified tile (${x},${y}). Defense +15.`;
  addMessage(msg, 'build');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Policies (T065)
// ---------------------------------------------------------------------------

/**
 * Activate or deactivate a governance policy.
 * Pass null to remove the active policy.
 * A 60-second cooldown prevents rapid policy flipping.
 */
export function setPolicy(id) {
  if (id !== null && !POLICIES[id]) {
    return { ok: false, reason: `Unknown policy: ${id}` };
  }

  // Enforce cooldown only when switching away from an existing policy
  if (state.policy !== null && id !== state.policy) {
    const cooldownRemaining = (state.policyChangedAt + POLICY_COOLDOWN_TICKS) - state.tick;
    if (cooldownRemaining > 0) {
      const secs = Math.ceil(cooldownRemaining / 4);
      return { ok: false, reason: `Policy cooldown: ${secs}s remaining.` };
    }
  }

  const prev = state.policy;
  state.policy          = id;
  state.policyChangedAt = state.tick;

  // Apply morale hit when activating a new harsh policy
  if (id !== null && id !== prev) {
    const def = POLICIES[id];
    if (def.moraleHit && def.moraleHit < 0) {
      state.morale = Math.max(0, Math.min(100, (state.morale ?? 50) + def.moraleHit));
      emit(Events.MORALE_CHANGED, {});
    }
  }

  recalcRates();
  emit(Events.POLICY_CHANGED, { id });
  emit(Events.RESOURCE_CHANGED, {});
  const name = id ? POLICIES[id].name : 'None';
  addMessage(`📜 Policy: ${name}.`, 'info');
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
// Garrison (T068)
// ---------------------------------------------------------------------------

const GARRISON_FOOD_COST  = 30;   // food per garrisoned unit
const GARRISON_MAX_TOTAL  = 10;   // max garrisoned units across all tiles

/**
 * Garrison `count` units of `unitId` on tile at (x, y).
 * Units are removed from state.units and tracked in state.garrisons.
 * Costs GARRISON_FOOD_COST food per unit.
 */
export function garrisonUnit(x, y, unitId, count = 1) {
  if (!state.map) return { ok: false, reason: 'No map loaded.' };
  const tile = state.map.tiles[y]?.[x];
  if (!tile) return { ok: false, reason: 'Invalid coordinates.' };
  if (tile.owner !== 'player') return { ok: false, reason: 'You can only garrison player-owned tiles.' };
  const cap = state.map.capital;
  if (x === cap.x && y === cap.y) return { ok: false, reason: 'Cannot garrison the capital — it is always defended.' };

  const def = UNITS[unitId];
  if (!def) return { ok: false, reason: `Unknown unit: ${unitId}` };

  const inArmy = state.units[unitId] ?? 0;
  if (inArmy < count) return { ok: false, reason: `Not enough ${def.name} in your army (have ${inArmy}).` };

  const foodCost = GARRISON_FOOD_COST * count;
  if ((state.resources.food ?? 0) < foodCost) return { ok: false, reason: `Need ${foodCost} food to provision the garrison.` };

  // Check total garrison cap
  const totalGarrisoned = _totalGarrisoned();
  if (totalGarrisoned + count > GARRISON_MAX_TOTAL)
    return { ok: false, reason: `Garrison limit reached (max ${GARRISON_MAX_TOTAL} total units).` };

  // Deduct from army and provision
  state.resources.food = Math.max(0, (state.resources.food ?? 0) - foodCost);
  state.units[unitId] = inArmy - count;
  if (state.units[unitId] <= 0) delete state.units[unitId];

  // Store in garrison map
  if (!state.garrisons) state.garrisons = {};
  const key = `${x},${y}`;
  const existing = state.garrisons[key];
  if (existing && existing.unitId === unitId) {
    existing.count += count;
  } else if (!existing) {
    state.garrisons[key] = { unitId, count };
  } else {
    // Replace existing garrison (different unit type)
    _returnGarrison(key);
    state.garrisons[key] = { unitId, count };
  }

  recalcRates();
  emit(Events.GARRISON_CHANGED, { x, y });
  emit(Events.UNIT_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🛡️ Garrisoned ${count} ${def.name} at (${x},${y}).`, 'build');
  return { ok: true };
}

/**
 * Withdraw the garrison from tile (x, y), returning units to the army.
 */
export function withdrawGarrison(x, y) {
  const key = `${x},${y}`;
  if (!state.garrisons?.[key]) return { ok: false, reason: 'No garrison at this tile.' };

  _returnGarrison(key);

  recalcRates();
  emit(Events.GARRISON_CHANGED, { x, y });
  emit(Events.UNIT_CHANGED, {});
  addMessage(`🛡️ Garrison at (${x},${y}) withdrawn.`, 'info');
  return { ok: true };
}

function _returnGarrison(key) {
  const g = state.garrisons?.[key];
  if (!g) return;
  state.units[g.unitId] = (state.units[g.unitId] ?? 0) + g.count;
  delete state.garrisons[key];
}

function _totalGarrisoned() {
  if (!state.garrisons) return 0;
  return Object.values(state.garrisons).reduce((s, g) => s + g.count, 0);
}

// Export helper for external use (e.g. enemyAI capturing a garrisoned tile)
export function destroyGarrison(x, y) {
  const key = `${x},${y}`;
  if (!state.garrisons?.[key]) return;
  const g = state.garrisons[key];
  // Garrison units are captured/destroyed — do NOT return to army
  delete state.garrisons[key];
  addMessage(`💀 Garrison at (${x},${y}) destroyed in battle! Lost ${g.count} ${UNITS[g.unitId]?.name ?? g.unitId}.`, 'combat-loss');
}

export { _totalGarrisoned as getTotalGarrisoned, GARRISON_MAX_TOTAL };

// ---------------------------------------------------------------------------
// Age Council Boons (T072)
// ---------------------------------------------------------------------------

/**
 * Record the player's council boon choice for the current age.
 * Idempotent — the same boon cannot be chosen twice.
 */
export function chooseCouncilBoon(boonId) {
  const def = BOONS[boonId];
  if (!def) return { ok: false, reason: `Unknown boon: ${boonId}` };
  if (!state.councilBoons) state.councilBoons = [];
  if (state.councilBoons.includes(boonId)) return { ok: false, reason: 'Boon already chosen.' };

  state.councilBoons.push(boonId);
  recalcRates();  // apply rate/cap bonuses immediately

  emit(Events.COUNCIL_BOON_CHOSEN, { boonId });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 Council boon: ${def.icon} ${def.name} — ${def.desc}`, 'info');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Building Specializations (T090)
// ---------------------------------------------------------------------------

/**
 * Apply a one-time permanent specialization to a building slot.
 * The player must own at least 1 of the building and must not have already
 * specialized it. Costs are paid immediately.
 */
export function specializeBuilding(buildingId, specId) {
  const def = SPECIALIZATIONS[specId];
  if (!def) return { ok: false, reason: `Unknown specialization: ${specId}` };
  if (def.buildingId !== buildingId) return { ok: false, reason: 'Specialization does not match building.' };
  if ((state.buildings[buildingId] ?? 0) < 1) return { ok: false, reason: 'You must own at least one of this building first.' };
  if (state.buildingSpecials?.[buildingId]) return { ok: false, reason: 'Building is already specialized.' };

  // Check tech/age requirements
  for (const req of (def.requires ?? [])) {
    if (req.type === 'tech' && !state.techs[req.id]) {
      return { ok: false, reason: `Requires ${req.id} technology.` };
    }
    if (req.type === 'age' && (state.age ?? 0) < req.age) {
      return { ok: false, reason: `Requires age ${req.age} or higher.` };
    }
  }

  if (!canAfford(def.cost)) return { ok: false, reason: 'Insufficient resources.' };

  deductCost(def.cost);
  if (!state.buildingSpecials) state.buildingSpecials = {};
  state.buildingSpecials[buildingId] = specId;

  recalcRates();
  emit(Events.BUILDING_SPECIALIZED, { buildingId, specId });
  emit(Events.BUILDING_CHANGED, { id: buildingId });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`${def.icon} ${def.name} specialization applied to ${BUILDINGS[buildingId]?.name ?? buildingId}!`, 'info');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Citizen Role Assignments (T096)
// ---------------------------------------------------------------------------

export const CITIZEN_ROLES = {
  scholars:  { icon: '📚', name: 'Scholars',  desc: '-5% research time each'  },
  merchants: { icon: '💰', name: 'Merchants', desc: '+0.3 gold/s each'         },
  workers:   { icon: '⚒️', name: 'Workers',   desc: '+4% production each'       },
  soldiers:  { icon: '⚔️', name: 'Soldiers',  desc: '-5% training time each'   },
};
export const CITIZEN_ROLE_ORDER = ['scholars', 'merchants', 'workers', 'soldiers'];

/**
 * Adjust the count for a citizen role by +delta (can be negative).
 * Max total slots = floor(population / 100). Each role is bounded [0, max].
 * Returns { ok, reason? }
 */
export function adjustCitizenRole(role, delta) {
  if (!CITIZEN_ROLES[role]) return { ok: false, reason: `Unknown role: ${role}` };

  // Initialise roles if needed (persists across new games)
  if (!state.citizenRoles) {
    state.citizenRoles = { scholars: 0, merchants: 0, workers: 0, soldiers: 0 };
  }
  const roles    = state.citizenRoles;
  const maxSlots = Math.floor((state.population?.count ?? 0) / 100);
  const current  = roles[role] ?? 0;
  const newCount = current + delta;

  if (newCount < 0) return { ok: false, reason: 'Cannot reduce below 0.' };

  const totalOther = CITIZEN_ROLE_ORDER.reduce((s, r) => s + (r !== role ? (roles[r] ?? 0) : 0), 0);
  if (totalOther + newCount > maxSlots) {
    return { ok: false, reason: `Not enough citizens. Need ${(totalOther + newCount) * 100} citizens (have ${Math.floor(state.population?.count ?? 0)}).` };
  }

  roles[role] = newCount;
  recalcRates();
  emit(Events.CITIZEN_ROLES_CHANGED, { role, count: newCount });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rally Troops (T098)
// ---------------------------------------------------------------------------

const RALLY_COST           = { gold: 50, mana: 25 };
const RALLY_COOLDOWN_TICKS = 1200;   // 5 min at 4 ticks/s
const RALLY_VETERAN_XP     = 3;
const RALLY_ELITE_XP       = 6;

/**
 * Rally all troops: +1 XP to every trained unit type (may trigger rank
 * promotions), +5 morale, costs 50 gold + 25 mana. 5-minute cooldown.
 */
export function rallyTroops() {
  const hasUnits = Object.values(state.units).some(c => c > 0);
  if (!hasUnits) return { ok: false, reason: 'No units to rally.' };

  if (!state.rallyState) state.rallyState = { cooldownUntil: 0 };
  if (state.tick < state.rallyState.cooldownUntil) {
    const secsLeft = Math.ceil((state.rallyState.cooldownUntil - state.tick) / 4);
    return { ok: false, reason: `Rally on cooldown (${secsLeft}s remaining).` };
  }

  // T119: rally_master trait makes rally free
  const rallyFree = state.hero?.trait === 'rally_master';
  if (!rallyFree && !canAfford(RALLY_COST)) {
    return { ok: false, reason: 'Need 50 gold and 25 mana to rally troops.' };
  }
  if (!rallyFree) deductCost(RALLY_COST);

  if (!state.unitXP)    state.unitXP    = {};
  if (!state.unitRanks) state.unitRanks = {};

  for (const [unitId, count] of Object.entries(state.units)) {
    if ((count ?? 0) <= 0) continue;
    state.unitXP[unitId] = (state.unitXP[unitId] ?? 0) + 1;
    const xp       = state.unitXP[unitId];
    const prevRank = state.unitRanks[unitId] ?? 'normal';
    let   newRank  = prevRank;
    if      (xp >= RALLY_ELITE_XP)   newRank = 'elite';
    else if (xp >= RALLY_VETERAN_XP) newRank = 'veteran';
    if (newRank !== prevRank) {
      state.unitRanks[unitId] = newRank;
      const def   = UNITS[unitId];
      const label = newRank === 'elite' ? '★★ Elite (×2.0 atk)' : '★ Veteran (×1.5 atk)';
      addMessage(`${def?.icon ?? '⚔️'} ${def?.name ?? unitId} promoted to ${label}!`, 'combat-win');
    }
  }

  // Boost morale directly (morale.js imports actions.js, so we avoid circular import)
  // T119: rally_master trait gives +10 morale instead of +5
  const rallyMorale = state.hero?.trait === 'rally_master' ? 10 : 5;
  state.morale = Math.min(100, (state.morale ?? 50) + rallyMorale);
  state.rallyState.cooldownUntil = state.tick + RALLY_COOLDOWN_TICKS;

  emit(Events.UNIT_CHANGED, {});
  emit(Events.MORALE_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📣 Rally! Troops reinvigorated. +1 XP to all units, +${rallyMorale} morale.`, 'hero');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Resource Cap Upgrades (T120)
// ---------------------------------------------------------------------------

export const CAP_UPGRADE_MAX    = 5;
export const CAP_UPGRADE_BONUS  = 250;  // +250 cap per level
export const CAP_UPGRADE_BASE   = 150;  // 150 × (level+1) gold cost

const VALID_CAP_RESOURCES = ['gold', 'food', 'wood', 'stone', 'iron', 'mana'];

/**
 * Purchase one level of cap expansion for a resource.
 * Cost = CAP_UPGRADE_BASE × (currentLevel + 1) gold.
 * Maximum CAP_UPGRADE_MAX levels per resource.
 */
export function upgradeResourceCap(resId) {
  if (!VALID_CAP_RESOURCES.includes(resId)) {
    return { ok: false, reason: `Unknown resource: ${resId}` };
  }
  if (!state.capUpgrades) state.capUpgrades = {};
  const level = state.capUpgrades[resId] ?? 0;
  if (level >= CAP_UPGRADE_MAX) {
    return { ok: false, reason: `${resId} cap is already at max level.` };
  }
  const cost = CAP_UPGRADE_BASE * (level + 1);
  if ((state.resources.gold ?? 0) < cost) {
    return { ok: false, reason: `Need ${cost} gold to expand ${resId} storage.` };
  }
  state.resources.gold -= cost;
  state.capUpgrades[resId] = level + 1;
  recalcRates();

  emit(Events.CAP_UPGRADED, { resId, level: level + 1 });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📦 ${resId.charAt(0).toUpperCase() + resId.slice(1)} storage expanded to +${(level + 1) * CAP_UPGRADE_BONUS} cap (Level ${level + 1}).`, 'build');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Capital Development Plan (T100)
// ---------------------------------------------------------------------------

/**
 * Choose a one-time capital development plan.
 * Validates cost, age requirement, and that no plan has been chosen yet.
 */
export function chooseCapitalPlan(planId) {
  const plan = CAPITAL_PLANS[planId];
  if (!plan) return { ok: false, reason: `Unknown plan: ${planId}` };
  if (state.capitalPlan) return { ok: false, reason: 'A capital plan is already active.' };
  if ((state.age ?? 0) < (plan.requiresAge ?? 0)) {
    return { ok: false, reason: `Requires ${plan.requiresAge === 1 ? 'Bronze' : 'Iron'} Age or higher.` };
  }
  if (!canAfford(plan.cost)) {
    const missing = Object.entries(plan.cost)
      .filter(([r, a]) => (state.resources[r] ?? 0) < a)
      .map(([r, a]) => `${a} ${r}`)
      .join(', ');
    return { ok: false, reason: `Need ${missing}.` };
  }
  deductCost(plan.cost);
  state.capitalPlan = planId;
  recalcRates();
  emit(Events.CAPITAL_PLAN_CHOSEN, { planId });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`${plan.icon} ${plan.name} established! ${plan.bonusDesc.join(', ')}.`, 'age');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Unit Arsenal Upgrades (T107)
// ---------------------------------------------------------------------------

export const UNIT_UPGRADE_MAX       = 5;     // max levels per unit type
export const UNIT_UPGRADE_COST_BASE = 100;   // cost multiplier (× level) in gold

/**
 * Permanently upgrade a unit type's attack power by +10% (up to 5 times).
 * Requires at least 1 unit of that type trained.
 * Cost: 100 × (current level + 1) gold.
 */
export function upgradeUnit(unitId) {
  const def = UNITS[unitId];
  if (!def) return { ok: false, reason: `Unknown unit: ${unitId}` };
  if ((state.units[unitId] ?? 0) <= 0) {
    return { ok: false, reason: `Train at least 1 ${def.name} first.` };
  }

  if (!state.unitUpgrades) state.unitUpgrades = {};
  const level = state.unitUpgrades[unitId] ?? 0;
  if (level >= UNIT_UPGRADE_MAX) {
    return { ok: false, reason: `${def.name} is already at maximum upgrade level.` };
  }

  const cost = UNIT_UPGRADE_COST_BASE * (level + 1);
  if ((state.resources.gold ?? 0) < cost) {
    return { ok: false, reason: `Need ${cost} gold to upgrade.` };
  }

  state.resources.gold = (state.resources.gold ?? 0) - cost;
  state.unitUpgrades[unitId] = level + 1;

  emit(Events.UNIT_UPGRADED, { unitId, level: level + 1 });
  emit(Events.UNIT_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⬆️ ${def.name} arsenal upgraded to level ${level + 1}! (+${(level + 1) * 10}% attack)`, 'build');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// T121: City Founding
// ---------------------------------------------------------------------------

const CITY_COST = { gold: 200, stone: 100, iron: 50 };
const CITY_MAX  = 5;

/**
 * Found a city on a player-owned tile.
 * Requires Bronze Age, costs 200 gold + 100 stone + 50 iron.
 * Cities grant +1.5 gold/s + 0.5 food/s each (up to 5 total).
 */
export function foundCity(x, y) {
  if (!state.map) return { ok: false, reason: 'No map loaded.' };
  if ((state.age ?? 0) < 1) return { ok: false, reason: 'City founding requires the Bronze Age.' };

  const tile = state.map.tiles[y]?.[x];
  if (!tile)                    return { ok: false, reason: 'Invalid tile coordinates.' };
  if (tile.owner !== 'player')  return { ok: false, reason: 'You can only found a city on your own territory.' };
  if (tile.type === 'capital')  return { ok: false, reason: 'The capital cannot become a city.' };
  if (tile.hasCity)             return { ok: false, reason: 'This tile already has a city.' };

  let cityCount = 0;
  for (const row of state.map.tiles) {
    for (const t of row) { if (t.hasCity) cityCount++; }
  }
  if (cityCount >= CITY_MAX) return { ok: false, reason: `City limit reached (max ${CITY_MAX}).` };

  if (!canAfford(CITY_COST)) {
    const needed = Object.entries(CITY_COST).map(([r, a]) => `${a} ${r}`).join(', ');
    return { ok: false, reason: `Need ${needed} to found a city.` };
  }

  deductCost(CITY_COST);
  tile.hasCity = true;
  recalcRates();
  emit(Events.CITY_FOUNDED, { x, y });
  emit(Events.MAP_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏙️ City founded at (${x},${y})! +1.5 gold/s and +0.5 food/s. (${cityCount + 1}/${CITY_MAX})`, 'build');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// T122: Hero Companion
// ---------------------------------------------------------------------------

/**
 * Choose a hero companion type when a companion offer is pending.
 * Companion provides a passive combat bonus for the rest of the game.
 */
export function chooseCompanion(type) {
  const h = state.hero;
  if (!h?.recruited)       return { ok: false, reason: 'No hero recruited.' };
  if (!h.companionOffer)   return { ok: false, reason: 'No companion offer is available.' };
  if (h.companion)         return { ok: false, reason: 'Hero already has a companion.' };
  if (!COMPANIONS[type])   return { ok: false, reason: 'Unknown companion type.' };

  h.companion      = { type };
  h.companionOffer = false;

  emit(Events.COMPANION_RECRUITED, { type });
  emit(Events.HERO_CHANGED, {});
  const c = COMPANIONS[type];
  addMessage(`${c.icon} ${c.name} joined the Champion as a companion! ${c.desc}`, 'hero');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Forge System (T125)
// ---------------------------------------------------------------------------

/**
 * Craft a unique forge item at the Iron Foundry.
 * Requires metalworking tech and the specific tech listed on the item.
 * Each item can only be crafted once per game.
 */
export function forgeItem(itemId) {
  const def = FORGE_ITEMS[itemId];
  if (!def) return { ok: false, reason: `Unknown forge item: ${itemId}` };

  // Requires Iron Foundry building
  if ((state.buildings.ironFoundry ?? 0) < 1) {
    return { ok: false, reason: 'Build an Iron Foundry first.' };
  }
  // Requires metalworking tech
  if (!state.techs.metalworking) {
    return { ok: false, reason: 'Research Metalworking first.' };
  }
  // Item-specific tech requirement
  if (def.requires?.tech && !state.techs[def.requires.tech]) {
    const techName = def.requires.tech.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
    return { ok: false, reason: `Requires the ${techName} technology.` };
  }

  if (!state.forge) state.forge = { crafted: {} };
  if (state.forge.crafted[itemId]) {
    return { ok: false, reason: `${def.name} is already forged.` };
  }

  if (!canAfford(def.cost)) {
    return { ok: false, reason: 'Insufficient resources.' };
  }

  deductCost(def.cost);
  state.forge.crafted[itemId] = state.tick;

  recalcRates();
  emit(Events.FORGE_CHANGED, { itemId });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚒️ Forged: ${def.icon} ${def.name}! ${def.bonusLabel}`, 'windfall');
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
  // T071 Agrarian Mastery: −15% building costs
  const masteryMult = state.masteries?.agrarian ? 0.85 : 1.0;
  const scaled = {};
  for (const [res, amt] of Object.entries(base)) {
    scaled[res] = Math.ceil(amt * factor * archMult * masteryMult);
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
