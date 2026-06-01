/**
 * EmpireOS — Imperial Spyglass Maker (T474).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), an imperial spyglass
 * maker arrives at the settlement carrying a fitted case of demonstration
 * instruments — a set of single-draw spyglasses with turned-bone draw-tubes
 * polished to take a tight sliding fit, a two-draw model with a leather-wrapped
 * grip, and a large fixed-focus telescope mounted on a tilting wooden stand for
 * observing distant coastlines — along with a portfolio of lens-grinding designs
 * showing the grinding curves, the pitch-lap construction used to hold the glass
 * blank during figuring, and the mounting sequence that aligns the objective and
 * eyepiece cells along a common optical axis — offering to commission a collection
 * of imperial spyglasses for the settlement's commanders, or to teach the
 * settlement's skilled craftspeople the lens-grinding arts for independent
 * production.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🔭 Commission Imperial Spyglass Collection — pay 25 iron + 20 gold
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Study Lens-Grinding Arts               — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                               — dismiss (no reward)
 *
 * state.imperialSpyglassMaker = {
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
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST            = 25;
export const COMMISSION_GOLD_COST            = 20;
export const COMMISSION_IRON_RATE            = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 22;
export const COMMISSION_MORALE_REWARD        = 12;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const STUDY_MANA_COST                 = 20;
export const STUDY_MANA_RATE                 = 0.18;
export const STUDY_PRESTIGE_REWARD           = 15;
export const STUDY_DURATION_TICKS            = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSpyglassMaker() {
  if (!state.imperialSpyglassMaker) {
    state.imperialSpyglassMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudies:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialSpyglassMaker;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalStudies       === undefined) s.totalStudies       = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialSpyglassMakerTick() {
  const a = state.imperialSpyglassMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SPYGLASS_MAKER_CHANGED, { expired: true });
      addMessage('🔭 The imperial spyglass maker latches the instrument case, rolls the lens-grinding portfolio into its protective tube, and departs to seek a settlement with the technical ambition to support a proper optical workshop.', 'info');
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
  emit(Events.IMPERIAL_SPYGLASS_MAKER_CHANGED, { spawned: true });
  addMessage('🔭 An imperial spyglass maker arrives carrying a fitted case of demonstration instruments — single-draw spyglasses with polished bone draw-tubes, a leather-wrapped two-draw model, and a large fixed-focus telescope on a tilting wooden stand — along with a portfolio of lens-grinding designs. The maker offers to commission a collection of imperial spyglasses for the settlement\'s commanders, or to teach the lens-grinding arts to the settlement\'s skilled craftspeople. Respond within 75 seconds.', 'info');
}

export function getActiveImperialSpyglassMaker() { return state.imperialSpyglassMaker?.active ?? null; }
export function getSpyglassMakerSecsLeft() {
  const a = state.imperialSpyglassMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialSpyglassCollection() {
  const a = state.imperialSpyglassMaker;
  if (!a?.active) return { ok: false, reason: 'No spyglass maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The spyglass maker has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial spyglass collection from the imperial spyglass maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'spyglassMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'spyglassMakerCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SPYGLASS_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔭 The spyglass maker opens the portfolio to the commission sheet and works through the order systematically: drawing the objective-lens blanks first, marking the grinding diameter with a scribe and cutting to rough shape with a bow-saw before beginning the slow spherical figuring on the pitch lap — checking the curve against a brass test gauge at each stage until the radius matches the design specification. The draw-tube blanks are turned from bar stock on a bow-lathe and polished in sequence, each taper cut with a long-bladed draw-knife and finished with progressively finer abrasive until the sliding fit requires no deliberate force to operate. The objective and eyepiece cells are assembled on an alignment jig, and the finished instruments are tested against a distant reference mark on the horizon before being accepted into the commission. The settlement's commanders receive their instruments and immediately begin ranging the approaches to the settlement with a thoroughness that had previously been impossible. −${COMMISSION_IRON_COST} iron −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyLensGrindingArts() {
  const a = state.imperialSpyglassMaker;
  if (!a?.active) return { ok: false, reason: 'No spyglass maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The spyglass maker has departed.' };
  if ((state.resources.mana ?? 0) < STUDY_MANA_COST) return { ok: false, reason: `Need ${STUDY_MANA_COST} mana.` };
  state.resources.mana -= STUDY_MANA_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied lens-grinding arts from the imperial spyglass maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'spyglassMakerStudy');
    state.randomEvents.activeModifiers.push({
      id: 'spyglassMakerStudy', resource: 'mana',
      rateMult: 1 + (STUDY_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudies = (a.totalStudies ?? 0) + 1;
  emit(Events.IMPERIAL_SPYGLASS_MAKER_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The spyglass maker begins the workshop session with the geometry of refraction — the relationship between lens curvature, focal length, and magnification, illustrated with diagrams drawn in charcoal on the workshop floor that the apprentices can measure directly with a string compass. The practical session follows: each apprentice grinds a small test lens on the pitch lap, beginning with coarse abrasive to establish the spherical curve and finishing with progressively finer grades until the surface will resolve a line ruled on paper at arm's length without a perceptible blur. The maker demonstrates the cell-alignment technique twice before passing the jig to the apprentices in turn, correcting their grip on the alignment screws and explaining the visual test that confirms the axis is true before the cement is set. Several of the settlement's more technically inclined craftspeople show a marked aptitude, and by the end of the session are independently figuring blanks to specification. −${STUDY_MANA_COST} mana · +${STUDY_PRESTIGE_REWARD} prestige. Mana surge: +${STUDY_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSpyglassMakerAway() {
  const a = state.imperialSpyglassMaker;
  if (!a?.active) return { ok: false, reason: 'No spyglass maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SPYGLASS_MAKER_CHANGED, { dismissed: true });
  addMessage('🔭 The imperial spyglass maker latches the instrument case, rolls the lens-grinding portfolio into its protective tube, and departs to seek a settlement with the technical ambition to support a proper optical workshop.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
