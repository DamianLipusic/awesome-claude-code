/**
 * EmpireOS — Imperial Cartography Master (T482).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), an imperial cartography
 * master arrives at the settlement carrying a cylindrical leather map case
 * stopped at both ends with turned hardwood plugs — inside the case, a set
 * of survey maps on vellum showing the surrounding territory in graduated ink
 * washes, with the surveyed elevations marked in finger-widths above a datum
 * line at the river crossing and the distances between landmarks recorded in
 * measured paces confirmed by a second survey party working the opposite
 * direction — along with a brass surveying chain of known length, a plumb-bob
 * on a braided silk cord, and a shadow staff calibrated against a table of
 * noon-shadow lengths for each month of the year — offering to commission a
 * complete territorial survey of the settlement's lands, or to teach the
 * mapping techniques used by imperial surveyors so the settlement can produce
 * its own accurate charts.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🗺️ Commission Territorial Survey    — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Study Mapping Techniques          — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.imperialCartographyMaster = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_STONE_COST           = 25;
export const COMMISSION_GOLD_COST            = 20;
export const COMMISSION_STONE_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 22;
export const COMMISSION_MORALE_REWARD        = 12;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const STUDY_MANA_COST                 = 20;
export const STUDY_MANA_RATE                 = 0.18;
export const STUDY_PRESTIGE_REWARD           = 15;
export const STUDY_DURATION_TICKS            = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialCartographyMaster() {
  if (!state.imperialCartographyMaster) {
    state.imperialCartographyMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudies:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialCartographyMaster;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalStudies       === undefined) s.totalStudies       = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialCartographyMasterTick() {
  const a = state.imperialCartographyMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_CARTOGRAPHY_MASTER_CHANGED, { expired: true });
      addMessage('🗺️ The imperial cartography master rolls the vellum survey sheets into the leather map case, plugs both ends, and departs to the next territory awaiting measurement.', 'info');
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
  emit(Events.IMPERIAL_CARTOGRAPHY_MASTER_CHANGED, { spawned: true });
  addMessage('🗺️ An imperial cartography master arrives carrying a cylindrical leather map case — inside, survey maps on vellum showing graduated elevation washes and distances confirmed by double survey — along with a brass surveying chain of known length, a plumb-bob on braided silk cord, and a shadow staff calibrated against monthly noon-shadow tables. The master offers to commission a complete territorial survey of the settlement\'s lands, or to teach the mapping techniques used by imperial surveyors so the settlement can produce its own accurate charts. Respond within 75 seconds.', 'info');
}

export function getActiveImperialCartographyMaster() { return state.imperialCartographyMaster?.active ?? null; }
export function getCartographyMasterSecsLeft() {
  const a = state.imperialCartographyMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTerritorialSurvey() {
  const a = state.imperialCartographyMaster;
  if (!a?.active) return { ok: false, reason: 'No cartography master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cartography master has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned territorial survey from the imperial cartography master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartographyMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'cartographyMasterCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_CARTOGRAPHY_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ The cartography master establishes a baseline along the longest straight stretch of road within the settlement's lands — laying the brass chain end to end in measured lengths, driving a wooden peg at each chain-end to hold the position while the chain is advanced, and counting the total chain-lengths to establish the baseline distance before beginning the triangulation network that will connect the baseline to the survey points across the territory. The shadow staff goes up at a fixed mark on the baseline, and the master reads the noon shadow length on three consecutive days to confirm the latitude against the table of calibration values: when the shadow length matches the tabulated value for the current month and the staff reads vertical against the plumb-bob cord, the orientation and scale of the survey are confirmed and the triangulation angles can be measured with confidence. Each survey point is occupied in turn — a hilltop, a river bend, a distinctive rock — and the angles to the two baseline ends and to the adjacent survey points are measured and recorded before the party moves on to the next station: the round of angles is computed each evening by the master and checked against the closing error for the circuit, with any station showing a discrepancy greater than one angular finger-width resurveyed the following morning. The finished vellum sheet, inked in the master's measured wash technique with elevations in graduated tones and distances annotated in paces, is presented to the settlement's record-keepers along with a table of coordinate positions that allows the survey to be extended by the settlement's own surveyors when new territories are annexed. −${COMMISSION_STONE_COST} stone −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyMappingTechniques() {
  const a = state.imperialCartographyMaster;
  if (!a?.active) return { ok: false, reason: 'No cartography master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cartography master has departed.' };
  if ((state.resources.mana ?? 0) < STUDY_MANA_COST) return { ok: false, reason: `Need ${STUDY_MANA_COST} mana.` };
  state.resources.mana -= STUDY_MANA_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied mapping techniques from the imperial cartography master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartographyMasterStudy');
    state.randomEvents.activeModifiers.push({
      id: 'cartographyMasterStudy', resource: 'mana',
      rateMult: 1 + (STUDY_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudies = (a.totalStudies ?? 0) + 1;
  emit(Events.IMPERIAL_CARTOGRAPHY_MASTER_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The cartography master opens the session with the geometry of triangulation: beginning with the property that a triangle's shape is fully determined by three angle measurements if one side length is known, the master demonstrates on a small scale using pegs driven into the ground at three corners of a measured triangle — showing how the angle at each corner can be read from the bearing of the sight-line to each of the other two corners, and how the three angle measurements should sum to exactly two right angles when the observations are correct. The error analysis section is the most detailed: the master explains the sources of angular error in practical survey work — the deviation of the shadow staff from true vertical under wind, the misalignment of the sighting notch with the centre of a distant target, the parallax error when reading the chain position from an oblique angle — and describes the systematic checks built into the imperial survey method that detect and correct each error type before it accumulates through the survey network. A practical drawing section covers the inking technique that produces legible graduated elevation washes: the master demonstrates the wet-in-wet wash method that blends high and low tones across a hillside without hard lines at the tone boundaries, and the point-and-stroke technique for indicating rock outcrops and stream beds with conventional signs that any trained reader of imperial maps can interpret without a key. The settlement's most capable record-keepers work through a practice survey of the immediate settlement area, closing the triangulation circuit and inking the result under the master's correction before the session ends. −${STUDY_MANA_COST} mana · +${STUDY_PRESTIGE_REWARD} prestige. Mana surge: +${STUDY_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCartographyMasterAway() {
  const a = state.imperialCartographyMaster;
  if (!a?.active) return { ok: false, reason: 'No cartography master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_CARTOGRAPHY_MASTER_CHANGED, { dismissed: true });
  addMessage('🗺️ The imperial cartography master rolls the vellum survey sheets into the leather map case, plugs both ends, and departs to the next territory awaiting measurement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
