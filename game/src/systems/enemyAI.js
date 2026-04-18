/**
 * EmpireOS — Enemy AI system (T033).
 *
 * Adds two behaviours to the static enemy settlements:
 *
 *   1. Expansion — every 30–60 s, one enemy tile captures an adjacent neutral tile,
 *      slowly spreading across unexplored territory.
 *
 *   2. Counterattack — every 90–150 s, enemies attempt to recapture a player border
 *      tile. Success probability is capped at 50% and scales with enemy power
 *      (30 + tick/100) vs player defensive strength. A successful raid removes
 *      one player unit and converts the tile back to enemy ownership.
 *
 * Both timers are saved in state.enemyAI so the intervals survive save/load.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage, destroyGarrison } from '../core/actions.js';
import { recalcRates } from './resources.js';
import { UNITS } from '../data/units.js';
import { HERO_DEF } from '../data/hero.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { EMPIRES } from '../data/empires.js';
import { clearBarbarianCamp } from './barbarianCamps.js';
import { clearResourceNode } from './resourceNodes.js';
import { changeMorale, MORALE_TILE_LOST } from './morale.js';
import { BOONS } from '../data/ageBoons.js';
import { SYNERGIES } from '../data/techs.js';

// ── Timing constants ───────────────────────────────────────────────────────

const EXPAND_MIN  = 30  * TICKS_PER_SECOND;   // 120 ticks  (~30 s)
const EXPAND_MAX  = 60  * TICKS_PER_SECOND;   // 240 ticks  (~60 s)
const ATTACK_MIN  = 90  * TICKS_PER_SECOND;   // 360 ticks  (~90 s)
const ATTACK_MAX  = 150 * TICKS_PER_SECOND;   // 600 ticks  (~150 s)

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// ── Internal helpers ───────────────────────────────────────────────────────

function _inBounds(x, y) {
  return x >= 0 && x < state.map.width && y >= 0 && y < state.map.height;
}

/**
 * Interval multiplier based on difficulty.
 * Easy  → 1.5 (enemies act 50% slower)
 * Hard  → 0.7 (enemies act 30% faster)
 */
function _intervalMult() {
  const d = state.difficulty ?? 'normal';
  return d === 'easy' ? 1.5 : d === 'hard' ? 0.7 : 1.0;
}

function _nextExpand() {
  const m = _intervalMult();
  return state.tick + Math.round((EXPAND_MIN + Math.floor(Math.random() * (EXPAND_MAX - EXPAND_MIN))) * m);
}

function _nextAttack() {
  const m = _intervalMult();
  return state.tick + Math.round((ATTACK_MIN + Math.floor(Math.random() * (ATTACK_MAX - ATTACK_MIN))) * m);
}

/**
 * Pick a random enemy tile, find an adjacent neutral tile, and claim it.
 * No-ops silently if there are no valid candidates (all neutral tiles gone).
 */
function _expandEnemies() {
  if (!state.map) return;
  const { tiles, width, height } = state.map;

  // Collect all enemy tiles and shuffle for randomness
  const enemyTiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].owner === 'enemy') enemyTiles.push({ x, y });
    }
  }
  if (enemyTiles.length === 0) return;

  enemyTiles.sort(() => Math.random() - 0.5);

  for (const { x, y } of enemyTiles) {
    // Can expand into neutral tiles OR barbarian camps (T056)
    const expandable = DIRS
      .map(([dx, dy]) => ({ nx: x + dx, ny: y + dy }))
      .filter(({ nx, ny }) =>
        _inBounds(nx, ny) &&
        (tiles[ny][nx].owner === null || tiles[ny][nx].owner === 'barbarian')
      );

    if (expandable.length === 0) continue;

    const { nx, ny } = expandable[Math.floor(Math.random() * expandable.length)];
    // T056: clear barbarian camp metadata if the target was a camp
    if (tiles[ny][nx].owner === 'barbarian') clearBarbarianCamp(tiles[ny][nx]);
    // T104: clear any resource node on the tile being claimed
    clearResourceNode(nx, ny);
    tiles[ny][nx].owner   = 'enemy';
    tiles[ny][nx].faction = tiles[y][x].faction ?? null;  // T053: inherit parent faction
    emit(Events.MAP_CHANGED, {});
    return; // one expansion per interval
  }
}

/**
 * Enemies attempt to capture a player border tile (one adjacent to an enemy tile).
 * Outcome is probabilistic: win-chance = min(0.5, enemyPower / (enemyPower + playerDefense)).
 * Capital tile is immune.
 */
function _counterattack() {
  if (!state.map) return;
  const { tiles, width, height } = state.map;

  // Find player tiles adjacent to at least one enemy tile
  const borderTiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].owner !== 'player') continue;
      if (tiles[y][x].type === 'capital') continue;  // capital is immune

      const hasEnemyNeighbor = DIRS.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return _inBounds(nx, ny) && tiles[ny][nx].owner === 'enemy';
      });
      if (hasEnemyNeighbor) borderTiles.push({ x, y });
    }
  }

  if (borderTiles.length === 0) return;

  const target = borderTiles[Math.floor(Math.random() * borderTiles.length)];
  const tile   = tiles[target.y][target.x];

  // Enemy power grows slowly over game time
  const enemyPower = 30 + Math.floor(state.tick / 100);

  // Player defense = sum of each unit type's defense × count + hero bonus
  let playerDefense = 20; // base garrison
  for (const [id, count] of Object.entries(state.units)) {
    if (count <= 0) continue;
    const def = UNITS[id];
    if (def) playerDefense += def.defense * count;
  }
  if (state.hero?.recruited) playerDefense += 20;
  // T068: garrisoned units on this specific tile add their defense values
  const tileGarrison = state.garrisons?.[`${target.x},${target.y}`];
  if (tileGarrison) {
    const gDef = UNITS[tileGarrison.unitId];
    if (gDef) playerDefense += gDef.defense * tileGarrison.count;
  }

  let winChance = Math.min(0.5, enemyPower / (enemyPower + playerDefense));
  // Fortification tech: -40% enemy success chance against player tiles
  if (state.techs?.fortification) winChance *= 0.6;
  // T066: tile-level fortification adds extra defense, reducing win chance further
  if (tile.fortified) winChance *= 0.70;
  // Formation: Defensive reduces enemy counterattack success by 30%; Aggressive increases by 25% (T052)
  const formation = state.formation ?? 'balanced';
  if (formation === 'defensive')  winChance *= 0.70;
  if (formation === 'aggressive') winChance *= 1.25;
  // Aegis Ward spell: -40% enemy counterattack success while active (T055)
  if (state.spells?.activeEffects?.aegis > state.tick) winChance *= 0.6;
  // T072: castle_walls boon — -20% enemy counterattack success
  if (state.councilBoons?.includes('castle_walls')) winChance *= 0.80;
  // T077: Fortress Doctrine synergy (fortification + tactics) — -25% enemy success
  if (SYNERGIES.fortress_doctrine.techs.every(t => !!state.techs?.[t])) winChance *= 0.75;
  // T100: Fortress capital plan — -20% enemy counterattack success
  if (state.capitalPlan === 'fortress') winChance *= 0.80;
  winChance = Math.min(0.9, winChance);
  const roll = Math.random();

  if (roll < winChance) {
    // Determine which faction is attacking — prefer faction of nearest enemy neighbour (T053)
    let attackingFaction = null;
    for (const [dx, dy] of DIRS) {
      const nx = target.x + dx;
      const ny = target.y + dy;
      if (_inBounds(nx, ny) && tiles[ny][nx].owner === 'enemy' && tiles[ny][nx].faction) {
        attackingFaction = tiles[ny][nx].faction;
        break;
      }
    }

    // Enemy captures the tile — destroy any improvement, fortification, or garrison (T051/T066/T068)
    tile.owner   = 'enemy';
    tile.faction = attackingFaction;   // T053: tag with attacking empire
    if (tile.improvement) tile.improvement = null;
    if (tile.fortified) { tile.fortified = false; tile.defense = Math.max(0, tile.defense - 15); }
    destroyGarrison(target.x, target.y);  // T068: garrison units lost on capture

    // Player loses one random unit defending the border
    const unitIds = Object.keys(state.units).filter(id => (state.units[id] ?? 0) > 0);
    let lostUnit = null;
    if (unitIds.length > 0) {
      const id = unitIds[Math.floor(Math.random() * unitIds.length)];
      state.units[id]--;
      if (state.units[id] <= 0) delete state.units[id];
      lostUnit = UNITS[id]?.name ?? id;
      emit(Events.UNIT_CHANGED, {});
    }

    // T057: losing territory hurts morale
    changeMorale(MORALE_TILE_LOST);

    recalcRates();
    emit(Events.MAP_CHANGED, { x: target.x, y: target.y, outcome: 'enemy-invasion' });

    // T053: include faction name in log message
    const empDef  = attackingFaction ? EMPIRES[attackingFaction] : null;
    const fctStr  = empDef ? `${empDef.icon} ${empDef.name}` : 'Enemy forces';
    const unitStr = lostUnit ? ` You lost 1 ${lostUnit} in the defence.` : '';
    addMessage(
      `⚔️ ${fctStr} seized your tile at (${target.x},${target.y})!${unitStr} Train more troops!`,
      'raid',
    );
  } else {
    // Repelled — quiet success, no message (avoid log spam)
    // Emit nothing; let the player discover lost tiles via the map
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise or reset enemy AI state.
 * Called on boot and at the start of every new game.
 * If state.enemyAI already has valid ticks (loaded save), it is left intact.
 */
export function initEnemyAI() {
  if (!state.enemyAI) {
    state.enemyAI = {
      nextExpansionTick: _nextExpand(),
      nextAttackTick:    _nextAttack(),
    };
  }
}

/**
 * Registered as a tick system. Checks both timers each tick and fires
 * the appropriate action when the scheduled tick arrives.
 */
export function enemyAITick() {
  const ai = state.enemyAI;
  if (!ai || !state.map) return;

  if (state.tick >= ai.nextExpansionTick) {
    _expandEnemies();
    ai.nextExpansionTick = _nextExpand();
  }

  if (state.tick >= ai.nextAttackTick) {
    _counterattack();
    ai.nextAttackTick = _nextAttack();
  }
}
