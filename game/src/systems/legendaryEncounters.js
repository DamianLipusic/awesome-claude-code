/**
 * EmpireOS — Legendary Encounters System (T216).
 *
 * At Bronze Age+, a legendary creature appears on a revealed map tile every
 * 15–20 minutes.  The player attacks the tile as normal combat; on victory
 * the creature is removed and special rewards are applied.  The creature
 * expires after 5 minutes if not defeated.  Max 1 legendary at a time.
 *
 * Creature types (chosen based on tile terrain):
 *   Ancient Dragon (🐉)   — mountain tiles preferred;  defense ×3.5
 *                            Reward: +200 gold · +40 prestige · +8 morale
 *   Spectral Guardian (👻) — any revealed tile;         defense ×2.5
 *                            Reward: +80 mana · 10% bonus research progress on active queue
 *   Sea Hydra (🐍)         — river tiles only;          defense ×3.0
 *                            Reward: +100 gold · +30 iron · +5 morale
 *
 * State: state.legendary = {
 *   current: {
 *     type:           string,
 *     x:              number,
 *     y:              number,
 *     icon:           string,
 *     name:           string,
 *     defenseBoost:   number,   // multiplier applied to tile base defense
 *     expiresAt:      number,   // tick when creature departs
 *   } | null,
 *   nextSpawnTick:  number,
 *   totalDefeated:  number,
 *   history:        [{ type, name, icon, tick, reward }],  // last 5 entries
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_AGE          = 1;   // Bronze Age+
const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;  // 15 min
const SPAWN_MAX        = 20 * 60 * TICKS_PER_SECOND;  // 20 min
const FIRST_SPAWN_MIN  = 10 * 60 * TICKS_PER_SECOND;  // first spawn no earlier than 10 min
const EXPIRE_TICKS     = 5 * 60 * TICKS_PER_SECOND;   // 5 min to defeat before it departs

export const LEGENDARY_TYPES = {
  dragon: {
    type:         'dragon',
    icon:         '🐉',
    name:         'Ancient Dragon',
    desc:         'A legendary dragon nests on this tile. Its scales repel all but the mightiest armies.',
    defenseBoost: 3.5,
    terrains:     ['mountain'],  // preferred terrain
    rewardDesc:   '+200 gold · +40 prestige · +8 morale',
  },
  guardian: {
    type:         'guardian',
    icon:         '👻',
    name:         'Spectral Guardian',
    desc:         'An ancient spirit guards forgotten knowledge. Defeat it to claim its wisdom.',
    defenseBoost: 2.5,
    terrains:     null,          // any terrain
    rewardDesc:   '+80 mana · research progress boost',
  },
  hydra: {
    type:         'hydra',
    icon:         '🐍',
    name:         'Sea Hydra',
    desc:         'A many-headed hydra lurks in the river shallows, terrorising your river trade.',
    defenseBoost: 3.0,
    terrains:     ['river'],     // river tiles only
    rewardDesc:   '+100 gold · +30 iron · +5 morale',
  },
};

const HISTORY_MAX = 5;

// ── Init ───────────────────────────────────────────────────────────────────

export function initLegendary() {
  if (!state.legendary) {
    state.legendary = {
      current:       null,
      nextSpawnTick: state.tick + FIRST_SPAWN_MIN,
      totalDefeated: 0,
      history:       [],
    };
  } else {
    if (!state.legendary.history) state.legendary.history = [];
    if (state.legendary.totalDefeated == null) state.legendary.totalDefeated = 0;
    // Validate current encounter still refers to a valid map tile
    if (state.legendary.current) {
      const { x, y } = state.legendary.current;
      const tile = state.map?.tiles?.[y]?.[x];
      if (!tile || tile.owner !== 'legendary') state.legendary.current = null;
    }
  }
}

// ── Tick System ────────────────────────────────────────────────────────────

export function legendaryTick() {
  if (!state.legendary || !state.map) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  const leg = state.legendary;

  // Expire current encounter
  if (leg.current && state.tick >= leg.current.expiresAt) {
    _expireCurrent();
    return;
  }

  // Spawn new encounter
  if (!leg.current && state.tick >= leg.nextSpawnTick) {
    _trySpawn();
  }
}

// ── Spawn Logic ────────────────────────────────────────────────────────────

function _trySpawn() {
  const leg    = state.legendary;
  const tiles  = state.map.tiles;
  const height = state.map.height;
  const width  = state.map.width;

  // Collect candidate tiles: revealed, not player-owned, not already special
  const candidates = { dragon: [], guardian: [], hydra: [] };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y][x];
      if (!t.revealed) continue;
      if (t.owner === 'player') continue;
      if (t.owner === 'legendary') continue;
      if (t.discovery) continue;

      if (t.type === 'mountain') candidates.dragon.push({ x, y, tile: t });
      if (t.type === 'river')    candidates.hydra.push({ x, y, tile: t });
      candidates.guardian.push({ x, y, tile: t });
    }
  }

  // Weighted random type selection
  let typeKey;
  const roll = Math.random();
  if (candidates.dragon.length >= 1 && roll < 0.35) {
    typeKey = 'dragon';
  } else if (candidates.hydra.length >= 1 && roll < 0.60) {
    typeKey = 'hydra';
  } else if (candidates.guardian.length >= 1) {
    typeKey = 'guardian';
  } else if (candidates.dragon.length >= 1) {
    typeKey = 'dragon';
  } else if (candidates.hydra.length >= 1) {
    typeKey = 'hydra';
  } else {
    // No valid tiles; reschedule soon
    leg.nextSpawnTick = state.tick + TICKS_PER_SECOND * 30;
    return;
  }

  const pool = candidates[typeKey];
  const { x, y, tile } = pool[Math.floor(Math.random() * pool.length)];
  const def = LEGENDARY_TYPES[typeKey];

  // Mark tile
  tile.owner = 'legendary';

  leg.current = {
    type:         typeKey,
    x,
    y,
    icon:         def.icon,
    name:         def.name,
    defenseBoost: def.defenseBoost,
    expiresAt:    state.tick + EXPIRE_TICKS,
  };

  // Schedule next spawn (after current is gone)
  leg.nextSpawnTick = state.tick + SPAWN_MIN
    + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));

  addMessage(
    `${def.icon} A ${def.name} has been sighted at (${x},${y})! Attack the tile to defeat it.`,
    'windfall',
  );
  emit(Events.LEGENDARY_CHANGED, { action: 'spawned', x, y, type: typeKey });
  emit(Events.MAP_CHANGED, { legendary: true });
}

function _expireCurrent() {
  const leg = state.legendary;
  if (!leg.current) return;
  const { x, y, icon, name } = leg.current;
  const tile = state.map?.tiles?.[y]?.[x];
  if (tile) tile.owner = null;  // revert to neutral
  addMessage(`${icon} The ${name} has departed from (${x},${y}).`, 'info');
  leg.current = null;
  emit(Events.LEGENDARY_CHANGED, { action: 'expired', x, y });
  emit(Events.MAP_CHANGED, {});
}

// ── Defeat Handling (called from combat.js) ────────────────────────────────

/**
 * Called when the player successfully captures a tile with owner='legendary'.
 * Grants rewards and clears the encounter.
 */
export function defeatLegendary(x, y) {
  const leg = state.legendary;
  if (!leg?.current) return;
  if (leg.current.x !== x || leg.current.y !== y) return;

  const typeKey = leg.current.type;
  const def     = LEGENDARY_TYPES[typeKey];
  const reward  = _applyReward(typeKey);

  leg.totalDefeated = (leg.totalDefeated ?? 0) + 1;
  leg.history.unshift({
    type:   typeKey,
    name:   def.name,
    icon:   def.icon,
    tick:   state.tick,
    reward: def.rewardDesc,
  });
  if (leg.history.length > HISTORY_MAX) leg.history.pop();

  leg.current = null;

  addMessage(
    `${def.icon} ${def.name} defeated! ${reward}`,
    'windfall',
  );
  emit(Events.LEGENDARY_CHANGED, { action: 'defeated', x, y, type: typeKey });
  emit(Events.RESOURCE_CHANGED, {});
}

function _applyReward(typeKey) {
  const goldCap = state.caps.gold ?? 500;
  const manaCap = state.caps.mana ?? 200;

  switch (typeKey) {
    case 'dragon': {
      state.resources.gold = Math.min(goldCap, (state.resources.gold ?? 0) + 200);
      awardPrestige(40, 'Ancient Dragon defeated');
      changeMorale(8, 'Ancient Dragon defeated');
      return '+200 gold · +40 prestige · +8 morale';
    }
    case 'guardian': {
      state.resources.mana = Math.min(manaCap, (state.resources.mana ?? 0) + 80);
      // Boost active research by 10% of remaining ticks
      const q = state.researchQueue;
      if (q?.length > 0) {
        const active = q[0];
        const boost  = Math.floor((active.remaining ?? active.totalTicks ?? 60) * 0.10);
        active.remaining = Math.max(1, (active.remaining ?? active.totalTicks) - boost);
      }
      return '+80 mana · research progress boosted';
    }
    case 'hydra': {
      state.resources.gold = Math.min(goldCap, (state.resources.gold ?? 0) + 100);
      const ironCap = state.caps.iron ?? 300;
      state.resources.iron = Math.min(ironCap, (state.resources.iron ?? 0) + 30);
      changeMorale(5, 'Sea Hydra defeated');
      return '+100 gold · +30 iron · +5 morale';
    }
    default: return '';
  }
}

// ── Public Helpers ─────────────────────────────────────────────────────────

/** Return defense boost for a legendary tile (or 1.0 if none). */
export function getLegendaryDefenseBoost(x, y) {
  const leg = state.legendary;
  if (!leg?.current) return 1.0;
  if (leg.current.x === x && leg.current.y === y) return leg.current.defenseBoost;
  return 1.0;
}

/** Returns the current legendary encounter (or null). */
export function getActiveLegendary() {
  return state.legendary?.current ?? null;
}

/** Returns seconds until current encounter expires (or 0). */
export function getLegendarySecsLeft() {
  const leg = state.legendary;
  if (!leg?.current) return 0;
  return Math.max(0, Math.ceil((leg.current.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/** Returns the legendary history array. */
export function getLegendaryHistory() {
  return state.legendary?.history ?? [];
}
