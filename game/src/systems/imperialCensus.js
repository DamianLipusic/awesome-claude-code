/**
 * EmpireOS — T171: Imperial Census System.
 *
 * Every 15 minutes the empire conducts a census, measuring overall growth
 * (territory, buildings, techs, gold earned) and awarding a scaled gold
 * bonus with a prestige reward.  The first census fires after 5 minutes.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const CENSUS_INTERVAL        = 15 * 60 * TICKS_PER_SECOND; // 3600 ticks  (~15 min)
const FIRST_CENSUS_DELAY     = 5  * 60 * TICKS_PER_SECOND; // 1200 ticks  (~5 min)

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Called once during boot. Initialises state.census for a new game,
 * or leaves existing save data intact.
 */
export function initCensus() {
  if (!state.census) {
    state.census = {
      nextCensusTick: state.tick + FIRST_CENSUS_DELAY,
      lastSnapshot:   null,
      totalCompleted: 0,
    };
  }
}

/**
 * Registered as a tick system. Fires the census when the timer expires.
 */
export function censusTick() {
  if (!state.census) return;
  if (state.tick < state.census.nextCensusTick) return;
  _runCensus();
  state.census.nextCensusTick = state.tick + CENSUS_INTERVAL;
}

// ── Internal ────────────────────────────────────────────────────────────────

function _snapshot() {
  const tiles      = state.map ? _countPlayerTiles() : 0;
  const buildings  = Object.values(state.buildings ?? {}).reduce((s, n) => s + n, 0);
  const techs      = Object.keys(state.techs ?? {}).length;
  const goldEarned = Math.floor(state.stats?.goldEarned ?? 0);
  return { tiles, buildings, techs, goldEarned };
}

function _countPlayerTiles() {
  let count = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') count++;
    }
  }
  return count;
}

function _runCensus() {
  const now  = _snapshot();
  const prev = state.census.lastSnapshot;

  // Base award: tiles × 2 + buildings × 3 + techs × 5
  const baseGold = now.tiles * 2 + now.buildings * 3 + now.techs * 5;

  // Growth bonus: reward improvement since last census
  let growthBonus = 0;
  if (prev) {
    const tileDiff     = Math.max(0, now.tiles     - prev.tiles);
    const buildDiff    = Math.max(0, now.buildings - prev.buildings);
    const techDiff     = Math.max(0, now.techs     - prev.techs);
    const goldDiff     = Math.max(0, now.goldEarned - prev.goldEarned);
    growthBonus = tileDiff * 4 + buildDiff * 6 + techDiff * 10 + Math.floor(goldDiff * 0.02);
  }

  const totalGold = baseGold + growthBonus;
  const cap       = state.caps?.gold ?? 500;
  state.resources.gold = Math.min(cap, (state.resources.gold ?? 0) + totalGold);

  state.census.lastSnapshot   = now;
  state.census.totalCompleted = (state.census.totalCompleted ?? 0) + 1;

  const num     = state.census.totalCompleted;
  const ordinal = num === 1 ? '1st' : num === 2 ? '2nd' : num === 3 ? '3rd' : `${num}th`;
  const parts   = [
    `${now.tiles} tiles`,
    `${now.buildings} buildings`,
    `${now.techs} techs`,
  ];

  let msg = `📊 ${ordinal} Imperial Census: ${parts.join(', ')}. Treasury awarded +${totalGold} gold`;
  if (growthBonus > 0) msg += ` (incl. +${growthBonus} growth bonus)`;
  msg += '!';

  addMessage(msg, 'windfall');
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.CENSUS_COMPLETED, { census: state.census.totalCompleted, gold: totalGold, snapshot: now });

  // Award prestige via dynamic import (avoids circular deps)
  import('./prestige.js').then(m => m.awardPrestige(25 + now.tiles, `imperial census #${num}`));
}
