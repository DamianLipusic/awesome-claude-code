/**
 * EmpireOS — Wandering Mapmaker (T303).
 *
 * Every 14–19 minutes (Medieval Age+, 12+ player tiles), a skilled wandering
 * mapmaker arrives bearing rolled parchment charts and precision instruments.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🗺️ Commission Imperial Atlas  — pay 30 gold + 25 mana
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +8 morale
 *   📐 Purchase Regional Survey   — pay 20 stone
 *        → +0.2 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.wanderingMapmaker = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalAtlases:        number,
 *   totalSurveys:        number,
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
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Medieval Age+
const MIN_PLAYER_TILES = 12;

export const ATLAS_GOLD_COST           = 30;
export const ATLAS_MANA_COST           = 25;
export const ATLAS_MANA_RATE           = 0.25;
export const ATLAS_PRESTIGE_REWARD     = 22;
export const ATLAS_MORALE_REWARD       = 8;
export const ATLAS_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const SURVEY_STONE_COST         = 20;
export const SURVEY_STONE_RATE         = 0.2;
export const SURVEY_PRESTIGE_REWARD    = 15;
export const SURVEY_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingMapmaker() {
  if (!state.wanderingMapmaker) {
    state.wanderingMapmaker = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalAtlases:    0,
      totalSurveys:    0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingMapmaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalAtlases     === undefined) s.totalAtlases     = 0;
  if (s.totalSurveys     === undefined) s.totalSurveys     = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingMapmakerTick() {
  const a = state.wanderingMapmaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_MAPMAKER_CHANGED, { expired: true });
      addMessage('🗺️ The wandering mapmaker carefully rolls his parchment charts, secures his brass instruments in their padded case, and departs the imperial court to chart unknown territories elsewhere.', 'info');
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
  emit(Events.WANDERING_MAPMAKER_CHANGED, { spawned: true });
  addMessage('🗺️ A skilled wandering mapmaker arrives bearing rolled parchment charts and precision measuring instruments, offering to render the empire\'s territories in magnificent cartographic detail. Respond within 80 seconds.', 'info');
}

export function getActiveMapmaker() { return state.wanderingMapmaker?.active ?? null; }
export function getMapmakerSecsLeft() {
  const a = state.wanderingMapmaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialAtlas() {
  const a = state.wanderingMapmaker;
  if (!a?.active) return { ok: false, reason: 'No mapmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The mapmaker has departed.' };
  if ((state.resources.gold ?? 0) < ATLAS_GOLD_COST) return { ok: false, reason: `Need ${ATLAS_GOLD_COST} gold.` };
  if ((state.resources.mana ?? 0) < ATLAS_MANA_COST) return { ok: false, reason: `Need ${ATLAS_MANA_COST} mana.` };
  state.resources.gold -= ATLAS_GOLD_COST;
  state.resources.mana -= ATLAS_MANA_COST;
  changeMorale(ATLAS_MORALE_REWARD);
  awardPrestige(ATLAS_PRESTIGE_REWARD, 'Commissioned imperial atlas from the wandering mapmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'mapmakerAtlas');
    state.randomEvents.activeModifiers.push({
      id: 'mapmakerAtlas', resource: 'mana',
      rateMult: 1 + (ATLAS_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + ATLAS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalAtlases = (a.totalAtlases ?? 0) + 1;
  emit(Events.WANDERING_MAPMAKER_CHANGED, { atlas: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ The mapmaker produces a breathtaking imperial atlas, unlocking hidden ley lines and mystical meridians that channel arcane energies throughout the realm. The imperial court hails its magnificence! −${ATLAS_GOLD_COST} gold · −${ATLAS_MANA_COST} mana · +${ATLAS_PRESTIGE_REWARD} prestige · +${ATLAS_MORALE_REWARD} morale. Arcane surge: +${ATLAS_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRegionalSurvey() {
  const a = state.wanderingMapmaker;
  if (!a?.active) return { ok: false, reason: 'No mapmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The mapmaker has departed.' };
  if ((state.resources.stone ?? 0) < SURVEY_STONE_COST) return { ok: false, reason: `Need ${SURVEY_STONE_COST} stone.` };
  state.resources.stone -= SURVEY_STONE_COST;
  awardPrestige(SURVEY_PRESTIGE_REWARD, 'Purchased regional survey from the wandering mapmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'mapmakerSurvey');
    state.randomEvents.activeModifiers.push({
      id: 'mapmakerSurvey', resource: 'stone',
      rateMult: 1 + (SURVEY_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + SURVEY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalSurveys = (a.totalSurveys ?? 0) + 1;
  emit(Events.WANDERING_MAPMAKER_CHANGED, { survey: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📐 The mapmaker's regional survey reveals optimal quarry sites and stone deposit formations throughout the empire's territories. Mining teams immediately begin exploiting these newfound reserves! −${SURVEY_STONE_COST} stone · +${SURVEY_PRESTIGE_REWARD} prestige. Quarry surge: +${SURVEY_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMapmakerAway() {
  const a = state.wanderingMapmaker;
  if (!a?.active) return { ok: false, reason: 'No mapmaker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_MAPMAKER_CHANGED, { dismissed: true });
  addMessage('🗺️ The wandering mapmaker bows respectfully, carefully secures his parchment charts, and heads off down the road to chart the territories of distant empires.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
