/**
 * EmpireOS — Wandering Dyer (T289).
 *
 * Every 11–15 minutes (Bronze Age+, 8+ player tiles), a master dyer arrives
 * with vibrant pigments and rare mordants, offering to transform the empire's
 * textiles into resplendent banners and livery. The player has 80 seconds.
 *
 * Choices:
 *   🎨 Dye Imperial Banners — pay 25 wood + 15 food
 *        → +0.22 wood/s for 2.5 min · +18 prestige · +8 morale
 *   🌿 Learn Natural Dyes   — pay 18 gold
 *        → +0.15 food/s for 2 min · +12 prestige
 *   👋 Send Away             — dismiss (no reward)
 *
 * state.wanderingDyer = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalDyed:        number,
 *   totalLearned:     number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const DYE_WOOD_COST          = 25;
export const DYE_FOOD_COST          = 15;
export const DYE_WOOD_RATE          = 0.22;
export const DYE_PRESTIGE_REWARD    = 18;
export const DYE_MORALE_REWARD      = 8;
export const DYE_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const LEARN_GOLD_COST        = 18;
export const LEARN_FOOD_RATE        = 0.15;
export const LEARN_PRESTIGE_REWARD  = 12;
export const LEARN_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingDyer() {
  if (!state.wanderingDyer) {
    state.wanderingDyer = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalDyed:       0,
      totalLearned:    0,
      totalDismissals: 0,
    };
  }
  if (state.wanderingDyer.nextSpawnTick   === undefined) state.wanderingDyer.nextSpawnTick   = _nextSpawnTick();
  if (state.wanderingDyer.totalVisits     === undefined) state.wanderingDyer.totalVisits     = 0;
  if (state.wanderingDyer.totalDyed       === undefined) state.wanderingDyer.totalDyed       = 0;
  if (state.wanderingDyer.totalLearned    === undefined) state.wanderingDyer.totalLearned    = 0;
  if (state.wanderingDyer.totalDismissals === undefined) state.wanderingDyer.totalDismissals = 0;
}

export function wanderingDyerTick() {
  const wd = state.wanderingDyer;
  if (!wd) return;
  if (wd.active) {
    if (state.tick >= wd.active.expiresAt) {
      wd.active = null; wd.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_DYER_CHANGED, { expired: true });
      addMessage('🎨 The wandering dyer packs their vats and pigments, moving on to the next settlement.', 'info');
    }
    return;
  }
  if (state.tick < wd.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  wd.active      = { expiresAt: state.tick + WINDOW_TICKS };
  wd.totalVisits = (wd.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_DYER_CHANGED, { spawned: true });
  addMessage('🎨 A wandering master dyer arrives at the imperial gates, their cart brimming with vibrant pigments, rare mordants, and bolts of brilliantly colored cloth, offering to transform the empire\'s textiles into resplendent banners. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingDyer() { return state.wanderingDyer?.active ?? null; }
export function getDyerSecsLeft() {
  const a = state.wanderingDyer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function dyeImperialBanners() {
  const wd = state.wanderingDyer;
  if (!wd?.active) return { ok: false, reason: 'No dyer present.' };
  if (state.tick >= wd.active.expiresAt) return { ok: false, reason: 'The dyer has departed.' };
  if ((state.resources.wood ?? 0) < DYE_WOOD_COST) return { ok: false, reason: `Need ${DYE_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < DYE_FOOD_COST) return { ok: false, reason: `Need ${DYE_FOOD_COST} food.` };
  state.resources.wood -= DYE_WOOD_COST;
  state.resources.food -= DYE_FOOD_COST;
  changeMorale(DYE_MORALE_REWARD);
  awardPrestige(DYE_PRESTIGE_REWARD, 'Commissioned imperial banners from a wandering master dyer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dyerBanners');
    state.randomEvents.activeModifiers.push({
      id: 'dyerBanners', resource: 'wood',
      rateMult: 1 + (DYE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + DYE_DURATION_TICKS,
    });
  }
  wd.active = null; wd.nextSpawnTick = _nextSpawnTick(); wd.totalDyed = (wd.totalDyed ?? 0) + 1;
  emit(Events.WANDERING_DYER_CHANGED, { dyed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 Resplendent imperial banners in brilliant crimson and gold inspire lumberjacks to work with renewed purpose! −${DYE_WOOD_COST} wood · −${DYE_FOOD_COST} food · +${DYE_PRESTIGE_REWARD} prestige · +${DYE_MORALE_REWARD} morale. Timber harvest: +${DYE_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function learnNaturalDyes() {
  const wd = state.wanderingDyer;
  if (!wd?.active) return { ok: false, reason: 'No dyer present.' };
  if (state.tick >= wd.active.expiresAt) return { ok: false, reason: 'The dyer has departed.' };
  if ((state.resources.gold ?? 0) < LEARN_GOLD_COST) return { ok: false, reason: `Need ${LEARN_GOLD_COST} gold.` };
  state.resources.gold -= LEARN_GOLD_COST;
  awardPrestige(LEARN_PRESTIGE_REWARD, 'Learned natural dyeing techniques from a wandering artisan');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dyerLearn');
    state.randomEvents.activeModifiers.push({
      id: 'dyerLearn', resource: 'food',
      rateMult: 1 + (LEARN_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + LEARN_DURATION_TICKS,
    });
  }
  wd.active = null; wd.nextSpawnTick = _nextSpawnTick(); wd.totalLearned = (wd.totalLearned ?? 0) + 1;
  emit(Events.WANDERING_DYER_CHANGED, { learned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 Ancient plant-based dye secrets inspire farmers to identify more productive crop varieties! −${LEARN_GOLD_COST} gold · +${LEARN_PRESTIGE_REWARD} prestige. Harvest wisdom: +${LEARN_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendDyerAway() {
  const wd = state.wanderingDyer;
  if (!wd?.active) return { ok: false, reason: 'No dyer present.' };
  wd.active = null; wd.nextSpawnTick = _nextSpawnTick(); wd.totalDismissals = (wd.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_DYER_CHANGED, { dismissed: true });
  addMessage('🎨 The wandering dyer is thanked and rolls their colorful cart onward to the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
