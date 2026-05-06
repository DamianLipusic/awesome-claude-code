/**
 * EmpireOS — T210: War Reparations.
 *
 * After accumulating 15+ war score against an enemy empire (≈3 tile captures),
 * the player can demand war reparations, costing 50 prestige.
 *
 * Outcomes (one per war per empire):
 *   Pays (40–85% chance based on war score):
 *     — gold reward = 100 + warScore × 5
 *     — empire relations → neutral
 *   Refuses:
 *     — player morale +8
 *     — Righteous Anger: +10% attack power for 120 seconds
 *
 * The demanded flag is cleared when the war ends (DIPLOMACY_CHANGED listener).
 *
 * state.reparations = {
 *   demanded:        { [empireId]: true },
 *   angryBonusUntil: tick,
 *   totalReceived:   number,
 * }
 */

import { state }               from '../core/state.js';
import { emit, on, Events }    from '../core/events.js';
import { addMessage }          from '../core/actions.js';
import { awardPrestige, getPrestigeScore } from './prestige.js';
import { changeMorale }        from './morale.js';
import { EMPIRES }             from '../data/empires.js';
import { TICKS_PER_SECOND }    from '../core/tick.js';

export const REPARATIONS_PRESTIGE_COST = 50;
export const REPARATIONS_WAR_SCORE_MIN = 15;   // ≈3 tile captures
export const RIGHTEOUS_ANGER_DURATION  = 120 * TICKS_PER_SECOND; // 120 s
export const RIGHTEOUS_ANGER_MULT      = 1.10; // +10% attack

const BASE_GOLD        = 100;
const GOLD_PER_WSCORE  = 5;

// ── Init ─────────────────────────────────────────────────────────────────────

let _listenerRegistered = false;

export function initReparations() {
  if (!state.reparations) {
    state.reparations = { demanded: {}, angryBonusUntil: 0, totalReceived: 0 };
  }
  if (!_listenerRegistered) {
    on(Events.DIPLOMACY_CHANGED, _onDiplomacyChanged);
    _listenerRegistered = true;
  }
}

// Clear demanded entries for empires no longer at war.
function _onDiplomacyChanged() {
  if (!state.reparations?.demanded || !state.diplomacy) return;
  for (const empireId of Object.keys(state.reparations.demanded)) {
    const emp = state.diplomacy.empires?.find(e => e.id === empireId);
    if (!emp || emp.relations !== 'war') {
      delete state.reparations.demanded[empireId];
    }
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns { ok: true } if reparations can be demanded from empireId,
 * or { ok: false, reason } if blocked.
 */
export function canDemandReparations(empireId) {
  if (!state.reparations) return { ok: false, reason: 'System not initialised.' };

  const emp = state.diplomacy?.empires?.find(e => e.id === empireId);
  if (!emp || emp.relations !== 'war')
    return { ok: false, reason: 'Not currently at war with this empire.' };

  const ws = emp.warScore ?? 0;
  if (ws < REPARATIONS_WAR_SCORE_MIN)
    return { ok: false, reason: `Need ${REPARATIONS_WAR_SCORE_MIN} war score (have ${ws}).` };

  if (state.reparations.demanded[empireId])
    return { ok: false, reason: 'Already demanded reparations in this war.' };

  if (getPrestigeScore() < REPARATIONS_PRESTIGE_COST)
    return { ok: false, reason: `Requires ${REPARATIONS_PRESTIGE_COST} prestige (have ${getPrestigeScore()}).` };

  return { ok: true };
}

/**
 * Returns true if the Righteous Anger attack bonus is active.
 */
export function isAngryBonusActive() {
  return (state.reparations?.angryBonusUntil ?? 0) > (state.tick ?? 0);
}

/**
 * Returns seconds remaining on the Righteous Anger bonus (0 when inactive).
 */
export function getAngryBonusSecs() {
  const remaining = (state.reparations?.angryBonusUntil ?? 0) - (state.tick ?? 0);
  return Math.max(0, Math.ceil(remaining / TICKS_PER_SECOND));
}

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * Demand war reparations from an empire.
 * @param {string} empireId
 * @returns {{ ok: boolean, reason?: string, outcome?: 'paid'|'refused' }}
 */
export function demandReparations(empireId) {
  if (!state.reparations) initReparations();

  const check = canDemandReparations(empireId);
  if (!check.ok) return check;

  const emp    = state.diplomacy.empires.find(e => e.id === empireId);
  const empDef = EMPIRES[empireId];
  const ws     = emp.warScore ?? 0;

  // Deduct prestige cost
  awardPrestige(-REPARATIONS_PRESTIGE_COST);

  // Mark demanded for this war
  state.reparations.demanded[empireId] = true;

  // Pay chance scales with war score: 40% base → 85% max at warScore ≥ 45
  const payChance = Math.min(0.85, 0.40 + ws * 0.01);
  const pays      = Math.random() < payChance;

  if (pays) {
    const goldAward = BASE_GOLD + ws * GOLD_PER_WSCORE;
    state.resources.gold = Math.min(
      state.caps?.gold ?? 9999,
      (state.resources.gold ?? 0) + goldAward
    );
    state.reparations.totalReceived += goldAward;

    // Empire capitulates: relations → neutral, warScore reset
    emp.relations = 'neutral';
    emp.warScore  = 0;

    addMessage(
      `💰 ${empDef?.name ?? empireId} paid ${goldAward}💰 in war reparations and withdrew from the conflict!`,
      'diplomacy'
    );
    emit(Events.REPARATIONS_DEMANDED, { empireId, outcome: 'paid', goldAward });
    emit(Events.RESOURCE_CHANGED, {});
    emit(Events.DIPLOMACY_CHANGED, {});
    return { ok: true, outcome: 'paid' };
  } else {
    // Defiant refusal — triggers Righteous Anger
    changeMorale(8);
    state.reparations.angryBonusUntil = state.tick + RIGHTEOUS_ANGER_DURATION;

    addMessage(
      `⚔️ ${empDef?.name ?? empireId} refused our demands! Righteous Anger: +10% attack for 120s.`,
      'combat-win'
    );
    emit(Events.REPARATIONS_DEMANDED, { empireId, outcome: 'refused' });
    emit(Events.MORALE_CHANGED, {});
    return { ok: true, outcome: 'refused' };
  }
}
