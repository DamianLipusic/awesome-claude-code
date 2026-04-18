/**
 * EmpireOS — Warlord Duel Events (T109).
 *
 * While the player is at war with an enemy empire and has a recruited,
 * non-injured, non-expeditioning hero, enemy warlords periodically issue
 * champion duel challenges.  The player has 45 s to Accept or Decline.
 *
 * Accept → win chance = 30% base + 15% per hero skill (max 85%); +10% if Conqueror
 *   Win:  +150–300 gold · +100 prestige · morale +10 · enemy raid deferred 120 s
 *   Lose: hero injured 5 min · morale −12 · −50 gold
 * Decline → morale −5
 *
 * A new challenge fires 4–7 minutes after the previous one resolves.
 * state.duels saved/loaded (backwards-compat null default). No version bump.
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { awardPrestige }    from './prestige.js';
import { changeMorale }     from './morale.js';

// ── Constants ──────────────────────────────────────────────────────────────

const CHALLENGE_MIN   = 4 * 60 * TICKS_PER_SECOND;  // 4 min  → 960 ticks
const CHALLENGE_MAX   = 7 * 60 * TICKS_PER_SECOND;  // 7 min  → 1680 ticks
const DURATION        = 45 * TICKS_PER_SECOND;       // 45 s   → 180 ticks
const COOLDOWN        = 5 * 60 * TICKS_PER_SECOND;   // 5 min  → 1200 ticks
const HERO_RECOVERY   = 5 * 60 * TICKS_PER_SECOND;   // 5 min injury (matches combat.js)
const RAID_DEFERRAL   = 120 * TICKS_PER_SECOND;      // 120 s enemy demoralized

const WARLORD_NAMES = {
  ironHorde:   'Warlord Grak',
  mageCouncil: 'Archon Veyra',
  seaWolves:   'Captain Dusk',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function _rand(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function _closePending() {
  state.duels.pending           = null;
  state.duels.cooldownUntil     = state.tick + COOLDOWN;
  state.duels.nextChallengeTick = state.tick + COOLDOWN + _rand(CHALLENGE_MIN, CHALLENGE_MAX);
}

function _recordHistory(empireId, won) {
  state.duels.history.unshift({ tick: state.tick, empireId, won });
  if (state.duels.history.length > 10) state.duels.history.length = 10;
}

// ── Public API ─────────────────────────────────────────────────────────────

export function initDuels() {
  if (state.duels !== null) return;
  state.duels = {
    pending:           null,
    nextChallengeTick: state.tick + _rand(CHALLENGE_MIN, CHALLENGE_MAX),
    cooldownUntil:     0,
    history:           [],
  };
}

export function duelTick() {
  if (!state.duels) return;

  // Expire stale pending challenge
  if (state.duels.pending && state.tick >= state.duels.pending.deadline) {
    const d = state.duels.pending;
    _closePending();
    addMessage(`${d.warlordName}'s duel challenge went unanswered.`, 'warning');
    emit(Events.DUEL_CHANGED, { phase: 'expired', empireId: d.empireId });
    return;
  }

  if (state.duels.pending) return;
  if (state.tick < state.duels.nextChallengeTick) return;
  if (state.tick < state.duels.cooldownUntil) return;

  // Hero must be recruited, healthy, and not on expedition
  if (!state.hero?.recruited || state.hero.injured || state.hero.expedition?.active) return;

  // At least one empire must be at war
  const warEmpires = (state.diplomacy?.empires ?? []).filter(e => e.relations === 'war');
  if (warEmpires.length === 0) {
    state.duels.nextChallengeTick = state.tick + _rand(CHALLENGE_MIN, CHALLENGE_MAX);
    return;
  }

  const target      = warEmpires[Math.floor(Math.random() * warEmpires.length)];
  const warlordName = WARLORD_NAMES[target.id] ?? 'Enemy Warlord';
  state.duels.pending = { empireId: target.id, warlordName, deadline: state.tick + DURATION };

  addMessage(
    `⚔️ ${warlordName} challenges your champion to single combat! Respond within 45 s.`,
    'warning',
  );
  emit(Events.DUEL_CHANGED, { phase: 'challenged', empireId: target.id });
}

/**
 * Accept the pending duel challenge.
 * @returns {{ ok: boolean, won?: boolean, reason?: string }}
 */
export function acceptDuel() {
  if (!state.duels?.pending) return { ok: false, reason: 'No pending challenge.' };
  const d = state.duels.pending;
  _closePending();

  // Win chance: 30% base + 15% per skill; +10% for Conqueror archetype; cap at 85%
  const skills    = state.hero?.skills?.length ?? 0;
  const bonus     = state.archetype === 'conqueror' ? 0.10 : 0;
  const winChance = Math.min(0.85, 0.30 + skills * 0.15 + bonus);
  const won       = Math.random() < winChance;

  _recordHistory(d.empireId, won);

  if (won) {
    const loot = 150 + Math.floor(Math.random() * 151);
    state.resources.gold = Math.min(state.caps.gold, state.resources.gold + loot);
    awardPrestige(100);
    changeMorale(+10);
    // Defer enemy raid for 120 s so victory feels meaningful
    const emp = state.diplomacy?.empires?.find(e => e.id === d.empireId);
    if (emp) emp.nextWarRaidTick = state.tick + RAID_DEFERRAL;
    addMessage(
      `🏆 Your champion defeats ${d.warlordName}! +${loot} gold · +100 prestige · enemy demoralized.`,
      'windfall',
    );
  } else {
    state.resources.gold = Math.max(0, state.resources.gold - 50);
    if (state.hero) {
      state.hero.injured       = true;
      state.hero.recoveryUntil = state.tick + HERO_RECOVERY;
    }
    changeMorale(-12);
    addMessage(
      `💀 Your champion falls to ${d.warlordName}! Hero injured · −50 gold · morale −12.`,
      'combat-loss',
    );
  }

  emit(Events.RESOURCE_CHANGED);
  emit(Events.HERO_CHANGED);
  emit(Events.DUEL_CHANGED, { phase: won ? 'won' : 'lost', empireId: d.empireId });
  return { ok: true, won };
}

/**
 * Decline the pending duel challenge.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function declineDuel() {
  if (!state.duels?.pending) return { ok: false, reason: 'No pending challenge.' };
  const d = state.duels.pending;
  _closePending();
  changeMorale(-5);
  addMessage(`${d.warlordName}'s challenge was declined. Morale suffers −5.`, 'warning');
  emit(Events.DUEL_CHANGED, { phase: 'declined', empireId: d.empireId });
  return { ok: true };
}

/** Seconds until the pending challenge expires (0 if none). */
export function getDuelSecsLeft() {
  if (!state.duels?.pending) return 0;
  return Math.max(0, Math.ceil((state.duels.pending.deadline - state.tick) / TICKS_PER_SECOND));
}
