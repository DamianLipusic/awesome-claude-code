/**
 * EmpireOS — Nomadic Tribe Encounter (T240).
 *
 * Every 15-18 minutes (Bronze Age+, 8+ player tiles), a nomadic tribe arrives
 * at the empire's borders. The player has 90 seconds to respond; the encounter
 * card appears in the Quest panel.
 *
 * Player choices:
 *   Accept (settle) — pay 50 food → +80 food, +50 wood, +5 morale
 *                      (tribe settles nearby and shares provisions)
 *   Hire (mercenaries) — pay 60 gold → adds +0.5 gold/s modifier for 4 min
 *                         via state.randomEvents.activeModifiers
 *   Refuse — no cost, no reward; dismisses the encounter
 *
 * Spawn conditions:
 *   - Bronze Age (age ≥ 1)
 *   - 8+ player-owned map tiles
 *   - No active encounter
 *   - 15-18 min spawn interval
 *
 * state.nomadicTribe = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalEncounters: number,
 *   totalAccepted:   number,
 *   totalHired:      number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;  // 15 min
const SPAWN_RANGE      = 3  * 60 * TICKS_PER_SECOND;  // +0-3 min jitter
const ENCOUNTER_WINDOW = 90 * TICKS_PER_SECOND;        // 90 sec
const MIN_AGE          = 1;                             // Bronze Age
const MIN_PLAYER_TILES = 8;

export const ACCEPT_FOOD_COST    = 50;
export const ACCEPT_FOOD_REWARD  = 80;
export const ACCEPT_WOOD_REWARD  = 50;
export const ACCEPT_MORALE       = 5;

export const HIRE_GOLD_COST      = 60;
const HIRE_GOLD_RATE_BONUS       = 0.5;  // gold/s
const HIRE_BONUS_DURATION        = 4 * 60 * TICKS_PER_SECOND;  // 4 min

// ── Init ──────────────────────────────────────────────────────────────────

export function initNomadicTribe() {
  if (!state.nomadicTribe) {
    state.nomadicTribe = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalEncounters: 0,
      totalAccepted:   0,
      totalHired:      0,
    };
  }
  if (state.nomadicTribe.nextSpawnTick   === undefined) state.nomadicTribe.nextSpawnTick   = _nextSpawnTick();
  if (state.nomadicTribe.totalEncounters === undefined) state.nomadicTribe.totalEncounters = 0;
  if (state.nomadicTribe.totalAccepted   === undefined) state.nomadicTribe.totalAccepted   = 0;
  if (state.nomadicTribe.totalHired      === undefined) state.nomadicTribe.totalHired      = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function nomadicTribeTick() {
  const nt = state.nomadicTribe;
  if (!nt) return;

  // Expire active encounter
  if (nt.active) {
    if (state.tick >= nt.active.expiresAt) {
      nt.active         = null;
      nt.nextSpawnTick  = _nextSpawnTick();
      emit(Events.NOMADIC_TRIBE_CHANGED, { expired: true });
      addMessage('🏕️ The nomadic tribe moved on without an agreement.', 'info');
    }
    return;
  }

  // Check spawn timing
  if (state.tick < nt.nextSpawnTick) return;

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

  // Spawn encounter
  nt.active = { expiresAt: state.tick + ENCOUNTER_WINDOW };
  nt.totalEncounters = (nt.totalEncounters ?? 0) + 1;

  emit(Events.NOMADIC_TRIBE_CHANGED, { spawned: true });
  addMessage(
    '🏕️ A nomadic tribe has arrived at your borders! Respond within 90 seconds.',
    'info',
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Accept the tribe — settle them peacefully.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function acceptTribe() {
  const nt = state.nomadicTribe;
  if (!nt?.active) return { ok: false, reason: 'No active tribe encounter.' };
  if (state.tick >= nt.active.expiresAt) return { ok: false, reason: 'Encounter has expired.' };

  if ((state.resources?.food ?? 0) < ACCEPT_FOOD_COST) {
    return { ok: false, reason: `Requires ${ACCEPT_FOOD_COST} food.` };
  }

  // Deduct cost
  state.resources.food -= ACCEPT_FOOD_COST;

  // Award resources
  state.resources.food = Math.min(state.caps.food ?? 500, (state.resources.food ?? 0) + ACCEPT_FOOD_REWARD);
  state.resources.wood = Math.min(state.caps.wood ?? 500, (state.resources.wood ?? 0) + ACCEPT_WOOD_REWARD);
  changeMorale(ACCEPT_MORALE);

  nt.active        = null;
  nt.nextSpawnTick = _nextSpawnTick();
  nt.totalAccepted = (nt.totalAccepted ?? 0) + 1;

  emit(Events.NOMADIC_TRIBE_CHANGED, { accepted: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🏕️ The nomadic tribe settles nearby! They share provisions: +${ACCEPT_FOOD_REWARD} food, +${ACCEPT_WOOD_REWARD} wood, +${ACCEPT_MORALE} morale.`,
    'windfall',
  );
  return { ok: true };
}

/**
 * Hire the tribe as mercenaries.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function hireTribe() {
  const nt = state.nomadicTribe;
  if (!nt?.active) return { ok: false, reason: 'No active tribe encounter.' };
  if (state.tick >= nt.active.expiresAt) return { ok: false, reason: 'Encounter has expired.' };

  if ((state.resources?.gold ?? 0) < HIRE_GOLD_COST) {
    return { ok: false, reason: `Requires ${HIRE_GOLD_COST} gold.` };
  }

  // Deduct cost
  state.resources.gold -= HIRE_GOLD_COST;

  // Apply gold rate modifier via existing randomEvents.activeModifiers mechanism
  if (state.randomEvents?.activeModifiers !== undefined) {
    // Remove any stale nomadic-hire modifier
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(
      m => m.id !== 'nomadicHire',
    );
    state.randomEvents.activeModifiers.push({
      id:       'nomadicHire',
      resource: 'gold',
      rateMult: 1 + HIRE_GOLD_RATE_BONUS,  // relative multiplier used by recalcRates
      expiresAt: state.tick + HIRE_BONUS_DURATION,
      flatBonus: HIRE_GOLD_RATE_BONUS,      // extra field for tooltip display
    });
  }

  nt.active        = null;
  nt.nextSpawnTick = _nextSpawnTick();
  nt.totalHired    = (nt.totalHired ?? 0) + 1;

  emit(Events.NOMADIC_TRIBE_CHANGED, { hired: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🏕️ Tribal mercenaries join your economy! +${HIRE_GOLD_RATE_BONUS} gold/s for 4 minutes.`,
    'windfall',
  );
  return { ok: true };
}

/**
 * Refuse the tribe — dismiss without engagement.
 * @returns {{ ok: boolean }}
 */
export function refuseTribe() {
  const nt = state.nomadicTribe;
  if (!nt?.active) return { ok: false, reason: 'No active tribe encounter.' };

  nt.active        = null;
  nt.nextSpawnTick = _nextSpawnTick();

  emit(Events.NOMADIC_TRIBE_CHANGED, { refused: true });
  addMessage('🏕️ The tribe was turned away at the border.', 'info');
  return { ok: true };
}

/** Returns the active encounter object or null. */
export function getActiveTribeEncounter() {
  return state.nomadicTribe?.active ?? null;
}

/** Seconds remaining on the active encounter window. */
export function getTribeSecsLeft() {
  const a = state.nomadicTribe?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}
