/**
 * EmpireOS — Wandering Oracle (T273).
 *
 * Every 15–20 minutes (Medieval Age+, 10+ player tiles), a mysterious wandering
 * oracle appears at the empire's gates, offering visions and prophecies from
 * beyond the veil. The player has 80 seconds to decide.
 *
 * Choices:
 *   🔮 Consult Vision           — pay 25 mana
 *        → +0.25 mana/s for 2.5 min + 20 prestige + 12 morale
 *   📜 Purchase Prophecy        — pay 40 gold
 *        → +30 prestige + 0.15 gold/s for 2 min
 *   👋 Send Away                — dismiss (no reward)
 *
 * state.wanderingOracle = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalConsultations:  number,
 *   totalPurchases:      number,
 *   totalDismissals:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const CONSULT_MANA_COST         = 25;
export const CONSULT_MANA_RATE         = 0.25;
export const CONSULT_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);
export const CONSULT_PRESTIGE_REWARD   = 20;
export const CONSULT_MORALE_REWARD     = 12;

export const PROPHECY_GOLD_COST        = 40;
export const PROPHECY_PRESTIGE_REWARD  = 30;
export const PROPHECY_GOLD_RATE        = 0.15;
export const PROPHECY_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingOracle() {
  if (!state.wanderingOracle) {
    state.wanderingOracle = {
      active:             null,
      nextSpawnTick:      _nextSpawnTick(),
      totalVisits:        0,
      totalConsultations: 0,
      totalPurchases:     0,
      totalDismissals:    0,
    };
  }
  if (state.wanderingOracle.nextSpawnTick      === undefined) state.wanderingOracle.nextSpawnTick      = _nextSpawnTick();
  if (state.wanderingOracle.totalVisits        === undefined) state.wanderingOracle.totalVisits        = 0;
  if (state.wanderingOracle.totalConsultations === undefined) state.wanderingOracle.totalConsultations = 0;
  if (state.wanderingOracle.totalPurchases     === undefined) state.wanderingOracle.totalPurchases     = 0;
  if (state.wanderingOracle.totalDismissals    === undefined) state.wanderingOracle.totalDismissals    = 0;
}

export function wanderingOracleTick() {
  const wo = state.wanderingOracle;
  if (!wo) return;
  if (wo.active) {
    if (state.tick >= wo.active.expiresAt) {
      wo.active = null; wo.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_ORACLE_CHANGED, { expired: true });
      addMessage('🔮 The wandering oracle retreats into the mists, their visions unshared with your court.', 'info');
    }
    return;
  }
  if (state.tick < wo.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  wo.active      = { expiresAt: state.tick + WINDOW_TICKS };
  wo.totalVisits = (wo.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_ORACLE_CHANGED, { spawned: true });
  addMessage('🔮 A wandering oracle has materialized at the gates of your empire, cloaked in mystery and starlight. They speak of visions and prophecies that could guide your realm. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingOracle() { return state.wanderingOracle?.active ?? null; }
export function getOracleSecsLeft() {
  const a = state.wanderingOracle?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function consultOracleVision() {
  const wo = state.wanderingOracle;
  if (!wo?.active) return { ok: false, reason: 'No oracle present.' };
  if (state.tick >= wo.active.expiresAt) return { ok: false, reason: 'The oracle has departed.' };
  if ((state.resources.mana ?? 0) < CONSULT_MANA_COST) return { ok: false, reason: `Need ${CONSULT_MANA_COST} mana.` };
  state.resources.mana -= CONSULT_MANA_COST;
  changeMorale(CONSULT_MORALE_REWARD);
  awardPrestige(CONSULT_PRESTIGE_REWARD, 'Consulted the visions of a wandering oracle');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'oracleVision');
    state.randomEvents.activeModifiers.push({
      id: 'oracleVision', resource: 'mana',
      rateMult: 1 + (CONSULT_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + CONSULT_DURATION_TICKS,
    });
  }
  wo.active = null; wo.nextSpawnTick = _nextSpawnTick(); wo.totalConsultations = (wo.totalConsultations ?? 0) + 1;
  emit(Events.WANDERING_ORACLE_CHANGED, { consulted: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔮 The oracle opens the veil between worlds! Arcane energies flow through the empire. +${CONSULT_PRESTIGE_REWARD} prestige · +${CONSULT_MORALE_REWARD} morale. Mana generation surges: +${CONSULT_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseOracleProphecy() {
  const wo = state.wanderingOracle;
  if (!wo?.active) return { ok: false, reason: 'No oracle present.' };
  if (state.tick >= wo.active.expiresAt) return { ok: false, reason: 'The oracle has departed.' };
  if ((state.resources.gold ?? 0) < PROPHECY_GOLD_COST) return { ok: false, reason: `Need ${PROPHECY_GOLD_COST} gold.` };
  state.resources.gold -= PROPHECY_GOLD_COST;
  awardPrestige(PROPHECY_PRESTIGE_REWARD, 'Purchased a grand prophecy from a wandering oracle');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'oracleProphecy');
    state.randomEvents.activeModifiers.push({
      id: 'oracleProphecy', resource: 'gold',
      rateMult: 1 + (PROPHECY_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PROPHECY_DURATION_TICKS,
    });
  }
  wo.active = null; wo.nextSpawnTick = _nextSpawnTick(); wo.totalPurchases = (wo.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_ORACLE_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The oracle reveals a grand prophecy of trade winds and wealth! +${PROPHECY_PRESTIGE_REWARD} prestige. Imperial treasuries flourish: +${PROPHECY_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendOracleAway() {
  const wo = state.wanderingOracle;
  if (!wo?.active) return { ok: false, reason: 'No oracle present.' };
  wo.active = null; wo.nextSpawnTick = _nextSpawnTick(); wo.totalDismissals = (wo.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_ORACLE_CHANGED, { dismissed: true });
  addMessage('🔮 The wandering oracle bows gracefully and dissolves into the morning mist.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
