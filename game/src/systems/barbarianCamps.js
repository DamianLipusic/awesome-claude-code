/**
 * EmpireOS — Barbarian Encampments System (T056).
 *
 * Neutral revealed tiles periodically become Barbarian Camps:
 *   - tile.owner = 'barbarian'
 *   - Defense boosted by +20–35 (stored so _victory() sees it for the preview)
 *   - Loot doubled at spawn time (captured by regular _victory() in combat.js)
 *   - Max 5 camps at once; one spawn attempt every 45–90 seconds
 *
 * Integration points:
 *   combat.js _victory()     — player captures, gets doubled loot + territory
 *   enemyAI.js _expandEnemies() — enemy expansion can clear a barbarian camp
 *   mapPanel.js              — dark maroon tint, skull icon, tooltip label
 *   minimap.js               — dark red color for barbarian tiles
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { MAP_W, MAP_H } from './map.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_CAMPS        = 5;
const SPAWN_MIN        = 45 * TICKS_PER_SECOND;   // 180 ticks  (45 s)
const SPAWN_MAX        = 90 * TICKS_PER_SECOND;   // 360 ticks  (90 s)
const MIN_DIST_CAPITAL = 4;    // camps can't appear too close to the player
const DEFENSE_BONUS_MIN = 20;
const DEFENSE_BONUS_MAX = 35;
const LOOT_MULT         = 2;   // loot multiplier at spawn

// Base loot values mirroring map.js TILE_LOOT (used when tile.loot is empty)
const BASE_LOOT = {
  grass:    { gold: 20 },
  forest:   { wood: 35 },
  hills:    { stone: 35 },
  river:    { food: 30, gold: 10 },
  mountain: { iron: 25, stone: 15 },
};

// ── Init ───────────────────────────────────────────────────────────────────

export function initBarbarians() {
  if (!state.barbarians) {
    state.barbarians = {
      nextSpawnTick: (state.tick ?? 0) + SPAWN_MIN,
    };
  }
}

// ── Tick ───────────────────────────────────────────────────────────────────

/**
 * Called once per game tick. Checks whether a new camp should spawn.
 */
export function barbarianTick() {
  if (!state.map || !state.barbarians) return;
  if (state.tick < state.barbarians.nextSpawnTick) return;

  // Count current camps
  const { tiles } = state.map;
  let campCount = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (tiles[y][x].owner === 'barbarian') campCount++;
    }
  }

  if (campCount < MAX_CAMPS) _spawnCamp(tiles);

  // Schedule next attempt
  const range = SPAWN_MAX - SPAWN_MIN;
  state.barbarians.nextSpawnTick = state.tick + SPAWN_MIN + Math.floor(Math.random() * range);
}

// ── Internal ───────────────────────────────────────────────────────────────

function _spawnCamp(tiles) {
  const capital = state.map.capital ?? { x: 10, y: 10 };

  // Gather candidates: neutral + revealed + not too close to capital
  const candidates = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = tiles[y][x];
      if (tile.owner !== null) continue;   // must be neutral
      if (!tile.revealed) continue;         // must be visible to the player
      const dist = Math.hypot(x - capital.x, y - capital.y);
      if (dist < MIN_DIST_CAPITAL) continue;
      candidates.push({ x, y, dist });
    }
  }

  if (candidates.length === 0) return;

  // Prefer tiles further away (more tactically interesting)
  candidates.sort((a, b) => b.dist - a.dist);
  const topSlice = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.4)));
  const { x, y } = topSlice[Math.floor(Math.random() * topSlice.length)];
  const tile = tiles[y][x];

  // Mark as barbarian camp
  tile.owner = 'barbarian';

  // Boost defense
  const bonus = DEFENSE_BONUS_MIN + Math.floor(Math.random() * (DEFENSE_BONUS_MAX - DEFENSE_BONUS_MIN + 1));
  tile.barbDefenseBase = tile.defense;
  tile.defense += bonus;

  // Double loot (seed from base if tile.loot is empty/undefined)
  const baseLoot = { ...(tile.loot && Object.keys(tile.loot).length ? tile.loot : (BASE_LOOT[tile.type] ?? {})) };
  const doubledLoot = {};
  for (const [res, amt] of Object.entries(baseLoot)) {
    doubledLoot[res] = Math.round(amt * LOOT_MULT);
  }
  tile.loot = doubledLoot;

  emit(Events.MAP_CHANGED, {});
  addMessage(
    `💀 Barbarian camp raised at (${x},${y})! High defense but rich spoils await the bold.`,
    'raid',
  );
}

/**
 * Restore a barbarian tile to neutral after it is cleared by the enemy AI.
 * (Player captures are handled by combat.js _victory() which sets owner='player'.)
 */
export function clearBarbarianCamp(tile) {
  tile.owner = null;
  if (tile.barbDefenseBase !== undefined) {
    tile.defense = tile.barbDefenseBase;
    delete tile.barbDefenseBase;
  }
}
