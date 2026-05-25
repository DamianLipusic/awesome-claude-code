/**
 * EmpireOS — Imperial Aqueduct Builder (T400).
 *
 * Every 16–20 minutes (Medieval Age+, 12+ player tiles), an imperial aqueduct builder
 * arrives at the palace bearing rolled architectural parchments, precision surveying
 * instruments, and detailed hydraulic diagrams illustrating elaborate stone channel
 * systems, gravity-fed cisterns, and elevated arch bridges — offering to commission
 * a magnificent grand aqueduct that channels fresh mountain water through the imperial
 * city to nourish the population, or to share advanced hydraulic engineering principles
 * with the imperial stonemasons and military engineers for broad fortification benefits.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🌊 Commission Grand Aqueduct       — pay 30 stone + 20 gold
 *        → +0.25 food/s for 2.5 min · +28 prestige · +12 morale
 *   ⚙️ Study Hydraulic Engineering     — pay 25 iron
 *        → +0.20 iron/s for 2 min · +18 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.imperialAqueductBuilder = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
 *   totalPurchases:    number,
 *   totalDismissals:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 16 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_STONE_COST       = 30;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_FOOD_RATE        = 0.25;
export const COMMISSION_PRESTIGE_REWARD  = 28;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const STUDY_IRON_COST             = 25;
export const STUDY_IRON_RATE             = 0.20;
export const STUDY_PRESTIGE_REWARD       = 18;
export const STUDY_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialAqueductBuilder() {
  if (!state.imperialAqueductBuilder) {
    state.imperialAqueductBuilder = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialAqueductBuilder;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function imperialAqueductBuilderTick() {
  const a = state.imperialAqueductBuilder;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_AQUEDUCT_BUILDER_CHANGED, { expired: true });
      addMessage('🌊 The imperial aqueduct builder carefully rolls the architectural parchments, packs the surveying instruments into their leather case, and bows respectfully before departing from the palace — the sound of flowing water lingering only in imagination as the diagrams disappear from view.', 'info');
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
  emit(Events.IMPERIAL_AQUEDUCT_BUILDER_CHANGED, { spawned: true });
  addMessage('🌊 An imperial aqueduct builder arrives at the palace bearing rolled architectural parchments, precision surveying instruments, and detailed hydraulic diagrams illustrating elaborate stone channel systems and gravity-fed cisterns — offering to commission a magnificent grand aqueduct or to share advanced hydraulic engineering principles with the imperial engineers. Respond within 80 seconds.', 'info');
}

export function getActiveImperialAqueductBuilder() { return state.imperialAqueductBuilder?.active ?? null; }
export function getAqueductBuilderSecsLeft() {
  const a = state.imperialAqueductBuilder?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGrandAqueduct() {
  const a = state.imperialAqueductBuilder;
  if (!a?.active) return { ok: false, reason: 'No aqueduct builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The aqueduct builder has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned grand aqueduct from the imperial aqueduct builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'aqueductCommission');
    state.randomEvents.activeModifiers.push({
      id: 'aqueductCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_AQUEDUCT_BUILDER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌊 The aqueduct builder marshals the imperial stonemason guilds and sets to work constructing a magnificent series of arched stone channels, gravity-fed cisterns, and carved water fountains that carry fresh mountain spring water directly into the imperial city's granaries, bathhouses, and residential districts — the abundant clean water supply nourishing the population and fuelling remarkable agricultural expansion! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyHydraulicEngineering() {
  const a = state.imperialAqueductBuilder;
  if (!a?.active) return { ok: false, reason: 'No aqueduct builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The aqueduct builder has departed.' };
  if ((state.resources.iron ?? 0) < STUDY_IRON_COST) return { ok: false, reason: `Need ${STUDY_IRON_COST} iron.` };
  state.resources.iron -= STUDY_IRON_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied hydraulic engineering from the imperial aqueduct builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'aqueductStudy');
    state.randomEvents.activeModifiers.push({
      id: 'aqueductStudy', resource: 'iron',
      rateMult: 1 + (STUDY_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_AQUEDUCT_BUILDER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚙️ The aqueduct builder exchanges precise hydraulic engineering diagrams for iron ore samples — teaching the imperial metallurgists and military engineers how water-powered bellows, hydraulic stamp mills, and pressure-driven forge hammers dramatically accelerate iron smelting and metal refinement, opening entirely new possibilities for mechanised ore processing! −${STUDY_IRON_COST} iron · +${STUDY_PRESTIGE_REWARD} prestige. Iron surge: +${STUDY_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendAqueductBuilderAway() {
  const a = state.imperialAqueductBuilder;
  if (!a?.active) return { ok: false, reason: 'No aqueduct builder present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_AQUEDUCT_BUILDER_CHANGED, { dismissed: true });
  addMessage('🌊 The imperial aqueduct builder carefully rolls the architectural parchments and packs the surveying instruments before bowing respectfully and departing from the palace — the sound of flowing water fading from imagination.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
