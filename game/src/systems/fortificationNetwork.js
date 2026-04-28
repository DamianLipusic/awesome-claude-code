/**
 * EmpireOS — Fortification Network System (T183).
 *
 * When 3+ adjacent fortified tiles owned by the same faction are connected via
 * BFS they form a Fortification Network and grant an extra +10 defense
 * (5+ tiles → +20). This applies symmetrically:
 *  • enemy networks → harder for the player to capture
 *  • player networks → harder for enemies to capture (enemyAI counterattack)
 *
 * Network membership is recomputed and cached on every MAP_CHANGED event.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// 'x,y' → group_size for every tile in a qualifying network (size ≥ 3)
let _networkSizes = {};

export function initFortificationNetwork() {
  on(Events.MAP_CHANGED, _recomputeNetworks);
  _recomputeNetworks();
}

/** Defense bonus for the tile at (x, y) if it is inside a fortification network. */
export function getFortificationNetworkBonus(x, y) {
  const sz = _networkSizes[`${x},${y}`] ?? 0;
  return sz >= 5 ? 20 : sz >= 3 ? 10 : 0;
}

/** True when the tile is part of any qualifying network (size ≥ 3). */
export function isInFortificationNetwork(x, y) {
  return (`${x},${y}`) in _networkSizes;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function _recomputeNetworks() {
  _networkSizes = {};
  if (!state.map) return;

  const { tiles, width, height } = state.map;
  const visited = new Set();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      const tile = tiles[y]?.[x];
      if (!tile || !tile.fortified || !tile.owner) continue;

      const group = _bfsGroup(x, y, tile.owner, tiles, width, height, visited);
      if (group.length >= 3) {
        for (const k of group) _networkSizes[k] = group.length;
      }
    }
  }
}

function _bfsGroup(startX, startY, owner, tiles, width, height, visited) {
  const group = [];
  const queue = [`${startX},${startY}`];
  visited.add(`${startX},${startY}`);

  while (queue.length) {
    const key = queue.shift();
    group.push(key);
    const [cx, cy] = key.split(',').map(Number);

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nkey = `${nx},${ny}`;
      if (visited.has(nkey)) continue;
      const nt = tiles[ny]?.[nx];
      if (!nt || !nt.fortified || nt.owner !== owner) continue;
      visited.add(nkey);
      queue.push(nkey);
    }
  }

  return group;
}
