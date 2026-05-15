/**
 * EmpireOS — Royal Astronomer (T286).
 *
 * Every 16–21 minutes (Medieval Age+, 12+ player tiles), a celebrated royal
 * astronomer arrives bearing telescopes and star charts to offer the empire the
 * wisdom of the heavens. The player has 80 seconds to decide.
 *
 * Choices:
 *   🔭 Commission Sky Survey   — pay 35 mana
 *        → +0.3 mana/s for 2.5 min · +25 prestige
 *   📚 Purchase Star Almanac  — pay 30 gold
 *        → +0.15 gold/s for 2 min · +20 prestige
 *   👋 Send Away               — dismiss (no reward)
 *
 * state.royalAstronomer = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalSurveys:      number,
 *   totalAlmanacs:     number,
 *   totalDismissals:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 16 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 12;

export const SURVEY_MANA_COST          = 35;
export const SURVEY_MANA_RATE          = 0.3;
export const SURVEY_PRESTIGE_REWARD    = 25;
export const SURVEY_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const ALMANAC_GOLD_COST         = 30;
export const ALMANAC_GOLD_RATE         = 0.15;
export const ALMANAC_PRESTIGE_REWARD   = 20;
export const ALMANAC_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initRoyalAstronomer() {
  if (!state.royalAstronomer) {
    state.royalAstronomer = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalSurveys:     0,
      totalAlmanacs:    0,
      totalDismissals:  0,
    };
  }
  if (state.royalAstronomer.nextSpawnTick   === undefined) state.royalAstronomer.nextSpawnTick   = _nextSpawnTick();
  if (state.royalAstronomer.totalVisits     === undefined) state.royalAstronomer.totalVisits     = 0;
  if (state.royalAstronomer.totalSurveys    === undefined) state.royalAstronomer.totalSurveys    = 0;
  if (state.royalAstronomer.totalAlmanacs   === undefined) state.royalAstronomer.totalAlmanacs   = 0;
  if (state.royalAstronomer.totalDismissals === undefined) state.royalAstronomer.totalDismissals = 0;
}

export function royalAstronomerTick() {
  const ra = state.royalAstronomer;
  if (!ra) return;
  if (ra.active) {
    if (state.tick >= ra.active.expiresAt) {
      ra.active = null; ra.nextSpawnTick = _nextSpawnTick();
      emit(Events.ROYAL_ASTRONOMER_CHANGED, { expired: true });
      addMessage('🔭 The royal astronomer rolls up their star charts and departs to observe from distant peaks.', 'info');
    }
    return;
  }
  if (state.tick < ra.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  ra.active      = { expiresAt: state.tick + WINDOW_TICKS };
  ra.totalVisits = (ra.totalVisits ?? 0) + 1;
  emit(Events.ROYAL_ASTRONOMER_CHANGED, { spawned: true });
  addMessage('🔭 A celebrated royal astronomer arrives bearing gilded telescopes and meticulously charted star maps, offering the wisdom of the heavens to guide your empire\'s fate. Respond within 80 seconds.', 'info');
}

export function getActiveRoyalAstronomer() { return state.royalAstronomer?.active ?? null; }
export function getAstronomerSecsLeft() {
  const a = state.royalAstronomer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionSkySurvey() {
  const ra = state.royalAstronomer;
  if (!ra?.active) return { ok: false, reason: 'No astronomer present.' };
  if (state.tick >= ra.active.expiresAt) return { ok: false, reason: 'The astronomer has departed.' };
  if ((state.resources.mana ?? 0) < SURVEY_MANA_COST) return { ok: false, reason: `Need ${SURVEY_MANA_COST} mana.` };
  state.resources.mana -= SURVEY_MANA_COST;
  awardPrestige(SURVEY_PRESTIGE_REWARD, 'Commissioned a celestial sky survey from the royal astronomer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'astronomerSurvey');
    state.randomEvents.activeModifiers.push({
      id: 'astronomerSurvey', resource: 'mana',
      rateMult: 1 + (SURVEY_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + SURVEY_DURATION_TICKS,
    });
  }
  ra.active = null; ra.nextSpawnTick = _nextSpawnTick(); ra.totalSurveys = (ra.totalSurveys ?? 0) + 1;
  emit(Events.ROYAL_ASTRONOMER_CHANGED, { survey: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔭 Meticulous sky surveys reveal hidden celestial currents, amplifying arcane energies across the empire! −${SURVEY_MANA_COST} mana · +${SURVEY_PRESTIGE_REWARD} prestige. Arcane flow: +${SURVEY_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseStarAlmanac() {
  const ra = state.royalAstronomer;
  if (!ra?.active) return { ok: false, reason: 'No astronomer present.' };
  if (state.tick >= ra.active.expiresAt) return { ok: false, reason: 'The astronomer has departed.' };
  if ((state.resources.gold ?? 0) < ALMANAC_GOLD_COST) return { ok: false, reason: `Need ${ALMANAC_GOLD_COST} gold.` };
  state.resources.gold -= ALMANAC_GOLD_COST;
  awardPrestige(ALMANAC_PRESTIGE_REWARD, 'Purchased a star almanac from the royal astronomer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'astronomerAlmanac');
    state.randomEvents.activeModifiers.push({
      id: 'astronomerAlmanac', resource: 'gold',
      rateMult: 1 + (ALMANAC_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + ALMANAC_DURATION_TICKS,
    });
  }
  ra.active = null; ra.nextSpawnTick = _nextSpawnTick(); ra.totalAlmanacs = (ra.totalAlmanacs ?? 0) + 1;
  emit(Events.ROYAL_ASTRONOMER_CHANGED, { almanac: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📚 The star almanac guides imperial merchants to trade on auspicious dates, multiplying treasury revenues! −${ALMANAC_GOLD_COST} gold · +${ALMANAC_PRESTIGE_REWARD} prestige. Trade fortune: +${ALMANAC_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendAstronomerAway() {
  const ra = state.royalAstronomer;
  if (!ra?.active) return { ok: false, reason: 'No astronomer present.' };
  ra.active = null; ra.nextSpawnTick = _nextSpawnTick(); ra.totalDismissals = (ra.totalDismissals ?? 0) + 1;
  emit(Events.ROYAL_ASTRONOMER_CHANGED, { dismissed: true });
  addMessage('🔭 The royal astronomer is graciously thanked and sets off to chart the skies from a distant mountaintop.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
