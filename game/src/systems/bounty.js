/**
 * EmpireOS — Territory Bounty System (T135).
 *
 * Every 8–12 minutes (Bronze Age+) a bounty is posted on a specific enemy
 * or barbarian tile adjacent to player territory.  Capturing the tile via
 * normal combat automatically claims the reward.  Bounties expire after
 * 3 minutes if unclaimed.
 *
 * Integration points:
 *   combat.js _victory()  — calls claimBounty(x, y) after capture
 *   ui/questPanel.js      — _bountySection() shows target + countdown
 *   ui/mapPanel.js        — gold ⭐ indicator on the bounty tile
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { MAP_W, MAP_H } from './map.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { awardPrestige } from './prestige.js';

// ── Constants ────────────────────────────────────────────────────────────────

const SPAWN_MIN    = 8  * 60 * TICKS_PER_SECOND;  // 1920 ticks (8 min)
const SPAWN_MAX    = 12 * 60 * TICKS_PER_SECOND;  // 2880 ticks (12 min)
const EXPIRE_TICKS = 3  * 60 * TICKS_PER_SECOND;  // 720 ticks  (3 min)
const PRESTIGE_REWARD = 60;

const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// ── Init ─────────────────────────────────────────────────────────────────────

export function initBounty() {
  if (!state.bounty) {
    state.bounty = {
      current:         null,
      nextBountyTick:  (state.tick ?? 0) + SPAWN_MIN,
      totalClaimed:    0,
    };
  }
  // Migration guards
  if (state.bounty.nextBountyTick === undefined) {
    state.bounty.nextBountyTick = (state.tick ?? 0) + SPAWN_MIN;
  }
  if (state.bounty.totalClaimed === undefined) {
    state.bounty.totalClaimed = 0;
  }
}

// ── Tick ─────────────────────────────────────────────────────────────────────

export function bountyTick() {
  if (!state.map || !state.bounty) return;
  if (state.age < 1) return;   // Bronze Age required

  const b = state.bounty;

  // Expire stale bounty
  if (b.current && state.tick >= b.current.expiresAt) {
    const { x, y } = b.current;
    b.current = null;
    b.nextBountyTick = state.tick + SPAWN_MIN +
      Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));
    addMessage(`⭐ Bounty on (${x},${y}) expired unclaimed.`, 'info');
    emit(Events.BOUNTY_CHANGED, { type: 'expired' });
    return;
  }

  // Spawn new bounty
  if (!b.current && state.tick >= b.nextBountyTick) {
    _spawnBounty();
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Returns the active bounty object or null. */
export function getActiveBounty() {
  return state.bounty?.current ?? null;
}

/** Seconds remaining on the active bounty (0 if none). */
export function getBountySecsLeft() {
  const c = state.bounty?.current;
  if (!c) return 0;
  return Math.max(0, Math.ceil((c.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Called by combat.js _victory() after a tile is captured.
 * If the tile matches the active bounty, awards reward + prestige.
 * Returns true when a bounty was claimed.
 */
export function claimBounty(x, y) {
  const b = state.bounty;
  if (!b?.current) return false;
  if (b.current.x !== x || b.current.y !== y) return false;

  const { reward } = b.current;
  const lootParts = [];

  for (const [res, amt] of Object.entries(reward)) {
    const cap = state.caps[res] ?? 500;
    const cur = state.resources[res] ?? 0;
    const gained = Math.min(amt, cap - cur);
    if (gained > 0) {
      state.resources[res] = cur + gained;
      lootParts.push(`+${gained} ${res}`);
    }
  }

  b.current = null;
  b.totalClaimed++;
  b.nextBountyTick = state.tick + SPAWN_MIN +
    Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));

  awardPrestige(PRESTIGE_REWARD, 'bounty claimed');
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.BOUNTY_CHANGED, { type: 'claimed', x, y });
  addMessage(
    `⭐ Bounty claimed at (${x},${y})!${lootParts.length ? ` Reward: ${lootParts.join(', ')}.` : ''}`,
    'windfall',
  );
  return true;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _spawnBounty() {
  const { tiles, capital } = state.map;
  const cap = capital ?? { x: 10, y: 10 };

  // Candidate tiles: enemy or barbarian, adjacent to player territory
  const candidates = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = tiles[y][x];
      if (tile.owner !== 'enemy' && tile.owner !== 'barbarian') continue;
      if (!tile.revealed) continue;

      const adjPlayer = NEIGHBORS.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H
            && tiles[ny][nx].owner === 'player';
      });
      if (!adjPlayer) continue;

      const dist = Math.hypot(x - cap.x, y - cap.y);
      candidates.push({ x, y, dist });
    }
  }

  if (candidates.length === 0) {
    // No eligible tile — try again later
    state.bounty.nextBountyTick = state.tick + Math.floor(SPAWN_MIN / 2);
    return;
  }

  // Pick from the farther half for tactical interest
  candidates.sort((a, b) => b.dist - a.dist);
  const pool = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.5)));
  const { x, y } = pool[Math.floor(Math.random() * pool.length)];

  // Scale reward with tick — more valuable as the game progresses
  const tick = state.tick;
  const goldReward = 200 + Math.floor(tick / 100);
  const reward = {
    gold: Math.min(goldReward, 600),
    food: 50,
  };

  state.bounty.current = {
    x, y,
    terrain:   state.map.tiles[y][x].type,
    reward,
    expiresAt: state.tick + EXPIRE_TICKS,
  };

  addMessage(
    `⭐ BOUNTY posted on (${x},${y})! Capture it within 3 minutes for ` +
    `${reward.gold} gold + ${reward.food} food + ${PRESTIGE_REWARD} prestige.`,
    'windfall',
  );
  emit(Events.BOUNTY_CHANGED, { type: 'spawned', x, y });
}
