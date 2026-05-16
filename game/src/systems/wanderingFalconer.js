/**
 * EmpireOS — Wandering Falconer (T297).
 *
 * Every 15–20 minutes (Medieval Age+, 12+ player tiles), a master falconer
 * arrives at court with trained hunting birds and the ancient art of falconry
 * inherited from desert nomads and mountain kingdoms. The player has
 * 80 seconds to decide.
 *
 * Choices:
 *   🦅 Host Royal Hunt       — pay 25 gold
 *        → +0.18 gold/s for 2.5 min · +20 prestige · +15 morale
 *   🪶 Learn Falconry Arts   — pay 20 food
 *        → +0.15 food/s for 2 min · +12 prestige
 *   👋 Send Away             — dismiss (no reward)
 *
 * state.wanderingFalconer = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalHunts:          number,
 *   totalFalconry:       number,
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
const MIN_PLAYER_TILES = 12;

export const HUNT_GOLD_COST         = 25;
export const HUNT_GOLD_RATE         = 0.18;
export const HUNT_PRESTIGE_REWARD   = 20;
export const HUNT_MORALE_REWARD     = 15;
export const HUNT_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const FALCONRY_FOOD_COST     = 20;
export const FALCONRY_FOOD_RATE     = 0.15;
export const FALCONRY_PRESTIGE      = 12;
export const FALCONRY_DURATION_TICKS = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingFalconer() {
  if (!state.wanderingFalconer) {
    state.wanderingFalconer = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalHunts:      0,
      totalFalconry:   0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingFalconer;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalHunts      === undefined) s.totalHunts      = 0;
  if (s.totalFalconry   === undefined) s.totalFalconry   = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingFalconerTick() {
  const a = state.wanderingFalconer;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_FALCONER_CHANGED, { expired: true });
      addMessage('🦅 The wandering falconer withdraws their hooded birds onto their perches, bows to the court, and rides off to seek another patron worthy of the ancient art of falconry.', 'info');
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
  emit(Events.WANDERING_FALCONER_CHANGED, { spawned: true });
  addMessage('🦅 A masterful wandering falconer arrives at court, their trained gyrfalcons and golden eagles perched on gloved arms, carrying the ancient hunting traditions of desert nomads and mountain kingdoms. Respond within 80 seconds.', 'info');
}

export function getActiveFalconer() { return state.wanderingFalconer?.active ?? null; }
export function getFalconerSecsLeft() {
  const a = state.wanderingFalconer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function hostRoyalHunt() {
  const a = state.wanderingFalconer;
  if (!a?.active) return { ok: false, reason: 'No falconer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The falconer has departed.' };
  if ((state.resources.gold ?? 0) < HUNT_GOLD_COST) return { ok: false, reason: `Need ${HUNT_GOLD_COST} gold.` };
  state.resources.gold -= HUNT_GOLD_COST;
  changeMorale(HUNT_MORALE_REWARD);
  awardPrestige(HUNT_PRESTIGE_REWARD, 'Hosted a royal falconry hunt');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'falconerHunt');
    state.randomEvents.activeModifiers.push({
      id: 'falconerHunt', resource: 'gold',
      rateMult: 1 + (HUNT_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + HUNT_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalHunts = (a.totalHunts ?? 0) + 1;
  emit(Events.WANDERING_FALCONER_CHANGED, { hunt: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🦅 The royal falconry hunt proves a spectacular success! Noble lords and dignitaries pour gold into the imperial treasury to participate in the prestigious event, and word of your magnificent court spreads across the realm! −${HUNT_GOLD_COST} gold · +${HUNT_PRESTIGE_REWARD} prestige · +${HUNT_MORALE_REWARD} morale. Treasury surge: +${HUNT_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function learnFalconryArts() {
  const a = state.wanderingFalconer;
  if (!a?.active) return { ok: false, reason: 'No falconer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The falconer has departed.' };
  if ((state.resources.food ?? 0) < FALCONRY_FOOD_COST) return { ok: false, reason: `Need ${FALCONRY_FOOD_COST} food.` };
  state.resources.food -= FALCONRY_FOOD_COST;
  awardPrestige(FALCONRY_PRESTIGE, 'Learned falconry arts from a wandering falconer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'falconerArts');
    state.randomEvents.activeModifiers.push({
      id: 'falconerArts', resource: 'food',
      rateMult: 1 + (FALCONRY_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + FALCONRY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalFalconry = (a.totalFalconry ?? 0) + 1;
  emit(Events.WANDERING_FALCONER_CHANGED, { falconry: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪶 The ancient falconry techniques prove transformative for the empire's huntsmen and game wardens, dramatically improving bird-assisted hunting yields and crop protection across imperial farmlands! −${FALCONRY_FOOD_COST} food · +${FALCONRY_PRESTIGE} prestige. Harvest surge: +${FALCONRY_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFalconerAway() {
  const a = state.wanderingFalconer;
  if (!a?.active) return { ok: false, reason: 'No falconer present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_FALCONER_CHANGED, { dismissed: true });
  addMessage('🦅 The wandering falconer accepts the dismissal with dignified grace, hoods their prized birds, and rides onward toward distant courts where the ancient art may find a more willing patron.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
