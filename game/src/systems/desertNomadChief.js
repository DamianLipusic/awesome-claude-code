/**
 * EmpireOS — Desert Nomad Chief (T300).
 *
 * Every 14–19 minutes (Bronze Age+, 8+ player tiles), a powerful desert
 * nomad chief arrives leading a delegation of warriors and traders from
 * the vast desert kingdoms. The player has 80 seconds to decide.
 *
 * Choices:
 *   🏜️ Forge Alliance         — pay 20 food + 20 gold
 *        → +0.2 food/s for 2.5 min · +20 prestige · +12 morale
 *   🐪 Exchange Trade Goods   — pay 30 wood
 *        → +0.18 gold/s for 2 min · +15 prestige
 *   🚫 Decline Meeting         — dismiss (no reward)
 *
 * state.desertNomadChief = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalAlliances:      number,
 *   totalTrades:         number,
 *   totalDismissals:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const ALLIANCE_FOOD_COST       = 20;
export const ALLIANCE_GOLD_COST       = 20;
export const ALLIANCE_FOOD_RATE       = 0.2;
export const ALLIANCE_PRESTIGE_REWARD = 20;
export const ALLIANCE_MORALE_REWARD   = 12;
export const ALLIANCE_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TRADE_WOOD_COST          = 30;
export const TRADE_GOLD_RATE          = 0.18;
export const TRADE_PRESTIGE_REWARD    = 15;
export const TRADE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initDesertNomadChief() {
  if (!state.desertNomadChief) {
    state.desertNomadChief = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalAlliances:  0,
      totalTrades:     0,
      totalDismissals: 0,
    };
  }
  const s = state.desertNomadChief;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalAlliances  === undefined) s.totalAlliances  = 0;
  if (s.totalTrades     === undefined) s.totalTrades     = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function desertNomadChiefTick() {
  const a = state.desertNomadChief;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.DESERT_NOMAD_CHIEF_CHANGED, { expired: true });
      addMessage('🏜️ The desert nomad chief gathers his warriors and traders, mounts his magnificent camel, and leads his delegation back into the shimmering sands of the great desert.', 'info');
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
  emit(Events.DESERT_NOMAD_CHIEF_CHANGED, { spawned: true });
  addMessage('🏜️ A powerful desert nomad chief arrives at the imperial gates leading a magnificent delegation of warriors, traders, and desert scouts from the vast sand kingdoms beyond the horizon. Respond within 80 seconds.', 'info');
}

export function getActiveNomadChief() { return state.desertNomadChief?.active ?? null; }
export function getNomadChiefSecsLeft() {
  const a = state.desertNomadChief?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function forgeNomadAlliance() {
  const a = state.desertNomadChief;
  if (!a?.active) return { ok: false, reason: 'No nomad chief present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The chief has departed.' };
  if ((state.resources.food ?? 0) < ALLIANCE_FOOD_COST) return { ok: false, reason: `Need ${ALLIANCE_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < ALLIANCE_GOLD_COST) return { ok: false, reason: `Need ${ALLIANCE_GOLD_COST} gold.` };
  state.resources.food -= ALLIANCE_FOOD_COST;
  state.resources.gold -= ALLIANCE_GOLD_COST;
  changeMorale(ALLIANCE_MORALE_REWARD);
  awardPrestige(ALLIANCE_PRESTIGE_REWARD, 'Forged alliance with the desert nomad chief');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'nomadAlliance');
    state.randomEvents.activeModifiers.push({
      id: 'nomadAlliance', resource: 'food',
      rateMult: 1 + (ALLIANCE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + ALLIANCE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalAlliances = (a.totalAlliances ?? 0) + 1;
  emit(Events.DESERT_NOMAD_CHIEF_CHANGED, { alliance: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏜️ The nomad alliance brings desert caravans laden with exotic provisions to the imperial markets, flooding the realm with new food supplies and invigorating the populace! −${ALLIANCE_FOOD_COST} food · −${ALLIANCE_GOLD_COST} gold · +${ALLIANCE_PRESTIGE_REWARD} prestige · +${ALLIANCE_MORALE_REWARD} morale. Provision surge: +${ALLIANCE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeTradeGoods() {
  const a = state.desertNomadChief;
  if (!a?.active) return { ok: false, reason: 'No nomad chief present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The chief has departed.' };
  if ((state.resources.wood ?? 0) < TRADE_WOOD_COST) return { ok: false, reason: `Need ${TRADE_WOOD_COST} wood.` };
  state.resources.wood -= TRADE_WOOD_COST;
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Exchanged trade goods with the desert nomad chief');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'nomadTrade');
    state.randomEvents.activeModifiers.push({
      id: 'nomadTrade', resource: 'gold',
      rateMult: 1 + (TRADE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.DESERT_NOMAD_CHIEF_CHANGED, { trade: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🐪 The desert traders open lucrative exchange routes between your imperial markets and the vast sand kingdoms, channelling a steady stream of exotic wealth into the imperial treasury! −${TRADE_WOOD_COST} wood · +${TRADE_PRESTIGE_REWARD} prestige. Trade surge: +${TRADE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function declineNomadMeeting() {
  const a = state.desertNomadChief;
  if (!a?.active) return { ok: false, reason: 'No nomad chief present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.DESERT_NOMAD_CHIEF_CHANGED, { dismissed: true });
  addMessage('🏜️ The desert nomad chief accepts the imperial refusal with proud dignity, turns his delegation around, and rides back toward the endless sands from whence they came.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
