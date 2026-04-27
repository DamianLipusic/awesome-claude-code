/**
 * EmpireOS — Noble Council Demands (T168).
 *
 * At Bronze Age+ the noble council periodically demands concessions to
 * maintain their loyalty. A demand arrives every 10–15 min with a 3-minute
 * deadline displayed as a banner below the title bar.
 *
 * Demand types:
 *   tribute   — pay gold (and optionally food) immediately
 *   construct — have a specific building already built
 *   glory     — win one battle (Medieval: two) before the deadline expires
 *
 * Satisfy:  +50 prestige · +10 morale
 * Fail:     −25 morale  · −15% gold/s for 3 min (nobility debuff)
 *
 * state.nobleDemands = {
 *   active:         { type, icon, title, desc, req, deadline, startTick } | null,
 *   nextDemandTick: tick,
 *   totalSatisfied: number,
 *   totalRefused:   number,
 *   debuffUntil:    tick,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const MIN_AGE         = 1;
const DEMAND_MIN      = 10 * 60 * TICKS_PER_SECOND;
const DEMAND_MAX      = 15 * 60 * TICKS_PER_SECOND;
const FIRST_DELAY     = 12 * 60 * TICKS_PER_SECOND;
const DEADLINE_TICKS  =  3 * 60 * TICKS_PER_SECOND;

const REWARD_PRESTIGE = 50;
const REWARD_MORALE   = 10;
const FAIL_MORALE     = -25;
export const DEBUFF_TICKS = 3 * 60 * TICKS_PER_SECOND;

// Tribute gold amounts scaled by age (index 0 = Stone, unused)
const GOLD_BY_AGE = [0, 60, 100, 150];
const FOOD_BY_AGE = [0, 50,  80, 120];

// Buildings eligible for construct demands (must exist in buildings.js)
const CONSTRUCT_POOL = [
  { id: 'barracks',    label: 'Barracks',     icon: '⚔️' },
  { id: 'farm',        label: 'Farm',         icon: '🌾' },
  { id: 'market',      label: 'Market',       icon: '🏪' },
  { id: 'library',     label: 'Library',      icon: '📚' },
  { id: 'granary',     label: 'Granary',      icon: '🏚️' },
  { id: 'stoneQuarry', label: 'Stone Quarry', icon: '🪨' },
];

// ── Public API ──────────────────────────────────────────────────────────────

export function initNobleDemands() {
  if (!state.nobleDemands) {
    state.nobleDemands = {
      active:         null,
      nextDemandTick: state.tick + FIRST_DELAY,
      totalSatisfied: 0,
      totalRefused:   0,
      debuffUntil:    0,
    };
  }
  if (state.nobleDemands.debuffUntil === undefined) state.nobleDemands.debuffUntil = 0;
}

export function nobleDemandsTick() {
  if (!state.nobleDemands) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  const nd = state.nobleDemands;

  // Check if active demand deadline has passed
  if (nd.active && state.tick >= nd.active.deadline) {
    _demandExpired(nd);
    return;
  }

  if (nd.active) return;

  if (state.tick >= nd.nextDemandTick) {
    _spawnDemand(nd);
  }
}

/**
 * Player clicks "Satisfy" on the noble demand banner.
 * Returns { ok: boolean, reason?: string }.
 */
export function satisfyDemand() {
  if (!state.nobleDemands?.active) return { ok: false, reason: 'No active demand' };

  const nd     = state.nobleDemands;
  const demand = nd.active;

  if (state.tick >= demand.deadline) return { ok: false, reason: 'Demand expired' };

  const check = _checkRequirement(demand);
  if (!check.met) return { ok: false, reason: check.reason };

  // Deduct tribute resources
  if (demand.type === 'tribute') {
    const { gold = 0, food = 0 } = demand.req;
    state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - gold);
    state.resources.food = Math.max(0, (state.resources.food ?? 0) - food);
    emit(Events.RESOURCE_CHANGED, {});
  }

  nd.active         = null;
  nd.totalSatisfied++;
  nd.nextDemandTick = state.tick + _nextDelay();

  awardPrestige(REWARD_PRESTIGE, 'noble council satisfied');
  changeMorale(REWARD_MORALE);
  addMessage(
    `👑 Noble council satisfied! +${REWARD_PRESTIGE} prestige, +${REWARD_MORALE} morale.`,
    'windfall',
  );
  emit(Events.NOBLE_DEMAND, { type: 'satisfied' });
  return { ok: true };
}

/**
 * Player clicks "Refuse" on the noble demand banner.
 */
export function refuseDemand() {
  if (!state.nobleDemands?.active) return;
  const nd    = state.nobleDemands;
  nd.active   = null;
  nd.totalRefused++;
  nd.nextDemandTick = state.tick + _nextDelay();
  _applyFailPenalty(nd, 'refused');
}

/** Seconds remaining on the active demand deadline. */
export function getDemandSecsLeft() {
  if (!state.nobleDemands?.active) return 0;
  return Math.max(0, Math.ceil(
    (state.nobleDemands.active.deadline - state.tick) / TICKS_PER_SECOND,
  ));
}

/** Seconds remaining on the gold debuff after a failed demand. */
export function getDebuffSecsLeft() {
  if (!(state.nobleDemands?.debuffUntil > state.tick)) return 0;
  return Math.ceil((state.nobleDemands.debuffUntil - state.tick) / TICKS_PER_SECOND);
}

/** Whether the active demand's requirement is currently met. */
export function canSatisfyDemand() {
  if (!state.nobleDemands?.active) return false;
  return _checkRequirement(state.nobleDemands.active).met;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function _spawnDemand(nd) {
  const age   = Math.min(3, state.age ?? 1);
  const types = ['tribute', 'construct', 'glory'];
  const type  = types[Math.floor(Math.random() * types.length)];

  let demand;

  if (type === 'tribute') {
    const gold = GOLD_BY_AGE[age];
    const food = Math.random() < 0.5 ? 0 : FOOD_BY_AGE[age];
    const costStr = food > 0 ? `${gold}💰 + ${food}🌾` : `${gold}💰`;
    demand = {
      type, icon: '💰',
      title: 'Noble Tribute Demand',
      desc:  `The noble council demands a tribute of ${costStr} to maintain their loyalty.`,
      req:   { gold, food },
      deadline:  state.tick + DEADLINE_TICKS,
      startTick: state.tick,
    };

  } else if (type === 'construct') {
    const bDef = CONSTRUCT_POOL[Math.floor(Math.random() * CONSTRUCT_POOL.length)];
    demand = {
      type, icon: '🏗️',
      title: 'Infrastructure Demand',
      desc:  `The nobles demand you prove your empire's strength by having a ${bDef.icon} ${bDef.label} built.`,
      req:   { buildingId: bDef.id, buildingLabel: bDef.label },
      deadline:  state.tick + DEADLINE_TICKS,
      startTick: state.tick,
    };

  } else { // glory
    const winsNeeded = age >= 3 ? 2 : 1;
    demand = {
      type, icon: '⚔️',
      title: 'Military Glory Demand',
      desc:  `The nobles demand a display of military might — win ${winsNeeded} battle${winsNeeded > 1 ? 's' : ''} before the deadline.`,
      req:   { winsNeeded },
      deadline:  state.tick + DEADLINE_TICKS,
      startTick: state.tick,
    };
  }

  nd.active = demand;
  addMessage(
    `👑 Noble council demands "${demand.title}"! Respond within 3 minutes.`,
    'warning',
  );
  emit(Events.NOBLE_DEMAND, { type: 'spawned', demand });
}

function _demandExpired(nd) {
  const title = nd.active?.title ?? 'demand';
  nd.active         = null;
  nd.totalRefused++;
  nd.nextDemandTick = state.tick + _nextDelay();
  _applyFailPenalty(nd, 'expired');
  addMessage(
    `👑 Noble demand "${title}" expired! Nobles are displeased — −${Math.abs(FAIL_MORALE)} morale, −15% gold/s for 3 min.`,
    'crisis',
  );
}

function _applyFailPenalty(nd, reason) {
  changeMorale(FAIL_MORALE);
  nd.debuffUntil = state.tick + DEBUFF_TICKS;
  emit(Events.NOBLE_DEMAND, { type: 'failed', reason });
  emit(Events.RESOURCE_CHANGED, {});
}

function _checkRequirement(demand) {
  if (demand.type === 'tribute') {
    const { gold = 0, food = 0 } = demand.req;
    if ((state.resources.gold ?? 0) < gold) return { met: false, reason: `Need ${gold} gold` };
    if ((state.resources.food ?? 0) < food) return { met: false, reason: `Need ${food} food` };
    return { met: true };
  }

  if (demand.type === 'construct') {
    const built = (state.buildings?.[demand.req.buildingId] ?? 0) >= 1;
    return built
      ? { met: true }
      : { met: false, reason: `Must have a ${demand.req.buildingLabel} built` };
  }

  if (demand.type === 'glory') {
    const wins = (state.combatHistory ?? []).filter(
      h => h.outcome === 'win' && h.tick >= demand.startTick,
    ).length;
    const needed = demand.req.winsNeeded - wins;
    return needed <= 0
      ? { met: true }
      : { met: false, reason: `Need ${needed} more battle win${needed > 1 ? 's' : ''}` };
  }

  return { met: true };
}

function _nextDelay() {
  return DEMAND_MIN + Math.floor(Math.random() * (DEMAND_MAX - DEMAND_MIN));
}
