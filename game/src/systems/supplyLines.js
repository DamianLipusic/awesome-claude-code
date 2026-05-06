/**
 * EmpireOS — T209: Military Supply Lines.
 *
 * Attacking tiles far from the capital (or a forward outpost) incurs a supply
 * penalty on attack power. Players can establish up to 3 Supply Outposts on
 * owned non-capital tiles (Bronze Age+, 80 gold + 40 iron each) to extend the
 * effective supply range by 5 tiles per outpost.
 *
 * Supply range: 7 tiles (Manhattan) from the capital or any outpost.
 * Penalty: −5% attack power per tile beyond supply range, max −30%.
 *
 * state.supplyLines = {
 *   outposts:    [{ x, y }],
 *   totalPlaced: number,
 * }
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';
import { CAPITAL }      from './map.js';

export const SUPPLY_RANGE    = 7;   // tiles from supply point before penalty kicks in
export const OUTPOST_RANGE   = 5;   // extra supply range per outpost
export const OUTPOST_COST    = { gold: 80, iron: 40 };
export const MAX_OUTPOSTS    = 3;
export const OUTPOST_MIN_AGE = 1;   // Bronze Age required

const PENALTY_PER_TILE = 0.05;  // −5% per tile over range
const MAX_PENALTY      = 0.30;  // max −30%

// ── Init ────────────────────────────────────────────────────────────────────

export function initSupplyLines() {
  if (!state.supplyLines) {
    state.supplyLines = { outposts: [], totalPlaced: 0 };
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the attack-power multiplier (0.70–1.0) for an attack on tile (x, y).
 * 1.0 means the tile is within supply range — no penalty applies.
 */
export function getSupplyPenalty(x, y) {
  if (!state.supplyLines) return 1.0;

  // Each supply point has an effective range.
  // Compute the minimum "excess distance" across all supply points.
  let minExcess = Math.abs(x - CAPITAL.x) + Math.abs(y - CAPITAL.y) - SUPPLY_RANGE;

  for (const op of (state.supplyLines.outposts ?? [])) {
    const dist   = Math.abs(x - op.x) + Math.abs(y - op.y);
    const excess = dist - (SUPPLY_RANGE + OUTPOST_RANGE);
    if (excess < minExcess) minExcess = excess;
  }

  if (minExcess <= 0) return 1.0;
  return Math.max(1 - MAX_PENALTY, 1 - minExcess * PENALTY_PER_TILE);
}

/**
 * Returns the outpost object at (x, y), or null if none.
 */
export function getOutpostAt(x, y) {
  return (state.supplyLines?.outposts ?? []).find(o => o.x === x && o.y === y) ?? null;
}

/**
 * Returns the current number of placed outposts.
 */
export function getOutpostCount() {
  return state.supplyLines?.outposts?.length ?? 0;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Establish a supply outpost on a player-owned tile.
 * @param {number} x
 * @param {number} y
 * @returns {{ ok: boolean, reason?: string }}
 */
export function establishOutpost(x, y) {
  if (!state.supplyLines) initSupplyLines();
  const sl = state.supplyLines;

  if ((state.age ?? 0) < OUTPOST_MIN_AGE)
    return { ok: false, reason: 'Supply outposts require Bronze Age.' };

  if (sl.outposts.length >= MAX_OUTPOSTS)
    return { ok: false, reason: `Outpost limit (${MAX_OUTPOSTS}) reached.` };

  if (getOutpostAt(x, y))
    return { ok: false, reason: 'A supply outpost already exists here.' };

  const tile = state.map?.tiles?.[y]?.[x];
  if (!tile || tile.owner !== 'player')
    return { ok: false, reason: 'Outposts can only be built on your territory.' };

  if (tile.type === 'capital')
    return { ok: false, reason: 'The capital already provides supply.' };

  if ((state.resources.gold ?? 0) < OUTPOST_COST.gold
   || (state.resources.iron ?? 0) < OUTPOST_COST.iron) {
    return { ok: false, reason: `Insufficient resources (${OUTPOST_COST.gold}💰 ${OUTPOST_COST.iron}⚙️ required).` };
  }

  state.resources.gold -= OUTPOST_COST.gold;
  state.resources.iron -= OUTPOST_COST.iron;
  sl.outposts.push({ x, y });
  sl.totalPlaced++;

  addMessage(`⛺ Supply outpost built at (${x},${y}) — attack range extended by ${OUTPOST_RANGE} tiles.`, 'info');
  emit(Events.SUPPLY_LINE_CHANGED, { x, y });
  emit(Events.MAP_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});

  return { ok: true };
}
