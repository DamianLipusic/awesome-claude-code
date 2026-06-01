/**
 * EmpireOS — Imperial Pottery Master (T472).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), an imperial pottery master
 * arrives at the settlement bearing a display chest of finished wares — wheel-
 * thrown storage jars with fitted lids sealed with clay washers, flat-based
 * cooking vessels in a coarse red-fired ware, and a set of fine grey slip-
 * decorated presentation bowls intended for official gatherings — along with a
 * portfolio of workshop plans showing the kiln layout, wheel-pit dimensions,
 * and drying-shed orientation required to run a profitable pottery enterprise,
 * offering to commission a grand pottery works for the settlement, or to teach
 * the settlement's craftspeople advanced ceramic arts for use in their own
 * workshops.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🏺 Commission Grand Pottery Works — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Study Ceramic Arts             — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.imperialPotteryMaster = {
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

export function initImperialPotteryMaster() {
  if (!state.imperialPotteryMaster) {
    state.imperialPotteryMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudies:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialPotteryMaster;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalStudies       === undefined) s.totalStudies       = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialPotteryMasterTick() {
  const a = state.imperialPotteryMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_POTTERY_MASTER_CHANGED, { expired: true });
      addMessage('🏺 The imperial pottery master latches the display chest, rolls the workshop portfolio under one arm, and departs to seek a more ambitious settlement for the grand commission.', 'info');
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
  emit(Events.IMPERIAL_POTTERY_MASTER_CHANGED, { spawned: true });
  addMessage('🏺 An imperial pottery master arrives bearing a display chest of finished wares — wheel-thrown storage jars with fitted lids, coarse red-fired cooking vessels, and fine grey slip-decorated presentation bowls — along with a portfolio of workshop plans showing the kiln layout, wheel-pit dimensions, and drying-shed orientation for a profitable pottery enterprise. The master offers to commission a grand pottery works for the settlement, or to teach advanced ceramic arts to the settlement\'s craftspeople. Respond within 75 seconds.', 'info');
}

export function getActiveImperialPotteryMaster() { return state.imperialPotteryMaster?.active ?? null; }
export function getPotteryMasterSecsLeft() {
  const a = state.imperialPotteryMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGrandPotteryWorks() {
  const a = state.imperialPotteryMaster;
  if (!a?.active) return { ok: false, reason: 'No pottery master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The pottery master has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold  ?? 0) < COMMISSION_GOLD_COST)  return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned grand pottery works from the imperial pottery master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'potteryMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'potteryMasterCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_POTTERY_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏺 The pottery master opens the portfolio to the site-plan page and walks through the commission: a two-chamber updraft kiln built from refractory clay bricks set in an arched firebox, a wheel room with a pair of kick-wheels seated in stone-lined pits to dampen vibration, and a covered drying shed oriented to catch the prevailing dry-season wind so green ware reaches the leather-hard stage without surface cracking. The construction team follows the master's specifications with evident care, setting the kiln arch from a template curve the master has used on a dozen similar commissions across the province. When the first firing completes and the chamber is opened, the settlement's potters carry out storage jars, cooking vessels, and roof tiles still radiating warmth — the largest single-day output the settlement has ever produced. A mood of quiet pride settles over the craftspeople's quarter. −${COMMISSION_STONE_COST} stone −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyCeramicArts() {
  const a = state.imperialPotteryMaster;
  if (!a?.active) return { ok: false, reason: 'No pottery master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The pottery master has departed.' };
  if ((state.resources.mana ?? 0) < STUDY_MANA_COST) return { ok: false, reason: `Need ${STUDY_MANA_COST} mana.` };
  state.resources.mana -= STUDY_MANA_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied ceramic arts from the imperial pottery master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'potteryMasterStudy');
    state.randomEvents.activeModifiers.push({
      id: 'potteryMasterStudy', resource: 'mana',
      rateMult: 1 + (STUDY_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudies = (a.totalStudies ?? 0) + 1;
  emit(Events.IMPERIAL_POTTERY_MASTER_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The pottery master draws the settlement's senior craftspeople into a half-day intensive workshop, beginning with the theory of clay body composition — the ratio of fine plastic clay to grog that controls shrinkage and fired strength, the role of feldspar in the glaze melt, and the way iron oxide content shifts the fired colour from cream through buff to brick-red depending on kiln atmosphere. The afternoon session moves to the wheel: the master demonstrates the centring technique that allows a skilled thrower to raise a tall cylinder without the walls wandering off-axis, then passes the wheel to the craftspeople and corrects their hand positions one by one. By the session's end the potters are producing uniform wall thicknesses that would have been beyond them that morning, and several are already planning modifications to the firing schedule that the new understanding makes possible. −${STUDY_MANA_COST} mana · +${STUDY_PRESTIGE_REWARD} prestige. Mana surge: +${STUDY_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendPotteryMasterAway() {
  const a = state.imperialPotteryMaster;
  if (!a?.active) return { ok: false, reason: 'No pottery master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_POTTERY_MASTER_CHANGED, { dismissed: true });
  addMessage('🏺 The imperial pottery master latches the display chest, rolls the workshop portfolio under one arm, and departs to seek a more ambitious settlement for the grand commission.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
