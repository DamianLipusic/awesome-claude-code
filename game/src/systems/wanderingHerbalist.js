/**
 * EmpireOS — Wandering Herbalist System (T248).
 *
 * Every 10–13 minutes (Bronze Age+, 6+ player tiles), a wandering herbalist
 * passes through the empire. The player has 80 seconds to decide.
 *
 * Choices:
 *   🌿 Purchase Remedies  — pay 40 gold → +50 food, +8 morale
 *   📖 Learn Techniques   — pay 20 mana → +0.4 food/s for 3 min
 *   🚶 Send Away          — no cost, no reward
 *
 * state.herbalist = {
 *   active: { expiresAt: tick } | null,
 *   nextSpawnTick: tick,
 *   totalVisits: number, totalPurchased: number, totalLearned: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 10 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 3  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;
const MIN_PLAYER_TILES = 6;

export const PURCHASE_GOLD_COST   = 40;
export const PURCHASE_FOOD_REWARD = 50;
export const PURCHASE_MORALE      = 8;

export const LEARN_MANA_COST     = 20;
export const LEARN_FOOD_RATE     = 0.4;
export const LEARN_DURATION_TICKS = 3 * 60 * TICKS_PER_SECOND;

export function initHerbalist() {
  if (!state.herbalist) {
    state.herbalist = { active: null, nextSpawnTick: _nextSpawnTick(), totalVisits: 0, totalPurchased: 0, totalLearned: 0 };
  }
  if (state.herbalist.nextSpawnTick  === undefined) state.herbalist.nextSpawnTick  = _nextSpawnTick();
  if (state.herbalist.totalVisits    === undefined) state.herbalist.totalVisits    = 0;
  if (state.herbalist.totalPurchased === undefined) state.herbalist.totalPurchased = 0;
  if (state.herbalist.totalLearned   === undefined) state.herbalist.totalLearned   = 0;
}

export function herbalistTick() {
  const hb = state.herbalist;
  if (!hb) return;
  if (hb.active) {
    if (state.tick >= hb.active.expiresAt) {
      hb.active        = null; hb.nextSpawnTick = _nextSpawnTick();
      emit(Events.HERBALIST_CHANGED, { expired: true });
      addMessage('🌿 The herbalist has moved on without a response.', 'info');
    }
    return;
  }
  if (state.tick < hb.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  hb.active = { expiresAt: state.tick + WINDOW_TICKS };
  hb.totalVisits = (hb.totalVisits ?? 0) + 1;
  emit(Events.HERBALIST_CHANGED, { spawned: true });
  addMessage('🌿 A wandering herbalist arrives at the gates bearing remedies and knowledge! Respond within 80 seconds.', 'info');
}

export function getActiveHerbalist() { return state.herbalist?.active ?? null; }
export function getHerbalistSecsLeft() {
  const a = state.herbalist?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function purchaseRemedies() {
  const hb = state.herbalist;
  if (!hb?.active) return { ok: false, reason: 'No herbalist present.' };
  if (state.tick >= hb.active.expiresAt) return { ok: false, reason: 'The herbalist has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  const cap = state.caps?.food ?? 9999;
  state.resources.food = Math.min(cap, (state.resources.food ?? 0) + PURCHASE_FOOD_REWARD);
  changeMorale(PURCHASE_MORALE);
  hb.active          = null; hb.nextSpawnTick   = _nextSpawnTick(); hb.totalPurchased  = (hb.totalPurchased ?? 0) + 1;
  emit(Events.HERBALIST_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 Remedies distributed! +${PURCHASE_FOOD_REWARD} food, +${PURCHASE_MORALE} morale.`, 'windfall');
  return { ok: true };
}

export function learnHerbalTechniques() {
  const hb = state.herbalist;
  if (!hb?.active) return { ok: false, reason: 'No herbalist present.' };
  if (state.tick >= hb.active.expiresAt) return { ok: false, reason: 'The herbalist has departed.' };
  if ((state.resources.mana ?? 0) < LEARN_MANA_COST) return { ok: false, reason: `Need ${LEARN_MANA_COST} mana.` };
  state.resources.mana -= LEARN_MANA_COST;
  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'herbalistLearn');
    state.randomEvents.activeModifiers.push({ id: 'herbalistLearn', resource: 'food', rateMult: 1 + (LEARN_FOOD_RATE / Math.max(0.001, (state.rates?.food ?? 1))), expiresAt: state.tick + LEARN_DURATION_TICKS });
  }
  hb.active        = null; hb.nextSpawnTick = _nextSpawnTick(); hb.totalLearned  = (hb.totalLearned ?? 0) + 1;
  emit(Events.HERBALIST_CHANGED, { learned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 Herbal cultivation techniques shared! +${LEARN_FOOD_RATE} food/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

export function sendHerbalistAway() {
  const hb = state.herbalist;
  if (!hb?.active) return { ok: false, reason: 'No herbalist present.' };
  hb.active        = null; hb.nextSpawnTick = _nextSpawnTick();
  emit(Events.HERBALIST_CHANGED, { dismissed: true });
  addMessage('🌿 The herbalist continues their journey.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }