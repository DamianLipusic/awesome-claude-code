/**
 * EmpireOS — Wandering Soap Maker (T367).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering soap maker
 * arrives at the imperial gates with fragrant oils, ash lye, and herbal blends,
 * offering to set up soap works or sell artisan soaps. The player has 80 seconds
 * to decide.
 *
 * Choices:
 *   🧼 Commission Imperial Soap Works — pay 20 food + 15 wood
 *        → +0.20 food/s for 2.5 min · +15 prestige · +10 morale
 *   🌿 Purchase Aromatic Soaps        — pay 18 gold
 *        → +0.15 gold/s for 2 min   · +10 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.wanderingSoapMaker = {
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST          = 20;
export const COMMISSION_WOOD_COST          = 15;
export const COMMISSION_FOOD_RATE          = 0.20;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingSoapMaker() {
  if (!state.wanderingSoapMaker) {
    state.wanderingSoapMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingSoapMaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingSoapMakerTick() {
  const a = state.wanderingSoapMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SOAP_MAKER_CHANGED, { expired: true });
      addMessage('🧼 The wandering soap maker wraps up the fragrant bars and herbal oils, shoulders the travelling pack, and sets off down the road — the faint scent of lavender and ash lingering in the courtyard.', 'info');
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
  emit(Events.WANDERING_SOAP_MAKER_CHANGED, { spawned: true });
  addMessage('🧼 A wandering soap maker arrives at the palace gates carrying baskets of fragrant herbal soaps, ash lye crocks, and aromatic oils gathered from distant market towns. They offer to establish an imperial soap works for the court and city bathhouses, or to sell their finest aromatic wares. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingSoapMaker() { return state.wanderingSoapMaker?.active ?? null; }
export function getSoapMakerSecsLeft() {
  const a = state.wanderingSoapMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionSoapWorks() {
  const a = state.wanderingSoapMaker;
  if (!a?.active) return { ok: false, reason: 'No soap maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The soap maker has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial soap works from the wandering soap maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'soapMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'soapMakerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_SOAP_MAKER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧼 The soap maker sets up a gleaming workshop in the palace district — vats of fragrant lye-and-herb soap bubble over ash fires, and imperial bath attendants distribute bars to the city's bathhouses and market stalls. Cleanliness spreads morale across the realm! −${COMMISSION_FOOD_COST} food · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseAromaticSoaps() {
  const a = state.wanderingSoapMaker;
  if (!a?.active) return { ok: false, reason: 'No soap maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The soap maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased aromatic soaps from the wandering soap maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'soapMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'soapMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_SOAP_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 Crates of fine lavender, rose-water, and cedar-scented soaps are distributed among the imperial court nobles, the palace servants, and the city's wealthiest merchants — trade value rises as the aromatic luxury goods circulate through the market! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSoapMakerAway() {
  const a = state.wanderingSoapMaker;
  if (!a?.active) return { ok: false, reason: 'No soap maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SOAP_MAKER_CHANGED, { dismissed: true });
  addMessage('🧼 The wandering soap maker nods politely, packs up the fragrant herb bundles and ash-lye crocks, and wanders off down the market road in search of a more willing buyer for the artisan wares.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
