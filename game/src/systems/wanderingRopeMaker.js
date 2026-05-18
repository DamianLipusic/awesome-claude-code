/**
 * EmpireOS — Wandering Rope Maker (T323).
 *
 * Every 12–17 minutes (Stone Age+, 6+ player tiles), a skilled wandering
 * rope maker arrives at the imperial court, offering to craft rigging and
 * share rope-making expertise. The player has 80 seconds to decide.
 *
 * Choices:
 *   🪢 Commission Ship Rigging — pay 20 wood + 10 food
 *        → +0.20 wood/s for 2.5 min · +15 prestige · +8 morale
 *   📜 Purchase Rope-Making Lore — pay 18 gold
 *        → +0.15 food/s for 2 min   · +10 prestige
 *   🚶 Send Away               — dismiss (no reward)
 *
 * state.wanderingRopeMaker = {
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
export const COMMISSION_FOOD_COST          = 10;
export const COMMISSION_WOOD_RATE          = 0.20;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_FOOD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingRopeMaker() {
  if (!state.wanderingRopeMaker) {
    state.wanderingRopeMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingRopeMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingRopeMakerTick() {
  const a = state.wanderingRopeMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_ROPE_MAKER_CHANGED, { expired: true });
      addMessage('🪢 The wandering rope maker carefully coils their hemp lines and tools back into the cart and departs down the road to the next settlement.', 'info');
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
  emit(Events.WANDERING_ROPE_MAKER_CHANGED, { spawned: true });
  addMessage('🪢 A wandering rope maker arrives at the imperial gates bearing coils of expertly braided hemp, flax, and silk rope. They offer to craft ship rigging or share their ancient rope-making lore. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingRopeMaker() { return state.wanderingRopeMaker?.active ?? null; }
export function getWanderingRopeMakerSecsLeft() {
  const a = state.wanderingRopeMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionShipRigging() {
  const a = state.wanderingRopeMaker;
  if (!a?.active) return { ok: false, reason: 'No rope maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The rope maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned ship rigging from the wandering rope maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'ropeMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'ropeMakerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_ROPE_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪢 The rope maker establishes a rigging workshop in the harbour district, producing coils of strong hemp rope for the imperial fleet and merchants. Improved rigging boosts timber efficiency across the empire! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRopeMakingLore() {
  const a = state.wanderingRopeMaker;
  if (!a?.active) return { ok: false, reason: 'No rope maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The rope maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased rope-making lore from the wandering rope maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'ropeMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'ropeMakerPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_ROPE_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The rope maker shares ancient secrets of fibre selection, twisting technique, and tensile testing. Imperial workers apply these methods to improve net fishing and crop-hauling operations across the empire! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendRopeMakerAway() {
  const a = state.wanderingRopeMaker;
  if (!a?.active) return { ok: false, reason: 'No rope maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_ROPE_MAKER_CHANGED, { dismissed: true });
  addMessage('🪢 The wandering rope maker nods respectfully, re-coils their finest demonstration lines, and sets off toward other courts with a load of freshly braided rope.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
