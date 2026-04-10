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

const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

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
    if (def) attackPower += def.attack * count;
  }

  if (attackPower <= 0) {
    return { ok: false, reason: 'You need military units to attack! Train soldiers first.' };
  }

  // Tech multipliers
  if (state.techs.tactics)     attackPower *= 1.25;
  if (state.techs.steel)       attackPower *= 1.5;
  if (state.techs.engineering) attackPower *= 1.1;

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
  tile.owner    = 'player';
  tile.revealed = true;
  revealAround(x, y);

  // Grant loot (cap at current storage cap)
  const lootParts = [];
  for (const [res, amt] of Object.entries(tile.loot ?? {})) {
    const cap  = state.caps[res] ?? 500;
    const prev = state.resources[res] ?? 0;
    state.resources[res] = Math.min(cap, prev + amt);
    lootParts.push(`+${amt} ${res}`);
  }

  recalcRates();
  emit(Events.MAP_CHANGED, { x, y, outcome: 'win' });
  emit(Events.RESOURCE_CHANGED, {});

  const lootStr = lootParts.length ? ` Looted: ${lootParts.join(', ')}.` : '';
  addMessage(
    `Victory! Captured ${_tileName(tile)} at (${x},${y}).${lootStr}`,
    'combat-win',
  );
  return { ok: true, outcome: 'win' };
}

function _defeat(tile, x, y, attackPower, defense) {
  // Lose 1 random unit as a casualty
  const lost = _loseOneUnit();

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

function _tileName(tile) {
  const names = {
    grass: 'Grassland', forest: 'Forest', hills: 'Hills',
    river: 'River', mountain: 'Mountain', capital: 'Capital',
  };
  return names[tile.type] ?? tile.type;
}
