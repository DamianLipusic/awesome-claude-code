/**
 * EmpireOS — Population system (T059).
 *
 * Tracks the number of citizens in the empire.
 *
 * Growth (per tick, 4 ticks/s):
 *   - When food > 20% of food cap AND count < cap: +0.015/tick (~+3.6/min)
 *   - When food > 50% of food cap AND count < cap: +0.030/tick (~+7.2/min, double rate)
 *   - When food === 0: −0.025/tick (~−6/min — starvation)
 *
 * Cap:
 *   - Base cap: 200
 *   - Each House building: +100 pop cap
 *
 * Production effects (applied in resources.js recalcRates):
 *   - Gold income: +0.003 gold/s per citizen
 *   - Food consumption: +0.005 food/s per citizen
 *
 * Milestones toasted at: 100, 250, 500, 1000, 2000, 5000
 */

import { state } from '../core/state.js';
import { emit, on, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { BOONS } from '../data/ageBoons.js';
import { recalcRates } from './resources.js';

// Base population cap before any buildings
export const POP_BASE_CAP = 200;
// Extra cap per House building
export const POP_PER_HOUSE = 100;

// Growth / decline rates (per tick, 4 ticks/s)
const GROW_SLOW  =  0.015;   // food > 20% of cap
const GROW_FAST  =  0.030;   // food > 50% of cap
const STARVE     = -0.025;   // food === 0

// Milestone thresholds (ascending)
const MILESTONES = [100, 250, 500, 1000, 2000, 5000];

// T148: Sub-set of milestones that fire a player-choice event instead of just a toast
const CHOICE_MILESTONES = new Set([500, 1000, 2000]);

// T140: Happiness thresholds
export const HAPPY_HIGH = 75;  // ≥ this → +10% production
export const HAPPY_LOW  = 25;  // ≤ this → -10% production
const HAPPY_INIT = 50;

let _initialized = false;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise population state. Idempotent — safe to call on every new game.
 */
export function initPopulation() {
  if (!state.population) {
    state.population = { count: 100, cap: POP_BASE_CAP, happiness: HAPPY_INIT };
  }
  // Migrate saves that predate the happiness field
  if (state.population.happiness === undefined) {
    state.population.happiness = HAPPY_INIT;
  }
  if (!_initialized) {
    _initialized = true;
    // Recalc cap whenever buildings, active policy, or a council boon changes
    on(Events.BUILDING_CHANGED,     _recalcCap);
    on(Events.POLICY_CHANGED,       _recalcCap);
    on(Events.COUNCIL_BOON_CHOSEN,  _recalcCap);
  }
  _recalcCap();
}

/**
 * Registered as a tick system. Handles growth, starvation, and milestone toasts.
 */
export function populationTick() {
  if (!state.population) return;

  _recalcCap();

  const food    = state.resources?.food ?? 0;
  const foodCap = state.caps?.food ?? 500;
  const pop     = state.population;

  let delta = 0;

  if (food === 0) {
    // Starvation
    delta = STARVE;
  } else if (food > foodCap * 0.5 && pop.count < pop.cap) {
    delta = GROW_FAST;
  } else if (food > foodCap * 0.2 && pop.count < pop.cap) {
    delta = GROW_SLOW;
  }

  if (Math.abs(delta) < 1e-9) return;

  const prev  = pop.count;
  pop.count   = Math.max(0, Math.min(pop.cap, pop.count + delta));

  // Check milestone crossings (growing only)
  if (delta > 0) {
    for (const m of MILESTONES) {
      if (prev < m && pop.count >= m) {
        if (CHOICE_MILESTONES.has(m) && !state.populationMilestones?.[m]) {
          // T148: emit choice event; main.js shows the choice modal
          if (!state.populationMilestones) state.populationMilestones = {};
          state.populationMilestones[m] = true;
          emit(Events.POPULATION_MILESTONE, { threshold: m });
        } else {
          addMessage(`🏘️ Population milestone: ${m.toLocaleString()} citizens!`, 'info');
        }
        emit(Events.POPULATION_CHANGED, { count: pop.count, cap: pop.cap });
        break;  // one milestone per tick is enough
      }
    }
  }

  // Emit when count crosses a 5-citizen boundary (avoids event storm)
  if (Math.floor(prev / 5) !== Math.floor(pop.count / 5)) {
    emit(Events.POPULATION_CHANGED, { count: pop.count, cap: pop.cap });
  }
}

/**
 * Returns the current population count (integer).
 */
export function getPopulation() {
  return Math.floor(state.population?.count ?? 0);
}

/**
 * Returns the current population cap.
 */
export function getPopCap() {
  return state.population?.cap ?? POP_BASE_CAP;
}

/**
 * T140: Returns the current happiness score (0–100).
 */
export function getHappiness() {
  return state.population?.happiness ?? HAPPY_INIT;
}

/**
 * T140: Update happiness toward a target derived from food security, morale,
 * and active crises.  Fires recalcRates and a message when thresholds are crossed.
 * Called once per tick by the main tick loop.
 */
export function happinessTick() {
  if (!state.population) return;
  if (state.population.happiness === undefined) state.population.happiness = HAPPY_INIT;

  // Derive target happiness
  let target = 50;

  const food    = state.resources?.food ?? 0;
  const foodCap = state.caps?.food      ?? 500;
  const foodPct = foodCap > 0 ? food / foodCap : 0;
  if (foodPct >= 0.6)      target += 20;
  else if (foodPct < 0.25) target -= 25;

  const morale = state.morale ?? 50;
  if (morale >= 70)   target += 15;
  else if (morale < 30) target -= 15;

  if (state.crises?.active) target -= 15;

  target = Math.max(0, Math.min(100, target));

  // Smooth drift toward target (~0.2% per tick)
  const prev = state.population.happiness;
  const next = Math.max(0, Math.min(100, prev + (target - prev) * 0.002));
  if (Math.abs(next - prev) < 0.001) return;
  state.population.happiness = next;

  // Fire events on threshold crossings so UI and rates update
  const wasPros   = prev >= HAPPY_HIGH;
  const wasUnrest = prev <= HAPPY_LOW;
  const nowPros   = next >= HAPPY_HIGH;
  const nowUnrest = next <= HAPPY_LOW;

  if (!wasPros && nowPros) {
    addMessage('😊 Your people are prospering! Population happiness +10% production bonus active.', 'windfall');
    recalcRates();
    emit(Events.POPULATION_CHANGED, { happiness: next });
  } else if (!wasUnrest && nowUnrest) {
    addMessage('😤 Civil unrest is spreading! Low happiness causes a -10% production penalty.', 'raid');
    recalcRates();
    emit(Events.POPULATION_CHANGED, { happiness: next });
  } else if ((wasPros && !nowPros) || (wasUnrest && !nowUnrest)) {
    recalcRates();
    emit(Events.POPULATION_CHANGED, { happiness: next });
  }
}

// ── Internal ───────────────────────────────────────────────────────────────

function _recalcCap() {
  if (!state.population) return;
  const houses = state.buildings?.house ?? 0;
  let cap = POP_BASE_CAP + houses * POP_PER_HOUSE;
  // T065: Agrarian policy grants +25% population cap
  if (state.policy === 'agrarian') cap = Math.floor(cap * 1.25);
  // T072: settlers_spirit boon — +100 pop cap
  if (state.councilBoons?.includes('settlers_spirit')) {
    const def = BOONS['settlers_spirit'];
    if (def?.effect?.popCap) cap += def.effect.popCap;
  }
  state.population.cap = cap;
}
