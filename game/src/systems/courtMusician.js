/**
 * EmpireOS — Court Musician (T307).
 *
 * Every 11–16 minutes (Bronze Age+, 6+ player tiles), a court musician
 * arrives with skilled performers seeking imperial patronage. The player
 * has 80 seconds to decide.
 *
 * Choices:
 *   🎵 Commission Grand Symphony — pay 20 gold
 *        → +0.18 gold/s for 2.5 min · +18 prestige · +12 morale
 *   🎶 Request Folk Performance  — free
 *        → +8 morale · +6 prestige
 *   🚶 Send Away                 — dismiss (no reward)
 *
 * state.courtMusician = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_GOLD_RATE          = 0.18;
export const COMMISSION_PRESTIGE_REWARD    = 18;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PERFORMANCE_MORALE_REWARD     = 8;
export const PERFORMANCE_PRESTIGE_REWARD   = 6;

export function initCourtMusician() {
  if (!state.courtMusician) {
    state.courtMusician = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPerformances: 0,
      totalDismissals:  0,
    };
  }
  const s = state.courtMusician;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPerformances  === undefined) s.totalPerformances  = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function courtMusicianTick() {
  const a = state.courtMusician;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.COURT_MUSICIAN_CHANGED, { expired: true });
      addMessage('🎵 The court musician bows graciously, packs their instruments into embroidered cases, and departs in search of another imperial audience.', 'info');
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
  emit(Events.COURT_MUSICIAN_CHANGED, { spawned: true });
  addMessage('🎵 A renowned court musician arrives at the imperial palace, bearing a lute inlaid with silver and a reputation for composing symphonies that have moved emperors to tears. They seek your patronage. Respond within 80 seconds.', 'info');
}

export function getActiveCourtMusician() { return state.courtMusician?.active ?? null; }
export function getCourtMusicianSecsLeft() {
  const a = state.courtMusician?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGrandSymphony() {
  const a = state.courtMusician;
  if (!a?.active) return { ok: false, reason: 'No court musician present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The musician has departed.' };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned a grand symphony from the court musician');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'musicianSymphony');
    state.randomEvents.activeModifiers.push({
      id: 'musicianSymphony', resource: 'gold',
      rateMult: 1 + (COMMISSION_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.COURT_MUSICIAN_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎵 The court musician begins composing an imperial grand symphony dedicated to the glory of the empire! The sweeping melodies inspire merchants, artisans, and traders to work with renewed vigour, boosting commerce across all provinces! −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Commerce surge: +${COMMISSION_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function requestFolkPerformance() {
  const a = state.courtMusician;
  if (!a?.active) return { ok: false, reason: 'No court musician present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The musician has departed.' };
  changeMorale(PERFORMANCE_MORALE_REWARD);
  awardPrestige(PERFORMANCE_PRESTIGE_REWARD, 'Enjoyed a folk performance by the court musician');
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPerformances = (a.totalPerformances ?? 0) + 1;
  emit(Events.COURT_MUSICIAN_CHANGED, { performance: true });
  addMessage(`🎶 The court musician performs beloved folk songs and traditional ballads in the imperial courtyard. Citizens gather to listen and are reminded of their shared cultural heritage, lifting spirits throughout the empire. +${PERFORMANCE_MORALE_REWARD} morale · +${PERFORMANCE_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

export function sendCourtMusicianAway() {
  const a = state.courtMusician;
  if (!a?.active) return { ok: false, reason: 'No court musician present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.COURT_MUSICIAN_CHANGED, { dismissed: true });
  addMessage('🎵 The court musician bows politely, tucks their instrument beneath one arm, and departs to seek patronage elsewhere along the imperial road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
