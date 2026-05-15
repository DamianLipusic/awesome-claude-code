/**
 * EmpireOS — Forest Warden (T282).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a forest warden
 * bearing ancient knowledge of woodland stewardship and nature lore arrives
 * at the imperial court. The player has 80 seconds to decide.
 *
 * Choices:
 *   🌲 Grant Forest Stewardship  — pay 20 food
 *        → +0.25 wood/s for 2.5 min · +15 prestige · +8 morale
 *   🍃 Exchange Woodland Lore    — pay 15 mana
 *        → +12 morale · +10 prestige · +0.1 food/s for 2 min
 *   👋 Send Away                 — dismiss (no reward)
 *
 * state.forestWarden = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalStewardship: number,
 *   totalLore:        number,
 *   totalDismissals:  number,
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

export const STEWARDSHIP_FOOD_COST       = 20;
export const STEWARDSHIP_WOOD_RATE       = 0.25;
export const STEWARDSHIP_PRESTIGE_REWARD = 15;
export const STEWARDSHIP_MORALE_REWARD   = 8;
export const STEWARDSHIP_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const LORE_MANA_COST        = 15;
export const LORE_MORALE_REWARD    = 12;
export const LORE_PRESTIGE_REWARD  = 10;
export const LORE_FOOD_RATE        = 0.1;
export const LORE_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initForestWarden() {
  if (!state.forestWarden) {
    state.forestWarden = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalStewardship: 0,
      totalLore:        0,
      totalDismissals:  0,
    };
  }
  if (state.forestWarden.nextSpawnTick    === undefined) state.forestWarden.nextSpawnTick    = _nextSpawnTick();
  if (state.forestWarden.totalVisits      === undefined) state.forestWarden.totalVisits      = 0;
  if (state.forestWarden.totalStewardship === undefined) state.forestWarden.totalStewardship = 0;
  if (state.forestWarden.totalLore        === undefined) state.forestWarden.totalLore        = 0;
  if (state.forestWarden.totalDismissals  === undefined) state.forestWarden.totalDismissals  = 0;
}

export function forestWardenTick() {
  const fw = state.forestWarden;
  if (!fw) return;
  if (fw.active) {
    if (state.tick >= fw.active.expiresAt) {
      fw.active = null; fw.nextSpawnTick = _nextSpawnTick();
      emit(Events.FOREST_WARDEN_CHANGED, { expired: true });
      addMessage('🌲 The forest warden returns to the ancient woodland, their knowledge preserved for another day.', 'info');
    }
    return;
  }
  if (state.tick < fw.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  fw.active      = { expiresAt: state.tick + WINDOW_TICKS };
  fw.totalVisits = (fw.totalVisits ?? 0) + 1;
  emit(Events.FOREST_WARDEN_CHANGED, { spawned: true });
  addMessage('🌲 A forest warden bearing ancient knowledge of woodland stewardship and the deep mysteries of nature has arrived at the imperial court, seeking to share their wisdom. Respond within 80 seconds.', 'info');
}

export function getActiveForestWarden() { return state.forestWarden?.active ?? null; }
export function getForestWardenSecsLeft() {
  const a = state.forestWarden?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function grantForestStewardship() {
  const fw = state.forestWarden;
  if (!fw?.active) return { ok: false, reason: 'No forest warden present.' };
  if (state.tick >= fw.active.expiresAt) return { ok: false, reason: 'The forest warden has departed.' };
  if ((state.resources.food ?? 0) < STEWARDSHIP_FOOD_COST) return { ok: false, reason: `Need ${STEWARDSHIP_FOOD_COST} food.` };
  state.resources.food -= STEWARDSHIP_FOOD_COST;
  changeMorale(STEWARDSHIP_MORALE_REWARD);
  awardPrestige(STEWARDSHIP_PRESTIGE_REWARD, 'Granted forest stewardship to a wandering forest warden');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'forestWardenStewardship');
    state.randomEvents.activeModifiers.push({
      id: 'forestWardenStewardship', resource: 'wood',
      rateMult: 1 + (STEWARDSHIP_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + STEWARDSHIP_DURATION_TICKS,
    });
  }
  fw.active = null; fw.nextSpawnTick = _nextSpawnTick(); fw.totalStewardship = (fw.totalStewardship ?? 0) + 1;
  emit(Events.FOREST_WARDEN_CHANGED, { stewardship: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌲 The forest warden's expertise transforms imperial logging into a sustainable bounty! −${STEWARDSHIP_FOOD_COST} food · +${STEWARDSHIP_PRESTIGE_REWARD} prestige · +${STEWARDSHIP_MORALE_REWARD} morale. Woodland abundance: +${STEWARDSHIP_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeWoodlandLore() {
  const fw = state.forestWarden;
  if (!fw?.active) return { ok: false, reason: 'No forest warden present.' };
  if (state.tick >= fw.active.expiresAt) return { ok: false, reason: 'The forest warden has departed.' };
  if ((state.resources.mana ?? 0) < LORE_MANA_COST) return { ok: false, reason: `Need ${LORE_MANA_COST} mana.` };
  state.resources.mana -= LORE_MANA_COST;
  changeMorale(LORE_MORALE_REWARD);
  awardPrestige(LORE_PRESTIGE_REWARD, 'Exchanged woodland lore with a forest warden');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'forestWardenLore');
    state.randomEvents.activeModifiers.push({
      id: 'forestWardenLore', resource: 'food',
      rateMult: 1 + (LORE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + LORE_DURATION_TICKS,
    });
  }
  fw.active = null; fw.nextSpawnTick = _nextSpawnTick(); fw.totalLore = (fw.totalLore ?? 0) + 1;
  emit(Events.FOREST_WARDEN_CHANGED, { lore: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍃 Ancient woodland lore inspires farmers and foragers to new levels of productivity! −${LORE_MANA_COST} mana · +${LORE_PRESTIGE_REWARD} prestige · +${LORE_MORALE_REWARD} morale. Nature's bounty: +${LORE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendForestWardenAway() {
  const fw = state.forestWarden;
  if (!fw?.active) return { ok: false, reason: 'No forest warden present.' };
  fw.active = null; fw.nextSpawnTick = _nextSpawnTick(); fw.totalDismissals = (fw.totalDismissals ?? 0) + 1;
  emit(Events.FOREST_WARDEN_CHANGED, { dismissed: true });
  addMessage('🌲 The forest warden is respectfully thanked and returns to the ancient woodland groves.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
