/**
 * EmpireOS — Ancient Pact System (T230).
 *
 * At Iron Age+ (age ≥ 2), the player may forge an Ancient Pact with one
 * allied empire.  The pact deepens over time, granting growing rate bonuses.
 * It dissolves automatically if the alliance is broken.
 *
 * Activation cost: 200 prestige
 * Min Age:         Iron (age ≥ 2)
 * Requirement:     Allied with the target empire (relations === 'allied')
 * Limit:           1 active pact at a time
 * Cooldown:        10 minutes after dissolution
 *
 * Tier schedule (time elapsed since pact formed):
 *   Tier 1 (0 – 5 min)  : +0.5 gold/s
 *   Tier 2 (5 – 15 min) : +1.0 gold/s + 0.3 mana/s
 *   Tier 3 (15 min+)    : +1.5 gold/s + 0.5 mana/s + one-time +5 morale
 *
 * state.ancientPact = {
 *   active:        { empireId: string, startTick: number, tier: 1|2|3 } | null,
 *   cooldownUntil: number,
 *   totalPacts:    number,
 *   moraleBonus:   number,   // 0 or 5 — non-zero means tier-3 morale bonus was awarded
 * }
 */

import { state }            from '../core/state.js';
import { on, emit, Events } from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from './morale.js';
import { recalcRates }      from './resources.js';
import { EMPIRES }          from '../data/empires.js';
import { getPrestigeScore } from './prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_AGE             = 2;  // Iron Age
export const PACT_PRESTIGE_COST = 200;
const COOLDOWN_TICKS      = 10 * 60 * TICKS_PER_SECOND; // 10 min

const TIER2_TICKS = 5  * 60 * TICKS_PER_SECOND;  // 5 min
const TIER3_TICKS = 15 * 60 * TICKS_PER_SECOND;  // 15 min

// Rate bonuses per tier (additive to gold/mana base rates)
export const PACT_RATES = Object.freeze([
  null,                                         // index 0 unused
  { gold: 0.5, mana: 0.0 },                     // tier 1
  { gold: 1.0, mana: 0.3 },                     // tier 2
  { gold: 1.5, mana: 0.5 },                     // tier 3
]);
export const PACT_MORALE_BONUS = 5; // morale cap increase at tier 3

// ── Init ──────────────────────────────────────────────────────────────────

export function initAncientPact() {
  if (!state.ancientPact) {
    state.ancientPact = { active: null, cooldownUntil: 0, totalPacts: 0, moraleBonus: 0 };
  }
  if (state.ancientPact.cooldownUntil === undefined) state.ancientPact.cooldownUntil = 0;
  if (state.ancientPact.totalPacts    === undefined) state.ancientPact.totalPacts    = 0;
  if (state.ancientPact.moraleBonus   === undefined) state.ancientPact.moraleBonus   = 0;

  // Listen for alliance breakdown — dissolve pact automatically
  on(Events.DIPLOMACY_CHANGED, _checkAllianceIntegrity);
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function ancientPactTick() {
  const ap = state.ancientPact;
  if (!ap?.active) return;

  const elapsed = state.tick - ap.active.startTick;
  const newTier = elapsed >= TIER3_TICKS ? 3
                : elapsed >= TIER2_TICKS ? 2
                : 1;

  if (newTier !== ap.active.tier) {
    ap.active.tier = newTier;

    if (newTier === 2) {
      const empDef = EMPIRES[ap.active.empireId];
      addMessage(
        `🤝 Ancient Pact deepens with ${empDef?.name ?? ap.active.empireId}! ` +
        `Now: +1.0 gold/s + +0.3 mana/s`,
        'diplomacy',
      );
    } else if (newTier === 3) {
      ap.moraleBonus = PACT_MORALE_BONUS;
      changeMorale(PACT_MORALE_BONUS);
      const empDef = EMPIRES[ap.active.empireId];
      addMessage(
        `🤝 Ancient Pact reaches full strength with ${empDef?.name ?? ap.active.empireId}! ` +
        `Now: +1.5 gold/s + +0.5 mana/s + +${PACT_MORALE_BONUS} morale`,
        'diplomacy',
      );
    }

    recalcRates();
    emit(Events.ANCIENT_PACT_CHANGED, { tiered: newTier });
    emit(Events.RESOURCE_CHANGED, {});
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Attempt to forge an Ancient Pact with the specified empire.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function forgeAncientPact(empireId) {
  if (!state.ancientPact) initAncientPact();

  if ((state.age ?? 0) < MIN_AGE) {
    return { ok: false, reason: 'Requires Iron Age.' };
  }
  if (state.ancientPact.active) {
    return { ok: false, reason: 'Ancient Pact already active.' };
  }
  if (state.tick < (state.ancientPact.cooldownUntil ?? 0)) {
    const secs = getPactCooldownSecs();
    return { ok: false, reason: `Pact cooldown: ${secs}s remaining.` };
  }
  const emp = _getEmpire(empireId);
  if (!emp) {
    return { ok: false, reason: 'Unknown empire.' };
  }
  if (emp.relations !== 'allied') {
    const empDef = EMPIRES[empireId];
    return { ok: false, reason: `Must be allied with ${empDef?.name ?? empireId}.` };
  }
  const score = getPrestigeScore();
  if (score < PACT_PRESTIGE_COST) {
    return { ok: false, reason: `Need ${PACT_PRESTIGE_COST} prestige (have ${score}).` };
  }

  // Spend prestige directly (avoid awardPrestige message formatting)
  if (state.prestige) state.prestige.score -= PACT_PRESTIGE_COST;
  emit(Events.PRESTIGE_CHANGED, { score: state.prestige?.score ?? 0 });

  state.ancientPact.active      = { empireId, startTick: state.tick, tier: 1 };
  state.ancientPact.totalPacts  = (state.ancientPact.totalPacts ?? 0) + 1;
  state.ancientPact.moraleBonus = 0;

  const empDef = EMPIRES[empireId];
  recalcRates();
  emit(Events.ANCIENT_PACT_CHANGED, { forged: true, empireId });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🤝 Ancient Pact forged with ${empDef?.name ?? empireId}! ` +
    `+0.5 gold/s — grows stronger over time. (Cost: ${PACT_PRESTIGE_COST} prestige)`,
    'diplomacy',
  );
  return { ok: true };
}

/** Dissolve the active pact (can be called manually or automatically on alliance break). */
export function dissolveAncientPact(reason = 'dissolved') {
  const ap = state.ancientPact;
  if (!ap?.active) return;

  const empireId = ap.active.empireId;
  const empDef   = EMPIRES[empireId];

  ap.active           = null;
  ap.cooldownUntil    = state.tick + COOLDOWN_TICKS;
  ap.moraleBonus      = 0;

  recalcRates();
  emit(Events.ANCIENT_PACT_CHANGED, { dissolved: true, reason, empireId });
  emit(Events.RESOURCE_CHANGED, {});

  if (reason === 'alliance_broken') {
    addMessage(
      `💔 Ancient Pact with ${empDef?.name ?? empireId} dissolved — alliance broken!`,
      'warning',
    );
  } else {
    addMessage(
      `🤝 Ancient Pact with ${empDef?.name ?? empireId} dissolved.`,
      'info',
    );
  }
}

/** True when a pact is currently active. */
export function isAncientPactActive() {
  return !!(state.ancientPact?.active);
}

/** Current pact tier (1–3), or 0 when inactive. */
export function getPactTier() {
  return state.ancientPact?.active?.tier ?? 0;
}

/** Gold/s bonus from the active pact (0 when inactive). */
export function getPactGoldRate() {
  const tier = getPactTier();
  return PACT_RATES[tier]?.gold ?? 0;
}

/** Mana/s bonus from the active pact (0 when inactive). */
export function getPactManaRate() {
  const tier = getPactTier();
  return PACT_RATES[tier]?.mana ?? 0;
}

/** Morale cap bonus from the active pact (0 unless tier 3). */
export function getPactMoraleBonus() {
  return state.ancientPact?.moraleBonus ?? 0;
}

/** ID of the allied empire in the active pact, or null. */
export function getPactEmpireId() {
  return state.ancientPact?.active?.empireId ?? null;
}

/** Seconds on cooldown (0 when ready). */
export function getPactCooldownSecs() {
  if (!state.ancientPact) return 0;
  const until = state.ancientPact.cooldownUntil ?? 0;
  return state.tick >= until ? 0 : Math.ceil((until - state.tick) / TICKS_PER_SECOND);
}

/** Elapsed seconds since pact was forged. */
export function getPactElapsedSecs() {
  const a = state.ancientPact?.active;
  if (!a) return 0;
  return Math.floor((state.tick - a.startTick) / TICKS_PER_SECOND);
}

/** Seconds until next tier upgrade (0 if already at tier 3). */
export function getPactNextTierSecs() {
  const a = state.ancientPact?.active;
  if (!a) return 0;
  const elapsed = state.tick - a.startTick;
  if (a.tier === 1) return Math.max(0, Math.ceil((TIER2_TICKS - elapsed) / TICKS_PER_SECOND));
  if (a.tier === 2) return Math.max(0, Math.ceil((TIER3_TICKS - elapsed) / TICKS_PER_SECOND));
  return 0;
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _getEmpire(empireId) {
  return (state.diplomacy?.empires ?? []).find(e => e.id === empireId) ?? null;
}

function _checkAllianceIntegrity() {
  const ap = state.ancientPact;
  if (!ap?.active) return;
  const emp = _getEmpire(ap.active.empireId);
  if (!emp || emp.relations !== 'allied') {
    dissolveAncientPact('alliance_broken');
  }
}
