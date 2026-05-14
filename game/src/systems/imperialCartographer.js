/**
 * EmpireOS — Imperial Cartographer (T272).
 *
 * Every 14–19 minutes (Bronze Age+, 10+ player tiles), a renowned imperial
 * cartographer arrives to chart the realm's borders and share geographic
 * knowledge. The player has 80 seconds to decide.
 *
 * Choices:
 *   🗺️ Commission Survey         — pay 35 gold
 *        → +0.15 stone/s for 2.5 min + 20 prestige
 *   📜 Exchange Techniques       — pay 20 mana
 *        → +25 prestige + 10 morale
 *   👋 Bid Farewell              — dismiss (no reward)
 *
 * state.imperialCartographer = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalSurveys:     number,
 *   totalExchanges:   number,
 *   totalDismissals:  number,
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
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 10;

export const SURVEY_GOLD_COST          = 35;
export const SURVEY_STONE_RATE         = 0.15;
export const SURVEY_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);
export const SURVEY_PRESTIGE_REWARD    = 20;

export const EXCHANGE_MANA_COST        = 20;
export const EXCHANGE_PRESTIGE_REWARD  = 25;
export const EXCHANGE_MORALE_REWARD    = 10;

export function initImperialCartographer() {
  if (!state.imperialCartographer) {
    state.imperialCartographer = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalSurveys:    0,
      totalExchanges:  0,
      totalDismissals: 0,
    };
  }
  if (state.imperialCartographer.nextSpawnTick   === undefined) state.imperialCartographer.nextSpawnTick   = _nextSpawnTick();
  if (state.imperialCartographer.totalVisits     === undefined) state.imperialCartographer.totalVisits     = 0;
  if (state.imperialCartographer.totalSurveys    === undefined) state.imperialCartographer.totalSurveys    = 0;
  if (state.imperialCartographer.totalExchanges  === undefined) state.imperialCartographer.totalExchanges  = 0;
  if (state.imperialCartographer.totalDismissals === undefined) state.imperialCartographer.totalDismissals = 0;
}

export function imperialCartographerTick() {
  const ic = state.imperialCartographer;
  if (!ic) return;
  if (ic.active) {
    if (state.tick >= ic.active.expiresAt) {
      ic.active = null; ic.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_CARTOGRAPHER_CHANGED, { expired: true });
      addMessage('🗺️ The imperial cartographer packs their instruments and departs without a commission.', 'info');
    }
    return;
  }
  if (state.tick < ic.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  ic.active      = { expiresAt: state.tick + WINDOW_TICKS };
  ic.totalVisits = (ic.totalVisits ?? 0) + 1;
  emit(Events.IMPERIAL_CARTOGRAPHER_CHANGED, { spawned: true });
  addMessage('🗺️ A renowned imperial cartographer has arrived bearing precise survey instruments and maps of surrounding territories. Their knowledge of the land could prove invaluable. Respond within 80 seconds.', 'info');
}

export function getActiveImperialCartographer() { return state.imperialCartographer?.active ?? null; }
export function getCartographerSecsLeft() {
  const a = state.imperialCartographer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCartographerSurvey() {
  const ic = state.imperialCartographer;
  if (!ic?.active) return { ok: false, reason: 'No cartographer present.' };
  if (state.tick >= ic.active.expiresAt) return { ok: false, reason: 'The cartographer has departed.' };
  if ((state.resources.gold ?? 0) < SURVEY_GOLD_COST) return { ok: false, reason: `Need ${SURVEY_GOLD_COST} gold.` };
  state.resources.gold -= SURVEY_GOLD_COST;
  awardPrestige(SURVEY_PRESTIGE_REWARD, 'Commissioned a cartographic survey of imperial lands');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartographerSurvey');
    state.randomEvents.activeModifiers.push({
      id: 'cartographerSurvey', resource: 'stone',
      rateMult: 1 + (SURVEY_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + SURVEY_DURATION_TICKS,
    });
  }
  ic.active = null; ic.nextSpawnTick = _nextSpawnTick(); ic.totalSurveys = (ic.totalSurveys ?? 0) + 1;
  emit(Events.IMPERIAL_CARTOGRAPHER_CHANGED, { surveyed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ The cartographer surveys imperial lands, revealing optimal quarry sites across the realm! +${SURVEY_PRESTIGE_REWARD} prestige. Stone extraction improves: +${SURVEY_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeCartographicTechniques() {
  const ic = state.imperialCartographer;
  if (!ic?.active) return { ok: false, reason: 'No cartographer present.' };
  if (state.tick >= ic.active.expiresAt) return { ok: false, reason: 'The cartographer has departed.' };
  if ((state.resources.mana ?? 0) < EXCHANGE_MANA_COST) return { ok: false, reason: `Need ${EXCHANGE_MANA_COST} mana.` };
  state.resources.mana -= EXCHANGE_MANA_COST;
  changeMorale(EXCHANGE_MORALE_REWARD);
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged cartographic techniques with an imperial cartographer');
  ic.active = null; ic.nextSpawnTick = _nextSpawnTick(); ic.totalExchanges = (ic.totalExchanges ?? 0) + 1;
  emit(Events.IMPERIAL_CARTOGRAPHER_CHANGED, { exchanged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The empire shares arcane geographic knowledge with the cartographer, receiving refined surveying techniques in return! +${EXCHANGE_PRESTIGE_REWARD} prestige · +${EXCHANGE_MORALE_REWARD} morale. The scholars are delighted.`, 'windfall');
  return { ok: true };
}

export function bidCartographerFarewell() {
  const ic = state.imperialCartographer;
  if (!ic?.active) return { ok: false, reason: 'No cartographer present.' };
  ic.active = null; ic.nextSpawnTick = _nextSpawnTick(); ic.totalDismissals = (ic.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_CARTOGRAPHER_CHANGED, { dismissed: true });
  addMessage('🗺️ The imperial cartographer thanks the court for their time and sets off to chart new horizons.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
