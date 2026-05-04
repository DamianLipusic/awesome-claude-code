/**
 * EmpireOS — Grand Vizier System (T195).
 *
 * The player appoints one of 5 Grand Viziers to advise the empire.
 * Each Vizier provides passive bonuses in their domain.
 * The first appointment is free.  Changing to a different Vizier costs
 * VIZIER_CHANGE_COST gold and enforces a VIZIER_COOLDOWN tick cooldown.
 * Dismissing (tapping the active vizier) is always free with no cooldown.
 *
 * Vizier types:
 *   chancellor    — +1.5 gold/s, sell prices ×1.10
 *   high_marshal  — training time ×0.80, attack power ×1.10
 *   archmage      — mana ×1.30, spell cost ×0.85
 *   architect     — all positive rates ×1.05, research time ×0.90
 *   diplomat      — trade route income ×1.15, +6 favor with allies on appoint
 *
 * Bonus helpers (getVizier*) are imported by resources.js (circular-safe
 * because both only use the helpers inside function bodies, not at init time).
 * combat.js, actions.js, market.js, spells.js and research.js inline the
 * state.vizier?.active check directly to avoid import cycles.
 *
 * State:  state.vizier = { active: null | string, lastChangedTick: 0, totalChanges: 0 }
 * Event:  Events.VIZIER_CHANGED
 * Save:   version 64
 */

import { state }           from '../core/state.js';
import { emit, Events }    from '../core/events.js';
import { addMessage }      from '../core/actions.js';
import { recalcRates }     from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ─────────────────────────────────────────────────────────────

export const VIZIER_CHANGE_COST = 80;                         // gold to switch vizier
export const VIZIER_COOLDOWN    = 5 * 60 * TICKS_PER_SECOND; // 5 min between switches
const DIPLOMAT_FAVOR_BONUS      = 6;
const DIPLOMAT_FAVOR_MAX        = 50; // mirrors diplomacy.js FAVOR_MAX

// ── Vizier definitions ─────────────────────────────────────────────────────

export const VIZIERS = Object.freeze({
  chancellor: {
    id:         'chancellor',
    icon:       '📜',
    name:       'Chancellor of Finance',
    bonusLines: ['+1.5 gold/s', 'Sell prices +10%'],
    desc:       'The Chancellor optimises tax collection and trade revenues.',
  },
  high_marshal: {
    id:         'high_marshal',
    icon:       '⚔️',
    name:       'High Marshal',
    bonusLines: ['−20% unit training time', '+10% attack power'],
    desc:       'The High Marshal drills armies to peak battlefield efficiency.',
  },
  archmage: {
    id:         'archmage',
    icon:       '🔮',
    name:       'Grand Archmage',
    bonusLines: ['+30% mana production', '−15% spell mana cost'],
    desc:       'The Archmage channels raw magic throughout the imperial academies.',
  },
  architect: {
    id:         'architect',
    icon:       '🏗️',
    name:       'Royal Architect',
    bonusLines: ['+5% all production rates', '−10% research time'],
    desc:       'The Architect oversees imperial infrastructure and scholarship.',
  },
  diplomat: {
    id:         'diplomat',
    icon:       '🤝',
    name:       'Court Diplomat',
    bonusLines: ['+15% trade route income', '+6 favor with allies on appoint'],
    desc:       'The Diplomat forges lasting bonds with foreign empires.',
  },
});

export const VIZIER_ORDER = ['chancellor', 'high_marshal', 'archmage', 'architect', 'diplomat'];

// ── Init ──────────────────────────────────────────────────────────────────

export function initVizier() {
  if (!state.vizier) {
    state.vizier = { active: null, lastChangedTick: 0, totalChanges: 0 };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns the active Vizier definition or null. */
export function getActiveVizier() {
  const id = state.vizier?.active;
  return id ? (VIZIERS[id] ?? null) : null;
}

/** Seconds remaining on the appointment cooldown (0 if ready or no active vizier). */
export function getVizierCooldownSecs() {
  if (!state.vizier?.active) return 0;
  const until = (state.vizier.lastChangedTick ?? 0) + VIZIER_COOLDOWN;
  return Math.max(0, Math.ceil((until - state.tick) / TICKS_PER_SECOND));
}

/**
 * Appoint a Vizier by id.
 * - Clicking the already-active vizier dismisses them (free, no cooldown).
 * - First appointment (active === null) is free with no cooldown.
 * - Switching from one vizier to another costs VIZIER_CHANGE_COST gold
 *   and requires the cooldown to have elapsed.
 */
export function appointVizier(id) {
  if (!state.vizier) initVizier();
  const v = state.vizier;

  if (!VIZIERS[id]) return { ok: false, reason: 'Unknown vizier.' };

  // Toggle-off: same vizier dismissed for free
  if (v.active === id) {
    const def = VIZIERS[id];
    v.active = null;
    recalcRates();
    emit(Events.VIZIER_CHANGED, { dismissed: id });
    addMessage(`${def.icon} ${def.name} has been dismissed from court.`, 'info');
    return { ok: true };
  }

  // Switching from an existing vizier: enforce cooldown + cost
  if (v.active !== null) {
    const secs = getVizierCooldownSecs();
    if (secs > 0) return { ok: false, reason: `Appointment cooldown — ${secs}s remaining.` };
    if ((state.resources.gold ?? 0) < VIZIER_CHANGE_COST) {
      return { ok: false, reason: `Need ${VIZIER_CHANGE_COST} gold to change Vizier.` };
    }
    state.resources.gold -= VIZIER_CHANGE_COST;
  }

  const prev    = v.active;
  v.active      = id;
  v.lastChangedTick = state.tick;
  v.totalChanges++;

  // Diplomat bonus: +6 favor to every currently-allied empire
  if (id === 'diplomat' && state.diplomacy) {
    for (const emp of state.diplomacy.empires) {
      if (emp.relations === 'allied') {
        emp.favor = Math.min(DIPLOMAT_FAVOR_MAX, (emp.favor ?? 0) + DIPLOMAT_FAVOR_BONUS);
      }
    }
  }

  recalcRates();
  emit(Events.VIZIER_CHANGED, { appointed: id, prev });
  const def    = VIZIERS[id];
  const note   = prev ? ` (cost: ${VIZIER_CHANGE_COST}g)` : '';
  addMessage(`${def.icon} ${def.name} appointed as Grand Vizier.${note}`, 'info');
  return { ok: true };
}

// ── Rate-bonus helpers (imported by resources.js) ─────────────────────────

/** +1.5 gold/s flat bonus (chancellor). */
export function getVizierGoldRate() {
  return state.vizier?.active === 'chancellor' ? 1.5 : 0;
}

/** Mana production multiplier (archmage ×1.30). */
export function getVizierManaMult() {
  return state.vizier?.active === 'archmage' ? 1.30 : 1.0;
}

/** All positive production rates multiplier (architect ×1.05). */
export function getVizierProdMult() {
  return state.vizier?.active === 'architect' ? 1.05 : 1.0;
}

/** Trade route income multiplier (diplomat ×1.15). */
export function getVizierTradeMult() {
  return state.vizier?.active === 'diplomat' ? 1.15 : 1.0;
}
