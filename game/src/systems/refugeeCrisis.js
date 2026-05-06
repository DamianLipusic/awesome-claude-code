/**
 * EmpireOS — Refugee Crisis System (T217).
 *
 * At Bronze Age+, a refugee crisis emerges every 12–18 minutes.
 * Displaced people from a neighboring faction arrive at the border.
 * The player has 90 seconds to respond via the refugee banner.
 *
 * Response options:
 *   accept     — free; +25–50 population; food rate −0.4/s for 2 minutes
 *   integrate  — costs 80g + 60 food; +pop; permanent +0.15/s in a random
 *                resource (gold|food|wood|stone|iron)
 *   decline    — no cost; −0.1 diplomatic relations with source faction;
 *                small reputation hit
 *
 * state.refugees = {
 *   current: {
 *     count:           number,   // 25–50 refugees
 *     sourceFactionId: string,   // faction id (empire1 | empire2 | empire3)
 *     sourceName:      string,   // human-readable faction name
 *     expiresAt:       number,   // tick when they move on
 *     integrateCost:   { gold: 80, food: 60 },
 *     integrateBonus:  string,   // resource key for permanent rate bonus
 *   } | null,
 *   nextCrisisTick:  number,
 *   totalAccepted:   number,
 *   totalIntegrated: number,
 *   skillBonus:      { gold, food, wood, stone, iron, mana },  // permanent /s
 *   debuffUntil:     number,   // tick: food rate penalty while settling
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_AGE         = 1;  // Bronze Age+
const SPAWN_MIN       = 12 * 60 * TICKS_PER_SECOND;  // 12 min
const SPAWN_MAX       = 18 * 60 * TICKS_PER_SECOND;  // 18 min
const FIRST_DELAY     = 14 * 60 * TICKS_PER_SECOND;  // first crisis ≥ 14 min in
const OFFER_TICKS     = 90 * TICKS_PER_SECOND;        // 90 s decision window
const DEBUFF_TICKS    =  2 * 60 * TICKS_PER_SECOND;  // 2 min food-rate penalty

export const INTEGRATE_GOLD = 80;
export const INTEGRATE_FOOD = 60;
const SKILL_BONUS_RATE  = 0.15;   // +0.15/s for integration permanent bonus
const FOOD_DEBUFF_RATE  = 0.4;    // −0.4 food/s while refugees settle
const REFUGEE_SKILLS    = ['gold', 'food', 'wood', 'stone', 'iron'];

const FACTION_NAMES = {
  ironHorde:   'Iron Horde',
  mageCouncil: 'Mage Council',
  seaWolves:   'Sea Wolves',
};

// ── Init ───────────────────────────────────────────────────────────────────

export function initRefugees() {
  if (!state.refugees) {
    state.refugees = {
      current:         null,
      nextCrisisTick:  state.tick + FIRST_DELAY,
      totalAccepted:   0,
      totalIntegrated: 0,
      skillBonus:      { gold: 0, food: 0, wood: 0, stone: 0, iron: 0, mana: 0 },
      debuffUntil:     0,
    };
  } else {
    if (!state.refugees.skillBonus) {
      state.refugees.skillBonus = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0, mana: 0 };
    }
    if (!state.refugees.debuffUntil) state.refugees.debuffUntil = 0;
    if (!state.refugees.totalIntegrated) state.refugees.totalIntegrated = 0;
  }
}

// ── Tick ───────────────────────────────────────────────────────────────────

export function refugeeTick() {
  if (!state.refugees) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  const r = state.refugees;

  // Expire active crisis
  if (r.current && state.tick >= r.current.expiresAt) {
    _expireCrisis();
    return;
  }

  // Spawn next crisis
  if (!r.current && state.tick >= r.nextCrisisTick) {
    _spawnCrisis();
  }
}

// ── Private ────────────────────────────────────────────────────────────────

function _spawnCrisis() {
  const r = state.refugees;

  const factionIds = Object.keys(FACTION_NAMES);
  const fid        = factionIds[Math.floor(Math.random() * factionIds.length)];
  const fname      = FACTION_NAMES[fid];
  const count      = 25 + Math.floor(Math.random() * 26); // 25–50
  const bonus      = REFUGEE_SKILLS[Math.floor(Math.random() * REFUGEE_SKILLS.length)];

  r.current = {
    count,
    sourceFactionId: fid,
    sourceName:      fname,
    expiresAt:       state.tick + OFFER_TICKS,
    integrateCost:   { gold: INTEGRATE_GOLD, food: INTEGRATE_FOOD },
    integrateBonus:  bonus,
  };

  r.nextCrisisTick = state.tick
    + SPAWN_MIN + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));

  addMessage(
    `🏚️ Refugees from ${fname} seek asylum — ${count} displaced people at the border. (90s to decide)`,
    'quest',
  );
  emit(Events.REFUGEE_CRISIS, { type: 'spawned', factionId: fid, count });
}

function _expireCrisis() {
  const r = state.refugees;
  if (!r.current) return;

  addMessage(
    `🏚️ The refugees from ${r.current.sourceName} moved on without assistance.`,
    'info',
  );
  r.current = null;
  emit(Events.REFUGEE_CRISIS, { type: 'expired' });
}

// ── Public Actions ─────────────────────────────────────────────────────────

/**
 * Accept refugees at no cost: population boost, temporary food-rate penalty.
 */
export function acceptRefugees() {
  const r = state.refugees;
  if (!r?.current) return { ok: false, reason: 'No refugee crisis active.' };

  const { count, sourceName } = r.current;

  const pop  = state.population;
  if (pop) {
    const addPop = Math.min(count, (pop.cap ?? 200) - (pop.count ?? 0));
    pop.count = Math.max(0, Math.min(pop.cap ?? 200, (pop.count ?? 0) + addPop));
  }

  r.debuffUntil = state.tick + DEBUFF_TICKS;
  r.totalAccepted = (r.totalAccepted ?? 0) + 1;

  addMessage(
    `🏚️ Refugees from ${sourceName} welcomed — +${count} population settling in. Food supplies strained for 2 minutes.`,
    'windfall',
  );
  emit(Events.REFUGEE_CRISIS, { type: 'accepted' });
  emit(Events.POPULATION_CHANGED, { count: state.population?.count });

  r.current = null;
  return { ok: true };
}

/**
 * Integrate refugees: costs gold + food; grants permanent resource-rate bonus.
 */
export function integrateRefugees() {
  const r = state.refugees;
  if (!r?.current) return { ok: false, reason: 'No refugee crisis active.' };

  const { gold, food } = r.current.integrateCost;
  if ((state.resources.gold ?? 0) < gold) return { ok: false, reason: `Need ${gold} gold to integrate.` };
  if ((state.resources.food ?? 0) < food) return { ok: false, reason: `Need ${food} food to integrate.` };

  state.resources.gold = (state.resources.gold ?? 0) - gold;
  state.resources.food = (state.resources.food ?? 0) - food;

  const { count, sourceName, integrateBonus: bonus } = r.current;

  const pop = state.population;
  if (pop) {
    const addPop = Math.min(count, (pop.cap ?? 200) - (pop.count ?? 0));
    pop.count = Math.max(0, Math.min(pop.cap ?? 200, (pop.count ?? 0) + addPop));
  }

  r.skillBonus[bonus] = (r.skillBonus[bonus] ?? 0) + SKILL_BONUS_RATE;
  r.totalIntegrated   = (r.totalIntegrated ?? 0) + 1;
  awardPrestige(20, 'refugee integration');

  addMessage(
    `🏚️ Refugees from ${sourceName} integrated — +${count} population · +${SKILL_BONUS_RATE} ${bonus}/s permanently. (+20 prestige)`,
    'windfall',
  );
  emit(Events.REFUGEE_CRISIS, { type: 'integrated', bonus });
  emit(Events.POPULATION_CHANGED, { count: state.population?.count });
  emit(Events.RESOURCE_CHANGED, {});

  r.current = null;
  return { ok: true };
}

/**
 * Decline refugees politely: small relation penalty with the source faction.
 */
export function declineRefugees() {
  const r = state.refugees;
  if (!r?.current) return { ok: false, reason: 'No refugee crisis active.' };

  const { sourceFactionId, sourceName } = r.current;

  // Increase war score slightly with the source faction — makes them slightly
  // more likely to initiate war (warScore is used by enemyAI war threshold).
  const dipState = state.diplomacy;
  if (dipState?.empires) {
    const emp = dipState.empires.find(e => e.id === sourceFactionId);
    if (emp && emp.relations !== 'war') {
      emp.warScore = (emp.warScore ?? 0) + 5;
    }
  }

  addMessage(
    `🏚️ Refugees from ${sourceName} turned away. ${sourceName} is displeased with your decision.`,
    'info',
  );
  emit(Events.REFUGEE_CRISIS, { type: 'declined' });
  emit(Events.DIPLOMACY_CHANGED, { factionId: sourceFactionId });

  r.current = null;
  return { ok: true };
}

// ── Public Helpers ─────────────────────────────────────────────────────────

export function getActiveCrisisRef()   { return state.refugees?.current ?? null; }
export function getRefugeeSecsLeft()   {
  const c = state.refugees?.current;
  if (!c) return 0;
  return Math.max(0, Math.ceil((c.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/** Returns the food rate debuff (positive number) while refugees are settling. */
export function getRefugeeDebuff() {
  if (!state.refugees?.debuffUntil) return 0;
  return state.tick < state.refugees.debuffUntil ? FOOD_DEBUFF_RATE : 0;
}
