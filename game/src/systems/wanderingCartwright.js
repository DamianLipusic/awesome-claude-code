/**
 * EmpireOS — Wandering Cartwright (T327).
 *
 * Every 12–17 minutes (Stone Age+, 6+ player tiles), a skilled wandering
 * cartwright arrives at the imperial court, offering to build wagons and
 * share wheel-making expertise. The player has 80 seconds to decide.
 *
 * Choices:
 *   🛒 Commission Trade Wagons — pay 20 wood + 15 food
 *        → +0.22 wood/s for 2.5 min · +18 prestige · +8 morale
 *   📜 Learn Wheel-Making Craft — pay 18 gold
 *        → +0.15 gold/s for 2 min   · +12 prestige
 *   🚶 Send Away               — dismiss (no reward)
 *
 * state.wanderingCartwright = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalPurchases:     number,
 *   totalDismissals:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_WOOD_COST          = 20;
export const COMMISSION_FOOD_COST          = 15;
export const COMMISSION_WOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 18;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCartwright() {
  if (!state.wanderingCartwright) {
    state.wanderingCartwright = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingCartwright;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingCartwrightTick() {
  const a = state.wanderingCartwright;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_CARTWRIGHT_CHANGED, { expired: true });
      addMessage('🛒 The wandering cartwright loads their tools and wheels back onto their demonstration cart and trundles off down the road to the next settlement.', 'info');
    }
    return;
  }
  if (state.tick < a.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  a.active      = { expiresAt: state.tick + WINDOW_TICKS };
  a.totalVisits = (a.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_CARTWRIGHT_CHANGED, { spawned: true });
  addMessage('🛒 A wandering cartwright arrives at the imperial gates bearing finely crafted wagon wheels and detailed drawings of trade carts. They offer to commission wagons for the empire or teach their wheel-making craft. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingCartwright() { return state.wanderingCartwright?.active ?? null; }
export function getCartwrightSecsLeft() {
  const a = state.wanderingCartwright?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTradeWagons() {
  const a = state.wanderingCartwright;
  if (!a?.active) return { ok: false, reason: 'No cartwright present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cartwright has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned trade wagons from the wandering cartwright');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartwrightCommission');
    state.randomEvents.activeModifiers.push({
      id: 'cartwrightCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_CARTWRIGHT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🛒 The cartwright establishes a wagon works in the imperial district, producing sturdy trade carts that dramatically improve timber transport throughout the empire! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function learnWheelMakingCraft() {
  const a = state.wanderingCartwright;
  if (!a?.active) return { ok: false, reason: 'No cartwright present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cartwright has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Learned wheel-making craft from the wandering cartwright');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartwrightPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'cartwrightPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_CARTWRIGHT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The cartwright shares the secrets of hub construction, spoke alignment, and rim fitting. Imperial craftsmen apply these techniques to create stronger wheels for merchant carts, boosting trade income across the empire! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCartwrightAway() {
  const a = state.wanderingCartwright;
  if (!a?.active) return { ok: false, reason: 'No cartwright present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_CARTWRIGHT_CHANGED, { dismissed: true });
  addMessage('🛒 The wandering cartwright nods respectfully, wheels their demonstration cart back onto the road, and heads off toward other imperial settlements.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
