/**
 * EmpireOS — Imperial Jubilee (T254).
 *
 * Every 18–23 minutes (Medieval Age+, 15+ player tiles), a grand imperial
 * jubilee is declared celebrating the empire's enduring glory.
 * The player has 85 seconds to decide.
 *
 * Choices:
 *   🎺 Grand Parade  — pay 60 gold → +25 morale, +30 prestige,
 *                       +0.15 food/s and +0.1 gold/s for 3 min
 *   🍽️  Royal Feast  — pay 40 food → +20 morale, +20 prestige
 *   🕯️  Simple Ceremony — free → +8 morale, +12 prestige
 *
 * state.imperialJubilee = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalJubilees:   number,
 *   totalParades:    number,
 *   totalFeasts:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 18 * 60 * TICKS_PER_SECOND; // 18 min
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND; // +0–5 min jitter
const WINDOW_TICKS     = 85 * TICKS_PER_SECOND;       // 85-second decision window
const MIN_AGE          = 3;                            // Medieval Age
const MIN_PLAYER_TILES = 15;

export const PARADE_GOLD_COST        = 60;
export const PARADE_MORALE_REWARD    = 25;
export const PARADE_PRESTIGE_REWARD  = 30;
export const PARADE_FOOD_RATE        = 0.15; // +0.15 food/s crowd festivity
export const PARADE_GOLD_RATE        = 0.10; // +0.10 gold/s commerce boom
export const PARADE_DURATION_TICKS   = 3 * 60 * TICKS_PER_SECOND; // 3 min

export const FEAST_FOOD_COST        = 40;
export const FEAST_MORALE_REWARD    = 20;
export const FEAST_PRESTIGE_REWARD  = 20;

export const CEREMONY_MORALE_REWARD   = 8;
export const CEREMONY_PRESTIGE_REWARD = 12;

// ── Init ──────────────────────────────────────────────────────────────────

export function initImperialJubilee() {
  if (!state.imperialJubilee) {
    state.imperialJubilee = {
      active:         null,
      nextSpawnTick:  _nextSpawnTick(),
      totalJubilees:  0,
      totalParades:   0,
      totalFeasts:    0,
    };
  }
  if (state.imperialJubilee.nextSpawnTick  === undefined) state.imperialJubilee.nextSpawnTick  = _nextSpawnTick();
  if (state.imperialJubilee.totalJubilees  === undefined) state.imperialJubilee.totalJubilees  = 0;
  if (state.imperialJubilee.totalParades   === undefined) state.imperialJubilee.totalParades   = 0;
  if (state.imperialJubilee.totalFeasts    === undefined) state.imperialJubilee.totalFeasts    = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function imperialJubileeTick() {
  const j = state.imperialJubilee;
  if (!j) return;

  // Expire active window
  if (j.active) {
    if (state.tick >= j.active.expiresAt) {
      j.active        = null;
      j.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_JUBILEE_CHANGED, { expired: true });
      addMessage('🎺 The imperial jubilee has passed without a formal celebration.', 'info');
    }
    return;
  }

  if (state.tick < j.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  j.active         = { expiresAt: state.tick + WINDOW_TICKS };
  j.totalJubilees  = (j.totalJubilees ?? 0) + 1;

  emit(Events.IMPERIAL_JUBILEE_CHANGED, { spawned: true });
  addMessage('🎺 The court announces an Imperial Jubilee! Citizens pour into the streets to celebrate the empire\'s greatness. Declare a celebration within 85 seconds.', 'info');
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getActiveImperialJubilee() {
  return state.imperialJubilee?.active ?? null;
}

export function getImperialJubileeSecsLeft() {
  const a = state.imperialJubilee?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Grand Parade — pay 60 gold, receive +25 morale, +30 prestige,
 * +0.15 food/s and +0.1 gold/s for 3 minutes.
 */
export function declareGrandParade() {
  const j = state.imperialJubilee;
  if (!j?.active) return { ok: false, reason: 'No jubilee declared.' };
  if (state.tick >= j.active.expiresAt) return { ok: false, reason: 'The jubilee has passed.' };
  if ((state.resources.gold ?? 0) < PARADE_GOLD_COST) {
    return { ok: false, reason: `Need ${PARADE_GOLD_COST} gold.` };
  }

  state.resources.gold -= PARADE_GOLD_COST;
  changeMorale(PARADE_MORALE_REWARD);
  awardPrestige(PARADE_PRESTIGE_REWARD, 'Grand imperial parade delighted the populace');

  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(
      m => m.id !== 'jubileeParadeFood' && m.id !== 'jubileeParadeGold'
    );
    state.randomEvents.activeModifiers.push({
      id:        'jubileeParadeFood',
      resource:  'food',
      rateMult:  1 + (PARADE_FOOD_RATE / Math.max(0.001, (state.rates?.food ?? 1))),
      expiresAt: state.tick + PARADE_DURATION_TICKS,
    });
    state.randomEvents.activeModifiers.push({
      id:        'jubileeParadeGold',
      resource:  'gold',
      rateMult:  1 + (PARADE_GOLD_RATE / Math.max(0.001, (state.rates?.gold ?? 1))),
      expiresAt: state.tick + PARADE_DURATION_TICKS,
    });
  }

  j.active        = null;
  j.nextSpawnTick = _nextSpawnTick();
  j.totalParades  = (j.totalParades ?? 0) + 1;

  emit(Events.IMPERIAL_JUBILEE_CHANGED, { parade: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎺 A grand imperial parade fills the streets! +${PARADE_MORALE_REWARD} morale, +${PARADE_PRESTIGE_REWARD} prestige, +${PARADE_FOOD_RATE} food/s and +${PARADE_GOLD_RATE} gold/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

/**
 * Royal Feast — pay 40 food, receive +20 morale and +20 prestige.
 */
export function declareRoyalFeast() {
  const j = state.imperialJubilee;
  if (!j?.active) return { ok: false, reason: 'No jubilee declared.' };
  if (state.tick >= j.active.expiresAt) return { ok: false, reason: 'The jubilee has passed.' };
  if ((state.resources.food ?? 0) < FEAST_FOOD_COST) {
    return { ok: false, reason: `Need ${FEAST_FOOD_COST} food.` };
  }

  state.resources.food -= FEAST_FOOD_COST;
  changeMorale(FEAST_MORALE_REWARD);
  awardPrestige(FEAST_PRESTIGE_REWARD, 'Royal feast honored citizens throughout the empire');

  j.active        = null;
  j.nextSpawnTick = _nextSpawnTick();
  j.totalFeasts   = (j.totalFeasts ?? 0) + 1;

  emit(Events.IMPERIAL_JUBILEE_CHANGED, { feast: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍽️ A royal feast is declared across the empire! +${FEAST_MORALE_REWARD} morale, +${FEAST_PRESTIGE_REWARD} prestige as citizens celebrate in the streets.`, 'windfall');
  return { ok: true };
}

/**
 * Simple Ceremony — free, gain +8 morale and +12 prestige.
 */
export function declareSimpleCeremony() {
  const j = state.imperialJubilee;
  if (!j?.active) return { ok: false, reason: 'No jubilee declared.' };

  changeMorale(CEREMONY_MORALE_REWARD);
  awardPrestige(CEREMONY_PRESTIGE_REWARD, 'Simple jubilee ceremony raised imperial spirits');

  j.active        = null;
  j.nextSpawnTick = _nextSpawnTick();

  emit(Events.IMPERIAL_JUBILEE_CHANGED, { ceremony: true });
  addMessage(`🕯️ A modest ceremony marks the jubilee. +${CEREMONY_MORALE_REWARD} morale, +${CEREMONY_PRESTIGE_REWARD} prestige as the empire pauses to reflect on its achievements.`, 'windfall');
  return { ok: true };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}
