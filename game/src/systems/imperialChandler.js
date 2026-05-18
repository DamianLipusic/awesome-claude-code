/**
 * EmpireOS — Imperial Chandler (T320).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a master chandler
 * arrives at the imperial court, offering premium candles and illumination
 * expertise to brighten the empire's halls. The player has 80 seconds to decide.
 *
 * Choices:
 *   🕯️ Commission Candle Works — pay 20 wood + 15 food
 *        → +0.20 food/s for 2.5 min · +18 prestige · +10 morale
 *   💰 Purchase Fine Candles   — pay 25 gold
 *        → +0.15 gold/s for 2 min   · +12 prestige
 *   🚶 Send Away               — dismiss (no reward)
 *
 * state.imperialChandler = {
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

export const PURCHASE_GOLD_COST            = 25;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialChandler() {
  if (!state.imperialChandler) {
    state.imperialChandler = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialChandler;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialChandlerTick() {
  const a = state.imperialChandler;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_CHANDLER_CHANGED, { expired: true });
      addMessage('🕯️ The imperial chandler carefully wraps their finest beeswax tapers and aromatic pillar candles, loads the cart, and departs the palace courtyard to seek other noble patrons.', 'info');
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
  emit(Events.IMPERIAL_CHANDLER_CHANGED, { spawned: true });
  addMessage('🕯️ An imperial chandler arrives at the palace bearing exquisitely crafted beeswax candles, aromatic tapers, and luminous lanterns of unparalleled quality. They offer their finest wares to illuminate the empire. Respond within 80 seconds.', 'info');
}

export function getActiveImperialChandler() { return state.imperialChandler?.active ?? null; }
export function getImperialChandlerSecsLeft() {
  const a = state.imperialChandler?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCandleWorks() {
  const a = state.imperialChandler;
  if (!a?.active) return { ok: false, reason: 'No chandler present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The chandler has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned candle works from the imperial chandler');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'chandlerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'chandlerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_CHANDLER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🕯️ The chandler establishes a grand candle works in the palace district, filling the halls with warm golden light. The brilliant illumination inspires craftspeople and farmers alike to work longer hours, boosting productivity across the realm! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseFineCandles() {
  const a = state.imperialChandler;
  if (!a?.active) return { ok: false, reason: 'No chandler present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The chandler has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased fine candles from the imperial chandler');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'chandlerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'chandlerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_CHANDLER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💛 The chandler's premium beeswax candles are distributed throughout the imperial court and merchant quarters. Their warm, steady light extends working hours and enables evening trade, bringing new commerce to the markets! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendChandlerAway() {
  const a = state.imperialChandler;
  if (!a?.active) return { ok: false, reason: 'No chandler present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_CHANDLER_CHANGED, { dismissed: true });
  addMessage('🕯️ The imperial chandler bows graciously, secures their collection of fine candles and tapers in their cart, and departs the palace grounds to offer their illuminating wares elsewhere.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
