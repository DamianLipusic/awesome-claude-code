/**
 * EmpireOS — Imperial Scroll Keeper (T478).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), an imperial scroll
 * keeper arrives at the settlement carrying a cedar-wood carrying case fitted
 * with internal dividers of tightly wound felt — each slot holding a scroll
 * rolled around a polished wooden dowel with a bone finial at each end and
 * wrapped in a tablet-woven sleeve tied with a braided cord — containing
 * the full series of administrative precedents assembled by the imperial
 * chancery over the preceding generations: tax survey transcripts with the
 * original assessors' marginal notes preserved alongside later corrections,
 * treaty texts with their witness lists and seal descriptions, and the
 * imperial rescript series that records how the central administration has
 * ruled on each category of dispute sent up from the provinces — offering
 * to commission a complete series of imperial scrolls for the settlement's
 * archives, or to grant access to the restricted archive sections whose
 * contents have not previously circulated beyond the central chancery.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   📜 Commission Imperial Scrolls    — pay 25 mana + 20 gold
 *        → +0.22 mana/s for 2.5 min · +22 prestige · +12 morale
 *   🔑 Access Restricted Archive      — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                       — dismiss (no reward)
 *
 * state.imperialScrollKeeper = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
 *   totalAccesses:       number,
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

export const COMMISSION_MANA_COST            = 25;
export const COMMISSION_GOLD_COST            = 20;
export const COMMISSION_MANA_RATE            = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 22;
export const COMMISSION_MORALE_REWARD        = 12;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const ACCESS_STONE_COST               = 20;
export const ACCESS_STONE_RATE               = 0.18;
export const ACCESS_PRESTIGE_REWARD          = 15;
export const ACCESS_DURATION_TICKS           = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialScrollKeeper() {
  if (!state.imperialScrollKeeper) {
    state.imperialScrollKeeper = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalAccesses:    0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialScrollKeeper;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalAccesses      === undefined) s.totalAccesses      = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialScrollKeeperTick() {
  const a = state.imperialScrollKeeper;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SCROLL_KEEPER_CHANGED, { expired: true });
      addMessage('📜 The imperial scroll keeper replaces the cedar-wood case lid, secures the brass lock, and departs to the next settlement on the chancery\'s circuit.', 'info');
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
  emit(Events.IMPERIAL_SCROLL_KEEPER_CHANGED, { spawned: true });
  addMessage('📜 An imperial scroll keeper arrives carrying a cedar-wood case fitted with felt-lined dividers — each slot holding a scroll rolled on a polished dowel with bone finials, wrapped in a tablet-woven sleeve — containing the full series of imperial administrative precedents: tax survey transcripts with assessors\' marginal notes, treaty texts with witness lists, and imperial rescript rulings on provincial disputes. The keeper offers to commission a complete series of imperial scrolls for the settlement\'s archives, or to grant access to the restricted archive sections not previously circulated beyond the central chancery. Respond within 75 seconds.', 'info');
}

export function getActiveImperialScrollKeeper() { return state.imperialScrollKeeper?.active ?? null; }
export function getScrollKeeperSecsLeft() {
  const a = state.imperialScrollKeeper?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialScrolls() {
  const a = state.imperialScrollKeeper;
  if (!a?.active) return { ok: false, reason: 'No scroll keeper present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The scroll keeper has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial scrolls from the imperial scroll keeper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'scrollKeeperCommission');
    state.randomEvents.activeModifiers.push({
      id: 'scrollKeeperCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SCROLL_KEEPER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The scroll keeper opens the commission ledger to a fresh page and works through the order in the sequence dictated by the chancery's production schedule: the survey transcripts come first because they carry the most active cross-references and need to be available before the treaty texts can be properly indexed against the territorial descriptions they contain. The keeper dictates the text to the settlement's senior scribe while a second scribe prepares the sheets — cutting each one from a large membrane to a consistent size, scraping the surface smooth with a curved iron blade, and ruling the lines with a lead point drawn against a straight-edge pinned to the sheet with small wooden pegs. The treaty texts follow, each one transcribed in the formal chancery hand with red ink used for the capital letter at the head of each clause and the names of the contracting parties underlined in the same colour. When the series is complete the keeper collates the scrolls, checks each one against the master copy in the cedar case, and hands the full set over to the settlement's archives with a receipt noting the title of each text and the date of the commission. −${COMMISSION_MANA_COST} mana −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function accessRestrictedArchive() {
  const a = state.imperialScrollKeeper;
  if (!a?.active) return { ok: false, reason: 'No scroll keeper present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The scroll keeper has departed.' };
  if ((state.resources.stone ?? 0) < ACCESS_STONE_COST) return { ok: false, reason: `Need ${ACCESS_STONE_COST} stone.` };
  state.resources.stone -= ACCESS_STONE_COST;
  awardPrestige(ACCESS_PRESTIGE_REWARD, 'Accessed the restricted imperial archive via the scroll keeper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'scrollKeeperAccess');
    state.randomEvents.activeModifiers.push({
      id: 'scrollKeeperAccess', resource: 'stone',
      rateMult: 1 + (ACCESS_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + ACCESS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalAccesses = (a.totalAccesses ?? 0) + 1;
  emit(Events.IMPERIAL_SCROLL_KEEPER_CHANGED, { accessed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔑 The scroll keeper produces a second smaller case from the luggage — a flat wooden box with a wax seal across the latch — and opens it to reveal the restricted series: a set of survey scrolls recording the mineral and quarry assessments carried out by the imperial surveyors in the generation before the current administration, when the central chancery commissioned a systematic inventory of workable stone deposits and their estimated yield under different extraction methods. The surveyor's notes include the original bore-hole records with the stratum depths and the quality assessments made by the accompanying stone assessor, the yield projections for each deposit under the three extraction schedules the surveyors proposed, and the marginal notes added by the chancery reviewer who accepted or revised each projection on the basis of comparison with deposits of known character in other parts of the empire. The settlement's master mason and chief surveyor work through the restricted sections together, identifying two deposits in the settlement's territory whose potential the existing workings have not fully realised, and planning how the extraction schedule can be adjusted in line with the imperial survey's recommendations to increase the quality and quantity of dressed stone available to the settlement's building programme. −${ACCESS_STONE_COST} stone · +${ACCESS_PRESTIGE_REWARD} prestige. Stone surge: +${ACCESS_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendScrollKeeperAway() {
  const a = state.imperialScrollKeeper;
  if (!a?.active) return { ok: false, reason: 'No scroll keeper present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SCROLL_KEEPER_CHANGED, { dismissed: true });
  addMessage('📜 The imperial scroll keeper replaces the cedar-wood case lid, secures the brass lock, and departs to the next settlement on the chancery\'s circuit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
