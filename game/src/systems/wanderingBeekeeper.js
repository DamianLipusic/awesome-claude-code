/**
 * EmpireOS — Wandering Beekeeper (T283).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a wandering beekeeper
 * arrives with knowledge of apiculture and sweet trade goods. The player has
 * 80 seconds to decide.
 *
 * Choices:
 *   🍯 Establish Royal Apiary   — pay 25 food
 *        → +0.2 food/s for 2.5 min · +15 prestige · +8 morale
 *   🌸 Trade Honey & Beeswax    — pay 15 gold
 *        → +30 food · +10 prestige
 *   👋 Send Away                — dismiss (no reward)
 *
 * state.wanderingBeekeeper = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalVisits:     number,
 *   totalApiaries:   number,
 *   totalTrades:     number,
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
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const APIARY_FOOD_COST       = 25;
export const APIARY_FOOD_RATE       = 0.2;
export const APIARY_PRESTIGE_REWARD = 15;
export const APIARY_MORALE_REWARD   = 8;
export const APIARY_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TRADE_GOLD_COST        = 15;
export const TRADE_FOOD_REWARD      = 30;
export const TRADE_PRESTIGE_REWARD  = 10;

export function initWanderingBeekeeper() {
  if (!state.wanderingBeekeeper) {
    state.wanderingBeekeeper = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalApiaries:   0,
      totalTrades:     0,
      totalDismissals: 0,
    };
  }
  if (state.wanderingBeekeeper.nextSpawnTick  === undefined) state.wanderingBeekeeper.nextSpawnTick  = _nextSpawnTick();
  if (state.wanderingBeekeeper.totalVisits    === undefined) state.wanderingBeekeeper.totalVisits    = 0;
  if (state.wanderingBeekeeper.totalApiaries  === undefined) state.wanderingBeekeeper.totalApiaries  = 0;
  if (state.wanderingBeekeeper.totalTrades    === undefined) state.wanderingBeekeeper.totalTrades    = 0;
  if (state.wanderingBeekeeper.totalDismissals === undefined) state.wanderingBeekeeper.totalDismissals = 0;
}

export function wanderingBeekeeperTick() {
  const wb = state.wanderingBeekeeper;
  if (!wb) return;
  if (wb.active) {
    if (state.tick >= wb.active.expiresAt) {
      wb.active = null; wb.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_BEEKEEPER_CHANGED, { expired: true });
      addMessage('🍯 The wandering beekeeper packs their hives and moves on to the next settlement.', 'info');
    }
    return;
  }
  if (state.tick < wb.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  wb.active     = { expiresAt: state.tick + WINDOW_TICKS };
  wb.totalVisits = (wb.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_BEEKEEPER_CHANGED, { spawned: true });
  addMessage('🍯 A wandering beekeeper arrives at the imperial court, bearing fragrant honeycomb and knowledge of the ancient art of apiculture. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingBeekeeper() { return state.wanderingBeekeeper?.active ?? null; }
export function getBeekeeperSecsLeft() {
  const a = state.wanderingBeekeeper?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishRoyalApiary() {
  const wb = state.wanderingBeekeeper;
  if (!wb?.active) return { ok: false, reason: 'No beekeeper present.' };
  if (state.tick >= wb.active.expiresAt) return { ok: false, reason: 'The beekeeper has departed.' };
  if ((state.resources.food ?? 0) < APIARY_FOOD_COST) return { ok: false, reason: `Need ${APIARY_FOOD_COST} food.` };
  state.resources.food -= APIARY_FOOD_COST;
  changeMorale(APIARY_MORALE_REWARD);
  awardPrestige(APIARY_PRESTIGE_REWARD, 'Established a royal apiary with a wandering beekeeper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'beekeeperApiary');
    state.randomEvents.activeModifiers.push({
      id: 'beekeeperApiary', resource: 'food',
      rateMult: 1 + (APIARY_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + APIARY_DURATION_TICKS,
    });
  }
  wb.active = null; wb.nextSpawnTick = _nextSpawnTick(); wb.totalApiaries = (wb.totalApiaries ?? 0) + 1;
  emit(Events.WANDERING_BEEKEEPER_CHANGED, { apiary: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍯 The royal apiary hums with activity as golden honeybees tend the imperial gardens! −${APIARY_FOOD_COST} food · +${APIARY_PRESTIGE_REWARD} prestige · +${APIARY_MORALE_REWARD} morale. Sweet abundance: +${APIARY_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function tradeHoneyBeeswax() {
  const wb = state.wanderingBeekeeper;
  if (!wb?.active) return { ok: false, reason: 'No beekeeper present.' };
  if (state.tick >= wb.active.expiresAt) return { ok: false, reason: 'The beekeeper has departed.' };
  if ((state.resources.gold ?? 0) < TRADE_GOLD_COST) return { ok: false, reason: `Need ${TRADE_GOLD_COST} gold.` };
  state.resources.gold -= TRADE_GOLD_COST;
  state.resources.food  = (state.resources.food ?? 0) + TRADE_FOOD_REWARD;
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Traded for honey and beeswax from a wandering beekeeper');
  wb.active = null; wb.nextSpawnTick = _nextSpawnTick(); wb.totalTrades = (wb.totalTrades ?? 0) + 1;
  emit(Events.WANDERING_BEEKEEPER_CHANGED, { trade: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌸 Jars of golden honey and fragrant beeswax fill the imperial stores! −${TRADE_GOLD_COST} gold · +${TRADE_FOOD_REWARD} food · +${TRADE_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

export function sendBeekeeperAway() {
  const wb = state.wanderingBeekeeper;
  if (!wb?.active) return { ok: false, reason: 'No beekeeper present.' };
  wb.active = null; wb.nextSpawnTick = _nextSpawnTick(); wb.totalDismissals = (wb.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_BEEKEEPER_CHANGED, { dismissed: true });
  addMessage('🍯 The wandering beekeeper is thanked and continues their journey across the countryside.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
