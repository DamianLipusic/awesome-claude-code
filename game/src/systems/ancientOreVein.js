/**
 * EmpireOS — Ancient Ore Vein Discovery System (T247).
 *
 * Every 14–18 minutes (Iron Age+, 12+ player tiles), imperial miners stumble
 * upon a rich ancient ore vein deep beneath the empire. The player has 75
 * seconds to decide how to proceed.
 *
 * Choices:
 *   ⛏️ Mine Intensively   — free → +90 iron, +50 stone, -8 morale
 *   👷 Commission Miners  — pay 60 gold → +140 iron, +80 stone, +10 prestige
 *   🚫 Seal It            — no cost, no reward
 *
 * state.oreVein = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalDiscoveries:  number,
 *   totalMined:        number,
 *   totalCommissioned: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from '../systems/prestige.js';
import { changeMorale }     from '../systems/morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND; // 14 min
const SPAWN_RANGE      = 4  * 60 * TICKS_PER_SECOND; // +0–4 min jitter
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;       // 75-second decision window
const MIN_AGE          = 2;                            // Iron Age
const MIN_PLAYER_TILES = 12;

export const MINE_IRON_REWARD    = 90;
export const MINE_STONE_REWARD   = 50;
export const MINE_MORALE_PENALTY = -8;

export const COMMISSION_GOLD_COST    = 60;
export const COMMISSION_IRON_REWARD  = 140;
export const COMMISSION_STONE_REWARD = 80;
export const COMMISSION_PRESTIGE     = 10;

// ── Init ──────────────────────────────────────────────────────────────

export function initOreVein() {
  if (!state.oreVein) {
    state.oreVein = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalDiscoveries:  0,
      totalMined:        0,
      totalCommissioned: 0,
    };
  }
  if (state.oreVein.nextSpawnTick     === undefined) state.oreVein.nextSpawnTick     = _nextSpawnTick();
  if (state.oreVein.totalDiscoveries  === undefined) state.oreVein.totalDiscoveries  = 0;
  if (state.oreVein.totalMined        === undefined) state.oreVein.totalMined        = 0;
  if (state.oreVein.totalCommissioned === undefined) state.oreVein.totalCommissioned = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────

export function oreVeinTick() {
  const ov = state.oreVein;
  if (!ov) return;

  // Expire active window
  if (ov.active) {
    if (state.tick >= ov.active.expiresAt) {
      ov.active          = null;
      ov.nextSpawnTick   = _nextSpawnTick();
      emit(Events.ORE_VEIN_CHANGED, { expired: true });
      addMessage('⛏️ The ore vein remains sealed — miners moved on.', 'info');
    }
    return;
  }

  if (state.tick < ov.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  ov.active = { expiresAt: state.tick + WINDOW_TICKS };
  ov.totalDiscoveries = (ov.totalDiscoveries ?? 0) + 1;

  emit(Events.ORE_VEIN_CHANGED, { spawned: true });
  addMessage('⛏️ Imperial miners have struck an ancient ore vein! Decide how to proceed — 75 seconds.', 'info');
}

// ── Public API ──────────────────────────────────────────────────────────

export function getActiveOreVein() {
  return state.oreVein?.active ?? null;
}

export function getOreVeinSecsLeft() {
  const a = state.oreVein?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Mine the vein intensively — free but costs morale.
 * Rewards: +90 iron, +50 stone, -8 morale.
 */
export function mineOreVein() {
  const ov = state.oreVein;
  if (!ov?.active) return { ok: false, reason: 'No active ore vein discovery.' };
  if (state.tick >= ov.active.expiresAt) return { ok: false, reason: 'The window has passed.' };

  const caps = state.caps ?? {};
  state.resources.iron  = Math.min(caps.iron  ?? 9999, (state.resources.iron  ?? 0) + MINE_IRON_REWARD);
  state.resources.stone = Math.min(caps.stone ?? 9999, (state.resources.stone ?? 0) + MINE_STONE_REWARD);
  changeMorale(MINE_MORALE_PENALTY);

  ov.active        = null;
  ov.nextSpawnTick = _nextSpawnTick();
  ov.totalMined    = (ov.totalMined ?? 0) + 1;

  emit(Events.ORE_VEIN_CHANGED, { mined: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⛏️ Miners work through the night! +${MINE_IRON_REWARD} iron, +${MINE_STONE_REWARD} stone (morale −${Math.abs(MINE_MORALE_PENALTY)}).`, 'windfall');
  return { ok: true };
}

/**
 * Commission expert miners — costs 60 gold, yields more resources + prestige.
 * Rewards: +140 iron, +80 stone, +10 prestige.
 */
export function commissionOreVein() {
  const ov = state.oreVein;
  if (!ov?.active) return { ok: false, reason: 'No active ore vein discovery.' };
  if (state.tick >= ov.active.expiresAt) return { ok: false, reason: 'The window has passed.' };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) {
    return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  }

  state.resources.gold  -= COMMISSION_GOLD_COST;
  const caps = state.caps ?? {};
  state.resources.iron  = Math.min(caps.iron  ?? 9999, (state.resources.iron  ?? 0) + COMMISSION_IRON_REWARD);
  state.resources.stone = Math.min(caps.stone ?? 9999, (state.resources.stone ?? 0) + COMMISSION_STONE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE);

  ov.active            = null;
  ov.nextSpawnTick     = _nextSpawnTick();
  ov.totalCommissioned = (ov.totalCommissioned ?? 0) + 1;

  emit(Events.ORE_VEIN_CHANGED, { commissioned: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`👷 Expert miners extract the vein! +${COMMISSION_IRON_REWARD} iron, +${COMMISSION_STONE_REWARD} stone, +${COMMISSION_PRESTIGE} prestige.`, 'windfall');
  return { ok: true };
}

/**
 * Seal the vein — no cost, no reward.
 */
export function sealOreVein() {
  const ov = state.oreVein;
  if (!ov?.active) return { ok: false, reason: 'No active ore vein discovery.' };

  ov.active        = null;
  ov.nextSpawnTick = _nextSpawnTick();

  emit(Events.ORE_VEIN_CHANGED, { sealed: true });
  addMessage('⛏️ The ore vein has been sealed. Perhaps for the best.', 'info');
  return { ok: true };
}

// ── Internal helpers ────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}