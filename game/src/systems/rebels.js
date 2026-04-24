/**
 * EmpireOS — Rebel Uprising System (T151).
 *
 * When morale stays below 25 for 30 s (120 ticks) at Bronze Age+, rebel
 * factions can seize 1–2 player tiles. Rebels spread to adjacent player tiles
 * if not suppressed within 3 min (720 ticks). Attacking a rebel tile suppresses
 * it: tile returns to the player, morale rises +10, and +50 prestige is awarded.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { awardPrestige } from './prestige.js';
import { changeMorale } from './morale.js';
import { recalcRates } from './resources.js';

const LOW_MORALE_THRESHOLD = 25;   // morale below this triggers tracking
const LOW_MORALE_TICKS     = 120;  // 30 s at 4 ticks/s before uprising fires
const SPAWN_COOLDOWN_TICKS = 1200; // 5 min cooldown between uprisings
const SPREAD_TICKS         = 720;  // 3 min before rebels spread to adjacent tile
const MIN_AGE              = 1;    // Bronze Age required

export function initRebels() {
  if (!state.rebels) {
    state.rebels = {
      active:          [],
      lowMoraleStart:  null,
      cooldownUntil:   0,
      totalSuppressed: 0,
    };
  }
}

export function rebelTick() {
  if (!state.rebels) initRebels();
  const r = state.rebels;

  // Track how long morale has been critically low
  if ((state.morale ?? 50) < LOW_MORALE_THRESHOLD) {
    if (r.lowMoraleStart === null) r.lowMoraleStart = state.tick;
  } else {
    r.lowMoraleStart = null;  // morale recovered — reset timer
  }

  // Attempt uprising spawn when conditions are met
  if (
    r.active.length === 0 &&
    r.lowMoraleStart !== null &&
    (state.tick - r.lowMoraleStart) >= LOW_MORALE_TICKS &&
    state.tick >= r.cooldownUntil &&
    (state.age ?? 0) >= MIN_AGE
  ) {
    _spawnRebels();
  }

  // Spread: each rebel tile that has been held for SPREAD_TICKS tries to infect one
  // adjacent player tile (spread one tile at a time to avoid cascade)
  for (const rebel of [...r.active]) {
    if ((state.tick - rebel.spawnedAt) >= SPREAD_TICKS) {
      _spreadRebel(rebel);
      rebel.spawnedAt = state.tick;  // reset so it doesn't immediately spread again
    }
  }
}

function _playerTiles() {
  if (!state.map) return [];
  const result = [];
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      const t = state.map.tiles[y][x];
      if (t.owner === 'player' && t.type !== 'capital') result.push({ x, y, t });
    }
  }
  return result;
}

function _spawnRebels() {
  const playerTiles = _playerTiles();
  if (playerTiles.length < 3) return;  // keep capital area safe

  const count = Math.min(2, Math.max(1, Math.floor(playerTiles.length * 0.10)));
  const shuffled = playerTiles.slice().sort(() => Math.random() - 0.5);
  const chosen   = shuffled.slice(0, count);

  for (const { x, y, t } of chosen) {
    t.owner = 'rebel';
    state.rebels.active.push({ x, y, spawnedAt: state.tick });
  }

  state.rebels.lowMoraleStart = null;
  state.rebels.cooldownUntil  = state.tick + SPAWN_COOLDOWN_TICKS;

  emit(Events.REBEL_UPRISING, { count: chosen.length });
  emit(Events.MAP_CHANGED, { outcome: 'rebel_uprising' });
  addMessage(
    `🔥 Rebel Uprising! Morale collapse has sparked revolt — ${chosen.length} tile${chosen.length > 1 ? 's have' : ' has'} fallen to rebels. Reclaim them before they spread!`,
    'danger',
  );
}

function _spreadRebel(rebel) {
  if (!state.map) return;
  const { tiles, width, height } = state.map;
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dx, dy] of neighbors) {
    const nx = rebel.x + dx;
    const ny = rebel.y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const neighbor = tiles[ny][nx];
    if (neighbor.owner === 'player' && neighbor.type !== 'capital') {
      neighbor.owner = 'rebel';
      state.rebels.active.push({ x: nx, y: ny, spawnedAt: state.tick });
      emit(Events.MAP_CHANGED, { outcome: 'rebel_spread' });
      addMessage(`⚠️ Rebels spread to (${nx},${ny})! Suppress them before more territory falls.`, 'danger');
      return;  // spread one tile per rebel per check
    }
  }
}

/**
 * Suppress a rebel-held tile after a victorious attack.
 * Returns true if a rebel was found and cleaned up at (x, y).
 * Called from combat.js after _victory() sets tile.owner = 'player'.
 */
export function suppressRebel(x, y) {
  if (!state.rebels?.active) return false;
  const idx = state.rebels.active.findIndex(r => r.x === x && r.y === y);
  if (idx === -1) return false;

  state.rebels.active.splice(idx, 1);
  state.rebels.totalSuppressed = (state.rebels.totalSuppressed ?? 0) + 1;

  changeMorale(10);
  awardPrestige(50, 'rebel uprising suppressed');

  const allClear = state.rebels.active.length === 0;
  emit(Events.REBELS_SUPPRESSED, { x, y, allClear });

  if (allClear) {
    addMessage('✅ All rebels suppressed! Order restored to the empire. +10 morale, +50 prestige.', 'windfall');
  } else {
    const rem = state.rebels.active.length;
    addMessage(`⚔️ Rebel forces routed at (${x},${y}). ${rem} rebel tile${rem > 1 ? 's remain' : ' remains'}.`, 'info');
  }

  recalcRates();
  return true;
}

/** Returns the active rebel tiles array (read-only intent). */
export function getActiveRebels() {
  return state.rebels?.active ?? [];
}
