/**
 * EmpireOS — Imperial Courier Master (T466).
 *
 * Every 15–19 minutes (Medieval Age+, 10+ player tiles), an imperial courier
 * master arrives at the settlement bearing a calfskin satchel packed with
 * sealed route-ledgers — each one listing the relay stations, estimated
 * transit times, and toll-gate arrangements along one of the major imperial
 * post roads — and a folded copy of the most current courier-route atlas
 * showing how the seven great roads converge on the capital in a wheel-spoke
 * pattern, with branch spurs connecting every provincial town to the nearest
 * trunk route within two days' ride — offering to establish a full courier
 * relay network connecting the settlement into the empire's postal system, or
 * to sell a set of the official route charts that the settlement's own
 * messengers can use to navigate between provinces without a guide. The player
 * has 80 seconds to decide.
 *
 * Choices:
 *   📯 Establish Courier Network  — pay 25 mana + 20 gold
 *        → +0.22 mana/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Purchase Route Charts      — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.imperialCourierMaster = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalEstablished:    number,
 *   totalPurchases:      number,
 *   totalDismissals:     number,
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

export const ESTABLISH_MANA_COST            = 25;
export const ESTABLISH_GOLD_COST            = 20;
export const ESTABLISH_MANA_RATE            = 0.22;
export const ESTABLISH_PRESTIGE_REWARD      = 22;
export const ESTABLISH_MORALE_REWARD        = 12;
export const ESTABLISH_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST            = 20;
export const PURCHASE_STONE_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD       = 15;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialCourierMaster() {
  if (!state.imperialCourierMaster) {
    state.imperialCourierMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalEstablished: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialCourierMaster;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalEstablished   === undefined) s.totalEstablished   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialCourierMasterTick() {
  const a = state.imperialCourierMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_COURIER_MASTER_CHANGED, { expired: true });
      addMessage('📯 The imperial courier master seals the route-ledgers back into the calfskin satchel, buckles the strap with practised efficiency, and sets off down the post road at the measured trot of a man accustomed to covering thirty miles before dark.', 'info');
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
  emit(Events.IMPERIAL_COURIER_MASTER_CHANGED, { spawned: true });
  addMessage('📯 An imperial courier master arrives at the settlement bearing a calfskin satchel packed with sealed route-ledgers and a folded copy of the official courier-route atlas — the seven great post roads converging on the capital in a wheel-spoke pattern, with branch spurs connecting every provincial town to the nearest trunk route within two days\' ride. The master offers to establish a full relay network connecting this settlement into the empire\'s postal system, or to sell a set of the official route charts for the settlement\'s own messengers. Respond within 80 seconds.', 'info');
}

export function getActiveImperialCourierMaster() { return state.imperialCourierMaster?.active ?? null; }
export function getCourierMasterSecsLeft() {
  const a = state.imperialCourierMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishCourierNetwork() {
  const a = state.imperialCourierMaster;
  if (!a?.active) return { ok: false, reason: 'No courier master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The courier master has departed.' };
  if ((state.resources.mana ?? 0) < ESTABLISH_MANA_COST) return { ok: false, reason: `Need ${ESTABLISH_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < ESTABLISH_GOLD_COST) return { ok: false, reason: `Need ${ESTABLISH_GOLD_COST} gold.` };
  state.resources.mana -= ESTABLISH_MANA_COST;
  state.resources.gold -= ESTABLISH_GOLD_COST;
  changeMorale(ESTABLISH_MORALE_REWARD);
  awardPrestige(ESTABLISH_PRESTIGE_REWARD, 'Established a courier network with the imperial courier master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'courierMasterEstablish');
    state.randomEvents.activeModifiers.push({
      id: 'courierMasterEstablish', resource: 'mana',
      rateMult: 1 + (ESTABLISH_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + ESTABLISH_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalEstablished = (a.totalEstablished ?? 0) + 1;
  emit(Events.IMPERIAL_COURIER_MASTER_CHANGED, { established: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📯 The courier master opens the route-ledgers across the council table and marks the settlement's position on the atlas with a small red circle — then traces the nearest trunk road with a fingertip, showing where a relay station should stand at the six-mile post: a stone stable block with a covered well, a tack room stocked with spare harness and saddle-pads, and a sealed lockbox for official correspondence requiring an authorised seal to open. The master dictates the station-keeper's duties — the roster of horses always saddled and ready, the incoming-pouch log that must record the seal number of every packet that passes through, the maintenance schedule for the road surface between this station and the next — and witnesses the settlement register its first outbound route entry in the imperial dispatch ledger, rubber-stamping the page with the red wax seal of the courier service. −${ESTABLISH_MANA_COST} mana −${ESTABLISH_GOLD_COST} gold · +${ESTABLISH_PRESTIGE_REWARD} prestige · +${ESTABLISH_MORALE_REWARD} morale. Mana surge: +${ESTABLISH_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRouteCharts() {
  const a = state.imperialCourierMaster;
  if (!a?.active) return { ok: false, reason: 'No courier master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The courier master has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased route charts from the imperial courier master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'courierMasterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'courierMasterPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_COURIER_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The courier master unrolls three charts on the table — each one a section of the imperial route atlas rendered at a scale of one inch to the mile on stiff linen-backed paper, the post roads inked in red with mileage figures at every change of direction and the relay stations marked as small horse-head symbols. The town names are written in two scripts: the formal imperial Roman letters used on official correspondence, and the local vernacular spellings used by the district porters who have never learned to read Latin. A supplementary sheet lists the unofficial short cuts known to experienced riders — the drovers' tracks across the upland moors that cut four miles off the long road around the escarpment; the ford that is safe in summer and impassable from October to March; the three inns whose landlords are licensed to accept official correspondence for forwarding. −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCourierMasterAway() {
  const a = state.imperialCourierMaster;
  if (!a?.active) return { ok: false, reason: 'No courier master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_COURIER_MASTER_CHANGED, { dismissed: true });
  addMessage('📯 The imperial courier master seals the route-ledgers back into the calfskin satchel, buckles the strap with practised efficiency, and sets off down the post road at the measured trot of a man accustomed to covering thirty miles before dark.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
