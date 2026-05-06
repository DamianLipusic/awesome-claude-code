/**
 * EmpireOS — Barbarian Encampments System (T056 + T079).
 *
 * Neutral revealed tiles periodically become Barbarian Camps:
 *   - tile.owner = 'barbarian'
 *   - Defense boosted by +20–35 (stored so _victory() sees it for the preview)
 *   - Loot doubled at spawn time (captured by regular _victory() in combat.js)
 *   - Max 5 camps at once; one spawn attempt every 45–90 seconds
 *
 * T079 — Grand Siege:
 *   When 3+ camps coexist and a cooldown has elapsed, the hordes organise a
 *   Grand Siege on the capital.  A 30-second warning fires first so the player
 *   can muster forces.  If player attack power ≥ 55% of combined camp defenses
 *   the siege is repelled (camps destroyed + loot + morale); otherwise the
 *   capital is struck (resource loss + morale penalty) and camps remain.
 *
 * Integration points:
 *   combat.js _victory()     — player captures, gets doubled loot + territory
 *   enemyAI.js _expandEnemies() — enemy expansion can clear a barbarian camp
 *   mapPanel.js              — dark maroon tint, skull icon, tooltip label
 *   minimap.js               — dark red color for barbarian tiles
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { MAP_W, MAP_H } from './map.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { UNITS } from '../data/units.js';
import { changeMorale } from './morale.js';
import { getReputationSpawnMult } from './reputation.js'; // T211

// ── Camp constants ─────────────────────────────────────────────────────────

const MAX_CAMPS        = 5;
const SPAWN_MIN        = 45 * TICKS_PER_SECOND;   // 180 ticks  (45 s)
const SPAWN_MAX        = 90 * TICKS_PER_SECOND;   // 360 ticks  (90 s)
const MIN_DIST_CAPITAL = 4;    // camps can't appear too close to the player
const DEFENSE_BONUS_MIN = 20;
const DEFENSE_BONUS_MAX = 35;
const LOOT_MULT         = 2;   // loot multiplier at spawn

// Base loot values mirroring map.js TILE_LOOT (used when tile.loot is empty)
const BASE_LOOT = {
  grass:    { gold: 20 },
  forest:   { wood: 35 },
  hills:    { stone: 35 },
  river:    { food: 30, gold: 10 },
  mountain: { iron: 25, stone: 15 },
};

// ── T079: Grand Siege constants ────────────────────────────────────────────

const SIEGE_THRESHOLD  = 3;                        // minimum camps required
const SIEGE_WARN_TICKS = 30 * TICKS_PER_SECOND;   // 120 ticks — 30s warning window
const SIEGE_INTERVAL   = 12 * 60 * TICKS_PER_SECOND; // 2880 ticks — 12 min cooldown
const SIEGE_WIN_RATIO  = 0.55;                     // player needs 55% of barbPower to repel
const SIEGE_REPEL_LOOT = { gold: 200, food: 100, iron: 50 }; // reward on repel
const SIEGE_MORALE_WIN = +15;
const SIEGE_MORALE_LOSS = -20;

// ── Init ───────────────────────────────────────────────────────────────────

export function initBarbarians() {
  if (!state.barbarians) {
    state.barbarians = {
      nextSpawnTick: (state.tick ?? 0) + SPAWN_MIN,
      nextSiegeTick: (state.tick ?? 0) + SIEGE_INTERVAL,
      siegeWarning:  null,   // tick when siege will fire (null = no pending siege)
    };
  }
  // Migration guards for older saves
  if (state.barbarians.nextSiegeTick === undefined) {
    state.barbarians.nextSiegeTick = state.tick + SIEGE_INTERVAL;
  }
  if (state.barbarians.siegeWarning === undefined) {
    state.barbarians.siegeWarning = null;
  }
}

// ── Tick ───────────────────────────────────────────────────────────────────

/**
 * Called once per game tick. Handles camp spawning and Grand Siege logic.
 */
export function barbarianTick() {
  if (!state.map || !state.barbarians) return;

  // Count current camps
  const { tiles } = state.map;
  let campCount = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (tiles[y][x].owner === 'barbarian') campCount++;
    }
  }

  // Spawn logic
  if (state.tick >= state.barbarians.nextSpawnTick) {
    if (campCount < MAX_CAMPS) _spawnCamp(tiles);
    const range = SPAWN_MAX - SPAWN_MIN;
    const spawnMult = getReputationSpawnMult(); // T211: Feared tier reduces spawn interval
    state.barbarians.nextSpawnTick = state.tick + Math.round((SPAWN_MIN + Math.floor(Math.random() * range)) * spawnMult);
    // Recount after potential spawn
    campCount = 0;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (tiles[y][x].owner === 'barbarian') campCount++;
  }

  // T079: Grand Siege check
  _siegeCheck(campCount);
}

/**
 * Seconds remaining until the Grand Siege launches (0 if no active warning).
 * Exported for use by the HUD badge in main.js.
 */
export function getSiegeSecsLeft() {
  if (!state.barbarians?.siegeWarning) return 0;
  return Math.max(0, Math.ceil((state.barbarians.siegeWarning - state.tick) / TICKS_PER_SECOND));
}

// ── Internal ───────────────────────────────────────────────────────────────

function _siegeCheck(campCount) {
  const b = state.barbarians;

  // Active warning: check if it's time to fire the siege
  if (b.siegeWarning !== null && state.tick >= b.siegeWarning) {
    _launchSiege();
    b.siegeWarning  = null;
    b.nextSiegeTick = state.tick + SIEGE_INTERVAL;
    return;
  }

  // New siege: trigger warning if threshold met, no warning active, cooldown elapsed
  if (
    b.siegeWarning === null &&
    campCount >= SIEGE_THRESHOLD &&
    state.tick >= b.nextSiegeTick
  ) {
    b.siegeWarning = state.tick + SIEGE_WARN_TICKS;
    addMessage(
      `⚔️ GRAND SIEGE WARNING! ${campCount} barbarian camps are massing on your capital! ` +
      `You have 30 seconds to muster your forces!`,
      'raid',
    );
    emit(Events.BARBARIAN_SIEGE, { type: 'warning' });
    emit(Events.MAP_CHANGED, {});
  }
}

function _launchSiege() {
  const playerPow = _playerPower();
  const barbPow   = _barbarianPower();
  const repelled  = playerPow >= barbPow * SIEGE_WIN_RATIO;

  if (repelled) {
    // Destroy all barbarian camps
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = state.map.tiles[y][x];
        if (tile.owner === 'barbarian') {
          tile.owner = null;
          if (tile.barbDefenseBase !== undefined) {
            tile.defense = tile.barbDefenseBase;
            delete tile.barbDefenseBase;
          }
        }
      }
    }

    // Award loot
    const lootParts = [];
    for (const [res, amt] of Object.entries(SIEGE_REPEL_LOOT)) {
      if (state.resources[res] !== undefined) {
        const gained = Math.min(amt, (state.caps[res] ?? 500) - (state.resources[res] ?? 0));
        if (gained > 0) {
          state.resources[res] = (state.resources[res] ?? 0) + gained;
          lootParts.push(`+${gained} ${res}`);
        }
      }
    }

    changeMorale(SIEGE_MORALE_WIN);
    emit(Events.MAP_CHANGED, {});
    emit(Events.RESOURCE_CHANGED, {});
    addMessage(
      `🏆 GRAND SIEGE REPELLED! Your forces crushed the barbarian horde!` +
      (lootParts.length ? ` Plundered: ${lootParts.join(', ')}.` : ''),
      'combat-win',
    );
    emit(Events.BARBARIAN_SIEGE, { type: 'repelled' });
  } else {
    // Siege strikes: penalty
    const goldLoss = Math.min(50, Math.floor(state.resources.gold ?? 0));
    const foodLoss = Math.min(30, Math.floor(state.resources.food ?? 0));
    state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - goldLoss);
    state.resources.food = Math.max(0, (state.resources.food ?? 0) - foodLoss);

    changeMorale(SIEGE_MORALE_LOSS);
    emit(Events.RESOURCE_CHANGED, {});
    addMessage(
      `💀 GRAND SIEGE STRUCK! The barbarian horde swept through your lands! ` +
      `Lost ${goldLoss} gold and ${foodLoss} food. Morale crumbles!`,
      'raid',
    );
    emit(Events.BARBARIAN_SIEGE, { type: 'struck' });
  }
}

/**
 * Simplified player attack power for siege resolution.
 * Mirrors core combat.js calculation without side effects.
 */
function _playerPower() {
  let power = 0;
  for (const [id, count] of Object.entries(state.units ?? {})) {
    const def = UNITS[id];
    if (def && count > 0) power += def.attack * count;
  }
  if (state.hero?.recruited) power += 30;   // flat hero bonus
  if (state.techs?.tactics)  power *= 1.25;
  if (state.techs?.steel)    power *= 1.50;
  return power;
}

function _barbarianPower() {
  if (!state.map) return 0;
  let power = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'barbarian') power += (tile.defense ?? 30);
    }
  }
  return power;
}

function _spawnCamp(tiles) {
  const capital = state.map.capital ?? { x: 10, y: 10 };

  // Gather candidates: neutral + revealed + not too close to capital
  const candidates = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = tiles[y][x];
      if (tile.owner !== null) continue;   // must be neutral
      if (!tile.revealed) continue;         // must be visible to the player
      const dist = Math.hypot(x - capital.x, y - capital.y);
      if (dist < MIN_DIST_CAPITAL) continue;
      candidates.push({ x, y, dist });
    }
  }

  if (candidates.length === 0) return;

  // Prefer tiles further away (more tactically interesting)
  candidates.sort((a, b) => b.dist - a.dist);
  const topSlice = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.4)));
  const { x, y } = topSlice[Math.floor(Math.random() * topSlice.length)];
  const tile = tiles[y][x];

  // Mark as barbarian camp
  tile.owner = 'barbarian';

  // Boost defense
  const bonus = DEFENSE_BONUS_MIN + Math.floor(Math.random() * (DEFENSE_BONUS_MAX - DEFENSE_BONUS_MIN + 1));
  tile.barbDefenseBase = tile.defense;
  tile.defense += bonus;

  // Double loot (seed from base if tile.loot is empty/undefined)
  const baseLoot = { ...(tile.loot && Object.keys(tile.loot).length ? tile.loot : (BASE_LOOT[tile.type] ?? {})) };
  const doubledLoot = {};
  for (const [res, amt] of Object.entries(baseLoot)) {
    doubledLoot[res] = Math.round(amt * LOOT_MULT);
  }
  tile.loot = doubledLoot;

  emit(Events.MAP_CHANGED, {});
  addMessage(
    `💀 Barbarian camp raised at (${x},${y})! High defense but rich spoils await the bold.`,
    'raid',
  );
}

/**
 * Restore a barbarian tile to neutral after it is cleared by the enemy AI.
 * (Player captures are handled by combat.js _victory() which sets owner='player'.)
 */
export function clearBarbarianCamp(tile) {
  tile.owner = null;
  if (tile.barbDefenseBase !== undefined) {
    tile.defense = tile.barbDefenseBase;
    delete tile.barbDefenseBase;
  }
}

// ── T139: Barbarian bribe ─────────────────────────────────────────────────

export const BRIBE_COST = 200;

/**
 * Pay gold to bribe the barbarian warlords and cancel an incoming Grand Siege.
 * Resets the siege cooldown so the next siege won't trigger for a full interval.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function bribeBarbarians() {
  if (!state.barbarians?.siegeWarning) {
    return { ok: false, reason: 'No Grand Siege is currently threatening.' };
  }
  if ((state.resources?.gold ?? 0) < BRIBE_COST) {
    return { ok: false, reason: `Need ${BRIBE_COST} gold to bribe the barbarians.` };
  }
  state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - BRIBE_COST);
  state.barbarians.siegeWarning  = null;
  state.barbarians.nextSiegeTick = state.tick + SIEGE_INTERVAL;
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.BARBARIAN_SIEGE, { type: 'bribed' });
  addMessage(
    `💰 Barbarian warlords bribed — Grand Siege called off! -${BRIBE_COST} gold.`,
    'info',
  );
  return { ok: true };
}
