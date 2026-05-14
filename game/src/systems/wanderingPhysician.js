/**
 * EmpireOS — Wandering Physician (T276).
 *
 * Every 13–18 minutes (Bronze Age+, 8+ player tiles), a wandering physician
 * arrives offering medical knowledge and healing services. The player has
 * 80 seconds to decide.
 *
 * Choices:
 *   💊 Commission Treatments    — pay 35 food
 *        → +20 morale + 15 prestige + 0.15 food/s for 2.5 min
 *   📖 Learn Medical Lore       — pay 20 mana
 *        → +12 morale + 8 prestige + 0.1 mana/s for 2 min
 *   👋 Send Away               — dismiss (no reward)
 *
 * state.wanderingPhysician = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalVisits:     number,
 *   totalTreatments: number,
 *   totalLearnings:  number,
 *   totalDismissals: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const TREAT_FOOD_COST          = 35;
export const TREAT_MORALE_REWARD      = 20;
export const TREAT_PRESTIGE_REWARD    = 15;
export const TREAT_FOOD_RATE          = 0.15;
export const TREAT_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const LEARN_MANA_COST          = 20;
export const LEARN_MORALE_REWARD      = 12;
export const LEARN_PRESTIGE_REWARD    = 8;
export const LEARN_MANA_RATE          = 0.10;
export const LEARN_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingPhysician() {
  if (!state.wanderingPhysician) {
    state.wanderingPhysician = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalTreatments: 0,
      totalLearnings:  0,
      totalDismissals: 0,
    };
  }
  if (state.wanderingPhysician.nextSpawnTick    === undefined) state.wanderingPhysician.nextSpawnTick    = _nextSpawnTick();
  if (state.wanderingPhysician.totalVisits      === undefined) state.wanderingPhysician.totalVisits      = 0;
  if (state.wanderingPhysician.totalTreatments  === undefined) state.wanderingPhysician.totalTreatments  = 0;
  if (state.wanderingPhysician.totalLearnings   === undefined) state.wanderingPhysician.totalLearnings   = 0;
  if (state.wanderingPhysician.totalDismissals  === undefined) state.wanderingPhysician.totalDismissals  = 0;
}

export function wanderingPhysicianTick() {
  const wp = state.wanderingPhysician;
  if (!wp) return;
  if (wp.active) {
    if (state.tick >= wp.active.expiresAt) {
      wp.active = null; wp.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_PHYSICIAN_CHANGED, { expired: true });
      addMessage('💊 The wandering physician departs to tend to other communities in need.', 'info');
    }
    return;
  }
  if (state.tick < wp.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  wp.active      = { expiresAt: state.tick + WINDOW_TICKS };
  wp.totalVisits = (wp.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_PHYSICIAN_CHANGED, { spawned: true });
  addMessage('💊 A wandering physician carrying medicinal herbs and ancient healing texts has arrived at your capital! Their skills could greatly benefit your people. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingPhysician() { return state.wanderingPhysician?.active ?? null; }
export function getPhysicianSecsLeft() {
  const a = state.wanderingPhysician?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionPhysicianTreatments() {
  const wp = state.wanderingPhysician;
  if (!wp?.active) return { ok: false, reason: 'No physician present.' };
  if (state.tick >= wp.active.expiresAt) return { ok: false, reason: 'The physician has departed.' };
  if ((state.resources.food ?? 0) < TREAT_FOOD_COST) return { ok: false, reason: `Need ${TREAT_FOOD_COST} food.` };
  state.resources.food -= TREAT_FOOD_COST;
  changeMorale(TREAT_MORALE_REWARD);
  awardPrestige(TREAT_PRESTIGE_REWARD, 'Commissioned healing treatments from a wandering physician');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'physicianTreat');
    state.randomEvents.activeModifiers.push({
      id: 'physicianTreat', resource: 'food',
      rateMult: 1 + (TREAT_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + TREAT_DURATION_TICKS,
    });
  }
  wp.active = null; wp.nextSpawnTick = _nextSpawnTick(); wp.totalTreatments = (wp.totalTreatments ?? 0) + 1;
  emit(Events.WANDERING_PHYSICIAN_CHANGED, { treated: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💊 The physician tends to the imperial court and citizens! Health and morale flourish. −${TREAT_FOOD_COST} food · +${TREAT_MORALE_REWARD} morale · +${TREAT_PRESTIGE_REWARD} prestige. Improved health boosts food output: +${TREAT_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function learnPhysicianLore() {
  const wp = state.wanderingPhysician;
  if (!wp?.active) return { ok: false, reason: 'No physician present.' };
  if (state.tick >= wp.active.expiresAt) return { ok: false, reason: 'The physician has departed.' };
  if ((state.resources.mana ?? 0) < LEARN_MANA_COST) return { ok: false, reason: `Need ${LEARN_MANA_COST} mana.` };
  state.resources.mana -= LEARN_MANA_COST;
  changeMorale(LEARN_MORALE_REWARD);
  awardPrestige(LEARN_PRESTIGE_REWARD, 'Learned medical lore from a wandering physician');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'physicianLore');
    state.randomEvents.activeModifiers.push({
      id: 'physicianLore', resource: 'mana',
      rateMult: 1 + (LEARN_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + LEARN_DURATION_TICKS,
    });
  }
  wp.active = null; wp.nextSpawnTick = _nextSpawnTick(); wp.totalLearnings = (wp.totalLearnings ?? 0) + 1;
  emit(Events.WANDERING_PHYSICIAN_CHANGED, { learned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 Ancient healing wisdom is transcribed into imperial medical texts! −${LEARN_MANA_COST} mana · +${LEARN_MORALE_REWARD} morale · +${LEARN_PRESTIGE_REWARD} prestige. Scholarly insight deepens: +${LEARN_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendPhysicianAway() {
  const wp = state.wanderingPhysician;
  if (!wp?.active) return { ok: false, reason: 'No physician present.' };
  wp.active = null; wp.nextSpawnTick = _nextSpawnTick(); wp.totalDismissals = (wp.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_PHYSICIAN_CHANGED, { dismissed: true });
  addMessage('💊 The wandering physician is thanked and sent on their way to help other settlements.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
