/**
 * EmpireOS — Wandering Shipwright (T291).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a master shipwright
 * arrives bearing advanced naval blueprints, hull designs, and maritime
 * engineering secrets. The player has 80 seconds to decide.
 *
 * Choices:
 *   ⚓ Commission War Galleys   — pay 30 wood + 20 iron
 *        → +0.22 wood/s for 2.5 min · +25 prestige · +10 morale
 *   📜 Purchase Naval Expertise — pay 25 gold
 *        → +0.15 iron/s for 2 min · +18 prestige
 *   👋 Send Away                — dismiss (no reward)
 *
 * state.wanderingShipwright = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissions: number,
 *   totalPurchases:   number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_WOOD_COST       = 30;
export const COMMISSION_IRON_COST       = 20;
export const COMMISSION_WOOD_RATE       = 0.22;
export const COMMISSION_PRESTIGE_REWARD = 25;
export const COMMISSION_MORALE_REWARD   = 10;
export const COMMISSION_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST         = 25;
export const PURCHASE_IRON_RATE         = 0.15;
export const PURCHASE_PRESTIGE_REWARD   = 18;
export const PURCHASE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingShipwright() {
  if (!state.wanderingShipwright) {
    state.wanderingShipwright = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  if (state.wanderingShipwright.nextSpawnTick   === undefined) state.wanderingShipwright.nextSpawnTick   = _nextSpawnTick();
  if (state.wanderingShipwright.totalVisits     === undefined) state.wanderingShipwright.totalVisits     = 0;
  if (state.wanderingShipwright.totalCommissions === undefined) state.wanderingShipwright.totalCommissions = 0;
  if (state.wanderingShipwright.totalPurchases  === undefined) state.wanderingShipwright.totalPurchases  = 0;
  if (state.wanderingShipwright.totalDismissals === undefined) state.wanderingShipwright.totalDismissals = 0;
}

export function wanderingShipwrightTick() {
  const ws = state.wanderingShipwright;
  if (!ws) return;
  if (ws.active) {
    if (state.tick >= ws.active.expiresAt) {
      ws.active = null; ws.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SHIPWRIGHT_CHANGED, { expired: true });
      addMessage('⚓ The wandering shipwright packs their blueprints and sails off to distant shores, their naval expertise departing with the tide.', 'info');
    }
    return;
  }
  if (state.tick < ws.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  ws.active      = { expiresAt: state.tick + WINDOW_TICKS };
  ws.totalVisits = (ws.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_SHIPWRIGHT_CHANGED, { spawned: true });
  addMessage('⚓ A seasoned wandering shipwright arrives at the imperial docks, their calloused hands bearing advanced hull designs and maritime engineering secrets that could transform the empire\'s naval power. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingShipwright() { return state.wanderingShipwright?.active ?? null; }
export function getShipwrightSecsLeft() {
  const a = state.wanderingShipwright?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionWarGalleys() {
  const ws = state.wanderingShipwright;
  if (!ws?.active) return { ok: false, reason: 'No shipwright present.' };
  if (state.tick >= ws.active.expiresAt) return { ok: false, reason: 'The shipwright has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.iron -= COMMISSION_IRON_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned war galleys from a wandering shipwright');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'shipwrightGalleys');
    state.randomEvents.activeModifiers.push({
      id: 'shipwrightGalleys', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  ws.active = null; ws.nextSpawnTick = _nextSpawnTick(); ws.totalCommissions = (ws.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_SHIPWRIGHT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚓ Imperial war galleys take shape at the docks, their construction driving a surge in timber demand and woodworking expertise! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_IRON_COST} iron · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Timber surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseNavalExpertise() {
  const ws = state.wanderingShipwright;
  if (!ws?.active) return { ok: false, reason: 'No shipwright present.' };
  if (state.tick >= ws.active.expiresAt) return { ok: false, reason: 'The shipwright has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased naval expertise from a wandering shipwright');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'shipwrightNaval');
    state.randomEvents.activeModifiers.push({
      id: 'shipwrightNaval', resource: 'iron',
      rateMult: 1 + (PURCHASE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  ws.active = null; ws.nextSpawnTick = _nextSpawnTick(); ws.totalPurchases = (ws.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_SHIPWRIGHT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 Advanced naval blueprints reveal innovative iron-reinforced hull techniques, boosting the empire's metallurgical output! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Iron surge: +${PURCHASE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendShipwrightAway() {
  const ws = state.wanderingShipwright;
  if (!ws?.active) return { ok: false, reason: 'No shipwright present.' };
  ws.active = null; ws.nextSpawnTick = _nextSpawnTick(); ws.totalDismissals = (ws.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SHIPWRIGHT_CHANGED, { dismissed: true });
  addMessage('⚓ The wandering shipwright is thanked and sails off to seek other imperial commissions beyond the horizon.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
