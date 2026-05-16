/**
 * EmpireOS — Wandering Weaver (T295).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a master weaver arrives
 * with bolts of rare fabric, golden thread, and the secrets of imperial
 * textile artistry. The player has 80 seconds to decide.
 *
 * Choices:
 *   🧵 Commission Royal Tapestries — pay 25 wood + 15 food
 *        → +0.22 wood/s for 2.5 min · +20 prestige · +8 morale
 *   🪡 Learn Weaving Patterns       — pay 18 gold
 *        → +0.15 food/s for 2 min · +12 prestige
 *   👋 Send Away                    — dismiss (no reward)
 *
 * state.wanderingWeaver = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalTapestries:     number,
 *   totalPatterns:       number,
 *   totalDismissals:     number,
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

export const TAPESTRY_WOOD_COST        = 25;
export const TAPESTRY_FOOD_COST        = 15;
export const TAPESTRY_WOOD_RATE        = 0.22;
export const TAPESTRY_PRESTIGE_REWARD  = 20;
export const TAPESTRY_MORALE_REWARD    = 8;
export const TAPESTRY_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PATTERNS_GOLD_COST        = 18;
export const PATTERNS_FOOD_RATE        = 0.15;
export const PATTERNS_PRESTIGE_REWARD  = 12;
export const PATTERNS_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingWeaver() {
  if (!state.wanderingWeaver) {
    state.wanderingWeaver = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalTapestries: 0,
      totalPatterns:   0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingWeaver;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalTapestries === undefined) s.totalTapestries = 0;
  if (s.totalPatterns   === undefined) s.totalPatterns   = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingWeaverTick() {
  const w = state.wanderingWeaver;
  if (!w) return;
  if (w.active) {
    if (state.tick >= w.active.expiresAt) {
      w.active = null; w.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_WEAVER_CHANGED, { expired: true });
      addMessage('🧵 The wandering weaver gathers their looms and bolts of exquisite fabric, loading them onto a cart with practiced efficiency before departing for distant markets.', 'info');
    }
    return;
  }
  if (state.tick < w.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  w.active      = { expiresAt: state.tick + WINDOW_TICKS };
  w.totalVisits = (w.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_WEAVER_CHANGED, { spawned: true });
  addMessage('🧵 A wandering weaver arrives at the imperial gates, their cart laden with rare silks, golden thread, and intricate loom patterns passed down through generations of master craftspeople. Respond within 80 seconds.', 'info');
}

export function getActiveWeaver() { return state.wanderingWeaver?.active ?? null; }
export function getWeaverSecsLeft() {
  const a = state.wanderingWeaver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalTapestries() {
  const w = state.wanderingWeaver;
  if (!w?.active) return { ok: false, reason: 'No weaver present.' };
  if (state.tick >= w.active.expiresAt) return { ok: false, reason: 'The weaver has departed.' };
  if ((state.resources.wood ?? 0) < TAPESTRY_WOOD_COST) return { ok: false, reason: `Need ${TAPESTRY_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < TAPESTRY_FOOD_COST) return { ok: false, reason: `Need ${TAPESTRY_FOOD_COST} food.` };
  state.resources.wood -= TAPESTRY_WOOD_COST;
  state.resources.food -= TAPESTRY_FOOD_COST;
  changeMorale(TAPESTRY_MORALE_REWARD);
  awardPrestige(TAPESTRY_PRESTIGE_REWARD, 'Commissioned royal tapestries from a wandering weaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'weaverTapestry');
    state.randomEvents.activeModifiers.push({
      id: 'weaverTapestry', resource: 'wood',
      rateMult: 1 + (TAPESTRY_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + TAPESTRY_DURATION_TICKS,
    });
  }
  w.active = null; w.nextSpawnTick = _nextSpawnTick(); w.totalTapestries = (w.totalTapestries ?? 0) + 1;
  emit(Events.WANDERING_WEAVER_CHANGED, { tapestry: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧵 The weaver's masterful hands transform raw materials into breathtaking imperial tapestries depicting legendary conquests and celestial glories, inspiring the entire court with renewed vigor! −${TAPESTRY_WOOD_COST} wood · −${TAPESTRY_FOOD_COST} food · +${TAPESTRY_PRESTIGE_REWARD} prestige · +${TAPESTRY_MORALE_REWARD} morale. Craft surge: +${TAPESTRY_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function learnWeavingPatterns() {
  const w = state.wanderingWeaver;
  if (!w?.active) return { ok: false, reason: 'No weaver present.' };
  if (state.tick >= w.active.expiresAt) return { ok: false, reason: 'The weaver has departed.' };
  if ((state.resources.gold ?? 0) < PATTERNS_GOLD_COST) return { ok: false, reason: `Need ${PATTERNS_GOLD_COST} gold.` };
  state.resources.gold -= PATTERNS_GOLD_COST;
  awardPrestige(PATTERNS_PRESTIGE_REWARD, 'Learned weaving patterns from a wandering weaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'weaverPatterns');
    state.randomEvents.activeModifiers.push({
      id: 'weaverPatterns', resource: 'food',
      rateMult: 1 + (PATTERNS_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PATTERNS_DURATION_TICKS,
    });
  }
  w.active = null; w.nextSpawnTick = _nextSpawnTick(); w.totalPatterns = (w.totalPatterns ?? 0) + 1;
  emit(Events.WANDERING_WEAVER_CHANGED, { patterns: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪡 The weaver's ancient patterns and loom techniques spread through the imperial workshops, boosting the productivity of farmers and craftspeople across the realm! −${PATTERNS_GOLD_COST} gold · +${PATTERNS_PRESTIGE_REWARD} prestige. Prosperity surge: +${PATTERNS_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendWeaverAway() {
  const w = state.wanderingWeaver;
  if (!w?.active) return { ok: false, reason: 'No weaver present.' };
  w.active = null; w.nextSpawnTick = _nextSpawnTick(); w.totalDismissals = (w.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_WEAVER_CHANGED, { dismissed: true });
  addMessage('🧵 The wandering weaver bows gracefully, wraps their finest silks, and departs down the imperial road toward their next commission in distant lands.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
