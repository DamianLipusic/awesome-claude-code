/**
 * EmpireOS — Resource Node System (T104).
 *
 * Glowing resource deposits appear on revealed neutral tiles every 5–8 minutes.
 * 1–2 nodes spawn per wave. Each node carries a terrain-matched resource reward
 * that scales with game tick. Nodes expire after 4 minutes if uncollected.
 * The player collects by clicking the node tile on the map.
 *
 * state.resourceNodes = {
 *   nodes:         [{ x, y, terrain, resource, amount, expiresAt }],
 *   nextSpawnTick: number,
 * }
 */

import { state }         from '../core/state.js';
import { emit, Events }  from '../core/events.js';
import { addMessage }    from '../core/actions.js';

// ── Timing constants ───────────────────────────────────────────────────────

const SPAWN_MIN_TICKS = 1200;  // 5 min
const SPAWN_MAX_TICKS = 1920;  // 8 min
const EXPIRE_TICKS    = 960;   // 4 min

// ── Terrain → resource mapping ─────────────────────────────────────────────

const TERRAIN_NODE = {
  grass:    { resource: 'gold',  base: 40 },
  forest:   { resource: 'wood',  base: 60 },
  hills:    { resource: 'stone', base: 60 },
  river:    { resource: 'food',  base: 70 },
  mountain: { resource: 'iron',  base: 50 },
};

const RESOURCE_ICON = {
  gold:  '💰',
  food:  '🌾',
  wood:  '🪵',
  stone: '🪨',
  iron:  '⚙️',
};

// ── Internal helpers ───────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN_TICKS
       + Math.floor(Math.random() * (SPAWN_MAX_TICKS - SPAWN_MIN_TICKS));
}

function _scaledAmount(base) {
  // +10% every 2 minutes of game time
  const bonus = Math.floor(state.tick / 500) * 0.10;
  return Math.floor(base * (1 + bonus));
}

// ── Init ───────────────────────────────────────────────────────────────────

export function initResourceNodes() {
  if (!state.resourceNodes) {
    state.resourceNodes = {
      nodes:         [],
      nextSpawnTick: _nextSpawnTick(),
    };
  }
}

// ── Tick ───────────────────────────────────────────────────────────────────

export function resourceNodeTick() {
  if (!state.resourceNodes) return;
  const rn = state.resourceNodes;

  // Expire nodes whose time is up
  const before = rn.nodes.length;
  rn.nodes = rn.nodes.filter(n => state.tick < n.expiresAt);
  if (rn.nodes.length < before) {
    emit(Events.RESOURCE_NODE_CHANGED, { expired: true });
  }

  // Spawn new wave when cooldown elapses
  if (!state.map) return;
  if (state.tick >= rn.nextSpawnTick) {
    _spawnWave();
  }
}

function _spawnWave() {
  const { tiles, width, height, capital } = state.map;
  const activeCaravan = state.caravans?.active;
  const occupied = new Set(state.resourceNodes.nodes.map(n => `${n.x},${n.y}`));

  // Eligible: revealed, truly neutral (null owner), not capital, no caravan, no existing node
  const candidates = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y][x];
      if (!t.revealed)                              continue;
      if (t.owner !== null)                         continue;
      if (x === capital.x && y === capital.y)       continue;
      if (activeCaravan?.x === x && activeCaravan?.y === y) continue;
      if (occupied.has(`${x},${y}`))                continue;
      const def = TERRAIN_NODE[t.type];
      if (!def) continue;
      candidates.push({ x, y, type: t.type });
    }
  }

  state.resourceNodes.nextSpawnTick = _nextSpawnTick();

  if (candidates.length === 0) return;

  // Pick 1–2 random spots
  const count   = 1 + (Math.random() < 0.5 ? 1 : 0);
  const picked  = [...candidates].sort(() => Math.random() - 0.5).slice(0, count);
  let   spawned = 0;

  for (const { x, y, type } of picked) {
    const { resource, base } = TERRAIN_NODE[type];
    const amount = _scaledAmount(base);
    state.resourceNodes.nodes.push({ x, y, terrain: type, resource, amount, expiresAt: state.tick + EXPIRE_TICKS });
    spawned++;
  }

  if (spawned > 0) {
    addMessage(
      `✦ ${spawned} resource node${spawned > 1 ? 's' : ''} appeared on the map! Click to collect.`,
      'windfall',
    );
    emit(Events.RESOURCE_NODE_CHANGED, { spawned: true });
  }
}

// ── Public actions ─────────────────────────────────────────────────────────

/**
 * Collect the resource node at (x, y).
 * Returns { ok: boolean, reason?: string }
 */
export function collectResourceNode(x, y) {
  if (!state.resourceNodes) return { ok: false, reason: 'Resource node system not initialised.' };

  const idx = state.resourceNodes.nodes.findIndex(n => n.x === x && n.y === y);
  if (idx === -1) return { ok: false, reason: 'No resource node at this tile.' };

  const node = state.resourceNodes.nodes[idx];
  if (state.tick >= node.expiresAt) {
    state.resourceNodes.nodes.splice(idx, 1);
    return { ok: false, reason: 'The node has already expired.' };
  }

  // Grant resources
  const cap    = state.caps[node.resource] ?? Infinity;
  const before = state.resources[node.resource] ?? 0;
  state.resources[node.resource] = Math.min(cap, before + node.amount);
  const gained = state.resources[node.resource] - before;

  // Remove node
  state.resourceNodes.nodes.splice(idx, 1);

  const icon = RESOURCE_ICON[node.resource] ?? '✦';
  addMessage(`✦ Resource node collected: ${icon} +${gained} ${node.resource}!`, 'windfall');
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.RESOURCE_NODE_CHANGED, { collected: true, x, y });
  return { ok: true };
}

/**
 * Silently remove any resource node at (x, y).
 * Called when a tile is captured (by player via combat or by enemies).
 * No resources are awarded when an enemy captures a node tile.
 */
export function clearResourceNode(x, y) {
  if (!state.resourceNodes) return;
  const idx = state.resourceNodes.nodes.findIndex(n => n.x === x && n.y === y);
  if (idx !== -1) {
    state.resourceNodes.nodes.splice(idx, 1);
    emit(Events.RESOURCE_NODE_CHANGED, {});
  }
}

/** Returns the resource node at (x, y), or null if none. */
export function getNodeAt(x, y) {
  return state.resourceNodes?.nodes.find(n => n.x === x && n.y === y) ?? null;
}

/** Seconds remaining before a node expires. */
export function nodeSecsLeft(node) {
  return Math.max(0, Math.ceil((node.expiresAt - state.tick) / 4));
}

/** Total count of active (non-expired) resource nodes. */
export function activeNodeCount() {
  return state.resourceNodes?.nodes.length ?? 0;
}
