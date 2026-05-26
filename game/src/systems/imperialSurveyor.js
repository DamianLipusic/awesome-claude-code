/**
 * EmpireOS — Imperial Surveyor (T408).
 *
 * Every 14–18 minutes (Iron Age+, 12+ player tiles), an imperial surveyor
 * arrives at the palace bearing long brass theodolites, wooden measuring rods,
 * and rolled parchment survey maps — offering to conduct a comprehensive land
 * survey across the empire's territories to identify new quarry sites and road
 * alignments that maximise stone extraction, or to sell a detailed set of
 * engineering drawings explaining the advanced use of iron survey instruments
 * and load-bearing frame calculations used in imperial construction projects.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📏 Commission Land Survey          — pay 30 stone + 20 gold
 *        → +0.25 stone/s for 2.5 min · +25 prestige · +12 morale
 *   ⚙️ Study Survey Methods             — pay 25 iron
 *        → +0.20 iron/s for 2 min · +18 prestige
 *   🚶 Send Away                         — dismiss (no reward)
 *
 * state.imperialSurveyor = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalStudies:       number,
 *   totalDismissals:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_STONE_COST         = 30;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_STONE_RATE         = 0.25;
export const COMMISSION_PRESTIGE_REWARD    = 25;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const STUDY_IRON_COST               = 25;
export const STUDY_IRON_RATE               = 0.20;
export const STUDY_PRESTIGE_REWARD         = 18;
export const STUDY_DURATION_TICKS          = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSurveyor() {
  if (!state.imperialSurveyor) {
    state.imperialSurveyor = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudies:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialSurveyor;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalStudies      === undefined) s.totalStudies      = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialSurveyorTick() {
  const a = state.imperialSurveyor;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SURVEYOR_CHANGED, { expired: true });
      addMessage('📏 The imperial surveyor packs the brass theodolites and measuring rods into padded wooden cases and departs the palace courtyard — the survey commission for the comprehensive land assessment passing unrealised as the instrument cart rolls back through the gate.', 'info');
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
  emit(Events.IMPERIAL_SURVEYOR_CHANGED, { spawned: true });
  addMessage('📏 An imperial surveyor arrives at the palace bearing long brass theodolites, wooden measuring rods, and rolled parchment survey maps — offering to conduct a comprehensive land survey across the empire\'s territories to identify new quarry sites and road alignments that maximise stone extraction, or to sell a detailed set of engineering drawings explaining advanced iron survey instruments and load-bearing frame calculations. Respond within 80 seconds.', 'info');
}

export function getActiveImperialSurveyor() { return state.imperialSurveyor?.active ?? null; }
export function getSurveyorSecsLeft() {
  const a = state.imperialSurveyor?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionLandSurvey() {
  const a = state.imperialSurveyor;
  if (!a?.active) return { ok: false, reason: 'No surveyor present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The surveyor has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST)   return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned a land survey from the imperial surveyor');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'surveyorCommission');
    state.randomEvents.activeModifiers.push({
      id: 'surveyorCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SURVEYOR_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📏 The surveyor deploys teams of rod-men and chain-bearers across every corner of the empire, sighting through polished brass theodolites and driving iron pins to mark the precise locations of limestone outcrops, granite veins, and sandstone seams — the detailed survey maps guide the quarry masters to previously overlooked deposits and allow the road engineers to plan the most efficient extraction corridors, filling the empire's stone yards to capacity with freshly dressed imperial masonry! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studySurveyMethods() {
  const a = state.imperialSurveyor;
  if (!a?.active) return { ok: false, reason: 'No surveyor present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The surveyor has departed.' };
  if ((state.resources.iron ?? 0) < STUDY_IRON_COST) return { ok: false, reason: `Need ${STUDY_IRON_COST} iron.` };
  state.resources.iron -= STUDY_IRON_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied survey methods from the imperial surveyor');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'surveyorStudy');
    state.randomEvents.activeModifiers.push({
      id: 'surveyorStudy', resource: 'iron',
      rateMult: 1 + (STUDY_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudies = (a.totalStudies ?? 0) + 1;
  emit(Events.IMPERIAL_SURVEYOR_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚙️ The surveyor presents a portfolio of engineering drawings detailing the precision manufacture of vernier calipers, scribing gauges, and transit levels from high-grade wrought iron — the palace ironmasters study the exacting tolerances required for survey instrument construction, applying the same precision-working techniques and fine-grinding methods to forge tooling, chisel tempering, and casting mould preparation, elevating the quality and output rate of imperial iron production across the entire smithing quarter! −${STUDY_IRON_COST} iron · +${STUDY_PRESTIGE_REWARD} prestige. Iron surge: +${STUDY_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSurveyorAway() {
  const a = state.imperialSurveyor;
  if (!a?.active) return { ok: false, reason: 'No surveyor present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SURVEYOR_CHANGED, { dismissed: true });
  addMessage('📏 The imperial surveyor carefully bundles the brass theodolites and parchment maps back into their wooden transport cases and departs the palace — the precision instrument cart rumbling away over the cobblestones as the survey commission passes unrealised.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
