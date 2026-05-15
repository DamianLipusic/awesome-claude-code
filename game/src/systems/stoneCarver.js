/**
 * EmpireOS — Stone Carver (T284).
 *
 * Every 14–19 minutes (Iron Age+, 10+ player tiles), a master stone carver
 * arrives with chisels and pattern books to offer their craft to the empire.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🗿 Commission Imperial Reliefs — pay 30 stone + 20 gold
 *        → +0.15 stone/s for 2.5 min · +28 prestige · +10 morale
 *   ⛏️ Exchange Carving Techniques — pay 15 iron
 *        → +0.12 iron/s for 2 min · +18 prestige
 *   👋 Send Away                   — dismiss (no reward)
 *
 * state.stoneCarver = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
 *   totalExchanges:      number,
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
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_STONE_COST      = 30;
export const COMMISSION_GOLD_COST       = 20;
export const COMMISSION_STONE_RATE      = 0.15;
export const COMMISSION_PRESTIGE_REWARD = 28;
export const COMMISSION_MORALE_REWARD   = 10;
export const COMMISSION_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_IRON_COST         = 15;
export const EXCHANGE_IRON_RATE         = 0.12;
export const EXCHANGE_PRESTIGE_REWARD   = 18;
export const EXCHANGE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initStoneCarver() {
  if (!state.stoneCarver) {
    state.stoneCarver = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalExchanges:   0,
      totalDismissals:  0,
    };
  }
  if (state.stoneCarver.nextSpawnTick    === undefined) state.stoneCarver.nextSpawnTick    = _nextSpawnTick();
  if (state.stoneCarver.totalVisits      === undefined) state.stoneCarver.totalVisits      = 0;
  if (state.stoneCarver.totalCommissions === undefined) state.stoneCarver.totalCommissions = 0;
  if (state.stoneCarver.totalExchanges   === undefined) state.stoneCarver.totalExchanges   = 0;
  if (state.stoneCarver.totalDismissals  === undefined) state.stoneCarver.totalDismissals  = 0;
}

export function stoneCarverTick() {
  const sc = state.stoneCarver;
  if (!sc) return;
  if (sc.active) {
    if (state.tick >= sc.active.expiresAt) {
      sc.active = null; sc.nextSpawnTick = _nextSpawnTick();
      emit(Events.STONE_CARVER_CHANGED, { expired: true });
      addMessage('🗿 The stone carver packs their chisels and departs to seek other patrons.', 'info');
    }
    return;
  }
  if (state.tick < sc.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  sc.active     = { expiresAt: state.tick + WINDOW_TICKS };
  sc.totalVisits = (sc.totalVisits ?? 0) + 1;
  emit(Events.STONE_CARVER_CHANGED, { spawned: true });
  addMessage('🗿 A master stone carver renowned for imperial reliefs and decorative stonework has arrived, offering to immortalize the empire\'s glory in stone. Respond within 75 seconds.', 'info');
}

export function getActiveStoneCarver() { return state.stoneCarver?.active ?? null; }
export function getCarverSecsLeft() {
  const a = state.stoneCarver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialReliefs() {
  const sc = state.stoneCarver;
  if (!sc?.active) return { ok: false, reason: 'No stone carver present.' };
  if (state.tick >= sc.active.expiresAt) return { ok: false, reason: 'The stone carver has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold  ?? 0) < COMMISSION_GOLD_COST)  return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial reliefs from a master stone carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'carverReliefs');
    state.randomEvents.activeModifiers.push({
      id: 'carverReliefs', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  sc.active = null; sc.nextSpawnTick = _nextSpawnTick(); sc.totalCommissions = (sc.totalCommissions ?? 0) + 1;
  emit(Events.STONE_CARVER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗿 Magnificent relief carvings adorn the imperial walls, inspiring quarry workers to new heights! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone mastery: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeCarvingTechniques() {
  const sc = state.stoneCarver;
  if (!sc?.active) return { ok: false, reason: 'No stone carver present.' };
  if (state.tick >= sc.active.expiresAt) return { ok: false, reason: 'The stone carver has departed.' };
  if ((state.resources.iron ?? 0) < EXCHANGE_IRON_COST) return { ok: false, reason: `Need ${EXCHANGE_IRON_COST} iron.` };
  state.resources.iron -= EXCHANGE_IRON_COST;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged carving techniques with a master stone carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'carverTechniques');
    state.randomEvents.activeModifiers.push({
      id: 'carverTechniques', resource: 'iron',
      rateMult: 1 + (EXCHANGE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  sc.active = null; sc.nextSpawnTick = _nextSpawnTick(); sc.totalExchanges = (sc.totalExchanges ?? 0) + 1;
  emit(Events.STONE_CARVER_CHANGED, { exchange: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⛏️ Precision stonecutting techniques inspire imperial miners to extract metal with newfound expertise! −${EXCHANGE_IRON_COST} iron · +${EXCHANGE_PRESTIGE_REWARD} prestige. Iron efficiency: +${EXCHANGE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendStoneCarverAway() {
  const sc = state.stoneCarver;
  if (!sc?.active) return { ok: false, reason: 'No stone carver present.' };
  sc.active = null; sc.nextSpawnTick = _nextSpawnTick(); sc.totalDismissals = (sc.totalDismissals ?? 0) + 1;
  emit(Events.STONE_CARVER_CHANGED, { dismissed: true });
  addMessage('🗿 The stone carver is politely thanked and departs to seek worthy commissions elsewhere.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
