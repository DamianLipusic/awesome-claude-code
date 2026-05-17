/**
 * EmpireOS — Wandering Sculptor (T301).
 *
 * Every 11–16 minutes (Stone Age+, 6+ player tiles), a master sculptor
 * arrives seeking a patron for his monumental works. The player has 80
 * seconds to decide.
 *
 * Choices:
 *   🗿 Commission Grand Sculpture  — pay 30 stone
 *        → +0.15 gold/s for 2 min · +22 prestige · +8 morale
 *   🎨 Learn Stone-Carving Secrets — pay 20 gold
 *        → +0.18 stone/s for 2 min · +12 prestige
 *   🚶 Send Sculptor Away          — dismiss (no reward)
 *
 * state.wanderingSculptor = {
 *   active:               { expiresAt: tick } | null,
 *   nextSpawnTick:        tick,
 *   totalVisits:          number,
 *   totalCommissions:     number,
 *   totalLessons:         number,
 *   totalDismissals:      number,
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
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_STONE_COST       = 30;
export const COMMISSION_GOLD_RATE        = 0.15;
export const COMMISSION_PRESTIGE_REWARD  = 22;
export const COMMISSION_MORALE_REWARD    = 8;
export const COMMISSION_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export const LESSON_GOLD_COST            = 20;
export const LESSON_STONE_RATE           = 0.18;
export const LESSON_PRESTIGE_REWARD      = 12;
export const LESSON_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingSculptor() {
  if (!state.wanderingSculptor) {
    state.wanderingSculptor = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalLessons:     0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingSculptor;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalLessons     === undefined) s.totalLessons     = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingSculptorTick() {
  const a = state.wanderingSculptor;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SCULPTOR_CHANGED, { expired: true });
      addMessage('🗿 The wandering sculptor gathers his chisels and mallets, rolls up his stone-dust cloak, and sets off down the road in search of a more appreciative patron.', 'info');
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
  emit(Events.WANDERING_SCULPTOR_CHANGED, { spawned: true });
  addMessage('🗿 A wandering master sculptor arrives at the imperial gates, his cart laden with chisels, mallets, and sketches of breathtaking monuments he wishes to carve for a worthy patron. Respond within 80 seconds.', 'info');
}

export function getActiveSculptor() { return state.wanderingSculptor?.active ?? null; }
export function getSculptorSecsLeft() {
  const a = state.wanderingSculptor?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGrandSculpture() {
  const a = state.wanderingSculptor;
  if (!a?.active) return { ok: false, reason: 'No sculptor present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The sculptor has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned grand imperial sculpture');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sculptorCommission');
    state.randomEvents.activeModifiers.push({
      id: 'sculptorCommission', resource: 'gold',
      rateMult: 1 + (COMMISSION_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_SCULPTOR_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗿 The master sculptor sets to work on a magnificent monument in the imperial plaza. Merchants and nobles flock to admire the work, driving commerce and prestige to new heights! −${COMMISSION_STONE_COST} stone · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Commerce surge: +${COMMISSION_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function learnStoneCarvingSecrets() {
  const a = state.wanderingSculptor;
  if (!a?.active) return { ok: false, reason: 'No sculptor present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The sculptor has departed.' };
  if ((state.resources.gold ?? 0) < LESSON_GOLD_COST) return { ok: false, reason: `Need ${LESSON_GOLD_COST} gold.` };
  state.resources.gold -= LESSON_GOLD_COST;
  awardPrestige(LESSON_PRESTIGE_REWARD, 'Learned stone-carving secrets from the wandering sculptor');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sculptorLesson');
    state.randomEvents.activeModifiers.push({
      id: 'sculptorLesson', resource: 'stone',
      rateMult: 1 + (LESSON_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + LESSON_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalLessons = (a.totalLessons ?? 0) + 1;
  emit(Events.WANDERING_SCULPTOR_CHANGED, { lesson: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The sculptor shares ancient stone-carving techniques that transform imperial quarrying operations. Workers extract stone with unprecedented precision and speed! −${LESSON_GOLD_COST} gold · +${LESSON_PRESTIGE_REWARD} prestige. Quarry surge: +${LESSON_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSculptorAway() {
  const a = state.wanderingSculptor;
  if (!a?.active) return { ok: false, reason: 'No sculptor present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SCULPTOR_CHANGED, { dismissed: true });
  addMessage('🗿 The wandering sculptor packs his tools with a disappointed sigh and trudges away from the imperial gates, his uncarved masterpieces still locked within untouched stone.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
