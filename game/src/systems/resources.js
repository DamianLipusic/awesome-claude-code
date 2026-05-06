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
import { SEASONS, SEASON_BUILDING_BONUSES } from '../data/seasons.js';
import { HERO_DEF, heroSkillBonus } from '../data/hero.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { territoryRateBonus, getTerrainControl } from './map.js';
import { RELICS, RELIC_COMBOS } from '../data/relics.js';
import { LANDMARKS } from '../data/landmarks.js';
import { SPECIALIZATIONS } from '../data/buildingSpecials.js';
import { POLICIES } from '../data/policies.js';
import { BOONS } from '../data/ageBoons.js';
import { SYNERGIES } from '../data/techs.js';
import { getCurrentTitle } from '../data/titles.js';
import { isGuildActive, GUILD_ROUTE_BONUS, getTradeBoostMult } from './tradeGuildHall.js'; // T190
import { getGuildRateBonuses } from './artisanGuilds.js'; // T194
import { getVizierGoldRate, getVizierManaMult, getVizierProdMult, getVizierTradeMult } from './vizier.js'; // T195
import { getTradeWindRateBonuses } from './tradeWinds.js'; // T198
import { getCorruptionPenalty } from './corruptionSystem.js'; // T203
import { getGovernorIncome } from './regionalGovernors.js';   // T206

/** Returns true if both techs in the named synergy pair are researched. */
function _synergy(id) {
  const syn = SYNERGIES[id];
  return syn ? syn.techs.every(t => !!state.techs[t]) : false;
}

const RESOURCE_KEYS = ['gold', 'food', 'wood', 'stone', 'iron', 'mana'];

// T094: module-level overflow tracking (which non-gold resources are currently at cap with positive rate)
const _overflowActive = { food: false, wood: false, stone: false, iron: false, mana: false };

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

  // T077: Runic Forging synergy (alchemy + steel) → +2 iron/s
  if (_synergy('runic_forging')) rates.iron += 2.0;

  // T077: Naval Engineering synergy (engineering + navigation) → +2 wood/s, +300 wood cap
  if (_synergy('naval_engineering')) {
    rates.wood  += 2.0;
    caps.wood   += 300;
  }

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

    // T090: per-resource specialization production multiplier
    const specId  = state.buildingSpecials?.[id];
    const specDef = specId ? SPECIALIZATIONS[specId] : null;

    for (const res of RESOURCE_KEYS) {
      if (def.production[res]) {
        const specMult = specDef?.prodMult?.[res] ?? 1.0;
        rates[res] += def.production[res] * count * prodMult * specMult;
      }
      if (def.consumption[res]) rates[res] -= def.consumption[res] * count;
      if (def.capBonus[res])   caps[res]  += def.capBonus[res] * count;
    }

    // T090: specialization flat bonuses (rateBonus, capBonus)
    if (specDef) {
      for (const [res, val] of Object.entries(specDef.rateBonus ?? {})) {
        if (rates[res] !== undefined) rates[res] += val;
      }
      for (const [res, val] of Object.entries(specDef.capBonus ?? {})) {
        if (caps[res] !== undefined) caps[res] += val;
      }
    }
  }

  // Economics tech: +500 gold storage cap
  if (state.techs.economics) caps.gold += 500;

  // Territory bonuses from captured map tiles
  const territory = territoryRateBonus();
  for (const res of RESOURCE_KEYS) {
    if (territory[res]) rates[res] += territory[res];
  }

  // T099: Region dominance bonuses — awarded when controlling 5+ tiles of a terrain type
  // At 10+ tiles the bonus doubles (×2)
  const terrainCtrl = getTerrainControl();
  const _regionBonus = (count, base5) => {
    if (count >= 10) return base5 * 2;
    if (count >= 5)  return base5;
    return 0;
  };
  rates.food  += _regionBonus(terrainCtrl.grass,   1.5);
  rates.wood  += _regionBonus(terrainCtrl.forest,  1.5);
  rates.stone += _regionBonus(terrainCtrl.hills,   1.5);
  rates.gold  += _regionBonus(terrainCtrl.river,   1.0);
  rates.food  += _regionBonus(terrainCtrl.river,   1.0);
  rates.iron  += _regionBonus(terrainCtrl.mountain, 1.5);

  // Trade route income from allied empires (reads state directly — no circular import)
  // Navigation tech gives +50% to all trade route income.
  // Merchant archetype gives +50% on top of navigation multiplier.
  if (state.diplomacy) {
    const navMult          = state.techs.navigation        ? 1.5 : 1.0;
    const merchantMult     = state.archetype === 'merchant' ? 1.5 : 1.0;
    // T071 Economic Mastery: +30% trade route income
    const economicMastery  = state.masteries?.economic     ? 1.3 : 1.0;
    // T077: Trade Empire synergy (navigation + economics) → +0.8 gold/s per open trade route
    const tradeEmpireActive = _synergy('trade_empire');
    // T150: Grand Theory Economic Mastery — ×1.5 trade route income
    const grandTheoryTradeMult = state.grandTheory === 'economic_mastery' ? 1.5 : 1.0;
    // T195: Court Diplomat Vizier — ×1.15 trade route income
    const vizierTradeMult  = getVizierTradeMult();
    for (const emp of state.diplomacy.empires) {
      if (emp.relations !== 'allied' || emp.tradeRoutes <= 0) continue;
      const gift = EMPIRES[emp.id]?.tradeGift ?? {};
      // T091: Sea Wolves alliance bonus multiplies their trade route income by 1.40
      const allyTradeMult = EMPIRES[emp.id]?.allianceBonus?.tradeIncomeMult ?? 1.0;
      // T172: dynastic marriage partner grants ×1.5 trade income
      const marriageMult = state.dynasticMarriage?.partnerId === emp.id ? 1.5 : 1.0;
      // T190: guild boost multiplier for this empire's routes
      const guildBoostMult = isGuildActive() ? getTradeBoostMult(emp.id) : 1.0;
      for (const [res, rate] of Object.entries(gift)) {
        if (rates[res] !== undefined) {
          // T185: trade route specialization doubles income for the chosen resource
          const specMult = (emp.tradeSpec === 'food_route' && res === 'food') ? 2.0 :
                           (emp.tradeSpec === 'gold_route' && res === 'gold') ? 2.0 :
                           (emp.tradeSpec === 'iron_route' && res === 'iron') ? 2.0 : 1.0;
          rates[res] += rate * emp.tradeRoutes * navMult * merchantMult * economicMastery * allyTradeMult * grandTheoryTradeMult * marriageMult * specMult * guildBoostMult * vizierTradeMult;
        }
      }
      // Trade Empire: flat +0.8 gold/s per open trade route (stacks per route)
      if (tradeEmpireActive) rates.gold += 0.8 * emp.tradeRoutes;
      // T190: Trade Guild Hall — flat +0.3 gold/s per open trade route per allied empire
      if (isGuildActive()) rates.gold += GUILD_ROUTE_BONUS * emp.tradeRoutes;
    }

    // T091: Faction alliance flat rate bonuses (Mage Council +1 mana/s, Sea Wolves +1 gold/s)
    for (const emp of state.diplomacy.empires) {
      if (emp.relations !== 'allied') continue;
      const bonus = EMPIRES[emp.id]?.allianceBonus ?? {};
      if (bonus.manaRate) rates.mana += bonus.manaRate;
      if (bonus.goldRate) rates.gold += bonus.goldRate;
    }

    // T155: Global Trade Network — +3 gold/s when all 3 empires are allied with open trade routes
    const allTradeActive = ['ironHorde', 'mageCouncil', 'seaWolves'].every(id => {
      const e = state.diplomacy.empires.find(emp => emp.id === id);
      return e && e.relations === 'allied' && e.tradeRoutes > 0;
    });
    if (allTradeActive) rates.gold += 3.0;
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

  // T078: Weather modifiers — applied to positive rates only (production, not upkeep)
  // T158: Adapted weather types have their negative multipliers halved
  const weatherMods = state.weather?.active?.modifiers;
  if (weatherMods) {
    const adapted = !!(state.weatherMemory?.adaptations?.[state.weather.active.type]);
    // allRates modifier applies to all positive rates (e.g. Clear Skies +10%, Snowstorm -20%)
    if (weatherMods.allRates !== undefined) {
      const m = (adapted && weatherMods.allRates < 1.0)
        ? 1 - (1 - weatherMods.allRates) * 0.5
        : weatherMods.allRates;
      for (const res of RESOURCE_KEYS) {
        if (rates[res] > 0) rates[res] *= m;
      }
    }
    // Per-resource modifiers (stacks on top of allRates if both present)
    for (const [res, mult] of Object.entries(weatherMods)) {
      if (res !== 'allRates' && rates[res] !== undefined && rates[res] > 0) {
        const m = (adapted && mult < 1.0) ? 1 - (1 - mult) * 0.5 : mult;
        rates[res] *= m;
      }
    }
  }

  // Unit upkeep (T071 Military Mastery: -20% upkeep; T157 Supply Depot: -15% upkeep)
  const _depotBuilt = (state.buildings?.supplyDepot ?? 0) >= 1;
  const upkeepMult  = (state.masteries?.military ? 0.80 : 1.0) * (_depotBuilt ? 0.85 : 1.0);
  for (const [id, count] of Object.entries(state.units)) {
    if (count <= 0) continue;
    const def = UNITS[id];
    if (!def || !def.upkeep) continue;
    for (const [res, amt] of Object.entries(def.upkeep)) {
      rates[res] = (rates[res] ?? 0) - amt * count * upkeepMult;
    }
  }

  // Hero upkeep (flat, not scaled by count)
  if (state.hero?.recruited) {
    for (const [res, amt] of Object.entries(HERO_DEF.upkeep)) {
      rates[res] = (rates[res] ?? 0) - amt;
    }

    // T070: Hero skill resource bonuses (applied after upkeep)
    const skills = state.hero.skills ?? [];
    if (skills.length > 0) {
      // Flat per-resource bonuses (treasury_guard, quartermaster, arcane_attunement)
      for (const res of RESOURCE_KEYS) {
        const bonus = heroSkillBonus(skills, 'resourceRate', res);
        if (bonus) rates[res] = (rates[res] ?? 0) + bonus;
      }
      // Global positive-rate multiplier (logistics +10%)
      const ratesMult = heroSkillBonus(skills, 'ratesMult');
      if (ratesMult !== 1.0) {
        for (const res of RESOURCE_KEYS) {
          if (rates[res] > 0) rates[res] *= ratesMult;
        }
      }
    }

    // T119: Commander trait resource effects (only when trait is chosen)
    const trait = state.hero.trait;
    if (trait && !state.hero.pendingTrait) {
      if (trait === 'iron_fist') {
        for (const res of RESOURCE_KEYS) {
          if (rates[res] > 0) rates[res] *= 0.90;
        }
      } else if (trait === 'merchant_heart') {
        rates.gold += 0.8;
      } else if (trait === 'naturalist') {
        if (rates.food > 0) rates.food *= 1.25;
        if (rates.wood > 0) rates.wood *= 1.25;
      } else if (trait === 'arcane_mind') {
        rates.mana += 0.5;
      }
    }
  }

  // T068: Garrison upkeep (units removed from army but still consume resources)
  // T071 Military Mastery: same -20% upkeep reduction applies to garrisoned units
  // T157: Supply Depot -15% upkeep applies to garrisons too
  if (state.garrisons) {
    for (const { unitId, count } of Object.values(state.garrisons)) {
      if (count <= 0) continue;
      const def = UNITS[unitId];
      if (!def?.upkeep) continue;
      for (const [res, amt] of Object.entries(def.upkeep)) {
        rates[res] = (rates[res] ?? 0) - amt * count * upkeepMult;
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

  // T096: Citizen role bonuses
  // merchants: +0.3 gold/s per slot; workers: +4% to all positive production rates
  if (state.citizenRoles) {
    const { merchants = 0, workers = 0 } = state.citizenRoles;
    if (merchants > 0) rates.gold += merchants * 0.3;
    if (workers > 0) {
      const workerMult = 1 + workers * 0.04;
      for (const res of RESOURCE_KEYS) {
        if (rates[res] > 0) rates[res] *= workerMult;
      }
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

  // T147: Relic combination bonuses — applied after individual relic bonuses
  if (state.relics?.discovered) {
    const disc = state.relics.discovered;
    for (const combo of RELIC_COMBOS) {
      if (!combo.relics.every(id => !!disc[id])) continue;
      if (combo.bonus.rates) {
        for (const [res, val] of Object.entries(combo.bonus.rates)) {
          if (rates[res] !== undefined) rates[res] += val;
        }
      }
      if (combo.bonus.caps) {
        for (const [res, val] of Object.entries(combo.bonus.caps)) {
          if (caps[res] !== undefined) caps[res] += val;
        }
      }
    }
  }

  // T089: apply special map landmark permanent bonuses
  if (state.landmarks?.captured) {
    for (const landmarkId of Object.keys(state.landmarks.captured)) {
      const def = LANDMARKS[landmarkId];
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

  // T118: Hero legacy bonuses from enshrined champions
  if (state.heroLegacy?.enshrined?.length) {
    for (const legacy of state.heroLegacy.enshrined) {
      if (!legacy.rates) continue;
      for (const [res, val] of Object.entries(legacy.rates)) {
        if (rates[res] !== undefined) rates[res] += val;
      }
    }
  }

  // T071: Tech mastery flat bonuses (applied after all other rate calculations)
  if (state.masteries) {
    // Military mastery: upkeep reduction already applied above
    if (state.masteries.economic) rates.gold += 3;            // +3 gold/s base
    if (state.masteries.arcane) {
      rates.mana += 1.5;                                       // +1.5 mana/s
      caps.mana  += 500;                                       // +500 mana cap
    }
    if (state.masteries.agrarian) {
      rates.food  += 0.5;                                      // +0.5 food/s
      rates.wood  += 0.5;                                      // +0.5 wood/s
      rates.stone += 0.5;                                      // +0.5 stone/s
    }
  }

  // T074: apply age council boon rate and cap bonuses
  if (state.councilBoons?.length) {
    for (const boonId of state.councilBoons) {
      const def = BOONS[boonId];
      if (!def?.effect) continue;
      if (def.effect.rateBonus) {
        for (const [res, val] of Object.entries(def.effect.rateBonus)) {
          if (rates[res] !== undefined) rates[res] += val;
        }
      }
      if (def.effect.capBonus) {
        for (const [res, val] of Object.entries(def.effect.capBonus)) {
          if (caps[res] !== undefined) caps[res] += val;
        }
      }
    }
  }

  // T080: Prestige milestone bonuses (applied after all other calculations)
  const pm = state.prestige?.milestones ?? [];
  if (pm.includes(500))  rates.gold += 1;
  if (pm.includes(1000)) { rates.food += 1; rates.wood += 1; }
  if (pm.includes(2000)) { for (const r of RESOURCE_KEYS) caps[r] += 200; }
  if (pm.includes(3500)) { rates.gold += 2; rates.iron += 1; rates.mana += 1; }
  if (pm.includes(5000)) { for (const r of RESOURCE_KEYS) if (rates[r] > 0) rates[r] *= 1.15; }

  // T083: Empire Decree — Harvest Edict (+40% food + wood while active)
  if ((state.decrees?.harvestEdictExpires ?? 0) > state.tick) {
    if (rates.food > 0) rates.food *= 1.40;
    if (rates.wood > 0) rates.wood *= 1.40;
  }

  // T103: Empire Festival multipliers (applied after decrees for stack clarity)
  const _festActive = state.festivals?.active;
  if (_festActive) {
    // T133: Grand Colosseum wonder amplifies festival rate bonuses by +25%
    const _colosseumMult = state.wonder?.completedId === 'colosseum' ? 1.25 : 1.0;
    if (_festActive.type === 'harvest') {
      if (rates.food > 0) rates.food *= 1.60 * _colosseumMult;
      if (rates.wood > 0) rates.wood *= 1.60 * _colosseumMult;
    } else if (_festActive.type === 'trade_fair') {
      if (rates.gold > 0) rates.gold *= 1.50 * _colosseumMult;
    }
    // parade bonus is applied in combat.js (not a rate effect)
  }

  // T100: Capital Development Plan bonuses
  if (state.capitalPlan === 'commerce') {
    rates.gold += 2.0;
    caps.gold  += 500;
  }
  if (state.capitalPlan === 'academy') {
    caps.mana += 500;
  }
  if (state.capitalPlan === 'arcane_tower') {
    rates.mana += 1.5;
  }

  // T106: Ancient ruins — Lost Artifact outcome grants +0.8 gold/s +100 gold cap
  if (state.ruins?.excavated) {
    for (const { outcome } of Object.values(state.ruins.excavated)) {
      if (outcome === 'lost_artifact') {
        rates.gold += 0.8;
        caps.gold  += 100;
      }
    }
  }

  // T105: Empire title bonuses — cumulative based on current title level
  const _title = getCurrentTitle(state);
  if (_title.bonus.gold)      rates.gold += _title.bonus.gold;
  if (_title.bonus.ratesMult) {
    for (const res of RESOURCE_KEYS) {
      if (rates[res] > 0) rates[res] *= (1 + _title.bonus.ratesMult);
    }
  }

  // T108: Map exploration 90% milestone — permanent +0.8 gold/s
  if (state.explorationMilestones?.[90]) rates.gold += 0.8;

  // T121: City bonuses — each founded city tile grants +1.5 gold/s and +0.5 food/s
  if (state.map) {
    let _cityCount = 0;
    for (const row of state.map.tiles) {
      for (const _ct of row) { if (_ct.hasCity) _cityCount++; }
    }
    if (_cityCount > 0) {
      rates.gold += _cityCount * 1.5;
      rates.food += _cityCount * 0.5;
    }
  }

  // T120: Resource cap upgrades — each level adds 250 to cap
  if (state.capUpgrades) {
    for (const [res, level] of Object.entries(state.capUpgrades)) {
      if (caps[res] !== undefined && level > 0) {
        caps[res] += level * 250;
      }
    }
  }

  // T125: Forge item rate bonuses
  if (state.forge?.crafted) {
    if (state.forge.crafted.ring_of_prosperity) rates.gold += 0.8;
    if (state.forge.crafted.farmers_almanac)    rates.food += 1.5;
  }

  // T131: Proclamation rate effects
  const _procId = state.proclamation?.activeId;
  if (_procId === 'war_economy') {
    for (const r of RESOURCE_KEYS) rates[r] *= 0.85;
  } else if (_procId === 'golden_era') {
    rates.gold *= 1.40;
    rates.food *= 0.80;
    rates.wood *= 0.80;
  } else if (_procId === 'great_works') {
    rates.mana *= 0.75;
  }

  // T133: Wonder project permanent rate / cap bonuses
  const _wonder = state.wonder?.completedId;
  if (_wonder === 'grand_bazaar') {
    rates.gold += 2.5;
  } else if (_wonder === 'tower_of_babel') {
    rates.mana += 1.5;
    caps.mana   = (caps.mana ?? 500) + 300;
  }

  // T134: Wandering scholar active effect on rates
  const _scholEff = state.scholar?.activeEffect;
  if (_scholEff?.type === 'agricultural_wisdom' && state.tick < _scholEff.expiresAt) {
    if (rates.food > 0) rates.food *= 2.0;
    if (rates.wood > 0) rates.wood *= 2.0;
  }

  // T140: Population happiness modifier (±10% on all positive rates)
  const _happiness = state.population?.happiness;
  if (_happiness !== undefined) {
    if (_happiness >= 75) {
      for (const res of RESOURCE_KEYS) if (rates[res] > 0) rates[res] *= 1.10;
    } else if (_happiness <= 25) {
      for (const res of RESOURCE_KEYS) if (rates[res] > 0) rates[res] *= 0.90;
    }
  }

  // T141: Tech milestone permanent bonuses
  if (state.techMilestones?.[12])    rates.gold += 1.5;          // 12 techs: +1.5 gold/s
  if (state.techMilestones?.['all']) {                           // all 16 techs: +10% all positive rates
    for (const res of RESOURCE_KEYS) if (rates[res] > 0) rates[res] *= 1.10;
  }

  // T143: Age challenge permanent bonuses (state read directly — no circular import)
  const _acr = state.ageChallenges?.results ?? {};
  if (_acr[1] === 'won') rates.food += 2.0;                      // Bronze: +2 food/s
  if (_acr[3] === 'won') {                                       // Medieval: +10% all positive rates
    for (const res of RESOURCE_KEYS) if (rates[res] > 0) rates[res] *= 1.10;
  }

  // T150: Grand Theory permanent flat rate bonuses
  if (state.grandTheory === 'economic_mastery')  rates.gold += 3;
  if (state.grandTheory === 'arcane_omniscience') rates.mana += 2;

  // T152: Dynasty heir passive bonuses
  const _heir = state.dynasty?.currentHeir;
  if (_heir === 'diplomat') rates.gold += 0.5;
  if (_heir === 'scholar')  rates.mana += 0.5;
  // T152: Regency penalty — −20% all positive rates
  if (state.dynasty?.regencyUntil && state.tick < state.dynasty.regencyUntil) {
    for (const res of RESOURCE_KEYS) if (rates[res] > 0) rates[res] *= 0.80;
  }

  // T153: Celestial event passive rate bonuses
  const _celestialType = state.celestial?.active?.type;
  if (_celestialType === 'solar_eclipse') {
    rates.mana *= 2.0;
  } else if (_celestialType === 'blue_moon') {
    for (const res of RESOURCE_KEYS) rates[res] += 1.0;
  }

  // T161: Plague outbreak — 35% food production penalty while active
  if (state.plague?.active && rates.food > 0) rates.food *= 0.65;

  // T162: Pilgrimage active bonus — applied per bonus type
  const _pilgBonus = state.pilgrimages?.activeBonus;
  if (_pilgBonus && state.tick < _pilgBonus.expiresAt) {
    if (_pilgBonus.type === 'artists')   { rates.gold += 0.5; }
    if (_pilgBonus.type === 'scholars')  { /* research speed handled in research.js */ }
    if (_pilgBonus.type === 'pilgrims')  { rates.mana += 0.3; }
  }

  // T168: Noble demand failure debuff — −15% gold/s for 3 min when nobles are displeased
  if ((state.nobleDemands?.debuffUntil ?? 0) > state.tick && rates.gold > 0) {
    rates.gold *= 0.85;
  }

  // T175: War exhaustion rate penalties
  const _wexLevel = state.warExhaustion?.level ?? 0;
  if (_wexLevel >= 75) {
    rates.gold -= 1.5;
    rates.food -= 1.0;
    rates.iron -= 0.5;
  } else if (_wexLevel >= 50) {
    rates.gold -= 0.8;
    rates.food -= 0.6;
  } else if (_wexLevel >= 25) {
    rates.gold -= 0.3;
  }

  // T194: Artisan Guild flat rate bonuses
  const _guildBonuses = getGuildRateBonuses();
  for (const [res, val] of Object.entries(_guildBonuses)) {
    if (rates[res] !== undefined) rates[res] += val;
  }

  // T195: Grand Vizier rate bonuses
  const _vizierGold = getVizierGoldRate();
  if (_vizierGold) rates.gold += _vizierGold;
  const _vizierMana = getVizierManaMult();
  if (_vizierMana !== 1.0 && rates.mana > 0) rates.mana *= _vizierMana;
  const _vizierProd = getVizierProdMult();
  if (_vizierProd !== 1.0) {
    for (const res of RESOURCE_KEYS) if (rates[res] > 0) rates[res] *= _vizierProd;
  }

  // T198: Trade wind flat rate bonuses/penalties
  const _windBonuses = getTradeWindRateBonuses();
  if (_windBonuses) {
    for (const [res, val] of Object.entries(_windBonuses)) {
      if (val !== 0 && rates[res] !== undefined) rates[res] += val;
    }
  }

  // T201: Province Council — public_works temporary +12% all positive rates
  if ((state.council?.prodBonusExpires ?? 0) > state.tick) {
    for (const res of RESOURCE_KEYS) if (rates[res] > 0) rates[res] *= 1.12;
  }

  // T202: Epic Quest Chains — Merchant Prince chain bonus: +1.5 gold/s
  if (state.epicQuests?.bonuses?.merchant) rates.gold += 1.5;

  // T206: Regional Governors — passive gold income per active governor
  const govIncome = getGovernorIncome();
  if (govIncome > 0) rates.gold += govIncome;

  // T203: Corruption penalty — reduces all positive production rates (max -20% at level 100)
  if (state.corruption?.level > 0) {
    const pen = getCorruptionPenalty();
    if (pen < 1.0) {
      for (const res of RESOURCE_KEYS) {
        if (rates[res] > 0) rates[res] *= pen;
      }
    }
  }

  // T215: Imperial Codex — permanent gold rate + production multiplier milestones
  if (state.codex) {
    if (state.codex.codexGoldRate > 0) rates.gold += state.codex.codexGoldRate;
    if ((state.codex.codexProdMult ?? 1.0) > 1.0) {
      for (const res of RESOURCE_KEYS) {
        if (rates[res] > 0) rates[res] *= state.codex.codexProdMult;
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
  let overflowGold = 0;  // T094: overflow gold accumulator

  for (const res of RESOURCE_KEYS) {
    const rate    = state.rates[res] ?? 0;
    const delta   = rate / TICKS_PER_SECOND;
    const current = state.resources[res] ?? 0;
    const cap     = state.caps[res] ?? 500;

    // T094: calculate overflow before capping (surplus that would be wasted)
    if (res !== 'gold' && delta > 0) {
      const overflow = Math.max(0, (current + delta) - cap);
      if (overflow > 0) {
        overflowGold += overflow * 0.25;
        _overflowActive[res] = true;
      } else {
        _overflowActive[res] = false;
      }
    }

    const next = Math.max(0, Math.min(cap, current + delta));
    if (next !== current) {
      state.resources[res] = next;
      changed = true;
    }
  }

  // T094: apply overflow gold conversion
  if (overflowGold > 0) {
    const goldCap = state.caps.gold ?? 500;
    const prevGold = state.resources.gold ?? 0;
    state.resources.gold = Math.min(goldCap, prevGold + overflowGold);
    if (state.resources.gold !== prevGold) changed = true;
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

  // T099: Region dominance bonus
  const _ctrl = getTerrainControl();
  const _rb = (count, base5) => count >= 10 ? base5 * 2 : count >= 5 ? base5 : 0;
  const regionContribs = [
    { terrain: 'grass',    res: 'food',  bonus: _rb(_ctrl.grass,    1.5), label: '🌿 Grassland dominance' },
    { terrain: 'forest',   res: 'wood',  bonus: _rb(_ctrl.forest,   1.5), label: '🌲 Forest dominance' },
    { terrain: 'hills',    res: 'stone', bonus: _rb(_ctrl.hills,    1.5), label: '⛰️ Hills dominance' },
    { terrain: 'river',    res: 'gold',  bonus: _rb(_ctrl.river,    1.0), label: '🏞️ River dominance' },
    { terrain: 'river',    res: 'food',  bonus: _rb(_ctrl.river,    1.0), label: '🏞️ River dominance (food)' },
    { terrain: 'mountain', res: 'iron',  bonus: _rb(_ctrl.mountain, 1.5), label: '🏔️ Mountain dominance' },
  ];
  for (const c of regionContribs) {
    if (c.res === resId && c.bonus > 0) lines.push({ label: c.label, value: c.bonus });
  }

  // Trade route income from allied empires (navigation tech ×1.5)
  if (state.diplomacy) {
    const navMult = state.techs.navigation ? 1.5 : 1.0;
    for (const emp of state.diplomacy.empires) {
      if (emp.relations !== 'allied' || emp.tradeRoutes <= 0) continue;
      const empDef = EMPIRES[emp.id];
      const gift   = empDef?.tradeGift ?? {};
      if (gift[resId]) {
        // T185: trade route specialization doubles income for the chosen resource
        const specMult = (emp.tradeSpec === 'food_route' && resId === 'food') ? 2.0 :
                         (emp.tradeSpec === 'gold_route' && resId === 'gold') ? 2.0 :
                         (emp.tradeSpec === 'iron_route' && resId === 'iron') ? 2.0 : 1.0;
        const specLabel = specMult > 1 ? ' ×2 spec' : '';
        lines.push({ label: `🤝 ${empDef.name} trade${specLabel}`, value: gift[resId] * emp.tradeRoutes * navMult * specMult });
      }
      // T190: Trade Guild Hall flat bonus to gold
      if (resId === 'gold' && isGuildActive()) {
        lines.push({ label: `🏦 Guild bonus (${emp.id})`, value: GUILD_ROUTE_BONUS * emp.tradeRoutes });
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

  // T094: overflow bank — add gold sources in gold breakdown; add overflow note to capped resources
  let overflowGoldRate = null;
  if (resId === 'gold') {
    for (const res of ['food', 'wood', 'stone', 'iron', 'mana']) {
      const cur  = state.resources[res] ?? 0;
      const cap  = state.caps[res] ?? 500;
      const rate = state.rates[res] ?? 0;
      if (cur >= cap * 0.99 && rate > 0) {
        lines.push({ label: `🔄 ${res[0].toUpperCase() + res.slice(1)} overflow`, value: rate * 0.25 });
      }
    }
  } else {
    const cur  = state.resources[resId] ?? 0;
    const cap  = state.caps[resId] ?? 500;
    const rate = state.rates[resId] ?? 0;
    if (cur >= cap * 0.99 && rate > 0) {
      overflowGoldRate = rate * 0.25;
    }
  }

  return {
    lines,
    seasonMult,
    seasonName,
    disasters,
    policyModifiers,
    overflowGoldRate,  // T094: gold/s being generated by this resource's overflow (null when inactive)
    total: state.rates[resId] ?? 0,
  };
}

function _buildingProdMultiplier(buildingId) {
  let mult = 1;
  const techs = state.techs;

  if (buildingId === 'farm') {
    if (techs.agriculture) mult *= 1.5;
    if (techs.divine_favor) mult *= 1.3;
    // T077: Sacred Harvest synergy (divine_favor + agriculture) → +50% additional farm food
    if (_synergy('sacred_harvest')) mult *= 1.5;
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

  // T128: Seasonal building bonus — per-building multiplier based on current season
  const seasonIdx = state.season?.index ?? -1;
  const seasonBuildingBonus = seasonIdx >= 0 ? SEASON_BUILDING_BONUSES[seasonIdx]?.[buildingId] : undefined;
  if (seasonBuildingBonus) mult *= seasonBuildingBonus;

  return mult;
}
