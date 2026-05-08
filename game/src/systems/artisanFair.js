/**
 * EmpireOS — Artisan Fair (T242).
 *
 * Every 16-20 minutes (Iron Age+, 10+ player tiles), local artisans hold a
 * fair at the empire's market square. The player has 80 seconds to respond;
 * the encounter card appears in the Quest panel.
 *
 * Player choices:
 *   Commission — pay 40 wood + 30 stone → +150 gold + +10 morale
 *                (artisans craft luxury goods for immediate profit)
 *   Export     — pay 50 food → +100 wood + +80 stone + +30 prestige
 *                (artisans export crafts in exchange for raw materials)
 *   Decline    — no cost, no reward; dismisses the event
 *
 * Spawn conditions:
 *   - Iron Age (age ≥ 2)
 *   - 10+ player-owned map tiles
 *   - No active event
 *   - 16-20 min spawn interval
 *
 * state.artisanFair = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalFairs:          number,
 *   totalCommissioned:   number,
 *   totalExported:       number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 16 * 60 * TICKS_PER_SECOND;  // 16 min
const SPAWN_RANGE      = 4  * 60 * TICKS_PER_SECOND;  // +0-4 min jitter
const FAIR_WINDOW      = 80 * TICKS_PER_SECOND;        // 80 sec
const MIN_AGE          = 2;                             // Iron Age
const MIN_PLAYER_TILES = 10;

export const COMMISSION_WOOD_COST   = 40;
export const COMMISSION_STONE_COST  = 30;
export const COMMISSION_GOLD_REWARD = 150;
export const COMMISSION_MORALE      = 10;

export const EXPORT_FOOD_COST       = 50;
export const EXPORT_WOOD_REWARD     = 100;
export const EXPORT_STONE_REWARD    = 80;
export const EXPORT_PRESTIGE        = 30;

// ── Init ──────────────────────────────────────────────────────────────────

export function initArtisanFair() {
  if (!state.artisanFair) {
    state.artisanFair = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalFairs:        0,
      totalCommissioned: 0,
      totalExported:     0,
    };
  }
  if (state.artisanFair.nextSpawnTick     === undefined) state.artisanFair.nextSpawnTick     = _nextSpawnTick();
  if (state.artisanFair.totalFairs        === undefined) state.artisanFair.totalFairs        = 0;
  if (state.artisanFair.totalCommissioned === undefined) state.artisanFair.totalCommissioned = 0;
  if (state.artisanFair.totalExported     === undefined) state.artisanFair.totalExported     = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function artisanFairTick() {
  const af = state.artisanFair;
  if (!af) return;

  // Expire active fair
  if (af.active) {
    if (state.tick >= af.active.expiresAt) {
      af.active        = null;
      af.nextSpawnTick = _nextSpawnTick();
      emit(Events.ARTISAN_FAIR_CHANGED, { expired: true });
      addMessage('🎪 The artisan fair packed up without a patron.', 'info');
    }
    return;
  }

  // Check spawn timing
  if (state.tick < af.nextSpawnTick) return;

  // Check age requirement
  if ((state.age ?? 0) < MIN_AGE) return;

  // Count player tiles
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  // Spawn fair
  af.active     = { expiresAt: state.tick + FAIR_WINDOW };
  af.totalFairs = (af.totalFairs ?? 0) + 1;

  emit(Events.ARTISAN_FAIR_CHANGED, { spawned: true });
  addMessage(
    '🎪 A travelling artisan fair has set up in your market square! Respond within 80 seconds.',
    'info',
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Commission crafts — pay wood+stone for gold+morale.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function commissionArtisans() {
  const af = state.artisanFair;
  if (!af?.active) return { ok: false, reason: 'No active artisan fair.' };
  if (state.tick >= af.active.expiresAt) return { ok: false, reason: 'Fair has ended.' };

  if ((state.resources?.wood  ?? 0) < COMMISSION_WOOD_COST) {
    return { ok: false, reason: `Requires ${COMMISSION_WOOD_COST} wood.` };
  }
  if ((state.resources?.stone ?? 0) < COMMISSION_STONE_COST) {
    return { ok: false, reason: `Requires ${COMMISSION_STONE_COST} stone.` };
  }

  state.resources.wood  -= COMMISSION_WOOD_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold   = Math.min(
    state.caps.gold ?? 500,
    (state.resources.gold ?? 0) + COMMISSION_GOLD_REWARD,
  );
  changeMorale(COMMISSION_MORALE);

  af.active            = null;
  af.nextSpawnTick     = _nextSpawnTick();
  af.totalCommissioned = (af.totalCommissioned ?? 0) + 1;

  emit(Events.ARTISAN_FAIR_CHANGED, { commissioned: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🎪 Artisans craft luxury goods for your treasury! +${COMMISSION_GOLD_REWARD} gold, +${COMMISSION_MORALE} morale.`,
    'windfall',
  );
  return { ok: true };
}

/**
 * Export crafts — pay food for wood+stone+prestige.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function exportCrafts() {
  const af = state.artisanFair;
  if (!af?.active) return { ok: false, reason: 'No active artisan fair.' };
  if (state.tick >= af.active.expiresAt) return { ok: false, reason: 'Fair has ended.' };

  if ((state.resources?.food ?? 0) < EXPORT_FOOD_COST) {
    return { ok: false, reason: `Requires ${EXPORT_FOOD_COST} food.` };
  }

  state.resources.food -= EXPORT_FOOD_COST;
  state.resources.wood  = Math.min(
    state.caps.wood ?? 500,
    (state.resources.wood ?? 0) + EXPORT_WOOD_REWARD,
  );
  state.resources.stone = Math.min(
    state.caps.stone ?? 500,
    (state.resources.stone ?? 0) + EXPORT_STONE_REWARD,
  );
  awardPrestige(EXPORT_PRESTIGE, 'artisan craft export');

  af.active        = null;
  af.nextSpawnTick = _nextSpawnTick();
  af.totalExported = (af.totalExported ?? 0) + 1;

  emit(Events.ARTISAN_FAIR_CHANGED, { exported: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🎪 Artisan crafts exported across the realm! +${EXPORT_WOOD_REWARD} wood, +${EXPORT_STONE_REWARD} stone, +${EXPORT_PRESTIGE} prestige.`,
    'windfall',
  );
  return { ok: true };
}

/**
 * Decline the fair — no cost, no reward.
 * @returns {{ ok: boolean }}
 */
export function declineArtisanFair() {
  const af = state.artisanFair;
  if (!af?.active) return { ok: false, reason: 'No active artisan fair.' };

  af.active        = null;
  af.nextSpawnTick = _nextSpawnTick();

  emit(Events.ARTISAN_FAIR_CHANGED, { declined: true });
  addMessage('🎪 The artisan fair moved on to the next town.', 'info');
  return { ok: true };
}

/** Returns the active fair object or null. */
export function getActiveArtisanFair() {
  return state.artisanFair?.active ?? null;
}

/** Seconds remaining on the active fair window. */
export function getArtisanFairSecsLeft() {
  const a = state.artisanFair?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}
