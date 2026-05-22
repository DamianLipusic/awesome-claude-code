/**
 * EmpireOS — Wandering Hat Maker (T363).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a skilled hat maker
 * arrives with a cartful of fine headwear and patterns for imperial crowns.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🎩 Commission Royal Headwear — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +10 morale
 *   📜 Purchase Hat-Making Craft  — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   👋 Send Away                  — dismiss (no reward)
 *
 * state.wanderingHatMaker = {
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

export const COMMISSION_FOOD_COST          = 20;
export const COMMISSION_WOOD_COST          = 15;
export const COMMISSION_FOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 18;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingHatMaker() {
  if (!state.wanderingHatMaker) {
    state.wanderingHatMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingHatMaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingHatMakerTick() {
  const a = state.wanderingHatMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_HAT_MAKER_CHANGED, { expired: true });
      addMessage('🎩 The hat maker packs up the display of fine headwear, loads the cartful of crown patterns back onto their wagon, and trundles off down the road — the cheerful jingle of ribbons and pins fading into the distance.', 'info');
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
  emit(Events.WANDERING_HAT_MAKER_CHANGED, { spawned: true });
  addMessage('🎩 A wandering hat maker arrives at the palace gates, wagon heaped with fine felt caps, elaborate feathered hats, and rolled parchment patterns for royal crowns and ceremonial headwear. They offer to commission a grand collection of imperial headwear or to share their craft secrets with the local artisans. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingHatMaker() { return state.wanderingHatMaker?.active ?? null; }
export function getHatMakerSecsLeft() {
  const a = state.wanderingHatMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalHeadwear() {
  const a = state.wanderingHatMaker;
  if (!a?.active) return { ok: false, reason: 'No hat maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The hat maker has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned royal headwear from the wandering hat maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'hatMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'hatMakerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_HAT_MAKER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎩 The hat maker sets up a grand workshop in the palace courtyard, stitching elaborate crowns and ceremonial caps from the finest felt and silk — the festive atmosphere draws the whole court to participate, boosting morale and inspiring the cooks and farmers to increase their output! −${COMMISSION_FOOD_COST} food · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseHatMakingCraft() {
  const a = state.wanderingHatMaker;
  if (!a?.active) return { ok: false, reason: 'No hat maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The hat maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased hat-making craft from the wandering hat maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'hatMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'hatMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_HAT_MAKER_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The hat-making patterns and craft techniques are shared with the local market artisans, who quickly adapt them into a thriving trade — fashionable hats become the season's must-have accessory, and the gold flows in from eager buyers! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendHatMakerAway() {
  const a = state.wanderingHatMaker;
  if (!a?.active) return { ok: false, reason: 'No hat maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_HAT_MAKER_CHANGED, { dismissed: true });
  addMessage('🎩 The hat maker tips their finest feathered cap in farewell, clicks the horse onward, and the wagon of hats and patterns disappears around the bend — heading for friendlier markets down the road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
