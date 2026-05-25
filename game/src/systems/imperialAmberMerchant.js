/**
 * EmpireOS — Imperial Amber Merchant (T404).
 *
 * Every 13–18 minutes (Bronze Age+, 8+ player tiles), an imperial amber merchant
 * arrives at the palace bearing lacquered display cases of translucent Baltic amber
 * chunks, insect-inclusion specimens, and polished amber amulets — offering to
 * arrange an exclusive Baltic amber trade route for the imperial treasury, or to
 * sell a curated collection of amber specimens to the palace artisans and gem-cutters.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🟡 Arrange Baltic Amber Trade         — pay 25 food + 20 gold
 *        → +0.22 gold/s for 2.5 min · +20 prestige · +10 morale
 *   💎 Purchase Amber Specimens           — pay 18 stone
 *        → +0.15 stone/s for 2 min · +12 prestige
 *   🚶 Send Away                           — dismiss (no reward)
 *
 * state.imperialAmberMerchant = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalArrangements: number,
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

export const ARRANGE_FOOD_COST           = 25;
export const ARRANGE_GOLD_COST           = 20;
export const ARRANGE_GOLD_RATE           = 0.22;
export const ARRANGE_PRESTIGE_REWARD     = 20;
export const ARRANGE_MORALE_REWARD       = 10;
export const ARRANGE_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST         = 18;
export const PURCHASE_STONE_RATE         = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialAmberMerchant() {
  if (!state.imperialAmberMerchant) {
    state.imperialAmberMerchant = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalArrangements: 0,
      totalPurchases:    0,
      totalDismissals:   0,
    };
  }
  const s = state.imperialAmberMerchant;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits       = 0;
  if (s.totalArrangements  === undefined) s.totalArrangements = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals   = 0;
}

export function imperialAmberMerchantTick() {
  const a = state.imperialAmberMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_AMBER_MERCHANT_CHANGED, { expired: true });
      addMessage('🟡 The imperial amber merchant closes the lacquered display cases, wraps the translucent Baltic specimens in silk, and departs the palace — the warm golden glow of amber fading with the wagon wheels on the cobblestones.', 'info');
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
  emit(Events.IMPERIAL_AMBER_MERCHANT_CHANGED, { spawned: true });
  addMessage('🟡 An imperial amber merchant arrives at the palace bearing lacquered display cases of translucent Baltic amber chunks, insect-inclusion specimens, and polished amber amulets — offering to arrange an exclusive Baltic amber trade route for the imperial treasury, or to sell curated specimens to the palace gem-cutters. Respond within 80 seconds.', 'info');
}

export function getActiveImperialAmberMerchant() { return state.imperialAmberMerchant?.active ?? null; }
export function getAmberMerchantSecsLeft() {
  const a = state.imperialAmberMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function arrangeBalticAmberTrade() {
  const a = state.imperialAmberMerchant;
  if (!a?.active) return { ok: false, reason: 'No amber merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The amber merchant has departed.' };
  if ((state.resources.food ?? 0) < ARRANGE_FOOD_COST) return { ok: false, reason: `Need ${ARRANGE_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < ARRANGE_GOLD_COST) return { ok: false, reason: `Need ${ARRANGE_GOLD_COST} gold.` };
  state.resources.food -= ARRANGE_FOOD_COST;
  state.resources.gold -= ARRANGE_GOLD_COST;
  changeMorale(ARRANGE_MORALE_REWARD);
  awardPrestige(ARRANGE_PRESTIGE_REWARD, 'Arranged Baltic amber trade route from the imperial amber merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'amberMerchantArrange');
    state.randomEvents.activeModifiers.push({
      id: 'amberMerchantArrange', resource: 'gold',
      rateMult: 1 + (ARRANGE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + ARRANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalArrangements = (a.totalArrangements ?? 0) + 1;
  emit(Events.IMPERIAL_AMBER_MERCHANT_CHANGED, { arranged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🟡 The amber merchant seals the trade agreement with wax and the imperial sigil — caravans of Baltic amber begin flowing into the palace storerooms, where jewellers, amulet carvers, and foreign dignitaries eagerly pay premium prices for the sun-gold resin prized across every civilised land, pouring a steady stream of coin into the imperial treasury! −${ARRANGE_FOOD_COST} food · −${ARRANGE_GOLD_COST} gold · +${ARRANGE_PRESTIGE_REWARD} prestige · +${ARRANGE_MORALE_REWARD} morale. Gold surge: +${ARRANGE_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseAmberSpecimens() {
  const a = state.imperialAmberMerchant;
  if (!a?.active) return { ok: false, reason: 'No amber merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The amber merchant has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased amber specimens from the imperial amber merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'amberMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'amberMerchantPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_AMBER_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💎 The amber merchant trades a collection of extraordinary specimens — large nodules of clear honey-gold resin, a fossilised moth frozen in mid-flight, and a fist-sized amber chunk shot through with silver inclusions — the palace gem-cutters study the optical and structural properties of the ancient tree resin to refine their techniques for working hard stone, inspiring new chiselling jigs and abrasive compound formulas that significantly accelerate the quarry and masonry operations! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendAmberMerchantAway() {
  const a = state.imperialAmberMerchant;
  if (!a?.active) return { ok: false, reason: 'No amber merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_AMBER_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🟡 The imperial amber merchant closes the display cases and departs the palace — the warm translucent glow of Baltic amber receding with the wagon into the distance.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
