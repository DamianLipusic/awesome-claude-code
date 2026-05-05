/**
 * EmpireOS — T207: Scout Reconnaissance System.
 *
 * Allows the player to dispatch a scouting party (Bronze Age+) once every
 * 3 seasons. Scouts reveal up to SCOUT_REVEAL frontier fog tiles and
 * return a field report summarising nearby enemy strength and terrain.
 *
 * Cost:     50 gold
 * Cooldown: 3 seasons (1080 ticks at 4 ticks/s × 90 s/season)
 * Min age:  1 (Bronze Age)
 *
 * state.scouts = {
 *   cooldownUntil: tick,
 *   totalMissions: number,
 *   lastReport:    { tilesRevealed, enemyTiles, fogRemaining, terrains: string[] } | null
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

export const SCOUT_COST     = 50;
export const SCOUT_COOLDOWN = 3 * 90 * TICKS_PER_SECOND; // 1080 ticks ≈ 4 min 30 s
export const SCOUT_REVEAL   = 8;
export const SCOUT_MIN_AGE  = 1;

// ── Init ───────────────────────────────────────────────────────────────────

export function initScouts() {
  if (!state.scouts) {
    state.scouts = { cooldownUntil: 0, totalMissions: 0, lastReport: null };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getScoutInfo() {
  return state.scouts ?? null;
}

export function getScoutCooldownSecs() {
  if (!state.scouts || state.scouts.cooldownUntil <= state.tick) return 0;
  return Math.ceil((state.scouts.cooldownUntil - state.tick) / TICKS_PER_SECOND);
}

export function canDispatchScouts() {
  if ((state.age ?? 0) < SCOUT_MIN_AGE) {
    return { ok: false, reason: 'Scouts require Bronze Age technology.' };
  }
  if (!state.map) {
    return { ok: false, reason: 'No map available.' };
  }
  if (state.scouts && state.scouts.cooldownUntil > state.tick) {
    const secs = getScoutCooldownSecs();
    const mins = Math.floor(secs / 60);
    const s    = secs % 60;
    return { ok: false, reason: `Scouts on cooldown (${mins}m ${String(s).padStart(2,'0')}s remaining).` };
  }
  if ((state.resources.gold ?? 0) < SCOUT_COST) {
    return { ok: false, reason: `Need ${SCOUT_COST} gold to dispatch scouts.` };
  }
  return { ok: true };
}

/**
 * Dispatch a scouting party.
 * Reveals up to SCOUT_REVEAL frontier fog tiles and builds a field report.
 * @returns {{ ok: boolean, report?: object, reason?: string }}
 */
export function dispatchScouts() {
  if (!state.scouts) initScouts();

  const check = canDispatchScouts();
  if (!check.ok) return check;

  // Deduct cost
  state.resources.gold -= SCOUT_COST;
  emit(Events.RESOURCE_CHANGED, {});

  // Find frontier fog tiles and reveal up to SCOUT_REVEAL
  const fogTiles = _getFrontierFogTiles();
  const toReveal = fogTiles.slice(0, SCOUT_REVEAL);
  for (const { x, y } of toReveal) {
    state.map.tiles[y][x].revealed = true;
  }

  // Build field report
  const report = _buildReport(toReveal);

  // Update state
  state.scouts.cooldownUntil = state.tick + SCOUT_COOLDOWN;
  state.scouts.totalMissions++;
  state.scouts.lastReport    = report;

  if (toReveal.length > 0) emit(Events.MAP_CHANGED, {});
  emit(Events.SCOUT_MISSION, { report });

  const terrainNote = report.terrains.length
    ? ` Terrain ahead: ${report.terrains.join(', ')}.`
    : '';
  addMessage(
    `🔭 Scouts returned — ${report.tilesRevealed} tiles revealed. ` +
    `Enemy presence: ${report.enemyTiles} tiles nearby. Fog remaining: ${report.fogRemaining}.${terrainNote}`,
    'info',
  );

  return { ok: true, report };
}

// ── Internal ───────────────────────────────────────────────────────────────

function _getFrontierFogTiles() {
  if (!state.map) return [];
  const { tiles, width, height } = state.map;
  const seen = new Set();
  const result = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y][x];
      // Only expand from player-owned or player-revealed tiles
      if (t.owner !== 'player' && !(t.revealed && t.owner === 'neutral')) continue;
      for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nt  = tiles[ny][nx];
        const key = `${nx},${ny}`;
        if (!nt.revealed && !seen.has(key)) {
          seen.add(key);
          result.push({ x: nx, y: ny });
        }
      }
    }
  }
  return result;
}

const _TERRAIN_NAMES = {
  grass: 'Grasslands', forest: 'Forests', hills: 'Hills',
  river: 'Rivers', mountain: 'Mountains',
};

function _buildReport(revealedTiles) {
  const { tiles, width, height } = state.map;

  // Count all enemy-faction tiles and remaining fog
  let enemyTiles   = 0;
  let fogRemaining = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y][x];
      if (!t.revealed) {
        fogRemaining++;
      } else if (t.owner && t.owner !== 'player' && t.owner !== 'neutral' && t.owner !== 'barbarian') {
        enemyTiles++;
      }
    }
  }

  // Collect unique terrain types from newly revealed tiles
  const terrainSet = new Set();
  for (const { x, y } of revealedTiles) {
    const t = tiles[y][x];
    if (t.type && _TERRAIN_NAMES[t.type]) terrainSet.add(_TERRAIN_NAMES[t.type]);
  }

  return {
    tilesRevealed: revealedTiles.length,
    enemyTiles,
    fogRemaining,
    terrains: [...terrainSet],
  };
}
