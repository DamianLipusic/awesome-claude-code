/**
 * EmpireOS — Cartographer's Guild System (T179).
 *
 * When the unique `cartographersGuild` building is constructed (Iron Age),
 * the system passively:
 *   - Reveals 1 fog-of-war tile adjacent to player territory every 10 seconds
 *   - Generates a Survey Report every 8 minutes summarising border terrain
 *
 * State: state.cartographer = {
 *   nextRevealTick:  number,
 *   nextSurveyTick:  number,
 *   totalRevealed:   number,
 *   lastSurvey:      null | { lines: string[], generatedAt: number }
 * } | null
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const REVEAL_INTERVAL = 10 * TICKS_PER_SECOND;       // 10 s
const SURVEY_INTERVAL = 8 * 60 * TICKS_PER_SECOND;   // 8 min

const TERRAIN_RESOURCE = {
  grass:    { res: 'gold',  icon: '💰' },
  forest:   { res: 'wood',  icon: '🪵' },
  hills:    { res: 'stone', icon: '🪨' },
  river:    { res: 'food',  icon: '🍞' },
  mountain: { res: 'iron',  icon: '⚙️' },
};

export function initCartographer() {
  if (!state.cartographer) {
    state.cartographer = {
      nextRevealTick: state.tick + REVEAL_INTERVAL,
      nextSurveyTick: state.tick + SURVEY_INTERVAL,
      totalRevealed:  0,
      lastSurvey:     null,
    };
  }
}

export function cartographerTick() {
  if (!(state.buildings?.cartographersGuild >= 1)) return;
  if (!state.cartographer) initCartographer();

  const c = state.cartographer;

  // Passive fog reveal every 10 s
  if (state.tick >= c.nextRevealTick) {
    c.nextRevealTick = state.tick + REVEAL_INTERVAL;
    const fogTiles = _getBorderFogTiles();
    if (fogTiles.length > 0) {
      const { x, y } = fogTiles[Math.floor(Math.random() * fogTiles.length)];
      state.map.tiles[y][x].revealed = true;
      c.totalRevealed++;
      emit(Events.MAP_CHANGED, {});
    }
  }

  // Survey report every 8 min
  if (state.tick >= c.nextSurveyTick) {
    c.nextSurveyTick = state.tick + SURVEY_INTERVAL;
    c.lastSurvey = _buildSurvey();
    emit(Events.CARTOGRAPHER_SURVEYED, { survey: c.lastSurvey });
    addMessage(
      `🗺️ Cartographers' Survey ready — ${c.lastSurvey.lines[0]}`,
      'windfall',
    );
  }
}

export function getCartographerSurvey() {
  return state.cartographer?.lastSurvey ?? null;
}

/** Returns seconds until next survey, or null if guild not built. */
export function getCartographerSurveySecs() {
  if (!(state.buildings?.cartographersGuild >= 1)) return null;
  if (!state.cartographer) return null;
  return Math.max(0, Math.ceil(
    (state.cartographer.nextSurveyTick - state.tick) / TICKS_PER_SECOND,
  ));
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _getBorderFogTiles() {
  if (!state.map) return [];
  const { tiles, width, height } = state.map;
  const fog = [];
  const seen = new Set();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].owner !== 'player') continue;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!tiles[ny][nx].revealed) fog.push({ x: nx, y: ny });
      }
    }
  }
  return fog;
}

function _buildSurvey() {
  if (!state.map) return { lines: ['No map data available'], generatedAt: state.tick };
  const { tiles, width, height } = state.map;

  // Count unrevealed tiles adjacent to (8-neighbours of) player territory
  const counts = {};
  const seen = new Set();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].owner !== 'player') continue;
      for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const t = tiles[ny][nx];
        if (!t.revealed && !t.owner && TERRAIN_RESOURCE[t.type]) {
          counts[t.type] = (counts[t.type] ?? 0) + 1;
        }
      }
    }
  }

  const entries = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const lines = entries.length > 0
    ? entries.map(([type, n]) => {
        const { res, icon } = TERRAIN_RESOURCE[type];
        return `${icon} ${n} ${type} tile${n !== 1 ? 's' : ''} → ${res}`;
      })
    : ['No nearby unexplored terrain detected'];

  return { lines, generatedAt: state.tick };
}
