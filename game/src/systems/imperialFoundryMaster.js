/**
 * EmpireOS — Imperial Foundry Master (T480).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), an imperial foundry
 * master arrives at the settlement carrying a flat wooden case of pattern
 * boards — each board bearing the carved negative impression of a finished
 * casting, with the runner channels and riser vents cut into the board face
 * alongside the main cavity — and a bound workbook of alloy formulas noting
 * the proportions of copper and tin that produce each grade of bronze from
 * the soft ductile alloy suited to sheet-work and wire-drawing through to the
 * harder bell metal and the dense bearing metal used for axle bushings, with
 * hand-annotated corrections recording where the original formula had to be
 * adjusted for the specific ore sources available in the region — offering
 * to commission a set of iron casting works for the settlement's foundry, or
 * to teach the settlement's metalworkers the metallurgy techniques that
 * distinguish imperial-grade castings from ordinary rough-poured iron.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🔥 Commission Iron Casting Works     — pay 25 iron + 20 gold
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Study Metallurgy Techniques       — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.imperialFoundryMaster = {
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

export function initImperialFoundryMaster() {
  if (!state.imperialFoundryMaster) {
    state.imperialFoundryMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudies:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialFoundryMaster;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalStudies       === undefined) s.totalStudies       = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialFoundryMasterTick() {
  const a = state.imperialFoundryMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_FOUNDRY_MASTER_CHANGED, { expired: true });
      addMessage('🔥 The imperial foundry master closes the pattern-board case, rolls the alloy workbook back into its leather sleeve, and departs for a settlement whose metalworkers have the skill to put the casting techniques to good use.', 'info');
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
  emit(Events.IMPERIAL_FOUNDRY_MASTER_CHANGED, { spawned: true });
  addMessage('🔥 An imperial foundry master arrives carrying a flat wooden case of pattern boards — carved negatives for finished castings with runner channels and riser vents cut into the face — and a bound workbook of alloy formulas covering the full range of bronze grades from soft ductile sheet metal to hard bell metal and bearing metal, with hand-annotated corrections for regional ore sources. The master offers to commission a set of iron casting works for the settlement\'s foundry, or to teach the metallurgy techniques that distinguish imperial-grade castings from ordinary rough-poured iron. Respond within 75 seconds.', 'info');
}

export function getActiveImperialFoundryMaster() { return state.imperialFoundryMaster?.active ?? null; }
export function getFoundryMasterSecsLeft() {
  const a = state.imperialFoundryMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionIronCastingWorks() {
  const a = state.imperialFoundryMaster;
  if (!a?.active) return { ok: false, reason: 'No foundry master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The foundry master has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned iron casting works from the imperial foundry master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'foundryMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'foundryMasterCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_FOUNDRY_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔥 The foundry master opens the pattern-board case on the bench beside the settlement's furnace and begins the commission in the sequence the casting schedule requires: the flask preparation comes first — ramming the damp sand into the cope and drag sections around the pattern board until the impression is clean and the venting holes are clear — before the master prepares the charge, adding the correct proportion of pig iron to the crucible with a measured addition of charcoal and a flux of burnt limestone to draw the phosphorus and sulphur into the slag. The furnace is brought to welding heat over two hours with a steady bellows rhythm, and the master monitors the surface of the melt by watching the colour and the movement of the slag layer: a bright mirror surface with a slow rolling motion indicates the correct temperature, while surface cracking or a dull reddish glow means the charge needs more time. The pour is made in a single motion from a pre-heated ladle, filling the runner channel from the bottom so the rising metal sweeps the air out through the riser vents rather than trapping it in pockets within the casting body. The finished castings are broken out of the sand after cooling and dressed with a file to remove the runner stubs and any surface roughness — producing iron components whose dense, even grain structure reflects the controlled charge preparation and the steady pour temperature. −${COMMISSION_IRON_COST} iron −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyMetallurgyTechniques() {
  const a = state.imperialFoundryMaster;
  if (!a?.active) return { ok: false, reason: 'No foundry master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The foundry master has departed.' };
  if ((state.resources.mana ?? 0) < STUDY_MANA_COST) return { ok: false, reason: `Need ${STUDY_MANA_COST} mana.` };
  state.resources.mana -= STUDY_MANA_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied metallurgy techniques from the imperial foundry master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'foundryMasterStudy');
    state.randomEvents.activeModifiers.push({
      id: 'foundryMasterStudy', resource: 'mana',
      rateMult: 1 + (STUDY_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudies = (a.totalStudies ?? 0) + 1;
  emit(Events.IMPERIAL_FOUNDRY_MASTER_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The foundry master begins the session with the chemistry of the iron charge — explaining the role of carbon content in determining whether the cooled metal is soft enough to be worked by a hammer or hard enough to hold a cutting edge, and describing the visual indicators that allow a skilled founder to judge carbon content from the colour and texture of a fresh fracture surface without a chemical test. The slag chemistry section follows: the master explains how limestone flux combines with the phosphorus and sulphur compounds in the ore to form a fluid slag that can be drawn off cleanly at welding heat, while an acid flux produces a more viscous slag that may carry iron oxide particles that would otherwise be left in the finished metal. The practical workshop sessions cover the two skills that distinguish imperial-grade castings from ordinary work: the sand preparation technique that produces a fine, even mould surface without dry corners or crumbling edges, and the pouring stance and ladle angle that fill the mould cavity smoothly from the bottom without the turbulence that introduces air inclusions. The settlement's senior founders work through test castings using each technique in turn, comparing the results against the master's reference samples and identifying the specific points in their existing practice where the changes produce the greatest improvement in casting quality. −${STUDY_MANA_COST} mana · +${STUDY_PRESTIGE_REWARD} prestige. Mana surge: +${STUDY_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFoundryMasterAway() {
  const a = state.imperialFoundryMaster;
  if (!a?.active) return { ok: false, reason: 'No foundry master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_FOUNDRY_MASTER_CHANGED, { dismissed: true });
  addMessage('🔥 The imperial foundry master closes the pattern-board case, rolls the alloy workbook back into its leather sleeve, and departs for a settlement whose metalworkers have the skill to put the casting techniques to good use.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
