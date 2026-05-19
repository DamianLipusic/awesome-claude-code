/**
 * EmpireOS — Wandering Puppeteer (T325).
 *
 * Every 12–16 minutes (Bronze Age+, 6+ player tiles), a skilled wandering
 * puppeteer arrives at court with elaborate marionettes and shadow-play
 * apparatus, eager to entertain the empire. The player has 80 seconds to decide.
 *
 * Choices:
 *   🎭 Commission Imperial Pageant  — pay 25 gold
 *        → +0.2 gold/s for 2.5 min · +22 prestige · +15 morale
 *   🎪 Host Village Performance     — free
 *        → +12 morale · +8 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingPuppeteer = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalPageants:       number,
 *   totalPerformances:   number,
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 6;

export const PAGEANT_GOLD_COST            = 25;
export const PAGEANT_GOLD_RATE            = 0.2;
export const PAGEANT_PRESTIGE_REWARD      = 22;
export const PAGEANT_MORALE_REWARD        = 15;
export const PAGEANT_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PERFORMANCE_MORALE_REWARD    = 12;
export const PERFORMANCE_PRESTIGE_REWARD  = 8;

export function initWanderingPuppeteer() {
  if (!state.wanderingPuppeteer) {
    state.wanderingPuppeteer = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalPageants:     0,
      totalPerformances: 0,
      totalDismissals:   0,
    };
  }
  const s = state.wanderingPuppeteer;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalPageants     === undefined) s.totalPageants     = 0;
  if (s.totalPerformances === undefined) s.totalPerformances = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingPuppeteerTick() {
  const a = state.wanderingPuppeteer;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_PUPPETEER_CHANGED, { expired: true });
      addMessage('🎭 The wandering puppeteer packs their marionettes carefully into traveling cases and moves on to the next kingdom without performing.', 'info');
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
  emit(Events.WANDERING_PUPPETEER_CHANGED, { spawned: true });
  addMessage('🎭 A wandering puppeteer arrives at court with an elaborate collection of marionettes and shadow-play apparatus, offering breathtaking performances for the empire\'s entertainment. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingPuppeteer() { return state.wanderingPuppeteer?.active ?? null; }
export function getWanderingPuppeteerSecsLeft() {
  const a = state.wanderingPuppeteer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialPageant() {
  const a = state.wanderingPuppeteer;
  if (!a?.active) return { ok: false, reason: 'No puppeteer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The puppeteer has departed.' };
  if ((state.resources.gold ?? 0) < PAGEANT_GOLD_COST) return { ok: false, reason: `Need ${PAGEANT_GOLD_COST} gold.` };
  state.resources.gold -= PAGEANT_GOLD_COST;
  changeMorale(PAGEANT_MORALE_REWARD);
  awardPrestige(PAGEANT_PRESTIGE_REWARD, 'Commissioned a grand imperial pageant with the wandering puppeteer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'puppeteerPageant');
    state.randomEvents.activeModifiers.push({
      id: 'puppeteerPageant', resource: 'gold',
      rateMult: 1 + (PAGEANT_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PAGEANT_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPageants = (a.totalPageants ?? 0) + 1;
  emit(Events.WANDERING_PUPPETEER_CHANGED, { pageant: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎭 The puppeteer stages a breathtaking imperial pageant — elaborate marionettes re-enact the empire\'s greatest victories before cheering crowds. Merchants flock to the celebrations and trade flourishes! −${PAGEANT_GOLD_COST} gold · +${PAGEANT_PRESTIGE_REWARD} prestige · +${PAGEANT_MORALE_REWARD} morale. Gold surge: +${PAGEANT_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function hostVillagePerformance() {
  const a = state.wanderingPuppeteer;
  if (!a?.active) return { ok: false, reason: 'No puppeteer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The puppeteer has departed.' };
  changeMorale(PERFORMANCE_MORALE_REWARD);
  awardPrestige(PERFORMANCE_PRESTIGE_REWARD, 'Hosted a village puppet performance');
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPerformances = (a.totalPerformances ?? 0) + 1;
  emit(Events.WANDERING_PUPPETEER_CHANGED, { performance: true });
  addMessage(`🎪 The puppeteer performs delightful shadow-plays and marionette shows in the village square. Children and elders alike laugh and clap with joy as the colorful characters dance. +${PERFORMANCE_PRESTIGE_REWARD} prestige · +${PERFORMANCE_MORALE_REWARD} morale.`, 'windfall');
  return { ok: true };
}

export function sendPuppeteerAway() {
  const a = state.wanderingPuppeteer;
  if (!a?.active) return { ok: false, reason: 'No puppeteer present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_PUPPETEER_CHANGED, { dismissed: true });
  addMessage('🎭 The wandering puppeteer bows graciously, carefully packs their marionettes, and sets off toward the next kingdom.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
