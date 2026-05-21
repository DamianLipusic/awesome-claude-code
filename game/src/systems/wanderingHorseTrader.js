/**
 * EmpireOS — Wandering Horse Trader (T359).
 *
 * Every 12–17 minutes (Iron Age+, 10+ player tiles), a skilled horse trader
 * arrives with a string of fine stallions and mares bred for cavalry and trade.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🐴 Purchase Prize Stallions — pay 35 gold
 *        → +0.2 gold/s for 2.5 min · +22 prestige · +12 morale
 *   ⚔️ Trade Saddle Equipment  — pay 20 iron + 15 food
 *        → +0.18 iron/s for 2 min · +15 prestige · +8 morale
 *   👋 Send Away               — dismiss (no reward)
 *
 * state.wanderingHorseTrader = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalPurchases:    number,
 *   totalTrades:       number,
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
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const PURCHASE_GOLD_COST          = 35;
export const PURCHASE_GOLD_RATE          = 0.2;
export const PURCHASE_PRESTIGE_REWARD    = 22;
export const PURCHASE_MORALE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TRADE_IRON_COST             = 20;
export const TRADE_FOOD_COST             = 15;
export const TRADE_IRON_RATE             = 0.18;
export const TRADE_PRESTIGE_REWARD       = 15;
export const TRADE_MORALE_REWARD         = 8;
export const TRADE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingHorseTrader() {
  if (!state.wanderingHorseTrader) {
    state.wanderingHorseTrader = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalPurchases:   0,
      totalTrades:      0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingHorseTrader;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalPurchases  === undefined) s.totalPurchases  = 0;
  if (s.totalTrades     === undefined) s.totalTrades     = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingHorseTraderTick() {
  const a = state.wanderingHorseTrader;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_HORSE_TRADER_CHANGED, { expired: true });
      addMessage('🐴 The horse trader clicks his tongue, gathers the lead ropes of the string of horses, and rides out through the gates — the sound of hooves fades as they disappear down the road toward the next market fair.', 'info');
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
  emit(Events.WANDERING_HORSE_TRADER_CHANGED, { spawned: true });
  addMessage('🐴 A wandering horse trader arrives leading a magnificent string of stallions and mares — bred on distant plains for speed, endurance, and battlefield courage. They offer to sell prize breeding stock for the empire\'s cavalry or to take quality saddle equipment and fodder as trade. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingHorseTrader() { return state.wanderingHorseTrader?.active ?? null; }
export function getHorseTraderSecsLeft() {
  const a = state.wanderingHorseTrader?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function purchasePrizeStallions() {
  const a = state.wanderingHorseTrader;
  if (!a?.active) return { ok: false, reason: 'No horse trader present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The horse trader has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  changeMorale(PURCHASE_MORALE_REWARD);
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased prize stallions from the wandering horse trader');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'horseTraderPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'horseTraderPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_HORSE_TRADER_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🐴 The finest stallions are stabled in the imperial paddock — merchants and nobles pay premium prices to lease quality horses for long-distance trade caravans, and the empire's cavalry reputation draws wealthy buyers who shower coin on local markets! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige · +${PURCHASE_MORALE_REWARD} morale. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function tradeSaddleEquipment() {
  const a = state.wanderingHorseTrader;
  if (!a?.active) return { ok: false, reason: 'No horse trader present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The horse trader has departed.' };
  if ((state.resources.iron ?? 0) < TRADE_IRON_COST) return { ok: false, reason: `Need ${TRADE_IRON_COST} iron.` };
  if ((state.resources.food ?? 0) < TRADE_FOOD_COST) return { ok: false, reason: `Need ${TRADE_FOOD_COST} food.` };
  state.resources.iron -= TRADE_IRON_COST;
  state.resources.food -= TRADE_FOOD_COST;
  changeMorale(TRADE_MORALE_REWARD);
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Traded saddle equipment with the wandering horse trader');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'horseTraderTrade');
    state.randomEvents.activeModifiers.push({
      id: 'horseTraderTrade', resource: 'iron',
      rateMult: 1 + (TRADE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.WANDERING_HORSE_TRADER_CHANGED, { trade: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚔️ The trader examines the iron fittings and fodder bales with an expert eye, trades two battle-hardened warhorses bred for heavy cavalry work, and departs satisfied — the horses' iron-shod hooves inspire smiths to refine their metalworking, and the empire's forges buzz with new horseshoe and armour commissions! −${TRADE_IRON_COST} iron · −${TRADE_FOOD_COST} food · +${TRADE_PRESTIGE_REWARD} prestige · +${TRADE_MORALE_REWARD} morale. Iron surge: +${TRADE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendHorseTraderAway() {
  const a = state.wanderingHorseTrader;
  if (!a?.active) return { ok: false, reason: 'No horse trader present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_HORSE_TRADER_CHANGED, { dismissed: true });
  addMessage('🐴 The horse trader tips his wide-brimmed hat, adjusts the lead ropes of the string, and trots south toward the next market town — the thunder of hooves fades into the distance.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
