/**
 * EmpireOS — Village Tribute Caravan System (T246).
 *
 * Every 10–14 minutes (Bronze Age+, 10+ player tiles), neutral villages
 * send a tribute caravan to the capital. The player has 90 seconds to choose
 * one of three resource gift options; unclaimed caravans depart without reward.
 *
 * Tribute options (randomised amounts within ranges):
 *   💰 Gold Tribute   — 80–120 gold
 *   🌾 Food Tribute   — 120–150 food
 *   📦 Supply Tribute — 50 wood + 40 stone + 30 iron
 *
 * state.tributeCaravan = {
 *   active:         { options: [...], expiresAt: tick } | null,
 *   nextSpawnTick:  tick,
 *   totalCaravans:  number,
 *   totalClaimed:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 10 * 60 * TICKS_PER_SECOND;  // 10 min
const SPAWN_RANGE      = 4  * 60 * TICKS_PER_SECOND;  // +0–4 min jitter
const WINDOW_TICKS     = 90 * TICKS_PER_SECOND;        // 90 sec decision window
const MIN_AGE          = 1;                             // Bronze Age
const MIN_PLAYER_TILES = 10;

// ── Init ──────────────────────────────────────────────────────────────────

export function initTributeCaravan() {
  if (!state.tributeCaravan) {
    state.tributeCaravan = {
      active:        null,
      nextSpawnTick: _nextSpawnTick(),
      totalCaravans: 0,
      totalClaimed:  0,
    };
  }
  if (state.tributeCaravan.nextSpawnTick === undefined) state.tributeCaravan.nextSpawnTick = _nextSpawnTick();
  if (state.tributeCaravan.totalCaravans === undefined) state.tributeCaravan.totalCaravans = 0;
  if (state.tributeCaravan.totalClaimed  === undefined) state.tributeCaravan.totalClaimed  = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function tributeCaravanTick() {
  const tc = state.tributeCaravan;
  if (!tc) return;

  // Expire active caravan
  if (tc.active) {
    if (state.tick >= tc.active.expiresAt) {
      tc.active        = null;
      tc.nextSpawnTick = _nextSpawnTick();
      emit(Events.TRIBUTE_CARAVAN_CHANGED, { expired: true });
      addMessage('🐪 The tribute caravan departed without a response.', 'info');
    }
    return;
  }

  if (state.tick < tc.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  tc.active = {
    options:   _buildOptions(),
    expiresAt: state.tick + WINDOW_TICKS,
  };
  tc.totalCaravans = (tc.totalCaravans ?? 0) + 1;

  emit(Events.TRIBUTE_CARAVAN_CHANGED, { spawned: true });
  addMessage('🐪 A tribute caravan from the outer villages arrives at your gates! Choose a gift — 90 seconds.', 'info');
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns the active caravan object or null. */
export function getActiveTributeCaravan() {
  return state.tributeCaravan?.active ?? null;
}

/** Seconds remaining on the active caravan window. */
export function getTributeCaravanSecsLeft() {
  const a = state.tributeCaravan?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Claim one of the three tribute options.
 * @param {number} idx — 0, 1, or 2
 * @returns {{ ok: boolean, reason?: string }}
 */
export function claimTribute(idx) {
  const tc = state.tributeCaravan;
  if (!tc?.active) return { ok: false, reason: 'No active tribute caravan.' };
  if (state.tick >= tc.active.expiresAt) return { ok: false, reason: 'The caravan has departed.' };

  const option = tc.active.options[idx];
  if (!option) return { ok: false, reason: 'Invalid option.' };

  // Apply reward
  for (const [res, amt] of Object.entries(option.reward)) {
    const cap = state.caps?.[res] ?? 9999;
    state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
  }

  tc.active        = null;
  tc.nextSpawnTick = _nextSpawnTick();
  tc.totalClaimed  = (tc.totalClaimed ?? 0) + 1;

  emit(Events.TRIBUTE_CARAVAN_CHANGED, { claimed: true });
  emit(Events.RESOURCE_CHANGED, {});

  const rewardStr = Object.entries(option.reward)
    .map(([r, a]) => `+${a} ${r}`)
    .join(', ');
  addMessage(`🐪 ${option.title} accepted! ${rewardStr}.`, 'windfall');
  return { ok: true };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}

function _ri(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function _buildOptions() {
  const gold  = _ri(80, 120);
  const food  = _ri(120, 150);
  return [
    {
      id:     'gold_tribute',
      icon:   '💰',
      title:  'Gold Tribute',
      desc:   `Merchants bearing ${gold} gold coins from the outer settlements.`,
      reward: { gold },
    },
    {
      id:     'food_tribute',
      icon:   '🌾',
      title:  'Food Tribute',
      desc:   `Farmers delivering ${food} bushels of grain and preserved provisions.`,
      reward: { food },
    },
    {
      id:     'supply_tribute',
      icon:   '📦',
      title:  'Supply Tribute',
      desc:   'Labourers hauling a mixed cargo of building materials from village stockpiles.',
      reward: { wood: 50, stone: 40, iron: 30 },
    },
  ];
}
