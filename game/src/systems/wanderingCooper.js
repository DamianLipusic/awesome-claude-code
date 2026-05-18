/**
 * EmpireOS — Wandering Cooper (T322).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a skilled wandering
 * cooper arrives at the imperial court, offering to craft storage barrels
 * and share cooperage expertise. The player has 80 seconds to decide.
 *
 * Choices:
 *   🪣 Commission Storage Barrels — pay 20 wood + 15 food
 *        → +0.20 food/s for 2.5 min · +18 prestige · +10 morale
 *   📜 Purchase Cooperage Secrets — pay 20 gold
 *        → +0.15 wood/s for 2 min   · +12 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.wanderingCooper = {
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
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_WOOD_COST          = 20;
export const COMMISSION_FOOD_COST          = 15;
export const COMMISSION_FOOD_RATE          = 0.20;
export const COMMISSION_PRESTIGE_REWARD    = 18;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 20;
export const PURCHASE_WOOD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCooper() {
  if (!state.wanderingCooper) {
    state.wanderingCooper = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingCooper;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingCooperTick() {
  const a = state.wanderingCooper;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_COOPER_CHANGED, { expired: true });
      addMessage('🪣 The wandering cooper carefully loads their barrel-making tools and wood staves back onto the wagon and rolls off down the road to the next settlement.', 'info');
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
  emit(Events.WANDERING_COOPER_CHANGED, { spawned: true });
  addMessage('🪣 A wandering cooper arrives at the imperial gates bearing a wagon of expertly crafted storage barrels, casks, and tuns. They offer to establish a cooperage or share the secrets of barrel-making with the empire. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingCooper() { return state.wanderingCooper?.active ?? null; }
export function getWanderingCooperSecsLeft() {
  const a = state.wanderingCooper?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionStorageBarrels() {
  const a = state.wanderingCooper;
  if (!a?.active) return { ok: false, reason: 'No cooper present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cooper has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned storage barrels from the wandering cooper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cooperCommission');
    state.randomEvents.activeModifiers.push({
      id: 'cooperCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_COOPER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪣 The cooper sets up a bustling cooperage within the palace district, producing rows of sturdy storage barrels. The improved storage capacity dramatically reduces food spoilage, boosting the empire's food supplies! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCooperageSecrets() {
  const a = state.wanderingCooper;
  if (!a?.active) return { ok: false, reason: 'No cooper present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cooper has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased cooperage secrets from the wandering cooper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cooperPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'cooperPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_COOPER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The cooper shares treasured family recipes for wood stave selection, steam bending, and hoop joining. Imperial woodworkers apply these techniques to dramatically improve timber yield across the empire! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCooperAway() {
  const a = state.wanderingCooper;
  if (!a?.active) return { ok: false, reason: 'No cooper present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_COOPER_CHANGED, { dismissed: true });
  addMessage('🪣 The wandering cooper tips their hat graciously, tucks their tools back in the wagon, and trundles off down the road to bring the art of cooperage to other settlements.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
