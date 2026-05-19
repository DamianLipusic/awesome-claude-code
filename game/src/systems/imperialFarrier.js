/**
 * EmpireOS — Imperial Farrier (T328).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a renowned imperial
 * farrier arrives at the court, offering to shoe cavalry horses and share
 * farriery expertise. The player has 80 seconds to decide.
 *
 * Choices:
 *   🐴 Commission Cavalry Horseshoes — pay 25 iron + 15 food
 *        → +0.20 iron/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Purchase Farriery Secrets — pay 25 gold
 *        → +0.15 food/s for 2 min   · +15 prestige
 *   🚶 Send Away               — dismiss (no reward)
 *
 * state.imperialFarrier = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalPurchases:     number,
 *   totalDismissals:    number,
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

export const COMMISSION_IRON_COST          = 25;
export const COMMISSION_FOOD_COST          = 15;
export const COMMISSION_IRON_RATE          = 0.20;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 25;
export const PURCHASE_FOOD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialFarrier() {
  if (!state.imperialFarrier) {
    state.imperialFarrier = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialFarrier;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialFarrierTick() {
  const a = state.imperialFarrier;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_FARRIER_CHANGED, { expired: true });
      addMessage('🐴 The imperial farrier gathers their tools, rasps, and nailing hammers, and departs the imperial stables to seek horses elsewhere.', 'info');
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
  emit(Events.IMPERIAL_FARRIER_CHANGED, { spawned: true });
  addMessage('🐴 A renowned imperial farrier arrives bearing a portable forge and a collection of finely crafted horseshoes. They offer to shoe the cavalry horses or share the secrets of farriery. Respond within 80 seconds.', 'info');
}

export function getActiveImperialFarrier() { return state.imperialFarrier?.active ?? null; }
export function getFarrierSecsLeft() {
  const a = state.imperialFarrier?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCavalryHorseshoes() {
  const a = state.imperialFarrier;
  if (!a?.active) return { ok: false, reason: 'No farrier present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The farrier has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned cavalry horseshoes from the imperial farrier');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'farrierCommission');
    state.randomEvents.activeModifiers.push({
      id: 'farrierCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_FARRIER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🐴 The farrier establishes a permanent smithy near the cavalry stables, crafting precision horseshoes that dramatically improve the speed and endurance of the imperial cavalry! −${COMMISSION_IRON_COST} iron · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseFarrierysSecrets() {
  const a = state.imperialFarrier;
  if (!a?.active) return { ok: false, reason: 'No farrier present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The farrier has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased farriery secrets from the imperial farrier');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'farrierPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'farrierPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_FARRIER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The farrier shares the ancient secrets of hoof care, balanced shoeing, and medicinal poultices. Imperial stablehands apply these techniques across the empire's horse breeding programs, improving livestock health and agricultural output! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFarrierAway() {
  const a = state.imperialFarrier;
  if (!a?.active) return { ok: false, reason: 'No farrier present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_FARRIER_CHANGED, { dismissed: true });
  addMessage('🐴 The imperial farrier respectfully gathers their portable forge and tools and departs to offer their services to other imperial courts.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
