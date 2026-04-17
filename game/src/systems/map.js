/**
 * EmpireOS — Map system.
 *
 * Responsibilities:
 *   - initMap(): generate a fresh 20×20 tile map with fog of war
 *   - revealAround(x, y): reveal adjacent tiles
 *   - territoryRateBonus(): compute per-second rate bonuses from captured terrain
 *
 * Tile types: grass | forest | hills | river | mountain | capital
 * Tile owner:  null (neutral) | 'player' | 'enemy'
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { IMPROVEMENTS } from '../data/improvements.js';
import { LANDMARK_ORDER, LANDMARKS } from '../data/landmarks.js';

export const MAP_W = 20;
export const MAP_H = 20;
export const CAPITAL = { x: 10, y: 10 };

// Weighted terrain distribution (grass appears most often)
const TERRAIN_POOL = [
  'grass', 'grass', 'grass', 'grass',
  'forest', 'forest',
  'hills', 'hills',
  'river',
  'mountain',
];

// Bonus resources granted when a tile is first captured
const TILE_LOOT = {
  grass:    { gold: 20 },
  forest:   { wood: 35 },
  hills:    { stone: 35 },
  river:    { food: 30, gold: 10 },
  mountain: { iron: 25, stone: 15 },
  capital:  {},
};

/**
 * Generate and assign a fresh map to state.map.
 */
export function initMap() {
  const tiles = [];

  for (let y = 0; y < MAP_H; y++) {
    tiles[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      const type = TERRAIN_POOL[Math.floor(Math.random() * TERRAIN_POOL.length)];
      const dist = Math.hypot(x - CAPITAL.x, y - CAPITAL.y);
      tiles[y][x] = {
        type,
        owner: null,
        revealed: false,
        // Defense scales with distance from player capital
        defense: Math.round(15 + dist * 6),
        loot: { ...TILE_LOOT[type] },
      };
    }
  }

  // Stamp player capital + surrounding 3×3 as owned + revealed
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = CAPITAL.x + dx;
      const ty = CAPITAL.y + dy;
      if (_inBounds(tx, ty, tiles)) {
        tiles[ty][tx].owner    = 'player';
        tiles[ty][tx].revealed = true;
        if (dx === 0 && dy === 0) tiles[ty][tx].type = 'capital';
      }
    }
  }

  // Reveal the ring around player territory
  _revealAdjacentToPlayer(tiles);

  // Scatter enemy settlements across the map
  _placeEnemies(tiles);

  // T093: designate one capital per faction (farthest settlement from player)
  _designateFactionCapitals(tiles);

  // Place special landmarks (T089)
  _placeLandmarks(tiles);
  state.landmarks = { captured: {} };

  state.map = {
    width:   MAP_W,
    height:  MAP_H,
    tiles,
    capital: { ...CAPITAL },
  };
}

// ── Fog helpers ────────────────────────────────────────────────────────────

/**
 * Reveal the 8 tiles surrounding (x, y) — call after capturing a tile.
 */
export function revealAround(x, y) {
  if (!state.map) return;
  const { tiles } = state.map;
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (_inBounds(nx, ny, tiles)) tiles[ny][nx].revealed = true;
  }
}

// ── Territory rate bonuses ─────────────────────────────────────────────────

/**
 * Returns per-second bonus rates from all player-owned terrain.
 * Consumed by resources.js recalcRates().
 */
export function territoryRateBonus() {
  if (!state.map) return {};
  const bonus = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0, mana: 0 };

  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      const tile = state.map.tiles[y][x];
      if (tile.owner !== 'player') continue;

      // Base terrain bonuses
      switch (tile.type) {
        case 'forest':   bonus.wood  += 0.3; break;
        case 'hills':    bonus.stone += 0.3; break;
        case 'river':    bonus.food  += 0.3; break;
        case 'mountain': bonus.iron  += 0.2; break;
        case 'grass':    bonus.gold  += 0.1; break;
      }

      // Tile improvement bonus (T051)
      if (tile.improvement) {
        const impDef = IMPROVEMENTS[tile.type];
        if (impDef && impDef.id === tile.improvement) {
          for (const [res, rate] of Object.entries(impDef.production)) {
            if (bonus[res] !== undefined) bonus[res] += rate;
          }
        }
      }
    }
  }
  return bonus;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function _inBounds(x, y, tiles) {
  return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H && tiles[y] !== undefined;
}

function _revealAdjacentToPlayer(tiles) {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (tiles[y][x].owner !== 'player') continue;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (_inBounds(nx, ny, tiles)) tiles[ny][nx].revealed = true;
      }
    }
  }
}

/**
 * Returns the AI faction that controls a given map position (T053).
 * The map is divided into 3 angular sectors of ~120° each, radiating from the capital:
 *   0° – 120°  → Iron Horde
 *   120° – 240° → Mage Council
 *   240° – 360° → Sea Wolves
 */
function _getFaction(x, y) {
  const dx = x - CAPITAL.x;
  const dy = y - CAPITAL.y;
  let angle = Math.atan2(dy, dx);          // –π … +π
  if (angle < 0) angle += 2 * Math.PI;    // normalise to 0 … 2π
  const sector = Math.floor(angle / (2 * Math.PI / 3));
  return ['ironHorde', 'mageCouncil', 'seaWolves'][Math.min(sector, 2)];
}

function _placeEnemies(tiles) {
  // Collect neutral tiles beyond radius 3
  const candidates = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const dist = Math.hypot(x - CAPITAL.x, y - CAPITAL.y);
      if (dist >= 3.5 && tiles[y][x].owner === null) {
        candidates.push({ x, y });
      }
    }
  }

  // Shuffle and place ~20 enemy settlements, each tagged with their faction (T053)
  candidates.sort(() => Math.random() - 0.5);
  const count = Math.min(20, candidates.length);
  for (let i = 0; i < count; i++) {
    const { x, y } = candidates[i];
    tiles[y][x].owner   = 'enemy';
    tiles[y][x].faction = _getFaction(x, y);
  }
}

/**
 * T093: Designate one enemy settlement per faction as that faction's capital.
 * Selects the settlement farthest from the player capital for each faction.
 * Capitals get +40% defense and have tile.isFactionCapital = factionId.
 */
function _designateFactionCapitals(tiles) {
  const factions = ['ironHorde', 'mageCouncil', 'seaWolves'];
  for (const faction of factions) {
    let bestTile = null;
    let bestDist = -1;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = tiles[y][x];
        if (tile.owner === 'enemy' && tile.faction === faction) {
          const dist = Math.hypot(x - CAPITAL.x, y - CAPITAL.y);
          if (dist > bestDist) { bestDist = dist; bestTile = tile; }
        }
      }
    }
    if (bestTile) {
      bestTile.isFactionCapital = faction;
      bestTile.defense = Math.round(bestTile.defense * 1.4);
    }
  }
}

/**
 * T089: Place 5 unique landmark tiles across the map.
 * Landmarks are scattered at distance 4–12 from capital on neutral non-enemy tiles.
 * Each landmark boosts the tile's defense by its defenseBonus.
 */
function _placeLandmarks(tiles) {
  const candidates = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const dist = Math.hypot(x - CAPITAL.x, y - CAPITAL.y);
      if (dist >= 4 && dist <= 12 && tiles[y][x].owner === null) {
        candidates.push({ x, y });
      }
    }
  }
  // Shuffle candidates and assign one landmark per slot, spread across map
  candidates.sort(() => Math.random() - 0.5);
  let placed = 0;
  for (const { x, y } of candidates) {
    if (placed >= LANDMARK_ORDER.length) break;
    const tile = tiles[y][x];
    if (tile.landmark) continue;
    const id = LANDMARK_ORDER[placed];
    tile.landmark = id;
    tile.defense += LANDMARKS[id].defenseBonus;
    placed++;
  }
}
