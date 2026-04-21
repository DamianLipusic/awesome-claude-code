/**
 * EmpireOS — Age Milestone Challenge System (T143)
 *
 * When the player advances to a new age (Bronze/Iron/Medieval), a 4-minute
 * time-limited challenge activates. Completing it earns a permanent in-game
 * bonus for the rest of the game:
 *
 *   Age 1 (Bronze):   Train 3 units    → +2 food/s permanent
 *   Age 2 (Iron):     Research 2 techs → −15% training costs permanent
 *   Age 3 (Medieval): Win 3 battles    → +10% all production rates permanent
 *
 * Permanent bonuses are applied inside resources.js (reads state.ageChallenges
 * directly) and actions.js trainUnit() (reads state.ageChallenges directly).
 *
 * State: state.ageChallenges = {
 *   results: { [age]: 'won' | 'lost' },
 *   active:  { age, icon, label, desc, type,
 *              startValue, target, expiresAt, bonusLabel } | null
 * }
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';
import { recalcRates }  from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const CHALLENGE_DURATION = 4 * 60 * TICKS_PER_SECOND;  // 960 ticks ≈ 4 min

const AGE_CHALLENGES = {
  1: {
    icon:        '🏹',
    label:       'Trial of Arms',
    desc:        'Train 3 military units within 4 minutes.',
    type:        'units',
    targetDelta: 3,
    bonusLabel:  '+2 food/s permanent',
  },
  2: {
    icon:        '🔬',
    label:       'Age of Knowledge',
    desc:        'Research 2 technologies within 4 minutes.',
    type:        'techs',
    targetDelta: 2,
    bonusLabel:  '−15% training costs permanent',
  },
  3: {
    icon:        '⚔️',
    label:       'The Great Campaign',
    desc:        'Win 3 battles within 4 minutes.',
    type:        'combat',
    targetDelta: 3,
    bonusLabel:  '+10% all production rates permanent',
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function initAgeChallenges() {
  if (!state.ageChallenges) {
    state.ageChallenges = { results: {}, active: null };
  }
}

/**
 * Called by main.js on AGE_CHANGED.
 * Starts the challenge for the new age if not already played.
 */
export function startAgeChallenge(age) {
  if (age < 1 || age > 3) return;
  if (!state.ageChallenges) initAgeChallenges();
  if (state.ageChallenges.results[age])           return; // already played
  if (state.ageChallenges.active?.age === age)    return; // already running

  const def        = AGE_CHALLENGES[age];
  const startValue = _metric(def.type);

  state.ageChallenges.active = {
    age,
    icon:        def.icon,
    label:       def.label,
    desc:        def.desc,
    type:        def.type,
    startValue,
    target:      startValue + def.targetDelta,
    expiresAt:   state.tick + CHALLENGE_DURATION,
    bonusLabel:  def.bonusLabel,
  };

  emit(Events.AGE_CHALLENGE_CHANGED, { age, status: 'started' });
  addMessage(
    `⚡ Age Challenge: ${def.label}! ${def.desc} Complete within 4 minutes to earn: ${def.bonusLabel}.`,
    'quest',
  );
}

/**
 * Called once per tick. Checks progress and handles expiry.
 */
export function ageChallengesTick() {
  const ch = state.ageChallenges?.active;
  if (!ch) return;

  const current = _metric(ch.type);

  if (current >= ch.target) {
    _resolve(ch, 'won');
    return;
  }
  if (state.tick >= ch.expiresAt) {
    _resolve(ch, 'lost');
  }
}

/**
 * Returns progress info for the active challenge (for the badge UI).
 * Returns null when no challenge is running.
 */
export function getActiveChallengeProgress() {
  const ch = state.ageChallenges?.active;
  if (!ch) return null;
  return {
    icon:      ch.icon,
    label:     ch.label,
    desc:      ch.desc,
    bonusLabel: ch.bonusLabel,
    current:   _metric(ch.type),
    target:    ch.target,
    secsLeft:  Math.max(0, Math.ceil((ch.expiresAt - state.tick) / TICKS_PER_SECOND)),
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _metric(type) {
  if (type === 'units')
    return Object.values(state.units ?? {}).reduce((a, b) => a + b, 0);
  if (type === 'techs')
    return Object.keys(state.techs ?? {}).length;
  if (type === 'combat')
    return (state.combatHistory ?? []).filter(h => h.outcome === 'win').length;
  return 0;
}

function _resolve(ch, result) {
  state.ageChallenges.results[ch.age] = result;
  state.ageChallenges.active          = null;

  if (result === 'won') {
    recalcRates();
    addMessage(`🏆 Age Challenge Won! ${ch.bonusLabel} has been permanently applied to your empire!`, 'quest');
  } else {
    addMessage(`⏱️ Age Challenge Failed — the ${ch.label} trial has ended without success.`, 'info');
  }

  emit(Events.AGE_CHALLENGE_CHANGED, { age: ch.age, status: result });
}
