/**
 * EmpireOS — Peace Overture (T222).
 *
 * During any active war, the player may dispatch a formal Peace Overture
 * to an enemy empire once per war. The overture costs prestige and has a
 * war-score-dependent acceptance chance:
 *
 *   warScore ≥ 15  →  75% acceptance (player is clearly winning)
 *   warScore 5–14  →  50% acceptance (evenly matched)
 *   warScore < 5   →  25% acceptance (player losing)
 *
 * On acceptance:  relations → neutral (war ends immediately).
 * On refusal:     player gains +10 warScore (diplomatic leverage).
 *
 * One attempt per war per empire. The attempted flag resets automatically
 * when the empire's relations return to neutral or allied (war ends).
 *
 * state.peaceOvertures = {
 *   attempted: { [empireId]: true },
 * }
 */

import { state }            from '../core/state.js';
import { emit, on, Events } from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { EMPIRES }          from '../data/empires.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const PRESTIGE_COST       = 40;
const REFUSE_WS_BONUS     = 10;

// warScore acceptance thresholds
const CHANCE_WINNING  = 0.75; // warScore ≥ 15
const CHANCE_EVEN     = 0.50; // warScore 5–14
const CHANCE_LOSING   = 0.25; // warScore < 5
const WS_WINNING_MIN  = 15;
const WS_EVEN_MIN     =  5;

export const OVERTURE_PRESTIGE_COST = PRESTIGE_COST;

// ── Init ──────────────────────────────────────────────────────────────────

export function initPeaceOvertures() {
  if (!state.peaceOvertures) {
    state.peaceOvertures = { attempted: {} };
  }
  if (!state.peaceOvertures.attempted) state.peaceOvertures.attempted = {};

  // Clear attempted flags whenever a war ends (relations leave 'war' state)
  on(Events.DIPLOMACY_CHANGED, _clearAttempted);
}

function _clearAttempted() {
  if (!state.peaceOvertures?.attempted || !state.diplomacy?.empires) return;
  for (const emp of state.diplomacy.empires) {
    if (emp.relations !== 'war') {
      delete state.peaceOvertures.attempted[emp.id];
    }
  }
}

// ── Validation ────────────────────────────────────────────────────────────

export function canSendOverture(empireId) {
  const po = state.peaceOvertures;
  if (!po) return { ok: false, reason: 'System not ready.' };

  const emp = state.diplomacy?.empires?.find(e => e.id === empireId);
  if (!emp)                    return { ok: false, reason: 'Empire not found.' };
  if (emp.relations !== 'war') return { ok: false, reason: 'Not at war with this empire.' };
  if (po.attempted[empireId]) return { ok: false, reason: 'Already sent an overture this war.' };

  const prestige = state.prestige?.score ?? 0;
  if (prestige < PRESTIGE_COST)
    return { ok: false, reason: `Need ${PRESTIGE_COST} prestige.` };

  return { ok: true };
}

// ── Action ────────────────────────────────────────────────────────────────

/**
 * Send a Peace Overture to the given empire.
 * Returns { ok: true, accepted: bool } or { ok: false, reason: string }.
 */
export function sendPeaceOverture(empireId) {
  const check = canSendOverture(empireId);
  if (!check.ok) return check;

  const po      = state.peaceOvertures;
  const emp     = state.diplomacy.empires.find(e => e.id === empireId);
  const empDef  = EMPIRES[empireId];
  const empName = empDef ? `${empDef.icon} ${empDef.name}` : empireId;
  const ws      = emp.warScore ?? 0;

  // Mark as attempted for this war
  po.attempted[empireId] = true;

  // Deduct prestige
  if (state.prestige) {
    state.prestige.score = Math.max(0, state.prestige.score - PRESTIGE_COST);
  }

  // Acceptance chance based on war score
  const chance =
    ws >= WS_WINNING_MIN ? CHANCE_WINNING :
    ws >= WS_EVEN_MIN    ? CHANCE_EVEN    : CHANCE_LOSING;
  const accepted = Math.random() < chance;

  if (accepted) {
    emp.relations = 'neutral';
    emp.warScore  = 0;
    addMessage(
      `🕊️ Peace Overture accepted! ${empName} agrees to end hostilities. Relations restored to neutral.`,
      'windfall',
    );
    emit(Events.DIPLOMACY_CHANGED, { empireId, action: 'peaceOverture', accepted: true });
  } else {
    emp.warScore = ws + REFUSE_WS_BONUS;
    addMessage(
      `📜 Peace Overture rejected by ${empName}. The war continues, but your resolve earns +${REFUSE_WS_BONUS} war score.`,
      'raid',
    );
    emit(Events.DIPLOMACY_CHANGED, { empireId, action: 'peaceOverture', accepted: false });
  }

  emit(Events.PEACE_OVERTURE_CHANGED, { empireId, accepted });
  return { ok: true, accepted };
}

// ── Accessors ─────────────────────────────────────────────────────────────

export function hasAttemptedOverture(empireId) {
  return !!(state.peaceOvertures?.attempted?.[empireId]);
}
