/**
 * EmpireOS — Imperial Chariot Builder (T426).
 *
 * Every 13–18 minutes (Bronze Age+, 8+ player tiles), an imperial chariot
 * builder arrives at the palace stable-yard carrying a set of finished
 * bent-wood wheel rims soaked and shaped to exact radius on a heated form,
 * spoke blanks split from straight-grained elm and dressed to a uniform
 * taper, bronze-bushed wheel hubs with pre-drilled spoke mortises, a
 * lightweight wicker-sided fighting platform fitted to a bronze axle bar,
 * and a set of joinery templates for cutting the pole, yoke, and floor-
 * frame joints that attach the car body to the running gear — offering to
 * commission a full fleet of war chariots for the palace cavalry and
 * chariot-archer corps, or to purchase the chariot-building designs and
 * joinery templates that allow every palace workshop to produce fighting
 * vehicles from the empire's existing stocks of seasoned wood and iron.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🏇 Commission War Chariots       — pay 25 wood + 20 iron
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +12 morale
 *   📖 Purchase Chariot Designs      — pay 20 gold
 *        → +0.18 gold/s for 2 min · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.imperialChariotBuilder = {
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
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_WOOD_COST          = 25;
export const COMMISSION_IRON_COST          = 20;
export const COMMISSION_IRON_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 20;
export const PURCHASE_GOLD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialChariotBuilder() {
  if (!state.imperialChariotBuilder) {
    state.imperialChariotBuilder = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialChariotBuilder;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialChariotBuilderTick() {
  const a = state.imperialChariotBuilder;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_CHARIOT_BUILDER_CHANGED, { expired: true });
      addMessage('🏇 The imperial chariot builder packs the wheel-rim forms, spoke blanks, and joinery templates back into the cart, covers the bronze wheel hubs with oiled cloth, and departs the palace stable-yard — the rattle of the loaded cart and smell of wheel-grease fading as the builder rounds the corner past the garrison forge.', 'info');
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
  emit(Events.IMPERIAL_CHARIOT_BUILDER_CHANGED, { spawned: true });
  addMessage('🏇 An imperial chariot builder arrives at the palace stable-yard carrying bent-wood wheel rims soaked and shaped to exact radius, spoke blanks split from straight-grained elm, bronze-bushed wheel hubs with pre-drilled spoke mortises, a lightweight wicker-sided fighting platform fitted to a bronze axle bar, and joinery templates for the pole, yoke, and floor-frame joints — offering to commission a full fleet of war chariots for the palace cavalry and chariot-archer corps, or to share the chariot-building designs and joinery templates that allow every workshop to produce fighting vehicles from existing stocks. Respond within 80 seconds.', 'info');
}

export function getActiveImperialChariotBuilder() { return state.imperialChariotBuilder?.active ?? null; }
export function getChariotBuilderSecsLeft() {
  const a = state.imperialChariotBuilder?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionWarChariots() {
  const a = state.imperialChariotBuilder;
  if (!a?.active) return { ok: false, reason: 'No chariot builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The chariot builder has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.iron -= COMMISSION_IRON_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned war chariots from the imperial chariot builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'chariotBuilderCommission');
    state.randomEvents.activeModifiers.push({
      id: 'chariotBuilderCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_CHARIOT_BUILDER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏇 The chariot builder selects the straightest elm planks from the palace timber store, soaks the wheel-rim strips in the heated forming trough until they bend without splitting, shapes each rim around the radius form and holds it with iron clamps until it sets perfectly round, drives the tapered spokes into the hub mortises with measured mallet blows, fits the bronze axle bushing to a smooth running clearance, builds the wicker fighting platform over the lightweight ash floor-frame, and delivers the completed war chariots to the palace cavalry commander and chariot-archer corps — the swift, manoeuvrable fighting vehicles immediately strengthening the empire's mobile strike capacity and reconnaissance reach across the frontier! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_IRON_COST} iron · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseChariotDesigns() {
  const a = state.imperialChariotBuilder;
  if (!a?.active) return { ok: false, reason: 'No chariot builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The chariot builder has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased chariot designs from the imperial chariot builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'chariotBuilderPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'chariotBuilderPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_CHARIOT_BUILDER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The chariot builder hands over the full set of joinery templates — the rim-soaking time guide for wood of different thicknesses, the spoke-taper proportions that produce the ideal balance between strength and weight, the hub-bushing clearance tolerance that allows smooth running without excessive play on the axle, the floor-frame joint angles that prevent racking under combat loads, and the wicker-side weaving pattern that produces a strong yet lightweight fighting platform — designs and templates that allow every palace workshop carpenter and smith to build well-fitted war chariots from standard seasoned-wood and iron stock without specialist supervision! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendChariotBuilderAway() {
  const a = state.imperialChariotBuilder;
  if (!a?.active) return { ok: false, reason: 'No chariot builder present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_CHARIOT_BUILDER_CHANGED, { dismissed: true });
  addMessage('🏇 The imperial chariot builder packs the wheel-rim forms, spoke blanks, and joinery templates back into the cart and departs the palace stable-yard — bowing respectfully before the laden cart rolls away through the garrison gate.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
