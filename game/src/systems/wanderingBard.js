/**
 * EmpireOS — Wandering Bard (T251).
 *
 * Every 12–16 minutes (Bronze Age+, 6+ player tiles), a wandering bard
 * arrives at the empire's gates with songs, tales, and cultural lore.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🎵 Commission Performance — pay 35 gold → +12 morale, +8 prestige, +0.1 food/s for 2 min
 *   📖 Share Stories          — free → +5 morale, +6 prestige
 *   🚪 Send Away              — no cost
 *
 * state.wanderingBard = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissioned: number,
 *   totalListened:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND; // 12 min
const SPAWN_RANGE      = 4  * 60 * TICKS_PER_SECOND; // +0–4 min jitter
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;       // 80-second decision window
const MIN_AGE          = 1;                            // Bronze Age
const MIN_PLAYER_TILES = 6;

export const COMMISSION_GOLD_COST       = 35;
export const COMMISSION_MORALE_REWARD   = 12;
export const COMMISSION_PRESTIGE_REWARD = 8;
export const COMMISSION_FOOD_RATE       = 0.1;  // +0.1 food/s population allure
export const COMMISSION_DURATION_TICKS  = 2 * 60 * TICKS_PER_SECOND; // 2 min

export const LISTEN_MORALE_REWARD   = 5;
export const LISTEN_PRESTIGE_REWARD = 6;

// ── Init ──────────────────────────────────────────────────────────────────

export function initWanderingBard() {
  if (!state.wanderingBard) {
    state.wanderingBard = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalCommissioned: 0,
      totalListened:     0,
    };
  }
  if (state.wanderingBard.nextSpawnTick     === undefined) state.wanderingBard.nextSpawnTick     = _nextSpawnTick();
  if (state.wanderingBard.totalVisits       === undefined) state.wanderingBard.totalVisits       = 0;
  if (state.wanderingBard.totalCommissioned === undefined) state.wanderingBard.totalCommissioned = 0;
  if (state.wanderingBard.totalListened     === undefined) state.wanderingBard.totalListened     = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function wanderingBardTick() {
  const b = state.wanderingBard;
  if (!b) return;

  // Expire active window
  if (b.active) {
    if (state.tick >= b.active.expiresAt) {
      b.active        = null;
      b.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_BARD_CHANGED, { expired: true });
      addMessage('🎵 The wandering bard has moved on without a response.', 'info');
    }
    return;
  }

  if (state.tick < b.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  b.active      = { expiresAt: state.tick + WINDOW_TICKS };
  b.totalVisits = (b.totalVisits ?? 0) + 1;

  emit(Events.WANDERING_BARD_CHANGED, { spawned: true });
  addMessage('🎵 A wandering bard arrives at the empire gates, bearing songs of distant lands and epic tales of heroes. Respond within 80 seconds.', 'info');
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getActiveWanderingBard() {
  return state.wanderingBard?.active ?? null;
}

export function getWanderingBardSecsLeft() {
  const a = state.wanderingBard?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Commission Performance — pay 35 gold, receive +12 morale, +8 prestige, +0.1 food/s for 2 min.
 */
export function commissionBardPerformance() {
  const b = state.wanderingBard;
  if (!b?.active) return { ok: false, reason: 'No bard present.' };
  if (state.tick >= b.active.expiresAt) return { ok: false, reason: 'The bard has departed.' };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) {
    return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  }

  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Bard performance raised cultural prestige');

  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bardCommission');
    state.randomEvents.activeModifiers.push({
      id:        'bardCommission',
      resource:  'food',
      rateMult:  1 + (COMMISSION_FOOD_RATE / Math.max(0.001, (state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }

  b.active            = null;
  b.nextSpawnTick     = _nextSpawnTick();
  b.totalCommissioned = (b.totalCommissioned ?? 0) + 1;

  emit(Events.WANDERING_BARD_CHANGED, { commissioned: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎵 The bard performs to a delighted crowd! +${COMMISSION_MORALE_REWARD} morale, +${COMMISSION_PRESTIGE_REWARD} prestige, +${COMMISSION_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

/**
 * Share Stories — free, gain +5 morale and +6 prestige.
 */
export function listenToBardStories() {
  const b = state.wanderingBard;
  if (!b?.active) return { ok: false, reason: 'No bard present.' };
  if (state.tick >= b.active.expiresAt) return { ok: false, reason: 'The bard has departed.' };

  changeMorale(LISTEN_MORALE_REWARD);
  awardPrestige(LISTEN_PRESTIGE_REWARD, 'Bard tales inspire the people');

  b.active        = null;
  b.nextSpawnTick = _nextSpawnTick();
  b.totalListened = (b.totalListened ?? 0) + 1;

  emit(Events.WANDERING_BARD_CHANGED, { listened: true });
  addMessage(`📖 The bard shares tales of distant empires! +${LISTEN_MORALE_REWARD} morale, +${LISTEN_PRESTIGE_REWARD} prestige as citizens are inspired.`, 'windfall');
  return { ok: true };
}

/**
 * Send Away — no cost, no reward.
 */
export function sendBardAway() {
  const b = state.wanderingBard;
  if (!b?.active) return { ok: false, reason: 'No bard present.' };

  b.active        = null;
  b.nextSpawnTick = _nextSpawnTick();

  emit(Events.WANDERING_BARD_CHANGED, { dismissed: true });
  addMessage('🚪 The wandering bard moves on to entertain elsewhere.', 'info');
  return { ok: true };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}
