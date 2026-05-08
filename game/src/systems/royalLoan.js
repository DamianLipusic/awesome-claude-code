/**
 * EmpireOS — Royal Loan System (T237).
 *
 * Players can borrow gold from the royal treasury and repay it with interest.
 * One active loan at a time; repayment is automatic when the due date arrives.
 * If the player cannot fully repay, a partial deduction is made and a default
 * penalty (−12 morale + story entry) is applied.
 *
 * Loan tiers:
 *   bronze — borrow 150 gold, repay 220 in 5 min   (any age, requires Market)
 *   silver — borrow 300 gold, repay 450 in 7 min   (Bronze Age+, age ≥ 1)
 *   gold   — borrow 600 gold, repay 900 in 10 min  (Iron Age+, age ≥ 2)
 *
 * Cooldown: 8 minutes after the loan closes (repaid or defaulted).
 *
 * state.royalLoan = {
 *   active:        { tier, borrowed, repayGold, dueAt } | null,
 *   cooldownUntil: tick,
 *   totalLoans:    number,
 *   defaults:      number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

export const LOAN_COOLDOWN = 8 * 60 * TICKS_PER_SECOND;  // 1920 ticks — 8 min

export const LOAN_TIERS = Object.freeze({
  bronze: {
    id:          'bronze',
    icon:        '🪙',
    name:        'Bronze Loan',
    label:       'Bronze Loan — 150 gold',
    borrowed:    150,
    repayGold:   220,
    durationMin: 5,
    durationTicks: 5 * 60 * TICKS_PER_SECOND,
    minAge:      0,
    desc:        'Borrow 150 gold. Repay 220 gold in 5 minutes.',
  },
  silver: {
    id:          'silver',
    icon:        '🥈',
    name:        'Silver Loan',
    label:       'Silver Loan — 300 gold',
    borrowed:    300,
    repayGold:   450,
    durationMin: 7,
    durationTicks: 7 * 60 * TICKS_PER_SECOND,
    minAge:      1,
    desc:        'Borrow 300 gold. Repay 450 gold in 7 minutes. (Bronze Age+)',
  },
  gold: {
    id:          'gold',
    icon:        '🏅',
    name:        'Gold Loan',
    label:       'Gold Loan — 600 gold',
    borrowed:    600,
    repayGold:   900,
    durationMin: 10,
    durationTicks: 10 * 60 * TICKS_PER_SECOND,
    minAge:      2,
    desc:        'Borrow 600 gold. Repay 900 gold in 10 minutes. (Iron Age+)',
  },
});

const DEFAULT_MORALE_PENALTY = -12;

// ── Init ──────────────────────────────────────────────────────────────────

export function initRoyalLoan() {
  if (!state.royalLoan) {
    state.royalLoan = {
      active:        null,
      cooldownUntil: 0,
      totalLoans:    0,
      defaults:      0,
    };
  }
  if (state.royalLoan.totalLoans === undefined) state.royalLoan.totalLoans = 0;
  if (state.royalLoan.defaults   === undefined) state.royalLoan.defaults   = 0;
  if (state.royalLoan.cooldownUntil === undefined) state.royalLoan.cooldownUntil = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function royalLoanTick() {
  const rl = state.royalLoan;
  if (!rl?.active) return;

  if (state.tick < rl.active.dueAt) return;

  // Loan is due — attempt repayment
  const currentGold = state.resources.gold ?? 0;
  const repay       = rl.active.repayGold;

  if (currentGold >= repay) {
    // Full repayment
    state.resources.gold -= repay;
    rl.active        = null;
    rl.cooldownUntil = state.tick + LOAN_COOLDOWN;
    emit(Events.LOAN_CHANGED, { action: 'repaid' });
    emit(Events.RESOURCE_CHANGED, {});
    addMessage(`🏦 Royal loan repaid in full (−${repay} gold). Treasury restored.`, 'info');
  } else {
    // Default — deduct what we can, apply penalty
    state.resources.gold = 0;
    rl.defaults      = (rl.defaults ?? 0) + 1;
    rl.active        = null;
    rl.cooldownUntil = state.tick + LOAN_COOLDOWN;
    changeMorale(DEFAULT_MORALE_PENALTY);
    emit(Events.LOAN_CHANGED, { action: 'defaulted' });
    emit(Events.RESOURCE_CHANGED, {});
    const shortfall = repay - currentGold;
    addMessage(
      `⚠️ Royal loan defaulted! Treasury had only ${Math.floor(currentGold)} gold — ${Math.floor(shortfall)} gold short. −${Math.abs(DEFAULT_MORALE_PENALTY)} morale.`,
      'raid',
    );
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Take out a royal loan.
 * @param {'bronze'|'silver'|'gold'} tierId
 * @returns {{ ok: boolean, reason?: string }}
 */
export function takeLoan(tierId) {
  const rl   = state.royalLoan;
  const tier = LOAN_TIERS[tierId];

  if (!tier) return { ok: false, reason: 'Unknown loan tier.' };
  if (!rl)   return { ok: false, reason: 'Loan system not initialised.' };

  if ((state.buildings?.market ?? 0) < 1) {
    return { ok: false, reason: 'Requires a Market building.' };
  }
  if ((state.age ?? 0) < tier.minAge) {
    const ageNames = ['Stone', 'Bronze', 'Iron', 'Medieval'];
    return { ok: false, reason: `Requires ${ageNames[tier.minAge] ?? 'higher'} Age.` };
  }
  if (rl.active) {
    return { ok: false, reason: 'You already have an active loan.' };
  }
  if (state.tick < rl.cooldownUntil) {
    const secs = Math.ceil((rl.cooldownUntil - state.tick) / TICKS_PER_SECOND);
    return { ok: false, reason: `Loan cooldown: ${secs}s remaining.` };
  }

  // Disburse funds
  const cap = state.caps.gold ?? 500;
  state.resources.gold = Math.min(cap, (state.resources.gold ?? 0) + tier.borrowed);

  rl.active = {
    tier:       tierId,
    borrowed:   tier.borrowed,
    repayGold:  tier.repayGold,
    dueAt:      state.tick + tier.durationTicks,
  };
  rl.totalLoans = (rl.totalLoans ?? 0) + 1;

  emit(Events.LOAN_CHANGED, { action: 'taken', tier: tierId });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🏦 ${tier.name} taken! +${tier.borrowed} gold deposited. Repay ${tier.repayGold} gold in ${tier.durationMin} minutes.`,
    'info',
  );
  return { ok: true };
}

/** Returns the active loan object or null. */
export function getActiveLoan() {
  return state.royalLoan?.active ?? null;
}

/** Seconds until loan is due (0 when no active loan). */
export function getLoanSecsLeft() {
  const a = state.royalLoan?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.dueAt - state.tick) / TICKS_PER_SECOND));
}

/** Seconds until next loan can be taken (0 when ready). */
export function getLoanCooldownSecs() {
  if (state.royalLoan?.active) return 0;
  const until = state.royalLoan?.cooldownUntil ?? 0;
  return state.tick >= until ? 0 : Math.ceil((until - state.tick) / TICKS_PER_SECOND);
}
