/**
 * EmpireOS — Wandering Leatherworker (T317).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a skilled leatherworker
 * arrives at the imperial court, offering expertly crafted saddlery and leather goods.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🐎 Commission Imperial Saddles — pay 25 food + 15 gold
 *        → +0.20 food/s for 2.5 min · +18 prestige · +10 morale
 *   🛒 Trade for Leather Goods     — pay 20 food
 *        → +0.15 gold/s for 2 min  · +12 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.wanderingLeatherworker = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalSaddles:       number,
 *   totalLeather:       number,
 *   totalDismissals:    number,
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

export const SADDLES_FOOD_COST            = 25;
export const SADDLES_GOLD_COST            = 15;
export const SADDLES_FOOD_RATE            = 0.20;
export const SADDLES_PRESTIGE_REWARD      = 18;
export const SADDLES_MORALE_REWARD        = 10;
export const SADDLES_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const LEATHER_FOOD_COST            = 20;
export const LEATHER_GOLD_RATE            = 0.15;
export const LEATHER_PRESTIGE_REWARD      = 12;
export const LEATHER_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingLeatherworker() {
  if (!state.wanderingLeatherworker) {
    state.wanderingLeatherworker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalSaddles:     0,
      totalLeather:     0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingLeatherworker;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalSaddles    === undefined) s.totalSaddles    = 0;
  if (s.totalLeather    === undefined) s.totalLeather    = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingLeatherworkerTick() {
  const a = state.wanderingLeatherworker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_LEATHERWORKER_CHANGED, { expired: true });
      addMessage('🐎 The wandering leatherworker rolls up their sample cases, packs away the bridles and saddlebags, and heads further down the trade road to find their next commission.', 'info');
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
  emit(Events.WANDERING_LEATHERWORKER_CHANGED, { spawned: true });
  addMessage('🐎 A wandering leatherworker arrives at the imperial court, their wagon laden with supple hides, ornate saddles, and finely crafted leather goods. They offer their skills and wares to the imperial household. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingLeatherworker() { return state.wanderingLeatherworker?.active ?? null; }
export function getWanderingLeatherworkerSecsLeft() {
  const a = state.wanderingLeatherworker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialSaddles() {
  const a = state.wanderingLeatherworker;
  if (!a?.active) return { ok: false, reason: 'No leatherworker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The leatherworker has departed.' };
  if ((state.resources.food ?? 0) < SADDLES_FOOD_COST) return { ok: false, reason: `Need ${SADDLES_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < SADDLES_GOLD_COST) return { ok: false, reason: `Need ${SADDLES_GOLD_COST} gold.` };
  state.resources.food -= SADDLES_FOOD_COST;
  state.resources.gold -= SADDLES_GOLD_COST;
  changeMorale(SADDLES_MORALE_REWARD);
  awardPrestige(SADDLES_PRESTIGE_REWARD, 'Commissioned imperial saddles from the wandering leatherworker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'leatherworkerSaddles');
    state.randomEvents.activeModifiers.push({
      id: 'leatherworkerSaddles', resource: 'food',
      rateMult: 1 + (SADDLES_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + SADDLES_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalSaddles = (a.totalSaddles ?? 0) + 1;
  emit(Events.WANDERING_LEATHERWORKER_CHANGED, { saddles: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🐎 The leatherworker sets up a workshop and crafts a magnificent set of imperial saddles for the cavalry corps. The superior equipment improves rider efficiency and morale across the stables! −${SADDLES_FOOD_COST} food · −${SADDLES_GOLD_COST} gold · +${SADDLES_PRESTIGE_REWARD} prestige · +${SADDLES_MORALE_REWARD} morale. Food surge: +${SADDLES_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function tradeForLeatherGoods() {
  const a = state.wanderingLeatherworker;
  if (!a?.active) return { ok: false, reason: 'No leatherworker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The leatherworker has departed.' };
  if ((state.resources.food ?? 0) < LEATHER_FOOD_COST) return { ok: false, reason: `Need ${LEATHER_FOOD_COST} food.` };
  state.resources.food -= LEATHER_FOOD_COST;
  awardPrestige(LEATHER_PRESTIGE_REWARD, 'Traded for leather goods with the wandering leatherworker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'leatherworkerGoods');
    state.randomEvents.activeModifiers.push({
      id: 'leatherworkerGoods', resource: 'gold',
      rateMult: 1 + (LEATHER_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + LEATHER_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalLeather = (a.totalLeather ?? 0) + 1;
  emit(Events.WANDERING_LEATHERWORKER_CHANGED, { leather: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🛒 The leatherworker exchanges a fine collection of leather pouches, belts, and satchels perfect for trade. Imperial merchants sell the goods across all market districts! −${LEATHER_FOOD_COST} food · +${LEATHER_PRESTIGE_REWARD} prestige. Gold surge: +${LEATHER_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLeatherworkerAway() {
  const a = state.wanderingLeatherworker;
  if (!a?.active) return { ok: false, reason: 'No leatherworker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_LEATHERWORKER_CHANGED, { dismissed: true });
  addMessage('🐎 The wandering leatherworker nods respectfully, loads their wagon back up, and continues down the trade road in search of more willing patrons.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
