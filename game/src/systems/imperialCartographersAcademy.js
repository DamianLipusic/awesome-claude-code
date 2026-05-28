/**
 * EmpireOS — Imperial Cartographer's Academy (T434).
 *
 * Every 15–19 minutes (Iron Age+, 12+ player tiles), a delegation from
 * the imperial cartographer's academy arrives at the settlement carrying
 * a full surveying kit — a brass theodolite mounted on a mahogany
 * tripod with levelling screws ground to allow precise horizontal and
 * vertical angle measurement, a plane table with an alidade fitted with
 * telescopic sights for distance estimation, a set of surveying chains
 * of known length standardised against the imperial cubit, a clinometer
 * for measuring slope angles across broken terrain, and a portfolio of
 * blank parchment sheets printed with the academy's triangulation grid
 * extending across the known empire — offering to commission a complete
 * ground survey of the settlement's territory that will establish the
 * precise boundaries and relative elevations needed for road planning,
 * aqueduct routing, and military advance, or to share the advanced
 * plane-table triangulation method that allows any literate engineer to
 * extend the survey network independently. The player has 80 seconds
 * to decide.
 *
 * Choices:
 *   🗺️ Commission Grand Survey       — pay 30 iron + 20 gold
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +10 morale
 *   📖 Study Cartography Methods     — pay 25 mana
 *        → +0.20 mana/s for 2 min · +18 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.imperialCartographersAcademy = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
 *   totalStudies:        number,
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_IRON_COST            = 30;
export const COMMISSION_GOLD_COST            = 20;
export const COMMISSION_IRON_RATE            = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 22;
export const COMMISSION_MORALE_REWARD        = 10;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const STUDY_MANA_COST                 = 25;
export const STUDY_MANA_RATE                 = 0.20;
export const STUDY_PRESTIGE_REWARD           = 18;
export const STUDY_DURATION_TICKS            = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialCartographersAcademy() {
  if (!state.imperialCartographersAcademy) {
    state.imperialCartographersAcademy = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudies:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialCartographersAcademy;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalStudies     === undefined) s.totalStudies     = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialCartographersAcademyTick() {
  const a = state.imperialCartographersAcademy;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_CARTOGRAPHERS_ACADEMY_CHANGED, { expired: true });
      addMessage('🗺️ The imperial cartographer\'s academy delegation repacks the theodolite in its mahogany case, rolls the survey parchments back into the leather carrying tube, and departs to complete the survey network in the adjacent province — the faint creak of the tripod straps the only sound as the group passes the settlement gate.', 'info');
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
  emit(Events.IMPERIAL_CARTOGRAPHERS_ACADEMY_CHANGED, { spawned: true });
  addMessage('🗺️ A delegation from the imperial cartographer\'s academy arrives carrying a brass theodolite on a mahogany tripod with precision levelling screws, a plane table with telescopic alidade, surveying chains of standardised length, a clinometer for slope measurement, and a portfolio of blank parchment sheets pre-printed with the imperial triangulation grid — offering to commission a complete ground survey of the settlement\'s territory establishing precise boundaries and elevations for road planning and military advance, or to share the advanced plane-table triangulation method for ongoing survey capability. Respond within 80 seconds.', 'info');
}

export function getActiveImperialCartographersAcademy() { return state.imperialCartographersAcademy?.active ?? null; }
export function getCartographersAcademySecsLeft() {
  const a = state.imperialCartographersAcademy?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGrandSurvey() {
  const a = state.imperialCartographersAcademy;
  if (!a?.active) return { ok: false, reason: 'No cartographer\'s academy delegation present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The delegation has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned grand survey from the imperial cartographer\'s academy');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartacadCommission');
    state.randomEvents.activeModifiers.push({
      id: 'cartacadCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_CARTOGRAPHERS_ACADEMY_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ The survey delegation establishes a primary baseline across the settlement's longest flat ground, sets the theodolite at each end of the baseline to measure the angles to every prominent hilltop and landmark in the territory, extends the triangulation network outward from these primary stations using the plane table to fix secondary points as the surveyors traverse the boundary zones on foot — measuring the slope angle at each terrain break with the clinometer and noting soil type and drainage pattern against each survey peg — and delivers a complete topographic record of the territory drawn to the academy's grid standard with elevation contours, boundary markers, road-grade profiles for every possible route, and the mine-and-quarry prospect map that identifies every exposed geological formation worth investigating for ore or building stone! −${COMMISSION_IRON_COST} iron · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyCartographyMethods() {
  const a = state.imperialCartographersAcademy;
  if (!a?.active) return { ok: false, reason: 'No cartographer\'s academy delegation present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The delegation has departed.' };
  if ((state.resources.mana ?? 0) < STUDY_MANA_COST) return { ok: false, reason: `Need ${STUDY_MANA_COST} mana.` };
  state.resources.mana -= STUDY_MANA_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied cartography methods with the imperial cartographer\'s academy');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartacadStudy');
    state.randomEvents.activeModifiers.push({
      id: 'cartacadStudy', resource: 'mana',
      rateMult: 1 + (STUDY_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudies = (a.totalStudies ?? 0) + 1;
  emit(Events.IMPERIAL_CARTOGRAPHERS_ACADEMY_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The academy delegation shares the complete plane-table triangulation method — the baseline measurement procedure using two surveyors walking opposite ends of the chain to eliminate cumulative error, the theodolite levelling sequence using the foot screws and spirit bubble that must be completed before any angular reading is taken, the back-sight check method that verifies each instrument setup against the previous station before recording forward angles, the plane-table resection technique for locating the instrument position when no baseline measurement is possible, and the grid-extension arithmetic for converting observed angles and baseline lengths into coordinates referenced to the imperial standard meridian — knowledge that allows any literate engineer to extend the survey network independently across the settlement's full territory using locally-made equipment. −${STUDY_MANA_COST} mana · +${STUDY_PRESTIGE_REWARD} prestige. Mana surge: +${STUDY_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCartographersAcademyAway() {
  const a = state.imperialCartographersAcademy;
  if (!a?.active) return { ok: false, reason: 'No cartographer\'s academy delegation present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_CARTOGRAPHERS_ACADEMY_CHANGED, { dismissed: true });
  addMessage('🗺️ The imperial cartographer\'s academy delegation repacks the survey instruments and departs toward the next territory in the survey programme.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
