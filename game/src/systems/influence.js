/**
 * EmpireOS — Cultural Influence Expansion (T145).
 *
 * Player-owned tiles passively spread influence to adjacent revealed neutral
 * tiles at +1 point per second per adjacent player tile.  When a neutral tile
 * accumulates 100 influence it is peacefully absorbed into the empire (no
 * combat, no loot).  Enemy or barbarian capture clears accumulated influence.
 *
 * State: state.influence = { tiles: {'x,y': count}, totalConverted: 0 }
 */

import { state }             from '../core/state.js';
import { emit, Events }      from '../core/events.js';
import { addMessage }        from '../core/actions.js';
import { revealAround }      from './map.js';
import { recalcRates }       from './resources.js';

export const INFLUENCE_MAX           = 100; // points needed to absorb a tile
export const INFLUENCE_TICK_INTERVAL = 4;   // ticks between spreads (≈1 s)

let _tickCount = 0;

/** Idempotent init — safe to call multiple times. */
export function initInfluence() {
  if (!state.influence) {
    state.influence = { tiles: {}, totalConverted: 0 };
  } else {
    if (!state.influence.tiles)          state.influence.tiles = {};
    if (state.influence.totalConverted == null) state.influence.totalConverted = 0;
  }
  _tickCount = 0;
}

/**
 * Return current influence count for tile (x,y).
 * Returns 0 if no influence tracked.
 */
export function getInfluence(x, y) {
  return state.influence?.tiles?.[`${x},${y}`] ?? 0;
}

/**
 * Clear influence on a tile (called when enemy or barbarian captures it).
 */
export function clearInfluence(x, y) {
  if (!state.influence?.tiles) return;
  delete state.influence.tiles[`${x},${y}`];
}

/** Main tick — call from main.js registerSystem. */
export function influenceTick() {
  if (!state.map || !state.influence) return;

  if (++_tickCount < INFLUENCE_TICK_INTERVAL) return;
  _tickCount = 0;

  const { tiles, width, height } = state.map;
  const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const absorbedThisTick = [];

  // For each player-owned tile, add +1 influence to each eligible neighbor
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x];
      if (tile.owner !== 'player') continue;
      if (tile.type === 'capital') continue;

      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighbor = tiles[ny][nx];
        // Only spread to revealed neutral tiles (not enemy, barbarian, or player)
        if (!neighbor.revealed) continue;
        if (neighbor.owner !== null) continue; // must be neutral

        const key = `${nx},${ny}`;
        state.influence.tiles[key] = (state.influence.tiles[key] ?? 0) + 1;

        if (state.influence.tiles[key] >= INFLUENCE_MAX) {
          absorbedThisTick.push({ x: nx, y: ny });
        }
      }
    }
  }

  // Process absorptions after iteration (avoid mutating while iterating)
  for (const { x, y } of absorbedThisTick) {
    const tile = tiles[y][x];
    // Validate still neutral (another absorption may have changed adjacency)
    if (tile.owner !== null) {
      clearInfluence(x, y);
      continue;
    }
    tile.owner = 'player';
    delete state.influence.tiles[`${x},${y}`];
    state.influence.totalConverted++;
    revealAround(x, y);
    recalcRates();
    addMessage(`🌟 Cultural influence absorbed tile at (${x},${y})!`, 'windfall');
    emit(Events.INFLUENCE_CHANGED, { x, y });
    emit(Events.MAP_CHANGED, { type: 'influence', x, y });
  }
}
