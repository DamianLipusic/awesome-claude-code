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
import { HERO_DEF } from '../data/hero.js';
import { addMessage } from '../core/actions.js';
import { revealAround } from './map.js';
import { recalcRates } from './resources.js';
import { getMoraleEffect, changeMorale, MORALE_COMBAT_WIN, MORALE_COMBAT_LOSS } from './morale.js';

const NEIGHBORS   = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const MAX_HISTORY = 20;

// XP thresholds for rank promotion
const VETERAN_XP = 3;
const ELITE_XP   = 6;

// Formation attack multipliers (T052)
const FORMATION_ATTACK = { defensive: 0.85, balanced: 1.0, aggressive: 1.25 };

/** Returns the player's current formation attack multiplier. */
function _formationAttackMult() {
  return FORMATION_ATTACK[state.formation ?? 'balanced'] ?? 1.0;
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
    if (def) attackPower += def.attack * count * _rankMult(id);
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

  if (state.hero?.recruited) {
    attackPower += HERO_DEF.attack;
    if (state.hero.activeEffects?.battleCry) attackPower *= 2;  // preview includes Battle Cry bonus
  }

  const siegeActive    = !!(state.hero?.recruited && state.hero.activeEffects?.siege);
  const manaBoltActive = !!(state.spells?.activeEffects?.manaBolt);
  const winChance      = (siegeActive || manaBoltActive)
    ? 1.0
    : Math.min(0.9, Math.max(0.1, attackPower / (attackPower + tile.defense)));

  return {
    valid:        true,
    attackPower:  Math.round(attackPower),
    defense:      tile.defense,
    winChance,
    loot:         tile.loot ?? {},
    terrain:      tile.type,
    owner:        tile.owner,
    siegeActive,
    manaBoltActive,
    formation:    state.formation ?? 'balanced',
    morale:       Math.round(state.morale ?? 50),
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
    if (def) attackPower += def.attack * count * _rankMult(id);
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

  // Hero bonus: flat attack power + Battle Cry (×2) on next attack
  if (state.hero?.recruited) {
    attackPower += HERO_DEF.attack;
    if (state.hero.activeEffects?.battleCry) {
      attackPower *= 2;
      state.hero.activeEffects.battleCry = false;
      emit(Events.HERO_CHANGED, {});
      addMessage('📣 Battle Cry: attack power doubled this strike!', 'hero');
    }
  }

  // ── Probabilistic resolution ─────────────────────────────────────────────
  // Siege Master: guaranteed victory this attack, ignores tile defense
  let siegeActive = false;
  let defense = tile.defense;
  if (state.hero?.recruited && state.hero.activeEffects?.siege) {
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

  const winChance = siegeActive
    ? 1.0
    : Math.min(0.9, Math.max(0.1, attackPower / (attackPower + defense)));
  const roll      = Math.random();

  if (roll < winChance) {
    return _victory(tile, x, y, attackPower, defense);
  } else {
    return _defeat(tile, x, y, attackPower, defense);
  }
}

// ── Outcome handlers ───────────────────────────────────────────────────────

function _victory(tile, x, y, attackPower, defense) {
  const wasBarbarian = tile.owner === 'barbarian';  // T056: check before changing owner

  tile.owner    = 'player';
  tile.faction  = null;    // T053: clear faction on player capture
  tile.revealed = true;
  // T056: clean up barbarian defense boost metadata
  if (wasBarbarian && tile.barbDefenseBase !== undefined) {
    delete tile.barbDefenseBase;
  }
  revealAround(x, y);

  // Grant loot (cap at current storage cap)
  const lootParts = [];
  const lootGained = {};
  for (const [res, amt] of Object.entries(tile.loot ?? {})) {
    const cap  = state.caps[res] ?? 500;
    const prev = state.resources[res] ?? 0;
    state.resources[res] = Math.min(cap, prev + amt);
    lootParts.push(`+${amt} ${res}`);
    lootGained[res] = amt;
  }

  // Record combat history entry
  _recordHistory({ outcome: 'win', terrain: tile.type, x, y, power: Math.round(attackPower), defense, loot: lootGained });

  // Grant combat XP to all participating unit types
  _grantCombatXP();

  // T057: victory boosts army morale
  changeMorale(MORALE_COMBAT_WIN);

  // T058: award war score for capturing tiles belonging to a faction at war
  if (tile.faction && state.diplomacy) {
    const warEmp = state.diplomacy.empires.find(e => e.id === tile.faction && e.relations === 'war');
    if (warEmp) {
      warEmp.warScore = (warEmp.warScore ?? 0) + 5;
      emit(Events.DIPLOMACY_CHANGED, { empireId: warEmp.id });
    }
  }

  recalcRates();
  emit(Events.MAP_CHANGED, { x, y, outcome: 'win' });
  emit(Events.RESOURCE_CHANGED, {});

  const lootStr = lootParts.length ? ` Looted: ${lootParts.join(', ')}.` : '';
  if (wasBarbarian) {
    addMessage(
      `💀 Barbarian camp cleared at (${x},${y})!${lootStr}`,
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

function _defeat(tile, x, y, attackPower, defense) {
  // Lose 1 random unit as a casualty
  const lost = _loseOneUnit();

  // Record combat history entry
  _recordHistory({ outcome: 'loss', terrain: tile.type, x, y, power: Math.round(attackPower), defense, lost });

  // T057: defeat damages army morale
  changeMorale(MORALE_COMBAT_LOSS);

  emit(Events.MAP_CHANGED,  { x, y, outcome: 'loss' });
  emit(Events.UNIT_CHANGED, {});

  const casualtyStr = lost ? ` Lost 1 ${lost}.` : '';
  addMessage(
    `Defeated! Enemy held (${x},${y}). Power: ${Math.round(attackPower)} vs ${defense}.${casualtyStr}`,
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
