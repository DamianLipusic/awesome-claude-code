/**
 * EmpireOS — Imperial Games (T236).
 *
 * Every 3 seasons (Silver Age+, age ≥ 1), the Imperial Games are announced
 * with a 3-minute decision window visible in the Quest panel.
 *
 * Options:
 *   Host    — costs 100 gold + 50 stone  → +60 prestige, +8 morale
 *   Compete — costs 25 soldiers           → +30 prestige, +4 morale
 *   Skip    — forfeit the opportunity
 *
 * If the window expires the event is lost and the cycle resets.
 *
 * state.imperialGames = {
 *   pending:           { expiresAt: tick } | null,
 *   seasonsSinceLast:  number,
 *   totalHosted:       number,
 *   totalCompeted:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, on, Events } from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { awardPrestige }    from './prestige.js';
import { changeMorale }     from './morale.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SEASONS_BETWEEN_GAMES = 3;
const PENDING_WINDOW = 3 * 60 * TICKS_PER_SECOND; // 720 ticks (3 min)

const HOST_GOLD      = 100;
const HOST_STONE     = 50;
const HOST_PRESTIGE  = 60;
const HOST_MORALE    = 8;

const COMPETE_SOLDIERS  = 25;
const COMPETE_PRESTIGE  = 30;
const COMPETE_MORALE    = 4;

// ── Init ──────────────────────────────────────────────────────────────────

export function initImperialGames() {
  if (!state.imperialGames) {
    state.imperialGames = {
      pending:          null,
      seasonsSinceLast: 0,
      totalHosted:      0,
      totalCompeted:    0,
    };
  }
  if (state.imperialGames.totalHosted   === undefined) state.imperialGames.totalHosted   = 0;
  if (state.imperialGames.totalCompeted === undefined) state.imperialGames.totalCompeted = 0;
  if (state.imperialGames.seasonsSinceLast === undefined) state.imperialGames.seasonsSinceLast = 0;

  on(Events.SEASON_CHANGED, _onSeasonChanged);
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function imperialGamesTick() {
  if (!state.imperialGames?.pending) return;
  if (state.tick >= state.imperialGames.pending.expiresAt) {
    state.imperialGames.pending = null;
    emit(Events.IMPERIAL_GAMES_CHANGED, { expired: true });
    addMessage('🏟️ The Imperial Games window has closed — the empire missed its chance.', 'info');
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Host the games: −100 gold, −50 stone → +60 prestige, +8 morale. */
export function hostImperialGames() {
  const ig = state.imperialGames;
  if (!ig?.pending) return { ok: false, reason: 'No active Imperial Games.' };
  if (state.tick >= ig.pending.expiresAt) return { ok: false, reason: 'The games have expired.' };
  if ((state.resources.gold  ?? 0) < HOST_GOLD)  return { ok: false, reason: `Need ${HOST_GOLD} gold.` };
  if ((state.resources.stone ?? 0) < HOST_STONE) return { ok: false, reason: `Need ${HOST_STONE} stone.` };

  state.resources.gold  -= HOST_GOLD;
  state.resources.stone -= HOST_STONE;
  awardPrestige(HOST_PRESTIGE, 'hosted Imperial Games');
  changeMorale(HOST_MORALE);
  ig.pending    = null;
  ig.totalHosted = (ig.totalHosted ?? 0) + 1;

  emit(Events.IMPERIAL_GAMES_CHANGED, { hosted: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🏟️ Imperial Games hosted! Your empire dazzles the world. +${HOST_PRESTIGE} prestige, +${HOST_MORALE} morale.`,
    'windfall',
  );
  return { ok: true };
}

/** Compete in the games: −25 soldiers → +30 prestige, +4 morale. */
export function competeImperialGames() {
  const ig = state.imperialGames;
  if (!ig?.pending) return { ok: false, reason: 'No active Imperial Games.' };
  if (state.tick >= ig.pending.expiresAt) return { ok: false, reason: 'The games have expired.' };

  const total = _totalSoldiers();
  if (total < COMPETE_SOLDIERS) return { ok: false, reason: `Need ${COMPETE_SOLDIERS} soldiers.` };

  _deductSoldiers(COMPETE_SOLDIERS);
  awardPrestige(COMPETE_PRESTIGE, 'competed in Imperial Games');
  changeMorale(COMPETE_MORALE);
  ig.pending      = null;
  ig.totalCompeted = (ig.totalCompeted ?? 0) + 1;

  emit(Events.IMPERIAL_GAMES_CHANGED, { competed: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🏟️ Your champions compete in the Imperial Games! +${COMPETE_PRESTIGE} prestige, +${COMPETE_MORALE} morale.`,
    'windfall',
  );
  return { ok: true };
}

/** Skip the games — forfeit the window. */
export function skipImperialGames() {
  const ig = state.imperialGames;
  if (!ig?.pending) return { ok: false, reason: 'No active Imperial Games.' };
  ig.pending = null;
  emit(Events.IMPERIAL_GAMES_CHANGED, { skipped: true });
  addMessage('🏟️ The empire chose to skip the Imperial Games this season.', 'info');
  return { ok: true };
}

/** True when a games window is open and awaiting a decision. */
export function isImperialGamesPending() {
  const ig = state.imperialGames;
  return !!(ig?.pending && state.tick < ig.pending.expiresAt);
}

/** Seconds remaining in the current games window (0 when none). */
export function getImperialGamesSecsLeft() {
  const ig = state.imperialGames;
  if (!ig?.pending || state.tick >= ig.pending.expiresAt) return 0;
  return Math.max(0, Math.ceil((ig.pending.expiresAt - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _onSeasonChanged() {
  const ig = state.imperialGames;
  if (!ig) return;
  if (ig.pending) return; // don't count seasons during an active window

  ig.seasonsSinceLast = (ig.seasonsSinceLast ?? 0) + 1;
  if (ig.seasonsSinceLast < SEASONS_BETWEEN_GAMES) return;

  // Silver Age+ required
  if ((state.age ?? 0) < 1) return;

  ig.seasonsSinceLast = 0;
  ig.pending = { expiresAt: state.tick + PENDING_WINDOW };
  emit(Events.IMPERIAL_GAMES_CHANGED, { announced: true });
  addMessage('🏟️ The Imperial Games are announced! Host, Compete, or Skip in the Quests tab.', 'windfall');
}

function _totalSoldiers() {
  if (!state.units) return 0;
  return Object.values(state.units).reduce((s, n) => s + (n ?? 0), 0);
}

function _deductSoldiers(count) {
  if (!state.units) return;
  let remaining = count;
  for (const unitId of Object.keys(state.units)) {
    if (remaining <= 0) break;
    const take = Math.min(state.units[unitId] ?? 0, remaining);
    state.units[unitId] -= take;
    remaining -= take;
  }
}
