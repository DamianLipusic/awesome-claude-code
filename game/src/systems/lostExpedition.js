/**
 * EmpireOS — Lost Expedition Rescue System (T233).
 *
 * Every 20–25 minutes (Bronze Age+, 6+ player tiles), a Lost Expedition
 * appears on a neutral revealed tile. The player must capture that tile
 * within 5 minutes to rescue the survivors.
 *
 * Rescue rewards: +100 gold, +60 food, +40 prestige, fog reveal.
 * If not rescued in time, the expedition perishes.
 *
 * state.lostExpedition = {
 *   active:              { x, y, expiresAt } | null,
 *   nextExpeditionTick:  number,
 *   totalRescued:        number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { revealAround, MAP_W, MAP_H, CAPITAL } from './map.js';
import { awardPrestige }    from './prestige.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN_TICKS   = 20 * 60 * TICKS_PER_SECOND;  // 20 min minimum between events
const SPAWN_RANGE_TICKS =  5 * 60 * TICKS_PER_SECOND;  // +0–5 min random jitter
const RESCUE_WINDOW     =  5 * 60 * TICKS_PER_SECOND;  // 5 min to rescue
const RETRY_TICKS       =  2 * 60 * TICKS_PER_SECOND;  // retry if no eligible tile
const MIN_PLAYER_TILES  = 6;                             // need Bronze Age expansion
const MIN_AGE           = 1;                             // Bronze Age
const MIN_DIST          = 4;                             // tiles from capital (min)

const RESCUE_GOLD    = 100;
const RESCUE_FOOD    =  60;
const RESCUE_PRESTIGE = 40;

const TERRAIN_NAMES = {
  grass:    'open plains',
  forest:   'dense forest',
  hills:    'rolling hills',
  river:    'riverbank',
  mountain: 'mountain pass',
};

// ── Init ──────────────────────────────────────────────────────────────────

export function initLostExpedition() {
  if (!state.lostExpedition) {
    state.lostExpedition = {
      active:             null,
      nextExpeditionTick: state.tick + SPAWN_MIN_TICKS,
      totalRescued:       0,
    };
  }
  if (state.lostExpedition.totalRescued === undefined) {
    state.lostExpedition.totalRescued = 0;
  }
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function lostExpeditionTick() {
  if (!state.lostExpedition) return;
  const le = state.lostExpedition;

  // Check if active expedition has expired
  if (le.active) {
    if (state.tick >= le.active.expiresAt) {
      le.active             = null;
      le.nextExpeditionTick = _nextSpawnTick();
      emit(Events.LOST_EXPEDITION_CHANGED, { expired: true });
      addMessage('🏴 The lost expedition could not be reached in time — the survivors have perished.', 'info');
    }
    return;
  }

  // Not yet time to spawn
  if (state.tick < le.nextExpeditionTick) return;

  // Require Bronze Age and enough territory
  if ((state.age ?? 0) < MIN_AGE) {
    le.nextExpeditionTick = _nextSpawnTick();
    return;
  }
  if (_countPlayerTiles() < MIN_PLAYER_TILES) {
    le.nextExpeditionTick = _nextSpawnTick();
    return;
  }

  const target = _pickTarget();
  if (!target) {
    // No eligible tile — retry shortly
    le.nextExpeditionTick = state.tick + RETRY_TICKS;
    return;
  }

  le.active = { x: target.x, y: target.y, expiresAt: state.tick + RESCUE_WINDOW };
  emit(Events.LOST_EXPEDITION_CHANGED, { spawned: true });
  const terrain = TERRAIN_NAMES[target.terrainType] ?? 'wilderness';
  addMessage(
    `🏴 A lost expedition has been spotted in the ${terrain}! Capture the tile within 5 minutes to rescue them and claim their reward.`,
    'windfall',
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Called from combat.js _victory() when the player captures a tile.
 * Returns true if the expedition was rescued.
 */
export function checkExpeditionRescue(x, y) {
  const le = state.lostExpedition;
  if (!le?.active) return false;
  if (le.active.x !== x || le.active.y !== y) return false;
  if (state.tick >= le.active.expiresAt) return false;

  le.totalRescued       = (le.totalRescued ?? 0) + 1;
  le.active             = null;
  le.nextExpeditionTick = _nextSpawnTick();

  // Grant rewards
  const cap = (res) => state.caps[res] ?? 500;
  state.resources.gold = Math.min(cap('gold'), (state.resources.gold ?? 0) + RESCUE_GOLD);
  state.resources.food = Math.min(cap('food'), (state.resources.food ?? 0) + RESCUE_FOOD);
  awardPrestige(RESCUE_PRESTIGE, 'expedition rescued');

  // Extra fog reveal around rescue site
  revealAround(x, y);

  emit(Events.LOST_EXPEDITION_CHANGED, { rescued: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🏴 Expedition rescued! Survivors reward your empire with +${RESCUE_GOLD} gold, +${RESCUE_FOOD} food, +${RESCUE_PRESTIGE} prestige.`,
    'windfall',
  );
  return true;
}

/** Returns active expedition info or null. */
export function getLostExpeditionInfo() {
  return state.lostExpedition?.active ?? null;
}

/** Seconds remaining in the rescue window (0 when inactive). */
export function getLostExpeditionSecsLeft() {
  const a = state.lostExpedition?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN_TICKS + Math.floor(Math.random() * SPAWN_RANGE_TICKS);
}

function _countPlayerTiles() {
  if (!state.map?.tiles) return 0;
  let count = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (state.map.tiles[y][x].owner === 'player') count++;
    }
  }
  return count;
}

/** Find a neutral revealed tile at least MIN_DIST tiles from the capital. */
function _pickTarget() {
  if (!state.map?.tiles) return null;
  const candidates = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = state.map.tiles[y][x];
      const dist = Math.hypot(x - CAPITAL.x, y - CAPITAL.y);
      if (tile.revealed && tile.owner === null && dist >= MIN_DIST) {
        candidates.push({ x, y, terrainType: tile.type });
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
