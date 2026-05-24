/**
 * EmpireOS — Wandering Candlemaker (T391).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering candlemaker
 * arrives at the imperial gates carrying bundles of fine beeswax candles,
 * tallow moulds, and aromatic wicking — offering to commission a set of royal
 * ceremonial candles for the palace halls, or to share rare wax-blending
 * formulas and wick-crafting secrets with the imperial chandlery.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🕯️ Commission Royal Candles  — pay 20 food + 15 wood
 *        → +0.20 food/s for 2.5 min · +15 prestige · +10 morale
 *   📜 Purchase Wax Formulas     — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                 — dismiss (no reward)
 *
 * state.wanderingCandlemaker = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST        = 20;
export const COMMISSION_WOOD_COST        = 15;
export const COMMISSION_FOOD_RATE        = 0.20;
export const COMMISSION_PRESTIGE_REWARD  = 15;
export const COMMISSION_MORALE_REWARD    = 10;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 10;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCandlemaker() {
  if (!state.wanderingCandlemaker) {
    state.wanderingCandlemaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingCandlemaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function wanderingCandlemakerTick() {
  const a = state.wanderingCandlemaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_CANDLEMAKER_CHANGED, { expired: true });
      addMessage('🕯️ The wandering candlemaker carefully wraps the unsold candles back in their linen cloth, bows graciously, and departs from the capital — the warm scent of beeswax fading on the breeze as the craftsman disappears down the road.', 'info');
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
  emit(Events.WANDERING_CANDLEMAKER_CHANGED, { spawned: true });
  addMessage('🕯️ A wandering candlemaker arrives at the imperial gates carrying bundles of fine beeswax candles, ornate tallow moulds, and fragrant wicking cords — offering to commission a set of royal ceremonial candles for the palace halls and throne room, or to share rare wax-blending formulas and wick-crafting secrets with the imperial chandlery. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingCandlemaker() { return state.wanderingCandlemaker?.active ?? null; }
export function getCandlemakerSecsLeft() {
  const a = state.wanderingCandlemaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalCandles() {
  const a = state.wanderingCandlemaker;
  if (!a?.active) return { ok: false, reason: 'No candlemaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The candlemaker has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned royal candles from the wandering candlemaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'candlemakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'candlemakerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_CANDLEMAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🕯️ The candlemaker sets to work with practiced skill — rendering beeswax, pulling wicks, and moulding a magnificent series of tall ceremonial candles that bathe the throne room in a warm amber glow, filling the halls with the sweet fragrance of honey and herbs. The palace kitchens and storehouses are energised by the ceremony, boosting food production across the realm! −${COMMISSION_FOOD_COST} food · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseWaxFormulas() {
  const a = state.wanderingCandlemaker;
  if (!a?.active) return { ok: false, reason: 'No candlemaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The candlemaker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased wax formulas from the wandering candlemaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'candlemakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'candlemakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_CANDLEMAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The candlemaker shares a well-worn formulary of wax-blending secrets — rare beeswax purification techniques, wick-braiding patterns, and scented tallow refinement methods that the imperial chandlery eagerly adopts, dramatically expanding their candle trade and generating steady new gold revenues for the treasury! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCandlemakerAway() {
  const a = state.wanderingCandlemaker;
  if (!a?.active) return { ok: false, reason: 'No candlemaker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_CANDLEMAKER_CHANGED, { dismissed: true });
  addMessage('🕯️ The candlemaker wraps the unsold candles back in their linen cloth, bows graciously, and departs from the capital — the warm scent of beeswax fading on the breeze as the craftsman heads off down the road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
