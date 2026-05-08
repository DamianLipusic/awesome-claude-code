/**
 * EmpireOS — Wandering Prophet (T241).
 *
 * Every 12-16 minutes (Bronze Age+, 6+ player tiles), a wandering prophet
 * arrives at the empire's gates. The player has 100 seconds to respond; the
 * encounter card appears in the Quest panel.
 *
 * Player choices:
 *   Heed   — pay 50 mana → adds +0.5 gold/s modifier for 4 min
 *                           via state.randomEvents.activeModifiers
 *   Tribute — pay 60 gold → +80 prestige + +8 morale
 *   Dismiss — no cost, no reward; dismisses the encounter
 *
 * Spawn conditions:
 *   - Bronze Age (age ≥ 1)
 *   - 6+ player-owned map tiles
 *   - No active encounter
 *   - 12-16 min spawn interval
 *
 * state.prophet = {
 *   active:        { expiresAt: tick } | null,
 *   nextSpawnTick: tick,
 *   totalVisits:   number,
 *   totalHeeded:   number,
 *   totalTributed: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN         = 12 * 60 * TICKS_PER_SECOND;  // 12 min
const SPAWN_RANGE       = 4  * 60 * TICKS_PER_SECOND;  // +0-4 min jitter
const ENCOUNTER_WINDOW  = 100 * TICKS_PER_SECOND;       // 100 sec
const MIN_AGE           = 1;                             // Bronze Age
const MIN_PLAYER_TILES  = 6;

export const HEED_MANA_COST     = 50;
const HEED_GOLD_RATE_BONUS      = 0.5;  // gold/s
const HEED_BONUS_DURATION       = 4 * 60 * TICKS_PER_SECOND;  // 4 min

export const TRIBUTE_GOLD_COST  = 60;
export const TRIBUTE_PRESTIGE   = 80;
export const TRIBUTE_MORALE     = 8;

// ── Init ──────────────────────────────────────────────────────────────────

export function initProphet() {
  if (!state.prophet) {
    state.prophet = {
      active:        null,
      nextSpawnTick: _nextSpawnTick(),
      totalVisits:   0,
      totalHeeded:   0,
      totalTributed: 0,
    };
  }
  if (state.prophet.nextSpawnTick  === undefined) state.prophet.nextSpawnTick  = _nextSpawnTick();
  if (state.prophet.totalVisits    === undefined) state.prophet.totalVisits    = 0;
  if (state.prophet.totalHeeded    === undefined) state.prophet.totalHeeded    = 0;
  if (state.prophet.totalTributed  === undefined) state.prophet.totalTributed  = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function prophetTick() {
  const p = state.prophet;
  if (!p) return;

  // Expire active encounter
  if (p.active) {
    if (state.tick >= p.active.expiresAt) {
      p.active        = null;
      p.nextSpawnTick = _nextSpawnTick();
      emit(Events.PROPHET_CHANGED, { expired: true });
      addMessage('🔮 The wandering prophet departed without a response.', 'info');
    }
    return;
  }

  // Check spawn timing
  if (state.tick < p.nextSpawnTick) return;

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
  p.active      = { expiresAt: state.tick + ENCOUNTER_WINDOW };
  p.totalVisits = (p.totalVisits ?? 0) + 1;

  emit(Events.PROPHET_CHANGED, { spawned: true });
  addMessage(
    '🔮 A wandering prophet stands at your gates! Respond within 100 seconds.',
    'info',
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Heed the prophecy — pay mana for a gold rate bonus.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function heedProphet() {
  const p = state.prophet;
  if (!p?.active) return { ok: false, reason: 'No active prophet encounter.' };
  if (state.tick >= p.active.expiresAt) return { ok: false, reason: 'Encounter has expired.' };

  if ((state.resources?.mana ?? 0) < HEED_MANA_COST) {
    return { ok: false, reason: `Requires ${HEED_MANA_COST} mana.` };
  }

  state.resources.mana -= HEED_MANA_COST;

  // Apply gold rate modifier via existing activeModifiers mechanism
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(
      m => m.id !== 'prophetHeed',
    );
    state.randomEvents.activeModifiers.push({
      id:        'prophetHeed',
      resource:  'gold',
      rateMult:  1 + HEED_GOLD_RATE_BONUS,
      expiresAt: state.tick + HEED_BONUS_DURATION,
      flatBonus: HEED_GOLD_RATE_BONUS,
    });
  }

  p.active       = null;
  p.nextSpawnTick = _nextSpawnTick();
  p.totalHeeded   = (p.totalHeeded ?? 0) + 1;

  emit(Events.PROPHET_CHANGED, { heeded: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🔮 The prophet's wisdom resonates through your treasury! +${HEED_GOLD_RATE_BONUS} gold/s for 4 minutes.`,
    'windfall',
  );
  return { ok: true };
}

/**
 * Offer tribute — pay gold for prestige and morale.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function tributeProphet() {
  const p = state.prophet;
  if (!p?.active) return { ok: false, reason: 'No active prophet encounter.' };
  if (state.tick >= p.active.expiresAt) return { ok: false, reason: 'Encounter has expired.' };

  if ((state.resources?.gold ?? 0) < TRIBUTE_GOLD_COST) {
    return { ok: false, reason: `Requires ${TRIBUTE_GOLD_COST} gold.` };
  }

  state.resources.gold -= TRIBUTE_GOLD_COST;
  awardPrestige(TRIBUTE_PRESTIGE, 'prophet tribute');
  changeMorale(TRIBUTE_MORALE);

  p.active        = null;
  p.nextSpawnTick = _nextSpawnTick();
  p.totalTributed = (p.totalTributed ?? 0) + 1;

  emit(Events.PROPHET_CHANGED, { tributed: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🔮 Your tribute honours the prophet! +${TRIBUTE_PRESTIGE} prestige, +${TRIBUTE_MORALE} morale.`,
    'windfall',
  );
  return { ok: true };
}

/**
 * Dismiss the prophet — no cost, no reward.
 * @returns {{ ok: boolean }}
 */
export function dismissProphet() {
  const p = state.prophet;
  if (!p?.active) return { ok: false, reason: 'No active prophet encounter.' };

  p.active        = null;
  p.nextSpawnTick = _nextSpawnTick();

  emit(Events.PROPHET_CHANGED, { dismissed: true });
  addMessage('🔮 The prophet was turned away from the gates.', 'info');
  return { ok: true };
}

/** Returns the active encounter object or null. */
export function getActiveProphetEncounter() {
  return state.prophet?.active ?? null;
}

/** Seconds remaining on the active encounter window. */
export function getProphetSecsLeft() {
  const a = state.prophet?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}
