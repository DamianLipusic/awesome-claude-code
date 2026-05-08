/**
 * EmpireOS — Ancient Vault Cache System (T238).
 *
 * Periodically spawns a buried treasure cache on a neutral revealed tile.
 * Player must capture the tile within 5 minutes to claim the loot.
 * Capture is detected in combat.js _victory() via checkVaultCapture(x, y).
 *
 * Spawn requirements:
 *   - Bronze Age (age ≥ 1)
 *   - 8+ player-owned tiles
 *   - Neutral revealed tile within distance 3–8 from player capital
 *
 * Interval: 15–18 minutes.  Capture window: 5 minutes.
 *
 * Vault types (random, age-gated):
 *   gem_vault     — +100 gold, +20 prestige               (any age)
 *   supply_vault  — +60 food, +50 wood, +30 stone         (any age)
 *   arsenal_vault — +45 iron, +50 gold, +15 prestige      (any age)
 *   arcane_vault  — +60 mana, +25 gold, +20 prestige      (Iron Age+)
 *
 * Map display: golden tint + 🏺 icon on the tile.
 *
 * state.ancientVaultCache = {
 *   active:        { x, y, type, expiresAt } | null,
 *   nextCacheTick: tick,
 *   totalFound:    number,
 *   totalCaptured: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { MAP_W, MAP_H }     from './map.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;  // 15 min
const SPAWN_RANGE      = 3  * 60 * TICKS_PER_SECOND;  // +0–3 min jitter
const CAPTURE_WINDOW   = 5  * 60 * TICKS_PER_SECOND;  // 5 min
const MIN_PLAYER_TILES = 8;
const MIN_AGE          = 1;  // Bronze Age
const SPAWN_DIST_MIN   = 3;
const SPAWN_DIST_MAX   = 8;

const VAULT_TYPES = Object.freeze({
  gem_vault: {
    id:      'gem_vault',
    icon:    '💎',
    name:    'Gem Vault',
    rewards: { gold: 100 },
    prestige: 20,
    minAge:  0,
    desc:    '+100 gold, +20 prestige',
  },
  supply_vault: {
    id:      'supply_vault',
    icon:    '📦',
    name:    'Supply Vault',
    rewards: { food: 60, wood: 50, stone: 30 },
    prestige: 0,
    minAge:  0,
    desc:    '+60 food, +50 wood, +30 stone',
  },
  arsenal_vault: {
    id:      'arsenal_vault',
    icon:    '⚔️',
    name:    'Arsenal Vault',
    rewards: { iron: 45, gold: 50 },
    prestige: 15,
    minAge:  0,
    desc:    '+45 iron, +50 gold, +15 prestige',
  },
  arcane_vault: {
    id:      'arcane_vault',
    icon:    '🔮',
    name:    'Arcane Vault',
    rewards: { mana: 60, gold: 25 },
    prestige: 20,
    minAge:  2,  // Iron Age
    desc:    '+60 mana, +25 gold, +20 prestige',
  },
});

// ── Init ──────────────────────────────────────────────────────────────────

export function initAncientVaultCache() {
  if (!state.ancientVaultCache) {
    state.ancientVaultCache = {
      active:        null,
      nextCacheTick: _nextSpawnTick(),
      totalFound:    0,
      totalCaptured: 0,
    };
  }
  if (state.ancientVaultCache.nextCacheTick === undefined) {
    state.ancientVaultCache.nextCacheTick = _nextSpawnTick();
  }
  if (state.ancientVaultCache.totalFound    === undefined) state.ancientVaultCache.totalFound    = 0;
  if (state.ancientVaultCache.totalCaptured === undefined) state.ancientVaultCache.totalCaptured = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function ancientVaultCacheTick() {
  const vc = state.ancientVaultCache;
  if (!vc) return;

  // Handle active vault expiry
  if (vc.active) {
    if (state.tick >= vc.active.expiresAt) {
      vc.active         = null;
      vc.nextCacheTick  = _nextSpawnTick();
      emit(Events.VAULT_CACHE_CHANGED, { expired: true });
      emit(Events.MAP_CHANGED, {});
    }
    return;
  }

  // Check spawn conditions
  if (state.tick < vc.nextCacheTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  // Count player tiles
  let playerTiles = 0;
  if (state.map?.tiles) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (state.map.tiles[y][x].owner === 'player') playerTiles++;
      }
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  // Find a valid spawn tile
  const target = _pickTarget();
  if (!target) {
    // No valid tile — retry in 2 minutes
    vc.nextCacheTick = state.tick + 2 * 60 * TICKS_PER_SECOND;
    return;
  }

  // Pick vault type (arcane only available at Iron Age+)
  const age          = state.age ?? 0;
  const availTypes   = Object.values(VAULT_TYPES).filter(v => age >= v.minAge);
  const vaultDef     = availTypes[Math.floor(Math.random() * availTypes.length)];

  vc.active = {
    x:         target.x,
    y:         target.y,
    type:      vaultDef.id,
    expiresAt: state.tick + CAPTURE_WINDOW,
  };
  vc.totalFound = (vc.totalFound ?? 0) + 1;

  emit(Events.VAULT_CACHE_CHANGED, { spawned: true });
  emit(Events.MAP_CHANGED, {});
  addMessage(
    `🏺 Ancient Vault Cache discovered at (${target.x},${target.y})! Capture within 5 minutes: ${vaultDef.desc}`,
    'windfall',
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Called from combat.js _victory() when the player captures a tile.
 * If the tile matches the active vault cache, awards loot.
 */
export function checkVaultCapture(x, y) {
  const vc = state.ancientVaultCache;
  if (!vc?.active) return;
  if (vc.active.x !== x || vc.active.y !== y) return;
  if (state.tick >= vc.active.expiresAt) return;

  const vaultDef = VAULT_TYPES[vc.active.type];
  if (!vaultDef) {
    vc.active        = null;
    vc.nextCacheTick = _nextSpawnTick();
    return;
  }

  // Award resources
  const rewParts = [];
  for (const [res, amt] of Object.entries(vaultDef.rewards)) {
    const cap = state.caps[res] ?? 500;
    state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
    rewParts.push(`+${amt} ${res}`);
  }
  if (vaultDef.prestige > 0) {
    awardPrestige(vaultDef.prestige, 'ancient vault captured');
    rewParts.push(`+${vaultDef.prestige} prestige`);
  }

  vc.totalCaptured = (vc.totalCaptured ?? 0) + 1;
  vc.active        = null;
  vc.nextCacheTick = _nextSpawnTick();

  emit(Events.VAULT_CACHE_CHANGED, { captured: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `${vaultDef.icon} ${vaultDef.name} opened! ${rewParts.join(', ')}.`,
    'windfall',
  );
}

/** Returns the active vault cache info, or null. */
export function getVaultCacheInfo() {
  return state.ancientVaultCache?.active ?? null;
}

/** Seconds remaining until the active vault cache expires (0 when none). */
export function getVaultCacheSecsLeft() {
  const a = state.ancientVaultCache?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}

function _dist(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function _pickTarget() {
  if (!state.map?.tiles || !state.map.capital) return null;
  const { x: cx, y: cy } = state.map.capital;

  const candidates = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = state.map.tiles[y][x];
      if (tile.owner !== 'neutral') continue;
      if (!tile.revealed) continue;
      const d = _dist(x, y, cx, cy);
      if (d >= SPAWN_DIST_MIN && d <= SPAWN_DIST_MAX) {
        candidates.push({ x, y });
      }
    }
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
