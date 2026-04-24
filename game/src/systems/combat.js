/**
 * EmpireOS — Combat resolution engine (T008).
 *
 * attackTile(x, y):
 *   - Validates the target (revealed, adjacent to player territory, not already owned)
 *   - Calculates player attack power from all trained units + tech bonuses
 *   - Rolls probabilistic outcome: win → capture + loot; loss → lose 1 unit
 *   - Emits MAP_CHANGED and RESOURCE_CHANGED events
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { UNITS } from '../data/units.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { HERO_DEF, HERO_SKILLS, HERO_SKILL_WIN_INTERVAL, HERO_MAX_SKILLS, heroSkillBonus, COMPANIONS, COMPANION_UNLOCK_WINS } from '../data/hero.js';
import { addMessage } from '../core/actions.js';
import { revealAround } from './map.js';
import { recalcRates } from './resources.js';
import { getMoraleEffect, changeMorale, MORALE_COMBAT_WIN, MORALE_COMBAT_LOSS } from './morale.js';
import { RELICS, RELIC_COMBOS, TERRAIN_RELIC, RELIC_DROP_CHANCE, ARCANE_SHARD_DROP_CHANCE } from '../data/relics.js';
import { LANDMARKS } from '../data/landmarks.js';
import { BOONS } from '../data/ageBoons.js';
import { SYNERGIES } from '../data/techs.js';
import { isEmpireInSkirmish, SKIRMISH_ATTACK_BONUS } from './diplomacy.js';
import { EMPIRES } from '../data/empires.js';
import { getActiveAid, consumeAidBattle } from './militaryAid.js';
import { clearResourceNode } from './resourceNodes.js';
import { getCurrentTitle } from '../data/titles.js';
import { rollRuinOutcome } from '../data/ruins.js';
import { claimBounty } from './bounty.js';
import { getGeneralBonus, consumeGeneralCharge } from './greatPersons.js'; // T136
import { trackMissionBattleWin } from './allianceMissions.js'; // T142
import { spawnDiscoveries } from './discoveries.js'; // T146
import { awardPrestige } from './prestige.js';        // T147: relic combo prestige
import { getCurrentWeather } from './weather.js';     // T149: weather combat modifiers

/** Returns true if both techs of a named synergy are researched. */
function _synergy(id) {
  const syn = SYNERGIES[id];
  return syn ? syn.techs.every(t => !!state.techs[t]) : false;
}

const NEIGHBORS   = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const MAX_HISTORY = 20;

// XP thresholds for rank promotion
const VETERAN_XP = 3;
const ELITE_XP   = 6;

// T082: Hero injury constants
const HERO_INJURY_CHANCE   = 0.20;   // 20% chance to be injured on defeat
const HERO_RECOVERY_TICKS  = 1200;   // 5 minutes at 4 ticks/s

/**
 * T082: Returns true if the hero is currently injured and in recovery.
 * If recovery time has elapsed, auto-clears the injury, emits HERO_CHANGED,
 * and logs the recovery message — then returns false.
 */
function _heroInjured() {
  if (!state.hero?.recruited || !state.hero.injured) return false;
  if (state.tick >= (state.hero.recoveryUntil ?? 0)) {
    state.hero.injured       = false;
    state.hero.recoveryUntil = null;
    addMessage(`⭐ ${HERO_DEF.name} has recovered from injuries and is ready for battle!`, 'hero');
    emit(Events.HERO_CHANGED, {});
    return false;
  }
  return true;
}

/**
 * T086: Returns true if the hero is currently away on a training expedition.
 * Hero contributes no combat bonus while on expedition.
 */
function _heroOnExpedition() {
  return !!(state.hero?.recruited && state.hero.expedition?.active);
}

// Formation attack multipliers (T052)
const FORMATION_ATTACK = { defensive: 0.85, balanced: 1.0, aggressive: 1.25 };

/** Returns the player's current formation attack multiplier. */
function _formationAttackMult() {
  const base = FORMATION_ATTACK[state.formation ?? 'balanced'] ?? 1.0;
  // T119: Tactician trait doubles formation bonus/penalty
  if (state.hero?.trait === 'tactician' && !state.hero.pendingTrait) {
    const delta = base - 1.0;
    return 1.0 + delta * 2;
  }
  return base;
}

// T071: Per-terrain attack and defense modifiers applied during combat resolution.
//   attackMult: multiplier on player's computed attack power  (< 1 = harder to assault)
//   defMult:    multiplier on the tile's base defense value   (> 1 = terrain aids defender)
const TERRAIN_COMBAT_MODS = {
  mountain: { attackMult: 0.85, defMult: 1.25 },  // uphill assault penalty + fortified height
  hills:    { attackMult: 1.00, defMult: 1.15 },  // elevated ground favours defender
  forest:   { attackMult: 1.10, defMult: 1.05 },  // guerrilla cover helps attacker; some cover for defender
  river:    { attackMult: 0.95, defMult: 1.10 },  // crossing penalty + river as natural barrier
  grass:    { attackMult: 1.00, defMult: 1.00 },  // open field — no modifier
  capital:  { attackMult: 1.00, defMult: 1.00 },  // intrinsic defense already in tile.defense
};

/** Returns the terrain combat modifier object for the given tile type. */
function _terrainMod(terrainType) {
  return TERRAIN_COMBAT_MODS[terrainType] ?? { attackMult: 1.0, defMult: 1.0 };
}

/**
 * T072: Returns the cumulative combat attack multiplier from chosen council boons.
 * Each boon with effect.combatAttack adds its fraction to the base 1.0 multiplier.
 * Example: bronze_weapons (+0.10) + iron_discipline (+0.15) → 1.25×
 */
function _councilBoonCombatMult() {
  if (!state.councilBoons?.length) return 1.0;
  let bonus = 0;
  for (const boonId of state.councilBoons) {
    const def = BOONS[boonId];
    if (def?.effect?.combatAttack) bonus += def.effect.combatAttack;
  }
  return 1.0 + bonus;
}

// ── T101: Conquest streak helpers ────────────────────────────────────────────

/** Returns the current streak tier (0=none, 1=Momentum, 2=Fury, 3=Unstoppable). */
function _streakTier() {
  const c = state.combatStreak?.count ?? 0;
  if (c >= 10) return 3;
  if (c >= 6)  return 2;
  if (c >= 3)  return 1;
  return 0;
}

/** Returns the attack power multiplier from the active streak tier. */
function _streakMult() {
  const tier = _streakTier();
  if (tier === 3) return 1.35;
  if (tier === 2) return 1.20;
  if (tier === 1) return 1.10;
  return 1.0;
}

/** Returns the loot multiplier (×2 at tier 3, otherwise 1). */
function _streakLootMult() {
  return _streakTier() >= 3 ? 2.0 : 1.0;
}

/** Returns the attack multiplier for a unit type based on its combat rank. */
function _rankMult(unitId) {
  const rank = state.unitRanks?.[unitId];
  if (rank === 'elite')   return 2.0;
  if (rank === 'veteran') return 1.5;
  return 1.0;
}

/**
 * Preview an attack without mutating state.
 * Returns preview data used by the combat-preview modal in mapPanel.js.
 * { valid, reason?, attackPower, defense, winChance, loot, terrain, owner, siegeActive }
 */
export function getAttackPreview(x, y) {
  if (!state.map) return { valid: false, reason: 'No map loaded.' };

  const { tiles, width, height } = state.map;
  const tile = tiles[y]?.[x];

  if (!tile)                    return { valid: false, reason: 'Invalid tile coordinates.' };
  if (!tile.revealed)           return { valid: false, reason: 'Tile is hidden in fog of war.' };
  if (tile.owner === 'player')  return { valid: false, reason: 'You already control this tile.' };

  const adjacent = NEIGHBORS.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && nx < width && ny >= 0 && ny < height
        && tiles[ny][nx].owner === 'player';
  });
  if (!adjacent) return { valid: false, reason: 'Target must be adjacent to your territory.' };

  // ── Mirror attackTile power calculation (no side effects) ─────────────────
  let attackPower = 0;
  for (const [id, count] of Object.entries(state.units)) {
    if (count <= 0) continue;
    const def = UNITS[id];
    if (def) {
      // T107: each arsenal upgrade level adds +10% attack for that unit type
      const upgradeMult = 1 + (state.unitUpgrades?.[id] ?? 0) * 0.10;
      attackPower += def.attack * count * _rankMult(id) * upgradeMult;
    }
  }

  if (attackPower <= 0) return { valid: false, reason: 'Train military units first!' };

  if (state.techs.tactics)     attackPower *= 1.25;
  if (state.techs.steel)       attackPower *= 1.5;
  if (state.techs.engineering) attackPower *= 1.1;
  if (state.techs.siege_craft) attackPower *= 1.75;

  // Formation modifier (T052)
  attackPower *= _formationAttackMult();

  // Morale modifier (T057)
  attackPower *= getMoraleEffect();

  // Conqueror archetype: +25% unit attack power
  if (state.archetype === 'conqueror') attackPower *= 1.25;

  // T071 Military Mastery: +40 flat attack power
  if (state.masteries?.military) attackPower += 40;

  // T077: Veteran Legion synergy (warcraft + tactics) → +20% attack power
  if (_synergy('veteran_legion')) attackPower *= 1.20;

  // T072b: age council boon combat attack bonus
  attackPower *= _councilBoonCombatMult();

  // T090: Armory specialization on barracks — +15% combat attack
  if (state.buildingSpecials?.barracks === 'armory') attackPower *= 1.15;

  // T091: Iron Horde alliance bonus — +20% attack when allied
  if (state.diplomacy?.empires.some(e => e.id === 'ironHorde' && e.relations === 'allied')) {
    attackPower *= 1.20;
  }

  // T083: War Banner decree preview — +40% attack when charges remain
  if ((state.decrees?.warBannerCharges ?? 0) > 0) {
    attackPower *= 1.40;
  }

  // T100: Fortress capital plan — +20% attack
  if (state.capitalPlan === 'fortress') attackPower *= 1.20;

  // T105: Empire title combat bonus
  const _titlePreview = getCurrentTitle(state);
  if (_titlePreview.bonus.combatMult) attackPower *= (1 + _titlePreview.bonus.combatMult);

  // T103: Military Parade festival — +25% attack while charges remain
  const _paradeActive = state.festivals?.active?.type === 'parade'
    && (state.festivals.active.chargesLeft ?? 0) > 0;
  if (_paradeActive) attackPower *= 1.25;

  // T082/T086: skip hero bonuses if hero is injured or on expedition
  if (state.hero?.recruited && !_heroInjured() && !_heroOnExpedition()) {
    attackPower += HERO_DEF.attack;
    // T070: hero skills — attack bonus + combat multiplier
    const skillAtk  = heroSkillBonus(state.hero.skills ?? [], 'attackBonus');
    const skillMult = heroSkillBonus(state.hero.skills ?? [], 'combatMult');
    attackPower += skillAtk;
    attackPower *= skillMult;
    if (state.hero.activeEffects?.battleCry) attackPower *= 2;  // preview includes Battle Cry bonus
    // T112: Legendary Quest — Battle Master permanent attack bonus
    attackPower += (state.hero.legendaryAttack ?? 0);
    // T119: commander trait combat bonuses (when hero is active)
    const herTrait = state.hero.trait;
    if (herTrait && !state.hero.pendingTrait) {
      if (herTrait === 'iron_fist')  attackPower += 30;
      if (herTrait === 'war_scholar') attackPower *= 1.15;
    }
  }

  // T125: Iron Helm forge item — +25 flat attack power
  if (state.forge?.crafted?.iron_helm) attackPower += 25;

  // T131: War Economy proclamation — +25% attack power
  if (state.proclamation?.activeId === 'war_economy') attackPower *= 1.25;

  // T136: Great General — flat attack bonus while charges remain
  const _gpBonus = getGeneralBonus();
  if (_gpBonus > 0) attackPower += _gpBonus;

  // T149: weather combat modifier
  const _weather = getCurrentWeather();
  const weatherMult = _weather?.combatMult ?? 1.0;
  if (weatherMult !== 1.0) attackPower *= weatherMult;

  // T150: Grand Theory Military Supremacy — +40% all attack power
  if (state.grandTheory === 'military_supremacy') attackPower *= 1.40;

  // T071: terrain combat modifiers
  const terrainMod = _terrainMod(tile.type);
  attackPower     *= terrainMod.attackMult;
  let effectiveDefense = (tile.defense ?? 0) * terrainMod.defMult;

  // T132: Siege Engine — halves effective defense of fortified tiles
  if ((state.units?.siege_engine ?? 0) > 0 && tile.fortified) effectiveDefense *= 0.50;

  const heroReady      = state.hero?.recruited && !_heroInjured() && !_heroOnExpedition();
  const siegeActive    = !!(heroReady && state.hero.activeEffects?.siege);
  const manaBoltActive = !!(state.spells?.activeEffects?.manaBolt);
  const heroInjured    = !!(state.hero?.recruited && state.hero.injured);
  let winChance        = (siegeActive || manaBoltActive)
    ? 1.0
    : Math.min(0.9, Math.max(0.1, attackPower / (attackPower + effectiveDefense)));

  // T088: skirmish bonus — target empire distracted by border fighting
  const skirmishBonus  = !siegeActive && !manaBoltActive && isEmpireInSkirmish(tile.owner);
  if (skirmishBonus) winChance = Math.min(0.9, winChance + SKIRMISH_ATTACK_BONUS);

  // T102: Aid troops from an allied empire (preview only — no side effects)
  const _aid = getActiveAid();
  if (_aid) {
    for (const [id, count] of Object.entries(_aid.units)) {
      const def = UNITS[id];
      if (def) attackPower += def.attack * count;
    }
  }

  // T101: Conquest streak attack bonus
  const streakCount = state.combatStreak?.count ?? 0;
  const streakTier  = _streakTier();
  if (streakTier > 0) attackPower *= _streakMult();

  return {
    valid:            true,
    attackPower:      Math.round(attackPower),
    defense:          tile.defense,
    effectiveDefense: Math.round(effectiveDefense),
    terrainMod,
    winChance,
    weatherMult,
    weatherIcon:  _weather?.icon  ?? null,
    weatherName:  _weather?.name  ?? null,
    loot:         tile.loot ?? {},
    terrain:      tile.type,
    owner:        tile.owner,
    siegeActive,
    manaBoltActive,
    heroInjured,
    formation:       state.formation ?? 'balanced',
    morale:          Math.round(state.morale ?? 50),
    militaryMastery: !!(state.masteries?.military),
    veteranLegion:   _synergy('veteran_legion'),
    warBannerCharges: state.decrees?.warBannerCharges ?? 0,
    skirmishBonus,
    streakCount,
    streakTier,
    aidActive:    !!_aid,
    aidEmpireId:  _aid?.empireId ?? null,
    aidBattlesLeft: _aid?.battlesLeft ?? 0,
    siegeEngineActive: (state.units?.siege_engine ?? 0) > 0 && tile.fortified, // T132
    paradeChargesLeft: _paradeActive ? (state.festivals.active.chargesLeft ?? 0) : 0,
  };
}

/**
 * Attack the tile at (x, y).
 * Returns { ok, reason?, outcome? }
 */
export function attackTile(x, y) {
  if (!state.map) return { ok: false, reason: 'No map loaded.' };

  const { tiles, width, height } = state.map;
  const tile = tiles[y]?.[x];

  if (!tile)              return { ok: false, reason: 'Invalid tile coordinates.' };
  if (!tile.revealed)     return { ok: false, reason: 'Tile is hidden in fog of war.' };
  if (tile.owner === 'player') return { ok: false, reason: 'You already control this tile.' };

  // Must be adjacent to at least one player-owned tile
  const adjacent = NEIGHBORS.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && nx < width && ny >= 0 && ny < height
        && tiles[ny][nx].owner === 'player';
  });
  if (!adjacent) return { ok: false, reason: 'Target must be adjacent to your territory.' };

  // ── Calculate player attack power ────────────────────────────────────────
  let attackPower = 0;
  for (const [id, count] of Object.entries(state.units)) {
    if (count <= 0) continue;
    const def = UNITS[id];
    if (def) {
      // T107: each arsenal upgrade level adds +10% attack for that unit type
      const upgradeMult = 1 + (state.unitUpgrades?.[id] ?? 0) * 0.10;
      attackPower += def.attack * count * _rankMult(id) * upgradeMult;
    }
  }

  if (attackPower <= 0) {
    return { ok: false, reason: 'You need military units to attack! Train soldiers first.' };
  }

  // Tech multipliers
  if (state.techs.tactics)     attackPower *= 1.25;
  if (state.techs.steel)       attackPower *= 1.5;
  if (state.techs.engineering) attackPower *= 1.1;
  if (state.techs.siege_craft) attackPower *= 1.75;

  // Formation modifier (T052)
  attackPower *= _formationAttackMult();

  // Morale modifier (T057)
  attackPower *= getMoraleEffect();

  // Conqueror archetype: +25% unit attack power
  if (state.archetype === 'conqueror') attackPower *= 1.25;

  // T071 Military Mastery: +40 flat attack power
  if (state.masteries?.military) attackPower += 40;

  // T077: Veteran Legion synergy (warcraft + tactics) → +20% attack power
  if (_synergy('veteran_legion')) attackPower *= 1.20;

  // T072b: age council boon combat attack bonus
  attackPower *= _councilBoonCombatMult();

  // T090: Armory specialization on barracks — +15% combat attack
  if (state.buildingSpecials?.barracks === 'armory') attackPower *= 1.15;

  // T091: Iron Horde alliance bonus — +20% attack when allied
  if (state.diplomacy?.empires.some(e => e.id === 'ironHorde' && e.relations === 'allied')) {
    attackPower *= 1.20;
  }

  // T083: War Banner decree — +40% attack for remaining charges
  if ((state.decrees?.warBannerCharges ?? 0) > 0) {
    attackPower *= 1.40;
  }

  // T100: Fortress capital plan — +20% attack
  if (state.capitalPlan === 'fortress') attackPower *= 1.20;

  // T105: Empire title combat bonus
  const _titleAtk = getCurrentTitle(state);
  if (_titleAtk.bonus.combatMult) attackPower *= (1 + _titleAtk.bonus.combatMult);

  // T103: Military Parade festival — +25% attack while charges remain
  const _paradeUp = state.festivals?.active?.type === 'parade'
    && (state.festivals.active.chargesLeft ?? 0) > 0;
  if (_paradeUp) attackPower *= 1.25;

  // Hero bonus: flat attack power + skills + Battle Cry (×2) on next attack
  // T082/T086: skip all hero bonuses if the hero is injured or on expedition
  if (state.hero?.recruited && !_heroInjured() && !_heroOnExpedition()) {
    attackPower += HERO_DEF.attack;
    // T070: hero skills — attack bonus + combat multiplier
    const skillAtk  = heroSkillBonus(state.hero.skills ?? [], 'attackBonus');
    const skillMult = heroSkillBonus(state.hero.skills ?? [], 'combatMult');
    attackPower += skillAtk;
    attackPower *= skillMult;
    if (state.hero.activeEffects?.battleCry) {
      attackPower *= 2;
      state.hero.activeEffects.battleCry = false;
      emit(Events.HERO_CHANGED, {});
      addMessage('📣 Battle Cry: attack power doubled this strike!', 'hero');
    }
    // T112: Legendary Quest — Battle Master permanent attack bonus
    attackPower += (state.hero.legendaryAttack ?? 0);
    // T119: commander trait combat bonuses (when hero is active)
    const herTraitAtk = state.hero.trait;
    if (herTraitAtk && !state.hero.pendingTrait) {
      if (herTraitAtk === 'iron_fist')   attackPower += 30;
      if (herTraitAtk === 'war_scholar') attackPower *= 1.15;
    }
  }

  // T125: Iron Helm forge item — +25 flat attack power
  if (state.forge?.crafted?.iron_helm) attackPower += 25;

  // T131: War Economy proclamation — +25% attack power
  if (state.proclamation?.activeId === 'war_economy') attackPower *= 1.25;

  // T136: Great General — flat attack bonus while charges remain
  const _gpBonusAtk = getGeneralBonus();
  if (_gpBonusAtk > 0) attackPower += _gpBonusAtk;

  // T149: weather combat modifier
  const _weatherAtk = getCurrentWeather();
  if (_weatherAtk?.combatMult && _weatherAtk.combatMult !== 1.0) {
    attackPower *= _weatherAtk.combatMult;
  }

  // T150: Grand Theory Military Supremacy — +40% all attack power
  if (state.grandTheory === 'military_supremacy') attackPower *= 1.40;

  // T071: terrain attack modifier (applied before siege/mana-bolt override)
  const _terrainM = _terrainMod(tile.type);
  attackPower *= _terrainM.attackMult;

  // ── Probabilistic resolution ─────────────────────────────────────────────
  // Siege Master: guaranteed victory this attack, ignores tile defense
  // T082/T086: Siege Master is unavailable while the hero is injured or on expedition
  let siegeActive = false;
  let defense = tile.defense;
  if (state.hero?.recruited && !state.hero.injured && !_heroOnExpedition() && state.hero.activeEffects?.siege) {
    siegeActive = true;
    defense = 0;
    state.hero.activeEffects.siege = false;
    emit(Events.HERO_CHANGED, {});
    addMessage('🏰 Siege Master: tile defenses bypassed!', 'hero');
  }

  // Mana Bolt spell: guaranteed victory (consumed on this attack)
  if (!siegeActive && state.spells?.activeEffects?.manaBolt) {
    siegeActive = true;
    defense = 0;
    state.spells.activeEffects.manaBolt = false;
    emit(Events.SPELL_CAST, { spell: 'manaBolt', consumed: true });
    addMessage('⚡ Mana Bolt: guaranteed combat victory!', 'spell');
  }

  // T071: apply terrain defense multiplier (0 × anything = 0, so siege still guarantees win)
  let effectiveDefense = defense * _terrainM.defMult;

  // T132: Siege Engine — halves effective defense of fortified tiles
  if ((state.units?.siege_engine ?? 0) > 0 && tile.fortified) {
    effectiveDefense *= 0.50;
    addMessage('🏰 Siege Engine: fortification defenses halved!', 'info');
  }

  let winChance = siegeActive
    ? 1.0
    : Math.min(0.9, Math.max(0.1, attackPower / (attackPower + effectiveDefense)));

  // T088: skirmish bonus — target empire distracted by border fighting
  if (!siegeActive && isEmpireInSkirmish(tile.owner)) {
    winChance = Math.min(0.9, winChance + SKIRMISH_ATTACK_BONUS);
    addMessage('⚔️ Skirmish distraction: +20% attack advantage!', 'info');
  }

  // T102: Aid troops from an allied empire contribute to attack power
  const _aid = getActiveAid();
  if (_aid) {
    let aidPower = 0;
    for (const [id, count] of Object.entries(_aid.units)) {
      const def = UNITS[id];
      if (def) aidPower += def.attack * count;
    }
    if (aidPower > 0) attackPower += aidPower;
  }

  // T101: Conquest streak attack bonus
  if (_streakTier() > 0) attackPower *= _streakMult();

  const roll = Math.random();

  // T083: consume one War Banner charge (win or lose — the banner was raised)
  if ((state.decrees?.warBannerCharges ?? 0) > 0) {
    state.decrees.warBannerCharges--;
    if (state.decrees.warBannerCharges === 0) {
      addMessage('🚩 War Banner spent — all charges used.', 'info');
    }
  }

  // T103: consume one Military Parade charge (win or lose — battle has been fought)
  if (state.festivals?.active?.type === 'parade') {
    const parade = state.festivals.active;
    parade.chargesLeft = (parade.chargesLeft ?? 0) - 1;
    if (parade.chargesLeft <= 0) {
      state.festivals.active        = null;
      state.festivals.cooldownUntil = state.tick + 1920; // 8 min
      addMessage('⚔️ Military Parade glory fades — all charges used.', 'info');
      emit(Events.FESTIVAL_CHANGED, { ended: true, type: 'parade' });
    } else {
      emit(Events.FESTIVAL_CHANGED, { type: 'parade', chargesLeft: parade.chargesLeft });
    }
  }

  const result = roll < winChance
    ? _victory(tile, x, y, attackPower, effectiveDefense)
    : _defeat(tile, x, y, attackPower, effectiveDefense);

  // T102: each battle (win or loss) consumes one aid charge
  consumeAidBattle();

  // T136: each battle consumes one Great General charge
  consumeGeneralCharge();

  return result;
}

// ── Outcome handlers ───────────────────────────────────────────────────────

function _victory(tile, x, y, attackPower, defense) {
  const wasBarbarian      = tile.owner === 'barbarian';            // T056: check before changing owner
  const wasFactionCapital = tile.isFactionCapital ?? null;         // T093: check before changing owner

  tile.owner            = 'player';
  tile.faction          = null;    // T053: clear faction on player capture
  tile.isFactionCapital = null;    // T093: clear capital status on capture
  tile.revealed         = true;
  // T056: clean up barbarian defense boost metadata
  if (wasBarbarian && tile.barbDefenseBase !== undefined) {
    delete tile.barbDefenseBase;
  }
  const _newlyRevealed = revealAround(x, y);
  spawnDiscoveries(_newlyRevealed); // T146: chance to spawn a discovery on each newly-lit tile

  // T070: War Profiteer skill — +30% loot multiplier
  const lootMult = (state.hero?.recruited && state.hero.skills?.length)
    ? heroSkillBonus(state.hero.skills, 'lootMult')
    : 1.0;

  // T101: Unstoppable streak tier — doubled loot
  const streakLoot = _streakLootMult();

  // Grant loot (cap at current storage cap)
  const lootParts = [];
  const lootGained = {};
  for (const [res, amt] of Object.entries(tile.loot ?? {})) {
    const bonusAmt = Math.round(amt * lootMult * streakLoot);
    const cap  = state.caps[res] ?? 500;
    const prev = state.resources[res] ?? 0;
    state.resources[res] = Math.min(cap, prev + bonusAmt);
    lootParts.push(`+${bonusAmt} ${res}`);
    lootGained[res] = bonusAmt;
  }

  // Record combat history entry
  _recordHistory({ outcome: 'win', terrain: tile.type, x, y, power: Math.round(attackPower), defense, loot: lootGained });

  // Grant combat XP to all participating unit types
  _grantCombatXP();

  // T057 + T070 Iron Will: victory boosts army morale
  // T119: rally_master and iron_will traits add extra morale per win
  const traitMoraleWin = (state.hero?.recruited && !state.hero.pendingTrait)
    ? (state.hero.trait === 'rally_master' || state.hero.trait === 'iron_will' ? 10 : 0)
    : 0;
  const moraleGain = MORALE_COMBAT_WIN + traitMoraleWin +
    (state.hero?.recruited ? heroSkillBonus(state.hero.skills ?? [], 'moraleBonus') : 0);
  changeMorale(moraleGain);

  // T070: Track hero combat wins for skill system
  if (state.hero?.recruited) _trackHeroCombatWin();

  // T101: Increment conquest streak
  if (!state.combatStreak) state.combatStreak = { count: 0, lastWinTick: 0 };
  state.combatStreak.count++;
  state.combatStreak.lastWinTick = state.tick;
  const newStreakTier = _streakTier();
  const streakCnt = state.combatStreak.count;
  if      (streakCnt === 3)  addMessage('🔥 Momentum! 3-win streak — +10% attack power.', 'combat-win');
  else if (streakCnt === 6)  addMessage('⚡ Battle Fury! 6-win streak — +20% attack power.', 'combat-win');
  else if (streakCnt === 10) addMessage('💥 Unstoppable! 10-win streak — +35% attack & doubled loot!', 'combat-win');
  emit(Events.STREAK_CHANGED, { count: streakCnt, tier: newStreakTier });

  // T064: chance to discover an ancient relic on this tile
  _tryDiscoverRelic(tile, x, y);

  // T089: check if this tile contains a special landmark
  _tryCaptureLandmark(tile, x, y);

  // T104: remove any resource node on this tile (node is lost when territory changes hands)
  clearResourceNode(x, y);

  // T106: excavate ruin if this tile contains one
  _tryExcavateRuin(tile, x, y);

  // T135: claim territory bounty if this tile was the active bounty target
  claimBounty(x, y);

  // T122: Companion passive effects on victory
  if (state.hero?.recruited && state.hero.companion) {
    const companionType = state.hero.companion.type;
    if (companionType === 'warlock') {
      // Warlock: +12 mana per victory, capped
      const manaCap  = state.caps.mana ?? 500;
      const prevMana = state.resources.mana ?? 0;
      state.resources.mana = Math.min(manaCap, prevMana + 12);
    } else if (companionType === 'scout') {
      // Scout: reveal extra tiles in Manhattan-distance-2 ring
      if (state.map) {
        const { tiles } = state.map;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > 2) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < state.map.width && ny >= 0 && ny < state.map.height) {
              tiles[ny][nx].revealed = true;
            }
          }
        }
      }
    }
  }

  // T093: faction capital capture — force peace, award morale bonus
  if (wasFactionCapital) {
    if (state.diplomacy) {
      const emp = state.diplomacy.empires.find(e => e.id === wasFactionCapital);
      if (emp) {
        const wasAtWar = emp.relations === 'war';
        emp.relations = 'neutral';
        emp.warScore  = 0;
        emit(Events.DIPLOMACY_CHANGED, { empireId: wasFactionCapital, relations: 'neutral' });
        if (wasAtWar) {
          addMessage(`🕊️ ${EMPIRES[wasFactionCapital]?.name ?? wasFactionCapital} has surrendered! Peace restored.`, 'windfall');
        }
      }
    }
    changeMorale(10);
    emit(Events.FACTION_CAPITAL_CAPTURED, { factionId: wasFactionCapital, x, y });
  }

  // T058: award war score for capturing tiles belonging to a faction at war
  if (tile.faction && state.diplomacy) {
    const warEmp = state.diplomacy.empires.find(e => e.id === tile.faction && e.relations === 'war');
    if (warEmp) {
      warEmp.warScore = (warEmp.warScore ?? 0) + 5;
      emit(Events.DIPLOMACY_CHANGED, { empireId: warEmp.id });
    }
  }

  // T142: count this win towards any active alliance mission
  trackMissionBattleWin();

  recalcRates();
  emit(Events.MAP_CHANGED, { x, y, outcome: 'win' });
  emit(Events.RESOURCE_CHANGED, {});

  const lootStr = lootParts.length ? ` Looted: ${lootParts.join(', ')}.` : '';
  if (wasBarbarian) {
    addMessage(
      `💀 Barbarian camp cleared at (${x},${y})!${lootStr}`,
      'combat-win',
    );
  } else if (wasFactionCapital) {
    addMessage(
      `👑 ${EMPIRES[wasFactionCapital]?.name ?? wasFactionCapital} capital captured at (${x},${y})! +10 morale.${lootStr}`,
      'combat-win',
    );
  } else {
    addMessage(
      `Victory! Captured ${_tileName(tile)} at (${x},${y}).${lootStr}`,
      'combat-win',
    );
  }
  return { ok: true, outcome: 'win' };
}

/**
 * T070: Increment hero combat win counter and offer a skill choice when
 * the HERO_SKILL_WIN_INTERVAL milestone is reached (up to HERO_MAX_SKILLS).
 * T112: Also initialises and advances the legendary quest.
 */
function _trackHeroCombatWin() {
  const h = state.hero;
  if (!h) return;

  if (!h.combatWins)        h.combatWins        = 0;
  if (!h.skills)            h.skills            = [];
  if (h.pendingSkillOffer === undefined) h.pendingSkillOffer = null;

  h.combatWins++;

  // Check if a new skill milestone was reached
  const skillsEarned = Math.floor(h.combatWins / HERO_SKILL_WIN_INTERVAL);
  const skillsChosen = h.skills.length;

  if (skillsEarned > skillsChosen && skillsChosen < HERO_MAX_SKILLS && !h.pendingSkillOffer) {
    // Generate up to 3 random choices from unlearned skills
    const available = HERO_SKILLS.filter(s => !h.skills.includes(s.id));
    if (available.length > 0) {
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      h.pendingSkillOffer = shuffled.slice(0, Math.min(3, shuffled.length)).map(s => s.id);
      addMessage(
        `⭐ ${HERO_DEF.name} grows in power after ${h.combatWins} victories! Choose a new skill in the Military panel.`,
        'hero',
      );
      emit(Events.HERO_LEVEL_UP, { offer: h.pendingSkillOffer });
    }
  }

  // T112: Legendary Quest — unlock at 10+ combat wins, then advance through 3 phases
  _handleLegendaryQuest(h);

  // T122: Companion offer — unlock at COMPANION_UNLOCK_WINS if hero has no companion yet
  if (h.combatWins >= COMPANION_UNLOCK_WINS && !h.companion && !h.companionOffer) {
    h.companionOffer = true;
    addMessage(
      `🦅 ${HERO_DEF.name} has earned a loyal companion after ${h.combatWins} victories! Choose one in the Military panel.`,
      'hero',
    );
  }

  emit(Events.HERO_CHANGED, {});
}

/**
 * T112: Legendary Quest phase management.
 * Phase 0 → 1 (Battle Master):    +5 wins after unlock  → +20 flat legendaryAttack
 * Phase 1 → 2 (War Strategist):   +3 wins               → halved ability cooldowns
 * Phase 2 → 3 (Supreme Commander):+5 wins               → zero-cooldown abilities
 */
const _LEGENDARY_PHASE_WINS      = [5, 3, 5];  // wins required per phase
const _LEGENDARY_PHASE_NAMES     = ['Battle Master', 'War Strategist', 'Supreme Commander'];
const _LEGENDARY_PHASE_REWARDS   = [
  '⭐ Battle Master: Champion permanently gains +20 attack power!',
  '⭐ War Strategist: Champion\'s ability cooldowns are now halved!',
  '⭐ Supreme Commander: Champion\'s abilities have no cooldown!',
];

function _handleLegendaryQuest(h) {
  // Initialise quest when the hero has ≥10 combat wins and quest hasn't started yet
  if (!h.legendaryQuest && h.combatWins >= 10) {
    h.legendaryQuest = { phase: 0, winsAtPhaseStart: h.combatWins };
    if (h.legendaryAttack   === undefined) h.legendaryAttack   = 0;
    if (h.cdReduction       === undefined) h.cdReduction       = false;
    if (h.supremeCommander  === undefined) h.supremeCommander  = false;
    addMessage(
      `🌟 ${HERO_DEF.name} has proven their valor after ${h.combatWins} victories! The Legendary Quest begins — win 5 more battles for the first reward.`,
      'hero',
    );
    emit(Events.HERO_QUEST_CHANGED, { phase: 0, unlocked: true });
    return;
  }

  if (!h.legendaryQuest || h.legendaryQuest.phase >= 3) return;

  // Ensure legacy fields from older saves
  if (h.legendaryAttack  === undefined) h.legendaryAttack  = 0;
  if (h.cdReduction      === undefined) h.cdReduction      = false;
  if (h.supremeCommander === undefined) h.supremeCommander = false;

  const lq             = h.legendaryQuest;
  const winsThisPhase  = h.combatWins - lq.winsAtPhaseStart;
  const required       = _LEGENDARY_PHASE_WINS[lq.phase];

  if (winsThisPhase < required) return;

  // Complete current phase
  const phase = lq.phase;

  if (phase === 0) {
    h.legendaryAttack = (h.legendaryAttack ?? 0) + 20;
  } else if (phase === 1) {
    h.cdReduction = true;
  } else if (phase === 2) {
    h.supremeCommander = true;
  }

  lq.phase++;
  lq.winsAtPhaseStart = h.combatWins;

  addMessage(_LEGENDARY_PHASE_REWARDS[phase], 'achievement');
  emit(Events.HERO_QUEST_CHANGED, { phase: lq.phase });
}

/**
 * Award 1 XP to every unit type that has at least one trained unit.
 * Promote to veteran (3 XP) or elite (6 XP) when thresholds are crossed.
 */
function _grantCombatXP() {
  if (!state.unitXP)   state.unitXP   = {};
  if (!state.unitRanks) state.unitRanks = {};

  const participating = Object.keys(state.units).filter(id => (state.units[id] ?? 0) > 0);
  let promoted = false;

  for (const id of participating) {
    state.unitXP[id] = (state.unitXP[id] ?? 0) + 1;
    const xp       = state.unitXP[id];
    const prevRank = state.unitRanks[id] ?? 'normal';

    let newRank = prevRank;
    if      (xp >= ELITE_XP)   newRank = 'elite';
    else if (xp >= VETERAN_XP) newRank = 'veteran';

    if (newRank !== prevRank) {
      state.unitRanks[id] = newRank;
      const def       = UNITS[id];
      const rankLabel = newRank === 'elite' ? '★★ Elite (×2.0 atk)' : '★ Veteran (×1.5 atk)';
      addMessage(
        `${def?.icon ?? '⚔️'} ${def?.name ?? id} promoted to ${rankLabel}!`,
        'combat-win',
      );
      promoted = true;
    }
  }

  if (promoted) emit(Events.UNIT_CHANGED, {});
}

// ── T064: Relic discovery ───────────────────────────────────────────────────

function _tryDiscoverRelic(tile, x, y) {
  if (!state.relics) state.relics = { discovered: {} };
  const discovered = state.relics.discovered;

  // Capital tiles cannot yield relics
  if (tile.type === 'capital') return;

  // Try terrain-matched relic first
  const terrainRelicId = TERRAIN_RELIC[tile.type];
  if (terrainRelicId && !discovered[terrainRelicId]) {
    if (Math.random() < RELIC_DROP_CHANCE) {
      _grantRelic(terrainRelicId, x, y);
      return; // only one relic per capture
    }
  }

  // Try universal arcane shard (independent roll)
  if (!discovered['arcane_shard'] && Math.random() < ARCANE_SHARD_DROP_CHANCE) {
    _grantRelic('arcane_shard', x, y);
  }
}

function _grantRelic(relicId, x, y) {
  if (!state.relics) state.relics = { discovered: {} };
  const def = RELICS[relicId];
  if (!def) return;

  state.relics.discovered[relicId] = state.tick;

  addMessage(
    `${def.icon} Ancient relic discovered at (${x},${y}): ${def.name}! ${def.desc}`,
    'windfall',
  );
  recalcRates();
  emit(Events.RELIC_DISCOVERED, { relicId });
  emit(Events.RESOURCE_CHANGED, {});

  // T147: check if this relic completed any combo synergies
  _checkRelicCombos();
}

// T147: Check if any relic combination synergy was newly completed; award prestige once.
function _checkRelicCombos() {
  if (!state.relics?.discovered) return;
  if (!state.relics.combosUnlocked) state.relics.combosUnlocked = {};
  const disc = state.relics.discovered;
  for (const combo of RELIC_COMBOS) {
    if (state.relics.combosUnlocked[combo.id]) continue;
    if (!combo.relics.every(id => !!disc[id])) continue;
    // Newly completed combo
    state.relics.combosUnlocked[combo.id] = state.tick;
    addMessage(`${combo.icon} Relic Synergy unlocked: ${combo.name}! ${combo.desc}`, 'windfall');
    if (combo.prestige) {
      awardPrestige(combo.prestige, `${combo.name} relic synergy`);
    }
    emit(Events.RELIC_COMBO_UNLOCKED, { comboId: combo.id });
    emit(Events.RESOURCE_CHANGED, {});
  }
}

// ── T089: Landmark capture ─────────────────────────────────────────────────

function _tryCaptureLandmark(tile, x, y) {
  if (!tile.landmark) return;
  if (!state.landmarks) state.landmarks = { captured: {} };
  if (state.landmarks.captured[tile.landmark]) return; // already recorded

  const id  = tile.landmark;
  const def = LANDMARKS[id];
  if (!def) return;

  state.landmarks.captured[id] = state.tick;

  // Apply permanent bonuses via recalcRates (resources.js reads state.landmarks)
  recalcRates();

  addMessage(
    `${def.icon} Landmark secured: ${def.name} at (${x},${y})! ${def.desc}`,
    'windfall',
  );
  emit(Events.LANDMARK_CAPTURED, { landmarkId: id, x, y });
  emit(Events.RESOURCE_CHANGED, {});
}

// ── T106: Ruin excavation ──────────────────────────────────────────────────

function _tryExcavateRuin(tile, x, y) {
  if (!tile.hasRuin) return;
  if (!state.ruins) state.ruins = { excavated: {} };
  const ruinId = tile.hasRuin;
  if (state.ruins.excavated[ruinId]) return;  // already excavated (shouldn't happen)

  const outcome = rollRuinOutcome();
  const detail  = outcome.apply ? outcome.apply(state) : '';

  state.ruins.excavated[ruinId] = { tick: state.tick, outcome: outcome.id };

  // Permanent 'lost_artifact' bonus applied via resources.js loop; recalc now
  recalcRates();

  addMessage(
    `🏛️ Ancient ruin excavated at (${x},${y}): ${outcome.icon} ${outcome.name}! ${detail}`,
    'windfall',
  );
  emit(Events.RUIN_EXCAVATED, { ruinId, outcome: outcome.id, x, y });
  emit(Events.RESOURCE_CHANGED, {});
}

function _defeat(tile, x, y, attackPower, defense) {
  // T122: Healer companion — 15% chance to prevent unit casualty
  const healerActive = state.hero?.recruited && state.hero.companion?.type === 'healer';
  const healerSaved  = healerActive && Math.random() < 0.15;

  const lost = healerSaved ? null : _loseOneUnit();
  if (healerSaved) {
    addMessage(`🩺 Healer companion saved a unit from the fallen battle!`, 'hero');
  }

  // Record combat history entry
  _recordHistory({ outcome: 'loss', terrain: tile.type, x, y, power: Math.round(attackPower), defense, lost });

  // T057: defeat damages army morale
  // T119: iron_will trait halves morale loss on defeat
  const ironWillActive = state.hero?.recruited && state.hero.trait === 'iron_will' && !state.hero.pendingTrait;
  changeMorale(ironWillActive ? Math.round(MORALE_COMBAT_LOSS * 0.5) : MORALE_COMBAT_LOSS);

  // T101: Reset conquest streak on defeat
  if ((state.combatStreak?.count ?? 0) > 0) {
    if ((state.combatStreak.count ?? 0) >= 3) {
      addMessage(`💔 Streak broken after ${state.combatStreak.count} wins.`, 'combat-loss');
    }
    state.combatStreak = { count: 0, lastWinTick: state.tick };
    emit(Events.STREAK_CHANGED, { count: 0, tier: 0 });
  }

  // T082: hero injury — 20% chance the hero is knocked out on defeat
  let heroInjuredMsg = '';
  if (state.hero?.recruited && !state.hero.injured && Math.random() < HERO_INJURY_CHANCE) {
    state.hero.injured       = true;
    state.hero.recoveryUntil = state.tick + HERO_RECOVERY_TICKS;
    emit(Events.HERO_CHANGED, {});
    heroInjuredMsg = ` ${HERO_DEF.name} was wounded and needs ${Math.round(HERO_RECOVERY_TICKS / 4 / 60)}m to recover!`;
    addMessage(
      `🩹 ${HERO_DEF.icon} ${HERO_DEF.name} was injured in battle! Recovering for 5 minutes.`,
      'hero',
    );
  }

  emit(Events.MAP_CHANGED,  { x, y, outcome: 'loss' });
  emit(Events.UNIT_CHANGED, {});

  const casualtyStr = lost ? ` Lost 1 ${lost}.` : '';
  addMessage(
    `Defeated! Enemy held (${x},${y}). Power: ${Math.round(attackPower)} vs ${defense}.${casualtyStr}${heroInjuredMsg}`,
    'combat-loss',
  );
  return { ok: true, outcome: 'loss' };
}

function _loseOneUnit() {
  const ids = Object.entries(state.units)
    .filter(([, c]) => c > 0)
    .map(([id]) => id);
  if (ids.length === 0) return null;

  const id = ids[Math.floor(Math.random() * ids.length)];
  state.units[id]--;
  if (state.units[id] <= 0) delete state.units[id];
  recalcRates();

  return UNITS[id]?.name ?? id;
}

/**
 * Push a battle result to state.combatHistory (newest first, capped at MAX_HISTORY).
 * @param {object} entry  { outcome, terrain, x, y, power, defense, loot?, lost? }
 */
function _recordHistory(entry) {
  if (!state.combatHistory) state.combatHistory = [];
  state.combatHistory.unshift({ tick: state.tick, ...entry });
  if (state.combatHistory.length > MAX_HISTORY) {
    state.combatHistory.length = MAX_HISTORY;
  }
}

function _tileName(tile) {
  const names = {
    grass: 'Grassland', forest: 'Forest', hills: 'Hills',
    river: 'River', mountain: 'Mountain', capital: 'Capital',
  };
  return names[tile.type] ?? tile.type;
}

// ── T127: Resource Raid ────────────────────────────────────────────────────

const RAID_FOOD_COST      = 30;                         // food consumed per raid
const RAID_COOLDOWN_TICKS = 5 * 60 * TICKS_PER_SECOND; // 5-minute global cooldown

function _initRaids() {
  if (!state.raids) state.raids = { cooldownUntil: 0, totalRaids: 0 };
}

/**
 * Preview a resource raid without mutating state.
 * Returns { valid, attackPower, enemyDef, winChance, loot, onCooldown, cooldownSecs, food }
 */
export function getRaidPreview(x, y) {
  _initRaids();
  if (!state.map) return { valid: false, reason: 'No map loaded.' };
  const { tiles, width, height } = state.map;
  const tile = tiles[y]?.[x];

  if (!tile?.revealed)                                   return { valid: false, reason: 'Tile not revealed.' };
  if (tile.owner !== 'enemy' && tile.owner !== 'barbarian') return { valid: false, reason: 'Not an enemy tile.' };

  const adjacent = NEIGHBORS.some(([dx, dy]) => {
    const nx = x + dx; const ny = y + dy;
    return nx >= 0 && nx < width && ny >= 0 && ny < height && tiles[ny][nx].owner === 'player';
  });
  if (!adjacent) return { valid: false, reason: 'Target not adjacent to your territory.' };

  // Compute attack power (mirrors attackTile logic)
  let attackPower = 0;
  for (const [id, count] of Object.entries(state.units)) {
    if (count <= 0) continue;
    const def = UNITS[id];
    if (!def) continue;
    const upgMult = 1 + (state.unitUpgrades?.[id] ?? 0) * 0.10;
    attackPower += def.attack * count * _rankMult(id) * upgMult;
  }
  if (attackPower <= 0) return { valid: false, reason: 'Train military units first.' };

  // Raid uses 40% of tile defense (raiders hit fast and light, not a siege)
  const enemyDef  = Math.round(tile.defense * 0.4);
  const winChance = Math.min(0.85, Math.max(0.40, attackPower / (attackPower + enemyDef)));

  // Loot preview: 60% of tile loot values + bonus gold scaled with game time
  const loot = {};
  if (tile.loot) {
    for (const [res, amt] of Object.entries(tile.loot)) {
      if (amt > 0) loot[res] = Math.floor(amt * 0.6);
    }
  }
  loot.gold = (loot.gold || 0) + 20 + Math.floor(state.tick / 150);

  const onCooldown  = (state.raids.cooldownUntil ?? 0) > state.tick;
  const cooldownSecs = onCooldown
    ? Math.ceil((state.raids.cooldownUntil - state.tick) / TICKS_PER_SECOND) : 0;

  return {
    valid: true,
    attackPower: Math.round(attackPower),
    enemyDef,
    winChance,
    loot,
    onCooldown,
    cooldownSecs,
    food: RAID_FOOD_COST,
  };
}

/**
 * Attempt a resource raid on an adjacent enemy tile.
 * Win: steal resources (no territory change). Loss: lose 1 unit.
 * Triggers a 5-minute global raid cooldown either way.
 */
export function raidTile(x, y) {
  _initRaids();
  const preview = getRaidPreview(x, y);
  if (!preview.valid) {
    addMessage(`❌ Raid: ${preview.reason}`, 'info');
    return { ok: false };
  }
  if (preview.onCooldown) {
    addMessage(`⚔️ Raiders are resting (cooldown: ${preview.cooldownSecs}s).`, 'info');
    return { ok: false };
  }
  if ((state.resources.food ?? 0) < RAID_FOOD_COST) {
    addMessage(`⚔️ Not enough food for a raid (need ${RAID_FOOD_COST} 🍞).`, 'info');
    return { ok: false };
  }

  state.resources.food -= RAID_FOOD_COST;
  state.raids.cooldownUntil = state.tick + RAID_COOLDOWN_TICKS;

  const tile    = state.map.tiles[y][x];
  const terrain = _tileName(tile);

  if (Math.random() < preview.winChance) {
    // Victory: steal resources (no capture, no territory change)
    const gained = {};
    for (const [res, amt] of Object.entries(preview.loot)) {
      const space   = (state.caps[res] ?? 0) - (state.resources[res] ?? 0);
      const g       = Math.min(amt, Math.max(0, space));
      if (g > 0) { state.resources[res] = (state.resources[res] ?? 0) + g; gained[res] = g; }
    }
    state.raids.totalRaids = (state.raids.totalRaids ?? 0) + 1;

    const parts = Object.entries(gained).filter(([, v]) => v > 0).map(([r, v]) => `+${v} ${r}`).join(', ');
    addMessage(`⚔️ Raid successful! Plundered ${terrain} (${x},${y})! ${parts || 'Nothing seized.'}`, 'windfall');
    emit(Events.RESOURCE_CHANGED, {});
    emit(Events.RAID_CHANGED, { outcome: 'win', x, y, loot: gained });
  } else {
    // Defeat: lose 1 unit
    const lost = _loseOneUnit();
    addMessage(`⚔️ Raid repelled at (${x},${y})! Raiders retreat${lost ? `; lost 1 ${lost}` : ''}.`, 'combat-loss');
    emit(Events.UNIT_CHANGED, {});
    emit(Events.RAID_CHANGED, { outcome: 'loss', x, y });
  }

  return { ok: true };
}
