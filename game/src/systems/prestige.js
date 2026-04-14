/**
 * EmpireOS — Empire Prestige System (T080).
 *
 * Prestige is a cumulative empire-wide score earned through major accomplishments:
 *   - Age advance        : +100 × new age index
 *   - Wonder built       : +200 per wonder
 *   - Battle victory     : +5 per win
 *   - New alliance       : +50
 *   - Quest completed    : +30
 *   - Tech mastery       : +100 per mastery group
 *   - Tech synergy       : +75 per synergy pair
 *
 * Milestone thresholds unlock permanent production bonuses applied in resources.js:
 *   500  — Renowned Kingdom   : +1 gold/s
 *   1000 — Great Power        : +1 food/s, +1 wood/s
 *   2000 — Dominant Empire    : +200 to all resource caps
 *   3500 — Continental Hegemon: +2 gold/s, +1 iron/s, +1 mana/s
 *   5000 — World Wonder       : all positive production rates ×1.15
 *
 * State: state.prestige = { score: number, milestones: number[] }
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';

// ── Milestone definitions ──────────────────────────────────────────────────

export const PRESTIGE_MILESTONES = [
  {
    threshold: 500,
    name:      'Renowned Kingdom',
    icon:      '👑',
    bonusDesc: '+1 gold/s base income',
  },
  {
    threshold: 1000,
    name:      'Great Power',
    icon:      '🌟',
    bonusDesc: '+1 food/s and +1 wood/s',
  },
  {
    threshold: 2000,
    name:      'Dominant Empire',
    icon:      '🏰',
    bonusDesc: '+200 to all resource storage caps',
  },
  {
    threshold: 3500,
    name:      'Continental Hegemon',
    icon:      '⚔️',
    bonusDesc: '+2 gold/s, +1 iron/s, +1 mana/s',
  },
  {
    threshold: 5000,
    name:      'World Wonder',
    icon:      '🌍',
    bonusDesc: 'All positive production rates ×1.15',
  },
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise prestige state. Idempotent — safe to call on every boot/new game.
 */
export function initPrestige() {
  if (!state.prestige) {
    state.prestige = { score: 0, milestones: [] };
  }
  // Migration guards for older saves
  if (typeof state.prestige.score !== 'number') state.prestige.score = 0;
  if (!Array.isArray(state.prestige.milestones)) state.prestige.milestones = [];
}

/**
 * Award prestige points to the player's empire.
 * @param {number} amount  Points to add (positive integer)
 * @param {string} reason  Short human-readable description (for the log message)
 */
export function awardPrestige(amount, reason) {
  if (!state.prestige) initPrestige();
  state.prestige.score += amount;
  _checkMilestones();
  emit(Events.PRESTIGE_CHANGED, { score: state.prestige.score });
  addMessage(`✨ +${amount} prestige — ${reason}`, 'info');
}

/**
 * Returns the current prestige score (0 if not initialised).
 */
export function getPrestigeScore() {
  return state.prestige?.score ?? 0;
}

// ── Internal ───────────────────────────────────────────────────────────────

function _checkMilestones() {
  for (const m of PRESTIGE_MILESTONES) {
    if (
      state.prestige.score >= m.threshold &&
      !state.prestige.milestones.includes(m.threshold)
    ) {
      state.prestige.milestones.push(m.threshold);
      addMessage(
        `🏆 Prestige Milestone: ${m.icon} "${m.name}"! ${m.bonusDesc} unlocked permanently.`,
        'achievement',
      );
      emit(Events.PRESTIGE_CHANGED, { score: state.prestige.score, milestone: m.threshold });
    }
  }
}
