/**
 * EmpireOS — T214: Royal Hunt Event.
 *
 * Every 8–12 minutes (Bronze Age+), a royal hunt opportunity becomes available.
 * The player can launch a hunt: costs HUNT_FOOD_COST food + HUNT_GOLD_COST gold.
 * After 90 seconds the hunt resolves:
 *   Success (60%): +15 morale, +5 prestige, 30% chance of +50 iron bonus.
 *   Failure (40%): −8 morale, −30 gold (accidents and wasted expenses).
 *
 * Only one hunt pending or active at a time. A new opportunity spawns after
 * SPAWN_MIN…SPAWN_MAX ticks once the previous hunt resolves or expires.
 *
 * state.royalHunt = {
 *   pending:    boolean,           // hunt invitation is available
 *   pendingUntil: tick,            // tick when the pending offer expires
 *   active:     { resolvesAt: tick } | null,
 *   nextSpawn:  tick,
 *   totalHunts: number,
 * }
 */

import { state }          from '../core/state.js';
import { emit, Events }   from '../core/events.js';
import { addMessage }     from '../core/actions.js';
import { changeMorale }   from './morale.js';
import { awardPrestige }  from './prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN       = 8  * 60 * TICKS_PER_SECOND;  // 8 min
const SPAWN_MAX       = 12 * 60 * TICKS_PER_SECOND;  // 12 min
const PENDING_WINDOW  = 3  * 60 * TICKS_PER_SECOND;  // 3 min to accept
const HUNT_DURATION   = 90 * TICKS_PER_SECOND;       // 90 s until result
const MIN_AGE         = 1;                            // Bronze Age+

export const HUNT_GOLD_COST = 40;
export const HUNT_FOOD_COST = 100;

const SUCCESS_CHANCE    = 0.60;
const IRON_BONUS_CHANCE = 0.30;
const IRON_BONUS_AMT    = 50;

// ── Public API ──────────────────────────────────────────────────────────────

export function initRoyalHunt() {
  if (!state.royalHunt) {
    state.royalHunt = {
      pending:      false,
      pendingUntil: 0,
      active:       null,
      nextSpawn:    _nextSpawnTick(),
      totalHunts:   0,
    };
  }
  if (state.royalHunt.pendingUntil === undefined) state.royalHunt.pendingUntil = 0;
  if (state.royalHunt.totalHunts   === undefined) state.royalHunt.totalHunts   = 0;
}

/**
 * Returns the current hunt status object.
 * { pending, active, pendingSecsLeft, activeSecsLeft }
 */
export function getRoyalHuntStatus() {
  const rh = state.royalHunt;
  if (!rh) return { pending: false, active: null, pendingSecsLeft: 0, activeSecsLeft: 0 };
  return {
    pending:         rh.pending,
    active:          rh.active,
    pendingSecsLeft: rh.pending
      ? Math.max(0, Math.ceil((rh.pendingUntil - state.tick) / TICKS_PER_SECOND))
      : 0,
    activeSecsLeft: rh.active
      ? Math.max(0, Math.ceil((rh.active.resolvesAt - state.tick) / TICKS_PER_SECOND))
      : 0,
  };
}

/**
 * Launch the pending royal hunt.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function launchRoyalHunt() {
  const rh = state.royalHunt;
  if (!rh?.pending)
    return { ok: false, reason: 'No royal hunt invitation available.' };
  if (rh.active)
    return { ok: false, reason: 'A hunt is already underway.' };
  if ((state.resources?.gold ?? 0) < HUNT_GOLD_COST)
    return { ok: false, reason: `Need ${HUNT_GOLD_COST} gold to outfit the hunting party.` };
  if ((state.resources?.food ?? 0) < HUNT_FOOD_COST)
    return { ok: false, reason: `Need ${HUNT_FOOD_COST} food to provision the hunters.` };

  state.resources.gold -= HUNT_GOLD_COST;
  state.resources.food -= HUNT_FOOD_COST;
  emit(Events.RESOURCE_CHANGED, {});

  rh.pending      = false;
  rh.pendingUntil = 0;
  rh.active       = { resolvesAt: state.tick + HUNT_DURATION };
  rh.totalHunts  += 1;

  addMessage('🦌 The hunting party departs! The hunt will conclude in ~90 seconds.', 'info');
  emit(Events.HUNT_CHANGED, { launched: true });
  return { ok: true };
}

/** Main tick — spawns hunt invitations and resolves active hunts. */
export function huntTick() {
  if (!state.royalHunt) return;
  const rh = state.royalHunt;

  // Resolve active hunt
  if (rh.active && state.tick >= rh.active.resolvesAt) {
    _resolveHunt();
    return;
  }

  // Expire pending invitation
  if (rh.pending && state.tick >= rh.pendingUntil) {
    rh.pending      = false;
    rh.pendingUntil = 0;
    rh.nextSpawn    = _nextSpawnTick();
    addMessage('🦌 The hunting season passed without a royal hunt.', 'info');
    emit(Events.HUNT_CHANGED, { expired: true });
    return;
  }

  // Spawn new invitation
  if (!rh.pending && !rh.active && state.tick >= rh.nextSpawn) {
    if ((state.age ?? 0) >= MIN_AGE) _spawnHunt();
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

function _spawnHunt() {
  const rh = state.royalHunt;
  rh.pending      = true;
  rh.pendingUntil = state.tick + PENDING_WINDOW;
  addMessage(
    `🦌 A royal hunt has been called! Spend ${HUNT_GOLD_COST}💰 ${HUNT_FOOD_COST}🍞 to join the hunt. (3 min window)`,
    'windfall',
  );
  emit(Events.HUNT_CHANGED, { spawned: true });
}

function _resolveHunt() {
  const rh = state.royalHunt;
  rh.active    = null;
  rh.nextSpawn = _nextSpawnTick();

  if (Math.random() < SUCCESS_CHANCE) {
    // Success
    changeMorale(15);
    awardPrestige(5, '🦌 royal hunt triumph');

    let msg = '🦌 The royal hunt was a great success! +15 morale, +5 prestige.';
    if (Math.random() < IRON_BONUS_CHANCE) {
      const ironCap = state.caps?.iron ?? 500;
      state.resources.iron = Math.min(ironCap, (state.resources.iron ?? 0) + IRON_BONUS_AMT);
      emit(Events.RESOURCE_CHANGED, {});
      msg += ` The hunters also secured ${IRON_BONUS_AMT} iron from the wilderness.`;
    }
    addMessage(msg, 'windfall');
    emit(Events.HUNT_CHANGED, { resolved: true, success: true });
  } else {
    // Failure
    changeMorale(-8);
    const penalty = 30;
    state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - penalty);
    emit(Events.RESOURCE_CHANGED, {});
    addMessage(
      `🦌 The royal hunt ended badly — accidents and poor weather cost morale and ${penalty} gold.`,
      'raid',
    );
    emit(Events.HUNT_CHANGED, { resolved: true, success: false });
  }
}

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));
}
