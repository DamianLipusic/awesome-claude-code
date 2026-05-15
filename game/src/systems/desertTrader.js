/**
 * EmpireOS — Desert Trader (T280).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a desert trader
 * leading a camel caravan laden with exotic goods arrives at the imperial
 * gates. The player has 75 seconds to decide.
 *
 * Choices:
 *   🐪 Arrange Caravan Deal  — pay 45 gold
 *        → +0.25 gold/s for 2.5 min · +20 prestige · +10 morale
 *   🏺 Exchange Exotic Goods — pay 25 food + 15 wood
 *        → +60 gold · +15 prestige
 *   👋 Send Away             — dismiss (no reward)
 *
 * state.desertTrader = {
 *   active:         { expiresAt: tick } | null,
 *   nextSpawnTick:  tick,
 *   totalVisits:    number,
 *   totalDeals:     number,
 *   totalExchanges: number,
 *   totalDismissals: number,
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
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const DEAL_GOLD_COST        = 45;
export const DEAL_GOLD_RATE        = 0.25;
export const DEAL_PRESTIGE_REWARD  = 20;
export const DEAL_MORALE_REWARD    = 10;
export const DEAL_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_FOOD_COST       = 25;
export const EXCHANGE_WOOD_COST       = 15;
export const EXCHANGE_GOLD_REWARD     = 60;
export const EXCHANGE_PRESTIGE_REWARD = 15;

export function initDesertTrader() {
  if (!state.desertTrader) {
    state.desertTrader = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalDeals:      0,
      totalExchanges:  0,
      totalDismissals: 0,
    };
  }
  if (state.desertTrader.nextSpawnTick    === undefined) state.desertTrader.nextSpawnTick    = _nextSpawnTick();
  if (state.desertTrader.totalVisits      === undefined) state.desertTrader.totalVisits      = 0;
  if (state.desertTrader.totalDeals       === undefined) state.desertTrader.totalDeals       = 0;
  if (state.desertTrader.totalExchanges   === undefined) state.desertTrader.totalExchanges   = 0;
  if (state.desertTrader.totalDismissals  === undefined) state.desertTrader.totalDismissals  = 0;
}

export function desertTraderTick() {
  const dt = state.desertTrader;
  if (!dt) return;
  if (dt.active) {
    if (state.tick >= dt.active.expiresAt) {
      dt.active = null; dt.nextSpawnTick = _nextSpawnTick();
      emit(Events.DESERT_TRADER_CHANGED, { expired: true });
      addMessage('🐪 The desert trader loads up their camels and continues their long journey across the sands.', 'info');
    }
    return;
  }
  if (state.tick < dt.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  dt.active      = { expiresAt: state.tick + WINDOW_TICKS };
  dt.totalVisits = (dt.totalVisits ?? 0) + 1;
  emit(Events.DESERT_TRADER_CHANGED, { spawned: true });
  addMessage('🐪 A desert trader leading a camel caravan laden with exotic spices, silks, and rare goods from distant lands has arrived at the imperial gates. Respond within 75 seconds.', 'info');
}

export function getActiveDesertTrader() { return state.desertTrader?.active ?? null; }
export function getDesertTraderSecsLeft() {
  const a = state.desertTrader?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function arrangeCaravanDeal() {
  const dt = state.desertTrader;
  if (!dt?.active) return { ok: false, reason: 'No trader present.' };
  if (state.tick >= dt.active.expiresAt) return { ok: false, reason: 'The trader has departed.' };
  if ((state.resources.gold ?? 0) < DEAL_GOLD_COST) return { ok: false, reason: `Need ${DEAL_GOLD_COST} gold.` };
  state.resources.gold -= DEAL_GOLD_COST;
  changeMorale(DEAL_MORALE_REWARD);
  awardPrestige(DEAL_PRESTIGE_REWARD, 'Arranged a lucrative caravan deal with a desert trader');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'traderDeal');
    state.randomEvents.activeModifiers.push({
      id: 'traderDeal', resource: 'gold',
      rateMult: 1 + (DEAL_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + DEAL_DURATION_TICKS,
    });
  }
  dt.active = null; dt.nextSpawnTick = _nextSpawnTick(); dt.totalDeals = (dt.totalDeals ?? 0) + 1;
  emit(Events.DESERT_TRADER_CHANGED, { deal: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🐪 A lucrative trading partnership with desert merchants opens new commerce routes! −${DEAL_GOLD_COST} gold · +${DEAL_PRESTIGE_REWARD} prestige · +${DEAL_MORALE_REWARD} morale. Exotic trade flows: +${DEAL_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeExoticGoods() {
  const dt = state.desertTrader;
  if (!dt?.active) return { ok: false, reason: 'No trader present.' };
  if (state.tick >= dt.active.expiresAt) return { ok: false, reason: 'The trader has departed.' };
  if ((state.resources.food ?? 0) < EXCHANGE_FOOD_COST) return { ok: false, reason: `Need ${EXCHANGE_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < EXCHANGE_WOOD_COST) return { ok: false, reason: `Need ${EXCHANGE_WOOD_COST} wood.` };
  state.resources.food -= EXCHANGE_FOOD_COST;
  state.resources.wood -= EXCHANGE_WOOD_COST;
  state.resources.gold = (state.resources.gold ?? 0) + EXCHANGE_GOLD_REWARD;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged exotic goods with a desert trader');
  dt.active = null; dt.nextSpawnTick = _nextSpawnTick(); dt.totalExchanges = (dt.totalExchanges ?? 0) + 1;
  emit(Events.DESERT_TRADER_CHANGED, { exchanged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏺 Exotic desert goods fetch premium prices in the imperial market! −${EXCHANGE_FOOD_COST} food · −${EXCHANGE_WOOD_COST} wood · +${EXCHANGE_GOLD_REWARD} gold · +${EXCHANGE_PRESTIGE_REWARD} prestige. The exchange delights imperial merchants.`, 'windfall');
  return { ok: true };
}

export function sendDesertTraderAway() {
  const dt = state.desertTrader;
  if (!dt?.active) return { ok: false, reason: 'No trader present.' };
  dt.active = null; dt.nextSpawnTick = _nextSpawnTick(); dt.totalDismissals = (dt.totalDismissals ?? 0) + 1;
  emit(Events.DESERT_TRADER_CHANGED, { dismissed: true });
  addMessage('🐪 The desert trader is politely declined and leads their caravan onward to distant markets.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
