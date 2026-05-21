/**
 * EmpireOS — Wandering Furrier (T357).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering furrier
 * arrives with pelts, cured hides, and fine fur garments ready for trade.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🦊 Commission Royal Pelt Works — pay 25 food
 *        → +0.22 food/s for 2.5 min · +18 prestige · +10 morale
 *   💰 Purchase Pelt Collection    — pay 20 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   👋 Send Away                   — dismiss (no reward)
 *
 * state.wanderingFurrier = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
 *   totalPurchases:    number,
 *   totalDismissals:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST         = 25;
export const COMMISSION_FOOD_RATE         = 0.22;
export const COMMISSION_PRESTIGE_REWARD   = 18;
export const COMMISSION_MORALE_REWARD     = 10;
export const COMMISSION_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST           = 20;
export const PURCHASE_GOLD_RATE           = 0.15;
export const PURCHASE_PRESTIGE_REWARD     = 12;
export const PURCHASE_DURATION_TICKS      = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingFurrier() {
  if (!state.wanderingFurrier) {
    state.wanderingFurrier = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingFurrier;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingFurrierTick() {
  const a = state.wanderingFurrier;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_FURRIER_CHANGED, { expired: true });
      addMessage('🦊 The wandering furrier carefully rolls the unsold pelts into travel bundles, hoists the pack over their shoulder, and heads off down the road in search of a lord with a greater appreciation for fine fur garments.', 'info');
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
  emit(Events.WANDERING_FURRIER_CHANGED, { spawned: true });
  addMessage('🦊 A wandering furrier arrives at the gates bearing a pack laden with wolf pelts, fox furs, beaver hides, and cured rabbit skins — all skillfully tanned and prepared for noble wardrobes or warm winter cloaks. They offer to commission a royal pelt works for the empire\'s nobility or to sell their finest collection outright. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingFurrier() { return state.wanderingFurrier?.active ?? null; }
export function getFurrierSecsLeft() {
  const a = state.wanderingFurrier?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalPeltWorks() {
  const a = state.wanderingFurrier;
  if (!a?.active) return { ok: false, reason: 'No furrier present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The furrier has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned royal pelt works from the wandering furrier');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'furrierCommission');
    state.randomEvents.activeModifiers.push({
      id: 'furrierCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_FURRIER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🦊 The furrier sets up a temporary curing and stitching workshop, teaching apprentices to work wolf pelts into grand cloaks and fox furs into noble trim — the smell of tanned leather fills the district as skilled hands produce warm, luxurious garments that boost morale and attract wealthy traders to the empire's markets! −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchasePeltCollection() {
  const a = state.wanderingFurrier;
  if (!a?.active) return { ok: false, reason: 'No furrier present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The furrier has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased pelt collection from the wandering furrier');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'furrierPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'furrierPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_FURRIER_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💰 The furrier unfolds the finest pelts — a silver wolf cloak, a red-fox stole trimmed in white ermine, a set of beaver-pelt gauntlets — which are quickly snapped up by nobles and wealthy merchants at a handsome premium, starting a brisk trade in luxury winter wear that fills the treasury! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFurrierAway() {
  const a = state.wanderingFurrier;
  if (!a?.active) return { ok: false, reason: 'No furrier present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_FURRIER_CHANGED, { dismissed: true });
  addMessage('🦊 The wandering furrier ties the pelt bundles shut with leather cord, bows politely, and heads off toward the next town — perhaps a lord there will appreciate fine furs more than this empire does today.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
