/**
 * EmpireOS — Hero System Tick Handler (T086).
 *
 * Manages the Hero Training Expedition feature:
 *   - Hero can be sent on a 2–3 minute training expedition when healthy.
 *   - During expedition: hero is unavailable for combat (no attack bonus, no abilities).
 *   - On return: hero gains 2 combatWins (may trigger skill level-up) + 25% chance of
 *     100–200 gold bonus.
 *
 * State fields added to state.hero:
 *   expedition: { active: boolean, endsAt: number } | null
 *
 * This module registers heroTick() as a tick system in main.js.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { HERO_DEF, HERO_SKILLS, HERO_SKILL_WIN_INTERVAL, HERO_MAX_SKILLS } from '../data/hero.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { recalcRates } from './resources.js';

// Expedition duration: random 2–3 minutes
const EXPEDITION_MIN_TICKS = 480;  // 2 min
const EXPEDITION_MAX_TICKS = 720;  // 3 min

// XP equivalent gained on return (counts as 2 combat victories)
const EXPEDITION_WIN_CREDIT = 2;

// Gold bonus on return (25% chance, 100–200 gold)
const EXPEDITION_GOLD_CHANCE = 0.25;
const EXPEDITION_GOLD_MIN    = 100;
const EXPEDITION_GOLD_MAX    = 200;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Send the hero on a training expedition.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function sendOnExpedition() {
  if (!state.hero?.recruited) {
    return { ok: false, reason: 'No hero has been recruited.' };
  }
  if (state.hero.injured) {
    return { ok: false, reason: 'Champion is recovering from injuries.' };
  }
  if (state.hero.expedition?.active) {
    return { ok: false, reason: 'Champion is already on expedition.' };
  }

  const durationTicks = EXPEDITION_MIN_TICKS
    + Math.floor(Math.random() * (EXPEDITION_MAX_TICKS - EXPEDITION_MIN_TICKS));

  state.hero.expedition = {
    active:     true,
    startedAt:  state.tick,
    endsAt:     state.tick + durationTicks,
    totalTicks: durationTicks,
  };

  const mins = Math.ceil(durationTicks / (TICKS_PER_SECOND * 60));
  addMessage(
    `⭐ Champion departed on a training expedition — returns in ~${mins} minute${mins !== 1 ? 's' : ''}.`,
    'hero',
  );
  emit(Events.HERO_CHANGED, {});
  emit(Events.HERO_EXPEDITION, { departed: true });
  return { ok: true };
}

/**
 * Recall the hero from an expedition immediately — no reward.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function recallExpedition() {
  if (!state.hero?.expedition?.active) {
    return { ok: false, reason: 'Hero is not on expedition.' };
  }

  state.hero.expedition = { active: false, endsAt: 0 };
  addMessage('⭐ Champion recalled from expedition — no reward earned.', 'hero');
  emit(Events.HERO_CHANGED, {});
  emit(Events.HERO_EXPEDITION, { recalled: true });
  return { ok: true };
}

/**
 * Tick handler — completes the expedition when timer elapses.
 * Registered as a tick system in main.js.
 */
export function heroTick() {
  if (!state.hero?.recruited || !state.hero.expedition?.active) return;

  if (state.tick < state.hero.expedition.endsAt) return;

  // Expedition complete — award XP credits
  state.hero.expedition = { active: false, endsAt: 0 };

  const wins = (state.hero.combatWins ?? 0) + EXPEDITION_WIN_CREDIT;
  state.hero.combatWins = wins;

  // Check for skill level-up
  const skills    = state.hero.skills ?? [];
  const maxed     = skills.length >= HERO_MAX_SKILLS;
  const milestone = Math.floor(wins / HERO_SKILL_WIN_INTERVAL) * HERO_SKILL_WIN_INTERVAL;
  const prevMile  = Math.floor((wins - EXPEDITION_WIN_CREDIT) / HERO_SKILL_WIN_INTERVAL) * HERO_SKILL_WIN_INTERVAL;

  const earnedSkill = !maxed && milestone > prevMile && wins >= HERO_SKILL_WIN_INTERVAL;

  if (earnedSkill && !state.hero.pendingSkillOffer) {
    // Pick 3 random skills from the pool that aren't already learned
    const pool    = HERO_SKILLS.filter(s => !skills.includes(s.id));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const offer   = shuffled.slice(0, 3).map(s => s.id);
    state.hero.pendingSkillOffer = offer;
    emit(Events.HERO_LEVEL_UP, { wins });
  }

  // Random gold bonus
  let bonusMsg = '';
  if (Math.random() < EXPEDITION_GOLD_CHANCE) {
    const bonus = EXPEDITION_GOLD_MIN + Math.floor(Math.random() * (EXPEDITION_GOLD_MAX - EXPEDITION_GOLD_MIN + 1));
    const cap   = state.caps?.gold ?? 500;
    state.resources.gold = Math.min(cap, (state.resources.gold ?? 0) + bonus);
    bonusMsg = ` Found ${bonus} 💰 gold on the road!`;
    emit(Events.RESOURCE_CHANGED, {});
  }

  const skillMsg = earnedSkill ? ' A new skill is available!' : '';
  addMessage(
    `⭐ Champion returned from training — gained experience (+${EXPEDITION_WIN_CREDIT} victories).${bonusMsg}${skillMsg}`,
    'hero',
  );

  emit(Events.HERO_CHANGED, {});
  emit(Events.HERO_EXPEDITION, { returned: true });
}

/**
 * Whether the hero is currently on a training expedition.
 */
export function isOnExpedition() {
  return !!(state.hero?.expedition?.active);
}

/**
 * Seconds remaining on the current expedition. 0 if none.
 */
export function expeditionSecsLeft() {
  if (!state.hero?.expedition?.active) return 0;
  return Math.max(0, Math.ceil((state.hero.expedition.endsAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Fraction complete (0–1) of the current expedition. 0 if none.
 */
export function expeditionProgress() {
  const exp = state.hero?.expedition;
  if (!exp?.active) return 0;
  const total   = exp.totalTicks ?? EXPEDITION_MAX_TICKS;
  const elapsed = state.tick - (exp.startedAt ?? (exp.endsAt - total));
  return Math.max(0, Math.min(1, elapsed / total));
}

// ── T118: Hero Enshrinement ───────────────────────────────────────────────

// Legacy resource rate bonus per skill type (at ~50% of the live skill's value).
// Converts every skill into a meaningful permanent rate bonus.
const LEGACY_RATES_BY_SKILL = {
  battle_hardened:    { gold: 0.4 },               // veteran soldiers send tribute
  war_drums:          { gold: 0.6 },               // war glory generates wealth
  logistics:          { food: 0.3, wood: 0.2 },    // supply chain expertise
  treasury_guard:     { gold: 0.4 },               // half of +0.8 gold/s
  quartermaster:      { food: 0.3 },               // half of +0.6 food/s
  arcane_attunement:  { mana: 0.25 },              // half of +0.5 mana/s
  swift_training:     { iron: 0.3 },               // weapons mastery legacy
  veteran_knowledge:  { mana: 0.3 },               // accumulated scholarship
  iron_will:          { food: 0.3 },               // inspired citizens produce more
  war_profiteer:      { gold: 0.5 },               // stored war treasure dividends
};

/** Max number of heroes that can be enshrined per game. */
export const ENSHRINE_MAX = 2;

/** Prestige awarded when a hero is enshrined. */
export const ENSHRINE_PRESTIGE = 200;

/** Returns true if the current hero meets the enshrinement requirements. */
export function canEnshrineHero() {
  const h  = state.hero;
  if (!h?.recruited) return false;
  if (h.expedition?.active || h.injured) return false;
  if ((h.skills ?? []).length < HERO_MAX_SKILLS) return false;
  if ((h.combatWins ?? 0) < 10) return false;
  const enshrined = state.heroLegacy?.totalEnshrined ?? 0;
  if (enshrined >= ENSHRINE_MAX) return false;
  return true;
}

/**
 * Enshrine the current hero as a lasting empire legacy.
 * Clears state.hero (allowing a new recruit) and records the legacy rates.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function enshrineHero() {
  if (!canEnshrineHero()) {
    const h = state.hero;
    if (!h?.recruited) return { ok: false, reason: 'No hero recruited.' };
    if (h.expedition?.active) return { ok: false, reason: 'Champion is on expedition.' };
    if (h.injured) return { ok: false, reason: 'Champion is still recovering.' };
    if ((h.skills ?? []).length < HERO_MAX_SKILLS) {
      return { ok: false, reason: `Champion needs all ${HERO_MAX_SKILLS} skills before enshrinement.` };
    }
    if ((h.combatWins ?? 0) < 10) {
      return { ok: false, reason: 'Champion needs 10+ combat victories to be enshrined.' };
    }
    const enshrined = state.heroLegacy?.totalEnshrined ?? 0;
    if (enshrined >= ENSHRINE_MAX) {
      return { ok: false, reason: `Maximum ${ENSHRINE_MAX} heroes can be enshrined per game.` };
    }
  }

  const skills = [...(state.hero.skills ?? [])];

  // Compute cumulative legacy rates from this hero's skills
  const rates = {};
  for (const id of skills) {
    const bonus = LEGACY_RATES_BY_SKILL[id];
    if (!bonus) continue;
    for (const [res, val] of Object.entries(bonus)) {
      rates[res] = (rates[res] ?? 0) + val;
    }
  }

  // Build rate description for display
  const rateDesc = Object.entries(rates)
    .map(([res, val]) => `+${val.toFixed(2)}/s ${res}`)
    .join(', ');

  if (!state.heroLegacy) {
    state.heroLegacy = { enshrined: [], totalEnshrined: 0 };
  }

  state.heroLegacy.enshrined.push({ skillIds: skills, rates });
  state.heroLegacy.totalEnshrined++;

  // Retire the hero
  state.hero = null;

  recalcRates();
  emit(Events.HERO_ENSHRINED, { skillIds: skills, rates });
  emit(Events.HERO_CHANGED, {});
  emit(Events.RESOURCE_CHANGED);

  addMessage(
    `🏛️ Champion enshrined as a legend of the empire! Their legacy lives on: ${rateDesc}.`,
    'success',
  );

  return { ok: true, rates, rateDesc };
}
