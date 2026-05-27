/**
 * EmpireOS — Wandering Seed Merchant (T427).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering seed
 * merchant arrives at the settlement carrying a wide selection of
 * cultivated grain varieties chosen for yield, disease resistance, and
 * tolerance of the local soil and rainfall patterns — emmer and einkorn
 * wheats selected over many growing seasons for their large, full kernels
 * and strong straw that stands up to autumn storms without lodging, hulled
 * barley strains with tightly-adhering husks that protect the grain during
 * threshing and storage, a dark-seeded lentil variety that fixes
 * atmospheric nitrogen into poor soils and returns two to three times the
 * planted volume in a single growing season, and broad bean stock bred for
 * a short growing season that allows a late sowing after the main grain
 * harvest — offering to sell the entire selection as a rare seed collection
 * that replenishes and improves the empire's agricultural stock in a single
 * season, or to share the accumulated crop cultivation lore gathered from
 * farmers across the wider region that allows every settlement to select
 * and save the best seed grain year after year without specialist guidance.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🌱 Purchase Rare Seed Collection  — pay 25 food
 *        → +0.25 food/s for 2.5 min · +15 prestige · +10 morale
 *   📖 Exchange Crop Cultivation Lore — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                       — dismiss (no reward)
 *
 * state.wanderingSeedMerchant = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalPurchases:   number,
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const PURCHASE_FOOD_COST             = 25;
export const PURCHASE_FOOD_RATE             = 0.25;
export const PURCHASE_PRESTIGE_REWARD       = 15;
export const PURCHASE_MORALE_REWARD         = 10;
export const PURCHASE_DURATION_TICKS        = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_GOLD_COST             = 18;
export const EXCHANGE_GOLD_RATE             = 0.15;
export const EXCHANGE_PRESTIGE_REWARD       = 10;
export const EXCHANGE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingSeedMerchant() {
  if (!state.wanderingSeedMerchant) {
    state.wanderingSeedMerchant = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalPurchases:  0,
      totalExchanges:  0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingSeedMerchant;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalPurchases  === undefined) s.totalPurchases  = 0;
  if (s.totalExchanges  === undefined) s.totalExchanges  = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingSeedMerchantTick() {
  const a = state.wanderingSeedMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SEED_MERCHANT_CHANGED, { expired: true });
      addMessage('🌱 The wandering seed merchant carefully re-seals the linen seed pouches, packs the cloth bundles back into the travelling chest, and departs along the field-track leading toward the next settlement on the route — the soft rattling of dried grain against the chest walls fading as the figure rounds the orchard boundary.', 'info');
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
  emit(Events.WANDERING_SEED_MERCHANT_CHANGED, { spawned: true });
  addMessage('🌱 A wandering seed merchant arrives at the settlement carrying linen pouches of cultivated grain varieties selected over many growing seasons — emmer and einkorn wheats with large full kernels and strong straw, hulled barley strains with tight husks that protect grain during threshing and storage, a nitrogen-fixing lentil variety that returns two to three times the planted volume in a single season, and short-season broad bean stock that allows a late sowing after the main harvest — offering to sell the entire rare seed collection that replenishes and improves the empire\'s agricultural stock, or to share accumulated crop cultivation lore from farmers across the wider region. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingSeedMerchant() { return state.wanderingSeedMerchant?.active ?? null; }
export function getSeedMerchantSecsLeft() {
  const a = state.wanderingSeedMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function purchaseRareSeeds() {
  const a = state.wanderingSeedMerchant;
  if (!a?.active) return { ok: false, reason: 'No seed merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The seed merchant has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  changeMorale(PURCHASE_MORALE_REWARD);
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased rare seed collection from the wandering seed merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'seedMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'seedMerchantPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_SEED_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌱 The seed merchant opens the travelling chest and counts out the full selection — emmer and einkorn wheat pouches with growing notes on ideal sowing depth and row spacing, the hulled barley labelled for threshing method and storage humidity, the lentil packet with soil preparation instructions for the nitrogen-fixing root nodules to establish in the first season, and the broad bean stock with its late-sowing calendar marked against the frost-date range — each variety catalogued and handed over together with a simple planting schedule that staggers the sowings to spread the harvest workload across the growing season and reduce weather risk across all crops simultaneously. The granaries fill quickly as the new varieties yield well above the old stock! −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige · +${PURCHASE_MORALE_REWARD} morale. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeCropLore() {
  const a = state.wanderingSeedMerchant;
  if (!a?.active) return { ok: false, reason: 'No seed merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The seed merchant has departed.' };
  if ((state.resources.gold ?? 0) < EXCHANGE_GOLD_COST) return { ok: false, reason: `Need ${EXCHANGE_GOLD_COST} gold.` };
  state.resources.gold -= EXCHANGE_GOLD_COST;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged crop cultivation lore with the wandering seed merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'seedMerchantExchange');
    state.randomEvents.activeModifiers.push({
      id: 'seedMerchantExchange', resource: 'gold',
      rateMult: 1 + (EXCHANGE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalExchanges = (a.totalExchanges ?? 0) + 1;
  emit(Events.WANDERING_SEED_MERCHANT_CHANGED, { exchanged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The seed merchant shares the accumulated crop cultivation knowledge gathered across the region — the visual inspection method for identifying healthy, full-kernelled seed grain from thin or diseased stock before threshing, the simple float-test that removes hollow and insect-damaged grains from the planting batch before sowing, the row-spacing and sowing-depth combinations that reduce competition between plants in the early establishment phase and produce a more even stand across the whole field, and the season-end seed-saving protocol that selects only the tallest and most disease-free plants for next year's stock rather than taking grain from the first and easiest-to-reach heads — knowledge that allows every farming household to steadily improve their own seed stock from season to season without buying replacements! −${EXCHANGE_GOLD_COST} gold · +${EXCHANGE_PRESTIGE_REWARD} prestige. Gold surge: +${EXCHANGE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSeedMerchantAway() {
  const a = state.wanderingSeedMerchant;
  if (!a?.active) return { ok: false, reason: 'No seed merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SEED_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🌱 The wandering seed merchant nods politely, closes the travelling chest of grain varieties, and departs along the field-track leading toward the next settlement on the seasonal route.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
