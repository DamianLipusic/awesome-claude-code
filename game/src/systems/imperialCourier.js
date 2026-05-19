/**
 * EmpireOS — Imperial Courier (T334).
 *
 * Every 15–19 minutes (Medieval Age+, 10+ player tiles), an experienced imperial
 * courier arrives bearing sealed dispatches, route maps, and offers to establish
 * fast messenger networks across the realm. The player has 80 seconds to decide.
 *
 * Choices:
 *   📮 Establish Postal Routes — pay 30 gold
 *        → +0.22 gold/s for 2.5 min · +22 prestige · +10 morale
 *   🔮 Exchange Intelligence Packets — pay 25 mana
 *        → +0.18 mana/s for 2 min   · +15 prestige
 *   🚶 Send Away              — dismiss (no reward)
 *
 * state.imperialCourier = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalEstablished:   number,
 *   totalExchanges:     number,
 *   totalDismissals:    number,
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
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const ESTABLISH_GOLD_COST           = 30;
export const ESTABLISH_GOLD_RATE           = 0.22;
export const ESTABLISH_PRESTIGE_REWARD     = 22;
export const ESTABLISH_MORALE_REWARD       = 10;
export const ESTABLISH_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_MANA_COST            = 25;
export const EXCHANGE_MANA_RATE            = 0.18;
export const EXCHANGE_PRESTIGE_REWARD      = 15;
export const EXCHANGE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialCourier() {
  if (!state.imperialCourier) {
    state.imperialCourier = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalEstablished: 0,
      totalExchanges:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialCourier;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalEstablished === undefined) s.totalEstablished = 0;
  if (s.totalExchanges   === undefined) s.totalExchanges   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialCourierTick() {
  const a = state.imperialCourier;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_COURIER_CHANGED, { expired: true });
      addMessage('📮 The imperial courier seals their dispatches, mounts a fresh horse, and departs to carry messages to distant settlements before the day is out.', 'info');
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
  emit(Events.IMPERIAL_COURIER_CHANGED, { spawned: true });
  addMessage('📮 An experienced imperial courier arrives at the palace bearing sealed diplomatic dispatches, route maps for new postal roads, and offers to establish a swift messenger network connecting all corners of the realm. Respond within 80 seconds.', 'info');
}

export function getActiveImperialCourier() { return state.imperialCourier?.active ?? null; }
export function getCourierSecsLeft() {
  const a = state.imperialCourier?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishPostalRoutes() {
  const a = state.imperialCourier;
  if (!a?.active) return { ok: false, reason: 'No courier present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The courier has departed.' };
  if ((state.resources.gold ?? 0) < ESTABLISH_GOLD_COST) return { ok: false, reason: `Need ${ESTABLISH_GOLD_COST} gold.` };
  state.resources.gold -= ESTABLISH_GOLD_COST;
  changeMorale(ESTABLISH_MORALE_REWARD);
  awardPrestige(ESTABLISH_PRESTIGE_REWARD, 'Established postal routes with the imperial courier');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'courierEstablish');
    state.randomEvents.activeModifiers.push({
      id: 'courierEstablish', resource: 'gold',
      rateMult: 1 + (ESTABLISH_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + ESTABLISH_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalEstablished = (a.totalEstablished ?? 0) + 1;
  emit(Events.IMPERIAL_COURIER_CHANGED, { established: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📮 The courier organises a network of relay stations, fresh horses, and trained riders throughout the empire. Messages travel faster, merchants coordinate better, and trade flourishes across all imperial territories! −${ESTABLISH_GOLD_COST} gold · +${ESTABLISH_PRESTIGE_REWARD} prestige · +${ESTABLISH_MORALE_REWARD} morale. Gold surge: +${ESTABLISH_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeIntelligencePackets() {
  const a = state.imperialCourier;
  if (!a?.active) return { ok: false, reason: 'No courier present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The courier has departed.' };
  if ((state.resources.mana ?? 0) < EXCHANGE_MANA_COST) return { ok: false, reason: `Need ${EXCHANGE_MANA_COST} mana.` };
  state.resources.mana -= EXCHANGE_MANA_COST;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged intelligence packets with the imperial courier');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'courierExchange');
    state.randomEvents.activeModifiers.push({
      id: 'courierExchange', resource: 'mana',
      rateMult: 1 + (EXCHANGE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalExchanges = (a.totalExchanges ?? 0) + 1;
  emit(Events.IMPERIAL_COURIER_CHANGED, { exchanged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔮 The courier delivers encrypted intelligence packets containing trade secrets, arcane research notes, and foreign court intelligence. Imperial scholars decode and apply this knowledge, accelerating the empire's arcane advancement! −${EXCHANGE_MANA_COST} mana · +${EXCHANGE_PRESTIGE_REWARD} prestige. Mana surge: +${EXCHANGE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCourierAway() {
  const a = state.imperialCourier;
  if (!a?.active) return { ok: false, reason: 'No courier present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_COURIER_CHANGED, { dismissed: true });
  addMessage('📮 The imperial courier bows, mounts their horse, and rides swiftly away toward the next posting station on their appointed rounds.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
