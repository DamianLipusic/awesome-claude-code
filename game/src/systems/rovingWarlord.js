/**
 * EmpireOS — Roving Warlord System (T165).
 *
 * At Iron Age+, a powerful independent warlord spawns on a revealed map tile
 * every 12–18 minutes. The player has 2 minutes to attack and capture the tile
 * before the warlord raids the treasury.
 *
 * Defeating:  +150–300 gold  · +40 prestige  · +10 morale
 * Strike:     −80–120 gold stolen from treasury
 *
 * state.warlord = {
 *   active: { name, x, y, originalDefense, strikesAt } | null,
 *   nextSpawnTick: tick,
 *   totalDefeated: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN          = 12 * 60 * TICKS_PER_SECOND;  // 12 min
const SPAWN_MAX          = 18 * 60 * TICKS_PER_SECOND;  // 18 min
const FIRST_SPAWN_DELAY  = 20 * 60 * TICKS_PER_SECOND;  // first spawn no earlier than 20 min
const STRIKE_TICKS       = 120 * TICKS_PER_SECOND;      // 2-min intercept window

const MIN_AGE            = 2;   // Iron Age+

const DEFENSE_BONUS      = { 2: 5, 3: 8 };  // added defense by age
const STEAL_MIN          = 80;
const STEAL_MAX          = 120;
const REWARD_PRESTIGE    = 40;
const REWARD_GOLD_MIN    = 150;
const REWARD_GOLD_MAX    = 300;
const REWARD_MORALE      = 10;

const WARLORD_NAMES = [
  'Warlord Gorax', 'Warlord Krev', 'Warlord Skara',
  'Warlord Dralg', 'Warlord Mhur', 'Warlord Tzek',
  'Warlord Brast', 'Warlord Vrenna',
];

// ── Public API ──────────────────────────────────────────────────────────────

export function initWarlord() {
  if (!state.warlord) {
    state.warlord = {
      active:        null,
      nextSpawnTick: state.tick + FIRST_SPAWN_DELAY,
      totalDefeated: 0,
    };
  }
  if (state.warlord.totalDefeated === undefined) state.warlord.totalDefeated = 0;
}

export function warlordTick() {
  if (!state.warlord) return;
  const w = state.warlord;

  // Strike check — warlord raids if not intercepted in time
  if (w.active && state.tick >= w.active.strikesAt) {
    _warlordStrikes();
    return;
  }

  if (w.active) return;

  // Spawn check
  if ((state.age ?? 0) < MIN_AGE) return;
  if (state.tick < w.nextSpawnTick) return;
  if (!state.map) return;

  _spawnWarlord();
}

/**
 * Called by combat._victory() when the player captures a warlord tile.
 * Restores tile state, awards bonus rewards, and schedules the next spawn.
 */
export function defeatWarlord(x, y) {
  if (!state.warlord?.active) return;
  const w = state.warlord.active;

  // Restore tile defense and remove warlord marker
  const tile = state.map?.tiles?.[y]?.[x];
  if (tile) {
    tile.defense = w.originalDefense;
    delete tile.warlord;
  }

  // Award gold bonus (emitted via RESOURCE_CHANGED in combat.js already)
  const goldReward = REWARD_GOLD_MIN + Math.floor(Math.random() * (REWARD_GOLD_MAX - REWARD_GOLD_MIN + 1));
  const goldCap    = state.caps?.gold ?? 500;
  state.resources.gold = Math.min(goldCap, (state.resources.gold ?? 0) + goldReward);

  awardPrestige(REWARD_PRESTIGE, `${w.name} defeated`);
  changeMorale(REWARD_MORALE);

  state.warlord.totalDefeated += 1;
  state.warlord.active         = null;
  state.warlord.nextSpawnTick  = state.tick + _nextSpawnDelay();

  addMessage(
    `🏆 ${w.name} defeated! Bonus: +${goldReward} gold, +${REWARD_PRESTIGE} prestige, +${REWARD_MORALE} morale!`,
    'windfall',
  );
  emit(Events.WARLORD_DEFEATED, { name: w.name, goldReward });
}

export function getActiveWarlord() {
  return state.warlord?.active ?? null;
}

export function getWarlordSecsLeft() {
  if (!state.warlord?.active) return 0;
  return Math.max(0, Math.ceil((state.warlord.active.strikesAt - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ────────────────────────────────────────────────────────

function _spawnWarlord() {
  const map   = state.map;
  const W     = map.width;
  const H     = map.height;
  const tiles = map.tiles;

  // Collect eligible tiles: revealed, non-player, non-barbarian, no existing warlord, not capital
  const eligible = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tile = tiles[y][x];
      if (!tile.revealed)          continue;
      if (tile.owner === 'player') continue;
      if (tile.owner === 'barbarian') continue;
      if (tile.warlord)            continue;
      if (tile.type === 'capital') continue;
      eligible.push({ x, y, adj: _isAdjacentToPlayer(x, y, tiles, W, H) });
    }
  }

  if (eligible.length === 0) {
    // No valid tile — defer and retry
    state.warlord.nextSpawnTick = state.tick + _nextSpawnDelay();
    return;
  }

  // Prefer tiles adjacent to player territory for immediate threat
  const preferred = eligible.filter(t => t.adj);
  const pool      = preferred.length > 0 ? preferred : eligible;
  const target    = pool[Math.floor(Math.random() * pool.length)];

  const tile           = tiles[target.y][target.x];
  const name           = WARLORD_NAMES[Math.floor(Math.random() * WARLORD_NAMES.length)];
  const defBonus       = DEFENSE_BONUS[state.age] ?? DEFENSE_BONUS[2];
  const originalDefense = tile.defense ?? 3;

  tile.defense = originalDefense + defBonus;
  tile.warlord = { name, power: tile.defense };

  state.warlord.active = {
    name,
    x:               target.x,
    y:               target.y,
    originalDefense,
    strikesAt:       state.tick + STRIKE_TICKS,
  };

  addMessage(
    `⚔️ ${name} appeared at (${target.x},${target.y})! ` +
    `Intercept on the Map tab within 2 min or lose gold!`,
    'raid',
  );
  emit(Events.WARLORD_APPEARED, { name, x: target.x, y: target.y });
  emit(Events.MAP_CHANGED, { x: target.x, y: target.y });
}

function _warlordStrikes() {
  const w    = state.warlord.active;
  const tile = state.map?.tiles?.[w.y]?.[w.x];

  // Restore tile
  if (tile) {
    tile.defense = w.originalDefense;
    delete tile.warlord;
  }

  // Steal gold from treasury
  const stealAmt  = STEAL_MIN + Math.floor(Math.random() * (STEAL_MAX - STEAL_MIN + 1));
  const goldLost  = Math.min(state.resources?.gold ?? 0, stealAmt);
  state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - goldLost);

  state.warlord.active        = null;
  state.warlord.nextSpawnTick = state.tick + _nextSpawnDelay();

  if (goldLost > 0) {
    addMessage(`💸 ${w.name} raided your treasury! Lost ${goldLost} gold.`, 'crisis');
  } else {
    addMessage(`⚔️ ${w.name} found your coffers empty and departed.`, 'warning');
  }
  emit(Events.WARLORD_STRUCK, { name: w.name, goldLost });
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.MAP_CHANGED, { x: w.x, y: w.y });
}

function _isAdjacentToPlayer(x, y, tiles, W, H) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    if (tiles[ny][nx].owner === 'player') return true;
  }
  return false;
}

function _nextSpawnDelay() {
  return SPAWN_MIN + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));
}
