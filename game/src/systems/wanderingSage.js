/**
 * EmpireOS — Wandering Sage (T266).
 *
 * Every 16–21 minutes (Medieval Age+, 12+ player tiles), a wandering sage
 * renowned for ancient knowledge arrives at the imperial court.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📜 Commission Imperial Edict — pay 40 gold + 20 mana
 *        → +0.3 gold/s + 0.1 mana/s for 3 min + 30 prestige
 *   📖 Study Ancient Texts      — pay 30 mana
 *        → +0.5 mana/s for 2.5 min + 20 prestige
 *   🍵 Offer Humble Hospitality — pay 25 food
 *        → +10 morale + 12 prestige
 *
 * state.wanderingSage = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalEdicts:      number,
 *   totalStudied:     number,
 *   totalHosted:      number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 16 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;
const MIN_PLAYER_TILES = 12;

export const EDICT_GOLD_COST       = 40;
export const EDICT_MANA_COST       = 20;
export const EDICT_GOLD_RATE       = 0.3;
export const EDICT_MANA_RATE       = 0.1;
export const EDICT_DURATION_TICKS  = 3 * 60 * TICKS_PER_SECOND;
export const EDICT_PRESTIGE_REWARD = 30;

export const STUDY_MANA_COST       = 30;
export const STUDY_MANA_RATE       = 0.5;
export const STUDY_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);
export const STUDY_PRESTIGE_REWARD = 20;

export const HOST_FOOD_COST        = 25;
export const HOST_MORALE_REWARD    = 10;
export const HOST_PRESTIGE_REWARD  = 12;

export function initWanderingSage() {
  if (!state.wanderingSage) {
    state.wanderingSage = {
      active:        null,
      nextSpawnTick: _nextSpawnTick(),
      totalVisits:   0,
      totalEdicts:   0,
      totalStudied:  0,
      totalHosted:   0,
    };
  }
  if (state.wanderingSage.nextSpawnTick  === undefined) state.wanderingSage.nextSpawnTick  = _nextSpawnTick();
  if (state.wanderingSage.totalVisits    === undefined) state.wanderingSage.totalVisits    = 0;
  if (state.wanderingSage.totalEdicts    === undefined) state.wanderingSage.totalEdicts    = 0;
  if (state.wanderingSage.totalStudied   === undefined) state.wanderingSage.totalStudied   = 0;
  if (state.wanderingSage.totalHosted    === undefined) state.wanderingSage.totalHosted    = 0;
}

export function wanderingSageTick() {
  const ws = state.wanderingSage;
  if (!ws) return;
  if (ws.active) {
    if (state.tick >= ws.active.expiresAt) {
      ws.active        = null; ws.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SAGE_CHANGED, { expired: true });
      addMessage('🧑‍🏫 The wandering sage departs without an audience, continuing their solitary journey.', 'info');
    }
    return;
  }
  if (state.tick < ws.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  ws.active      = { expiresAt: state.tick + WINDOW_TICKS };
  ws.totalVisits = (ws.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_SAGE_CHANGED, { spawned: true });
  addMessage('🧑‍🏫 A wandering sage renowned for ancient knowledge has arrived at the imperial court! Their wisdom spans centuries. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingSage()  { return state.wanderingSage?.active ?? null; }
export function getWanderingSageSecsLeft() {
  const a = state.wanderingSage?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialEdict() {
  const ws = state.wanderingSage;
  if (!ws?.active) return { ok: false, reason: 'No sage present.' };
  if (state.tick >= ws.active.expiresAt) return { ok: false, reason: 'The sage has departed.' };
  if ((state.resources.gold ?? 0) < EDICT_GOLD_COST) return { ok: false, reason: `Need ${EDICT_GOLD_COST} gold.` };
  if ((state.resources.mana ?? 0) < EDICT_MANA_COST) return { ok: false, reason: `Need ${EDICT_MANA_COST} mana.` };
  state.resources.gold -= EDICT_GOLD_COST;
  state.resources.mana -= EDICT_MANA_COST;
  awardPrestige(EDICT_PRESTIGE_REWARD, 'Commissioned an Imperial Edict from a wandering sage');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(
      m => m.id !== 'sageEdictGold' && m.id !== 'sageEdictMana'
    );
    state.randomEvents.activeModifiers.push({
      id: 'sageEdictGold', resource: 'gold', rateMult: 1 + (EDICT_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + EDICT_DURATION_TICKS,
    });
    state.randomEvents.activeModifiers.push({
      id: 'sageEdictMana', resource: 'mana', rateMult: 1 + (EDICT_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 0.1))),
      expiresAt: state.tick + EDICT_DURATION_TICKS,
    });
  }
  ws.active       = null; ws.nextSpawnTick = _nextSpawnTick(); ws.totalEdicts = (ws.totalEdicts ?? 0) + 1;
  emit(Events.WANDERING_SAGE_CHANGED, { edict: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The sage inscribes an Imperial Edict with ancient authority! +${EDICT_PRESTIGE_REWARD} prestige. Commerce and arcane arts flourish: +${EDICT_GOLD_RATE} gold/s and +${EDICT_MANA_RATE} mana/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

export function studyAncientTexts() {
  const ws = state.wanderingSage;
  if (!ws?.active) return { ok: false, reason: 'No sage present.' };
  if (state.tick >= ws.active.expiresAt) return { ok: false, reason: 'The sage has departed.' };
  if ((state.resources.mana ?? 0) < STUDY_MANA_COST) return { ok: false, reason: `Need ${STUDY_MANA_COST} mana.` };
  state.resources.mana -= STUDY_MANA_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied ancient texts under the guidance of a wandering sage');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sageStudy');
    state.randomEvents.activeModifiers.push({
      id: 'sageStudy', resource: 'mana', rateMult: 1 + (STUDY_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 0.1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  ws.active        = null; ws.nextSpawnTick = _nextSpawnTick(); ws.totalStudied = (ws.totalStudied ?? 0) + 1;
  emit(Events.WANDERING_SAGE_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 Imperial scholars study alongside the sage! +${STUDY_PRESTIGE_REWARD} prestige. Ancient ley lines resonate: +${STUDY_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function offerHumbleHospitality() {
  const ws = state.wanderingSage;
  if (!ws?.active) return { ok: false, reason: 'No sage present.' };
  if (state.tick >= ws.active.expiresAt) return { ok: false, reason: 'The sage has departed.' };
  if ((state.resources.food ?? 0) < HOST_FOOD_COST) return { ok: false, reason: `Need ${HOST_FOOD_COST} food.` };
  state.resources.food -= HOST_FOOD_COST;
  changeMorale(HOST_MORALE_REWARD);
  awardPrestige(HOST_PRESTIGE_REWARD, 'Offered humble hospitality to a wandering sage');
  ws.active       = null; ws.nextSpawnTick = _nextSpawnTick(); ws.totalHosted = (ws.totalHosted ?? 0) + 1;
  emit(Events.WANDERING_SAGE_CHANGED, { hosted: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍵 The sage blesses the empire with parting wisdom! +${HOST_MORALE_REWARD} morale, +${HOST_PRESTIGE_REWARD} prestige. The people are inspired by this show of imperial grace.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
