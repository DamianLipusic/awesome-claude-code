/**
 * EmpireOS — Province Council System (T201).
 *
 * Every 15 minutes, when the player controls 10+ territory tiles,
 * the provincial council convenes and presents 3 governance options.
 * The player has 90 seconds to choose one before the session expires.
 *
 * Option pool (3 randomly chosen per session):
 *   gold_levy      — +80 gold immediately
 *   harvest_tithe  — +80 food immediately
 *   conscription   — +2 soldiers added directly (no queue)
 *   public_works   — +12% all positive rates for 90 seconds
 *   stone_quarry   — +60 stone, +40 wood immediately
 *   iron_muster    — +70 iron immediately
 *   morale_rally   — +15 morale
 *   mana_harvest   — +60 mana immediately
 *   training_drill — unit training speed +25% for 90 seconds
 *
 * State shape:
 *   state.council = {
 *     nextSessionTick:   number,
 *     active:            { options: [{id, icon, label, desc}], expiresAt: number } | null,
 *     totalSessions:     number,
 *     prodBonusExpires:  number,   // tick when public_works rate bonus expires
 *     drillBonusExpires: number,   // tick when training_drill speed bonus expires
 *   } | null
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from './morale.js';
import { recalcRates }      from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_TERRITORY      = 10;                              // tiles required for council
const SESSION_INTERVAL   = 15 * 60 * TICKS_PER_SECOND;     // 15 min between sessions
const EXPIRE_TICKS       = 90 * TICKS_PER_SECOND;          // 90s to choose
const PROD_BONUS_TICKS   = 90 * TICKS_PER_SECOND;          // public_works duration
const DRILL_BONUS_TICKS  = 90 * TICKS_PER_SECOND;          // training_drill duration
const OPTIONS_PER_SESSION = 3;

// ── Option pool ────────────────────────────────────────────────────────────

export const COUNCIL_OPTIONS = {
  gold_levy: {
    id:    'gold_levy',
    icon:  '💰',
    label: 'Gold Levy',
    desc:  'Tax the provinces — treasury receives 80 gold.',
  },
  harvest_tithe: {
    id:    'harvest_tithe',
    icon:  '🌾',
    label: 'Harvest Tithe',
    desc:  'Collect a food tribute from provincial farmers — +80 food.',
  },
  conscription: {
    id:    'conscription',
    icon:  '⚔️',
    label: 'Conscription',
    desc:  'Draft 2 soldiers from the provinces immediately.',
  },
  public_works: {
    id:    'public_works',
    icon:  '🏗️',
    label: 'Public Works',
    desc:  'Invest in infrastructure — all production rates +12% for 90 seconds.',
  },
  stone_quarry: {
    id:    'stone_quarry',
    icon:  '🪨',
    label: 'Stone Quarry',
    desc:  'Commission provincial quarries — +60 stone, +40 wood.',
  },
  iron_muster: {
    id:    'iron_muster',
    icon:  '⛏️',
    label: 'Iron Muster',
    desc:  'Requisition iron from provincial mines — +70 iron.',
  },
  morale_rally: {
    id:    'morale_rally',
    icon:  '📣',
    label: 'Morale Rally',
    desc:  "Address the people and boost the empire's morale by +15.",
  },
  mana_harvest: {
    id:    'mana_harvest',
    icon:  '✨',
    label: 'Arcane Harvest',
    desc:  'Channel provincial ley lines — +60 mana.',
  },
  training_drill: {
    id:    'training_drill',
    icon:  '🎯',
    label: 'Training Drills',
    desc:  'Provincial drill grounds reduce training time by 25% for 90 seconds.',
  },
};

const OPTION_ORDER = Object.keys(COUNCIL_OPTIONS);

// ── Helpers ────────────────────────────────────────────────────────────────

function _playerTileCount() {
  if (!state.map) return 0;
  let count = 0;
  for (const row of state.map.tiles) {
    for (const t of row) { if (t.owner === 'player') count++; }
  }
  return count;
}

function _pickOptions() {
  const pool = [...OPTION_ORDER];
  const chosen = [];
  while (chosen.length < OPTIONS_PER_SESSION && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    chosen.push(COUNCIL_OPTIONS[pool.splice(idx, 1)[0]]);
  }
  return chosen;
}

// ── Init ───────────────────────────────────────────────────────────────────

export function initCouncil() {
  if (!state.council) {
    state.council = {
      nextSessionTick:   SESSION_INTERVAL,
      active:            null,
      totalSessions:     0,
      prodBonusExpires:  0,
      drillBonusExpires: 0,
    };
  } else {
    if (state.council.prodBonusExpires  === undefined) state.council.prodBonusExpires  = 0;
    if (state.council.drillBonusExpires === undefined) state.council.drillBonusExpires = 0;
  }
}

// ── Tick ───────────────────────────────────────────────────────────────────

export function councilTick() {
  if (!state.council) return;

  // Expire active session if timer ran out
  if (state.council.active && state.tick >= state.council.active.expiresAt) {
    state.council.active = null;
    state.council.nextSessionTick = state.tick + SESSION_INTERVAL;
    addMessage('Provincial Council: session expired with no decision made.', 'info');
    emit(Events.COUNCIL_SESSION_CHANGED, {});
    return;
  }

  // Spawn new session
  if (!state.council.active && state.tick >= state.council.nextSessionTick) {
    if (_playerTileCount() >= MIN_TERRITORY) {
      const options = _pickOptions();
      state.council.active = {
        options,
        expiresAt: state.tick + EXPIRE_TICKS,
      };
      state.council.totalSessions++;
      addMessage('Provincial Council has convened — choose a governance decree!', 'council');
      emit(Events.COUNCIL_SESSION_CHANGED, { type: 'spawned' });
    } else {
      // Not enough territory yet — try again in half the interval
      state.council.nextSessionTick = state.tick + SESSION_INTERVAL / 2;
    }
  }
}

// ── Player action ──────────────────────────────────────────────────────────

/**
 * Apply the chosen council option and close the session.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function chooseCouncilOption(optionId) {
  if (!state.council?.active) return { ok: false, reason: 'No active council session.' };
  const opt = state.council.active.options.find(o => o.id === optionId);
  if (!opt) return { ok: false, reason: 'Invalid option.' };

  _applyOption(optionId);

  state.council.active           = null;
  state.council.nextSessionTick  = state.tick + SESSION_INTERVAL;
  emit(Events.COUNCIL_SESSION_CHANGED, { type: 'resolved', optionId });
  return { ok: true };
}

function _applyOption(id) {
  const cap = (res) => Math.min(state.resources[res] + _amount(id, res), state.caps[res]);

  switch (id) {
    case 'gold_levy': {
      state.resources.gold = Math.min(state.resources.gold + 80, state.caps.gold);
      addMessage('Council: Gold Levy raised 80 gold from the provinces.', 'council');
      emit(Events.RESOURCE_CHANGED, {});
      break;
    }
    case 'harvest_tithe': {
      state.resources.food = Math.min(state.resources.food + 80, state.caps.food);
      addMessage('Council: Harvest Tithe collected 80 food from provincial farms.', 'council');
      emit(Events.RESOURCE_CHANGED, {});
      break;
    }
    case 'conscription': {
      state.units.soldier = (state.units.soldier ?? 0) + 2;
      addMessage('Council: Conscription drafted 2 soldiers from the provinces.', 'council');
      emit(Events.UNIT_CHANGED, {});
      recalcRates();
      break;
    }
    case 'public_works': {
      state.council.prodBonusExpires = state.tick + PROD_BONUS_TICKS;
      addMessage('Council: Public Works begun — production rates +12% for 90 seconds!', 'council');
      recalcRates();
      break;
    }
    case 'stone_quarry': {
      state.resources.stone = Math.min(state.resources.stone + 60, state.caps.stone);
      state.resources.wood  = Math.min(state.resources.wood  + 40, state.caps.wood);
      addMessage('Council: Stone Quarry delivered 60 stone and 40 wood.', 'council');
      emit(Events.RESOURCE_CHANGED, {});
      break;
    }
    case 'iron_muster': {
      state.resources.iron = Math.min(state.resources.iron + 70, state.caps.iron);
      addMessage('Council: Iron Muster requisitioned 70 iron from provincial mines.', 'council');
      emit(Events.RESOURCE_CHANGED, {});
      break;
    }
    case 'morale_rally': {
      changeMorale(15);
      addMessage('Council: Morale Rally lifted imperial spirits by +15.', 'council');
      break;
    }
    case 'mana_harvest': {
      state.resources.mana = Math.min(state.resources.mana + 60, state.caps.mana);
      addMessage('Council: Arcane Harvest channeled 60 mana from provincial ley lines.', 'council');
      emit(Events.RESOURCE_CHANGED, {});
      break;
    }
    case 'training_drill': {
      state.council.drillBonusExpires = state.tick + DRILL_BONUS_TICKS;
      addMessage('Council: Training Drills reduce unit training time by 25% for 90 seconds!', 'council');
      break;
    }
  }
}

// Unused helper kept for completeness (lint-safe)
function _amount(id, res) { void id; void res; return 0; }

// ── Public getters ─────────────────────────────────────────────────────────

/** Seconds remaining on the active session, or 0 if none. */
export function getCouncilSecsLeft() {
  const exp = state.council?.active?.expiresAt ?? 0;
  if (!exp || state.tick >= exp) return 0;
  return Math.ceil((exp - state.tick) / TICKS_PER_SECOND);
}

/** Seconds until the next session, or 0 if one is active. */
export function getCouncilNextSecs() {
  if (state.council?.active) return 0;
  const next = state.council?.nextSessionTick ?? 0;
  if (state.tick >= next) return 0;
  return Math.ceil((next - state.tick) / TICKS_PER_SECOND);
}

/** True if the public_works rate bonus is currently active. */
export function isCouncilProdBonusActive() {
  return (state.council?.prodBonusExpires ?? 0) > state.tick;
}

/** True if the training_drill speed bonus is currently active. */
export function isCouncilDrillBonusActive() {
  return (state.council?.drillBonusExpires ?? 0) > state.tick;
}
