/**
 * EmpireOS — Imperial Siege Catapult Engineer (T402).
 *
 * Every 15–19 minutes (Iron Age+, 12+ player tiles), an imperial siege catapult
 * engineer arrives at the palace workshop bearing detailed technical drawings of
 * onagers, trebuchets, and torsion-powered bolt-throwers — offering to commission
 * a full war machine arsenal for the imperial siege corps, or to share advanced
 * torsion physics and mechanical leverage principles with the imperial engineers
 * and blacksmith guilds.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   ⚔️  Commission War Machines        — pay 35 iron + 20 wood
 *        → +0.25 iron/s for 2.5 min · +28 prestige · +10 morale
 *   📐 Study Torsion Physics           — pay 25 stone
 *        → +0.20 stone/s for 2 min · +18 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.imperialSiegeCatapultEngineer = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
 *   totalStudies:      number,
 *   totalDismissals:   number,
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
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_IRON_COST        = 35;
export const COMMISSION_WOOD_COST        = 20;
export const COMMISSION_IRON_RATE        = 0.25;
export const COMMISSION_PRESTIGE_REWARD  = 28;
export const COMMISSION_MORALE_REWARD    = 10;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const STUDY_STONE_COST            = 25;
export const STUDY_STONE_RATE            = 0.20;
export const STUDY_PRESTIGE_REWARD       = 18;
export const STUDY_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSiegeCatapultEngineer() {
  if (!state.imperialSiegeCatapultEngineer) {
    state.imperialSiegeCatapultEngineer = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudies:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialSiegeCatapultEngineer;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalStudies     === undefined) s.totalStudies     = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialSiegeCatapultEngineerTick() {
  const a = state.imperialSiegeCatapultEngineer;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SIEGE_CATAPULT_ENGINEER_CHANGED, { expired: true });
      addMessage('⚔️ The imperial siege catapult engineer rolls the technical drawings back into their leather tube, checks the brass buckles on the tool case, and marches from the palace workshop — the thunder of imagined catapult volleys receding with the footsteps.', 'info');
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
  emit(Events.IMPERIAL_SIEGE_CATAPULT_ENGINEER_CHANGED, { spawned: true });
  addMessage('⚔️ An imperial siege catapult engineer arrives at the palace workshop bearing detailed technical drawings of onagers, trebuchets, and torsion-powered bolt-throwers — offering to commission a full war machine arsenal for the imperial siege corps, or to share advanced torsion physics and mechanical leverage principles with the imperial engineers. Respond within 75 seconds.', 'info');
}

export function getActiveImperialSiegeCatapultEngineer() { return state.imperialSiegeCatapultEngineer?.active ?? null; }
export function getSiegeCatapultEngineerSecsLeft() {
  const a = state.imperialSiegeCatapultEngineer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionWarMachines() {
  const a = state.imperialSiegeCatapultEngineer;
  if (!a?.active) return { ok: false, reason: 'No siege catapult engineer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The siege catapult engineer has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned war machines from the imperial siege catapult engineer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'catapultEngineerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'catapultEngineerCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_CATAPULT_ENGINEER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚔️ The siege catapult engineer directs the imperial blacksmiths and carpenter teams to assemble a magnificent battery of torsion-powered onagers, counterweight trebuchets, and precision bolt-throwers — the roar of taut ropes and the crack of hurled stones inspiring the armament workers to smelt and forge iron components at a driven pace never before seen in the palace workshops! −${COMMISSION_IRON_COST} iron · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyTorsionPhysics() {
  const a = state.imperialSiegeCatapultEngineer;
  if (!a?.active) return { ok: false, reason: 'No siege catapult engineer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The siege catapult engineer has departed.' };
  if ((state.resources.stone ?? 0) < STUDY_STONE_COST) return { ok: false, reason: `Need ${STUDY_STONE_COST} stone.` };
  state.resources.stone -= STUDY_STONE_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied torsion physics from the imperial siege catapult engineer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'catapultEngineerStudy');
    state.randomEvents.activeModifiers.push({
      id: 'catapultEngineerStudy', resource: 'stone',
      rateMult: 1 + (STUDY_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudies = (a.totalStudies ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_CATAPULT_ENGINEER_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📐 The siege catapult engineer demonstrates how twisted rope bundles, counterweight ratios, and precision sling geometry obey universal mechanical laws — the imperial stonemasons immediately apply the leverage principles to redesign quarrying cranes and stone-splitting apparatus, dramatically accelerating the extraction and dressing of building stone! −${STUDY_STONE_COST} stone · +${STUDY_PRESTIGE_REWARD} prestige. Stone surge: +${STUDY_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSiegeCatapultEngineerAway() {
  const a = state.imperialSiegeCatapultEngineer;
  if (!a?.active) return { ok: false, reason: 'No siege catapult engineer present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_CATAPULT_ENGINEER_CHANGED, { dismissed: true });
  addMessage('⚔️ The imperial siege catapult engineer rolls the technical drawings back into their leather tube and marches from the palace workshop — the thunder of imagined catapult volleys receding into silence.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
