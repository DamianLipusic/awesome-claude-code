/**
 * EmpireOS — Imperial Silk Weaver (T360).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), a master silk weaver
 * arrives bearing exquisite bolts of dyed silk and embroidered tapestries
 * worthy of imperial courts. The player has 80 seconds to decide.
 *
 * Choices:
 *   🧵 Commission Silk Tapestries — pay 25 mana + 20 gold
 *        → +0.2 mana/s for 2.5 min · +22 prestige · +10 morale
 *   🌾 Purchase Silk Bolts        — pay 20 food
 *        → +0.18 food/s for 2 min · +15 prestige
 *   👋 Send Away                  — dismiss (no reward)
 *
 * state.imperialSilkWeaver = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
 *   totalPurchases:    number,
 *   totalDismissals:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_MANA_RATE          = 0.2;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST            = 20;
export const PURCHASE_FOOD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSilkWeaver() {
  if (!state.imperialSilkWeaver) {
    state.imperialSilkWeaver = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialSilkWeaver;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialSilkWeaverTick() {
  const a = state.imperialSilkWeaver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SILK_WEAVER_CHANGED, { expired: true });
      addMessage('🧵 The silk weaver carefully rolls the bolts of shimmering fabric back into protective linen sleeves, lashes the lacquered carrying case shut, and slips quietly through the gates — a trail of coloured silk threads flutter briefly in the breeze before the opportunity is lost.', 'info');
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
  emit(Events.IMPERIAL_SILK_WEAVER_CHANGED, { spawned: true });
  addMessage('🧵 An imperial silk weaver arrives carrying an exquisite lacquered case containing bolts of hand-dyed silk in deep crimson, imperial gold, and ocean blue — each thread individually spun from the finest cocoons of the eastern provinces. They offer to weave grand tapestries for the palace or to sell finished silk bolts for the treasury markets. Respond within 80 seconds.', 'info');
}

export function getActiveImperialSilkWeaver() { return state.imperialSilkWeaver?.active ?? null; }
export function getSilkWeaverSecsLeft() {
  const a = state.imperialSilkWeaver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionSilkTapestries() {
  const a = state.imperialSilkWeaver;
  if (!a?.active) return { ok: false, reason: 'No silk weaver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The silk weaver has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned silk tapestries from the imperial silk weaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'silkWeaverCommission');
    state.randomEvents.activeModifiers.push({
      id: 'silkWeaverCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SILK_WEAVER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧵 The weaver sets up a great loom in the palace hall and begins creating breathtaking tapestries depicting the empire's victories and myths — court scholars are inspired to record new knowledge beside the masterworks, and the mystical patterns woven into the silk seem to focus arcane energies, amplifying the mana channels throughout the realm! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSilkBolts() {
  const a = state.imperialSilkWeaver;
  if (!a?.active) return { ok: false, reason: 'No silk weaver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The silk weaver has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased silk bolts from the imperial silk weaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'silkWeaverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'silkWeaverPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SILK_WEAVER_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌾 The silk bolts are distributed to the market stalls where wealthy buyers pay lavishly for the finest fabrics — the gold flows back into the treasury in the form of festival commissions, and the festive mood inspires farmers to harvest with greater vigour as silk-clad nobles tour the fields in celebration of the empire's refinement! −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSilkWeaverAway() {
  const a = state.imperialSilkWeaver;
  if (!a?.active) return { ok: false, reason: 'No silk weaver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SILK_WEAVER_CHANGED, { dismissed: true });
  addMessage('🧵 The silk weaver closes the lacquered case with a soft click, bows graciously, and departs through the gates — the shimmer of silk threads catch the light one last time before vanishing around the corner.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
