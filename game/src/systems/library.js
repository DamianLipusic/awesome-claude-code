/**
 * EmpireOS — Grand Library System (T231).
 *
 * At Iron Age+ (age ≥ 2), the player may found a Grand Library
 * (one-time, costs 150 gold + 100 stone).
 *
 * The library accumulates "scrolls" — one per researched technology.
 * When scroll count reaches 5+, a seasonal bonus activates.
 * The bonus is drawn from a pool of 6 options and rerolls each season.
 *
 * Bonus pool:
 *   0 — +0.4 food/s
 *   1 — +0.3 mana/s
 *   2 — +0.4 gold/s
 *   3 — +8% wood production rate
 *   4 — +8% stone production rate
 *   5 — +3 flat attack
 *
 * state.library = {
 *   founded:        boolean,
 *   activeBonusIdx: number | null,   // index into BONUS_POOL, or null = no bonus yet
 * }
 */

import { state }            from '../core/state.js';
import { on, emit, Events } from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { recalcRates }      from './resources.js';

// ── Constants ──────────────────────────────────────────────────────────────

export const LIBRARY_GOLD_COST  = 150;
export const LIBRARY_STONE_COST = 100;
const MIN_AGE                   = 2;   // Iron Age
export const SCROLL_THRESHOLD   = 5;

export const BONUS_POOL = Object.freeze([
  { id: 'food',   icon: '🌾', label: '+0.4 food/s',    type: 'rate',   res: 'food',  value: 0.4  },
  { id: 'mana',   icon: '✨', label: '+0.3 mana/s',    type: 'rate',   res: 'mana',  value: 0.3  },
  { id: 'gold',   icon: '💰', label: '+0.4 gold/s',    type: 'rate',   res: 'gold',  value: 0.4  },
  { id: 'wood',   icon: '🪵', label: '+8% wood rate',  type: 'mult',   res: 'wood',  value: 1.08 },
  { id: 'stone',  icon: '🪨', label: '+8% stone rate', type: 'mult',   res: 'stone', value: 1.08 },
  { id: 'attack', icon: '⚔️', label: '+3 flat attack', type: 'attack',               value: 3    },
]);

// ── Init ──────────────────────────────────────────────────────────────────

export function initLibrary() {
  if (!state.library) {
    state.library = { founded: false, activeBonusIdx: null };
  }
  if (state.library.founded       === undefined) state.library.founded       = false;
  if (state.library.activeBonusIdx === undefined) state.library.activeBonusIdx = null;

  // Migrate: if library is founded, scroll threshold is met but no bonus assigned
  if (state.library.founded && getLibraryScrollCount() >= SCROLL_THRESHOLD
      && state.library.activeBonusIdx === null) {
    state.library.activeBonusIdx = Math.floor(Math.random() * BONUS_POOL.length);
  }

  on(Events.TECH_CHANGED,    _onTechChanged);
  on(Events.SEASON_CHANGED,  _onSeasonChanged);
}

// ── Internal event handlers ────────────────────────────────────────────────

function _onTechChanged(data) {
  // Only react when a tech is actually completed (payload has techId)
  if (!data?.techId) return;
  if (!state.library?.founded) return;

  const scrolls = getLibraryScrollCount();
  if (scrolls >= SCROLL_THRESHOLD && state.library.activeBonusIdx === null) {
    // Just crossed the threshold — roll initial bonus
    _rollBonus('threshold');
  } else {
    emit(Events.LIBRARY_CHANGED, { scrollAdded: true });
  }
}

function _onSeasonChanged() {
  if (!state.library?.founded) return;
  if (getLibraryScrollCount() < SCROLL_THRESHOLD) return;
  _rollBonus('season');
}

function _rollBonus(reason) {
  const idx = Math.floor(Math.random() * BONUS_POOL.length);
  state.library.activeBonusIdx = idx;
  recalcRates();
  emit(Events.LIBRARY_CHANGED, { rerolled: reason });
  if (reason === 'season') {
    const bonus = BONUS_POOL[idx];
    addMessage(
      `📚 Grand Library seasonal wisdom: ${bonus.icon} ${bonus.label} this season.`,
      'info',
    );
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Attempt to found the Grand Library.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function foundLibrary() {
  if (!state.library) initLibrary();

  if (state.library.founded) {
    return { ok: false, reason: 'Grand Library already founded.' };
  }
  if ((state.age ?? 0) < MIN_AGE) {
    return { ok: false, reason: 'Requires Iron Age.' };
  }
  if ((state.resources.gold ?? 0) < LIBRARY_GOLD_COST) {
    return { ok: false, reason: `Need ${LIBRARY_GOLD_COST} gold.` };
  }
  if ((state.resources.stone ?? 0) < LIBRARY_STONE_COST) {
    return { ok: false, reason: `Need ${LIBRARY_STONE_COST} stone.` };
  }

  state.resources.gold  -= LIBRARY_GOLD_COST;
  state.resources.stone -= LIBRARY_STONE_COST;
  state.library.founded  = true;

  const scrolls    = getLibraryScrollCount();
  const remaining  = Math.max(0, SCROLL_THRESHOLD - scrolls);

  if (scrolls >= SCROLL_THRESHOLD) {
    _rollBonus('founded');
  } else {
    recalcRates();
  }

  emit(Events.LIBRARY_CHANGED, { founded: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    remaining > 0
      ? `📚 Grand Library founded! Research ${remaining} more tech${remaining > 1 ? 's' : ''} to unlock seasonal wisdom.`
      : `📚 Grand Library founded! Seasonal wisdom bonus now active.`,
    'info',
  );
  return { ok: true };
}

/** True when the Grand Library has been founded. */
export function isLibraryFounded() {
  return !!(state.library?.founded);
}

/** Number of scrolls = number of researched techs. */
export function getLibraryScrollCount() {
  return Object.keys(state.techs ?? {}).length;
}

/** Returns the active bonus object from BONUS_POOL, or null when inactive. */
export function getActiveLibraryBonus() {
  if (!state.library?.founded) return null;
  if (getLibraryScrollCount() < SCROLL_THRESHOLD) return null;
  const idx = state.library.activeBonusIdx;
  if (idx === null || idx === undefined) return null;
  return BONUS_POOL[idx] ?? null;
}

/** Flat attack bonus from the library (0 when inactive or non-attack bonus). */
export function getLibraryAttackBonus() {
  const bonus = getActiveLibraryBonus();
  return (bonus?.type === 'attack') ? bonus.value : 0;
}
