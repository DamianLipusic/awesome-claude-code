/**
 * EmpireOS — Imperial Copper Merchant (T456).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), an imperial copper
 * merchant arrives at the settlement with a covered wagon carrying ingots of
 * smelted copper cast in standard rectangular moulds, bundles of copper wire
 * drawn through a series of iron drawplates to produce consistent gauges
 * suitable for jewellery wire, rivets, and fine inlay work, samples of copper
 * alloy test bars showing the properties of different tin additions — the
 * hardness and corrosion resistance gained from bronze alloys at various
 * proportions of two to sixteen parts tin per hundred — assay certificates
 * from the regional mint attesting the purity of each ingot lot, and a set of
 * casting crucibles in different capacities for immediate use, offering to
 * arrange a regular copper trade agreement that will supply the settlement's
 * smiths and artisans with consistent-quality metal through the season, or to
 * sell the full specifications of the copper alloy compositions and smelting
 * temperatures that produce the most useful bronze grades for different
 * applications. The player has 80 seconds to decide.
 *
 * Choices:
 *   🔶 Arrange Copper Trade            — pay 25 iron + 20 gold
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +12 morale
 *   📖 Purchase Alloy Secrets          — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                       — dismiss (no reward)
 *
 * state.imperialCopperMerchant = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalTrades:         number,
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

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const TRADE_IRON_COST               = 25;
export const TRADE_GOLD_COST               = 20;
export const TRADE_IRON_RATE               = 0.22;
export const TRADE_PRESTIGE_REWARD         = 22;
export const TRADE_MORALE_REWARD           = 12;
export const TRADE_DURATION_TICKS          = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST           = 20;
export const PURCHASE_STONE_RATE           = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialCopperMerchant() {
  if (!state.imperialCopperMerchant) {
    state.imperialCopperMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalTrades:      0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialCopperMerchant;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalTrades      === undefined) s.totalTrades      = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialCopperMerchantTick() {
  const a = state.imperialCopperMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_COPPER_MERCHANT_CHANGED, { expired: true });
      addMessage('🔶 The imperial copper merchant covers the ingot wagon with its oilcloth, secures the assay certificates in their document case, and drives away along the trade road toward the next settlement.', 'info');
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
  emit(Events.IMPERIAL_COPPER_MERCHANT_CHANGED, { spawned: true });
  addMessage('🔶 An imperial copper merchant arrives with a covered wagon carrying rectangular copper ingots, bundles of drawn copper wire, alloy test bars showing different tin addition proportions, mint assay certificates attesting ingot purity, and casting crucibles — offering to arrange a regular copper trade agreement to supply the settlement\'s smiths and artisans through the season, or to sell the full alloy composition specifications and smelting temperatures for the most useful bronze grades. Respond within 80 seconds.', 'info');
}

export function getActiveImperialCopperMerchant() { return state.imperialCopperMerchant?.active ?? null; }
export function getCopperMerchantSecsLeft() {
  const a = state.imperialCopperMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function arrangeCopperTrade() {
  const a = state.imperialCopperMerchant;
  if (!a?.active) return { ok: false, reason: 'No copper merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The copper merchant has departed.' };
  if ((state.resources.iron ?? 0) < TRADE_IRON_COST) return { ok: false, reason: `Need ${TRADE_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < TRADE_GOLD_COST) return { ok: false, reason: `Need ${TRADE_GOLD_COST} gold.` };
  state.resources.iron -= TRADE_IRON_COST;
  state.resources.gold -= TRADE_GOLD_COST;
  changeMorale(TRADE_MORALE_REWARD);
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Arranged a copper trade agreement with the imperial copper merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'coppermerchantTrade');
    state.randomEvents.activeModifiers.push({
      id: 'coppermerchantTrade', resource: 'iron',
      rateMult: 1 + (TRADE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.IMPERIAL_COPPER_MERCHANT_CHANGED, { traded: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔶 The copper merchant unloads the full ingot consignment from the wagon — stacking the rectangular copper ingots in the settlement's metal store arranged by lot number to preserve the assay certificate traceability, hanging the bundles of drawn wire on pegs sorted by gauge, placing the casting crucibles near the forge in order of capacity, and leaving a forward order form specifying the delivery schedule and pricing for the next three seasonal shipments — before accepting the agreed payment of iron tools and gold coin and committing the settlement to a regular supply of consistent-quality copper metal. −${TRADE_IRON_COST} iron · −${TRADE_GOLD_COST} gold · +${TRADE_PRESTIGE_REWARD} prestige · +${TRADE_MORALE_REWARD} morale. Iron surge: +${TRADE_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseAlloySecrets() {
  const a = state.imperialCopperMerchant;
  if (!a?.active) return { ok: false, reason: 'No copper merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The copper merchant has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased alloy secrets from the imperial copper merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'coppermerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'coppermerchantPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_COPPER_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The copper merchant provides a complete written specification of the bronze alloy compositions used by the principal imperial smithies — the tin addition percentages that produce the hardest casting bronze suitable for tools and weapons, the lower tin proportions that give a more malleable bronze better suited to hammered sheet work for vessels and armour, the arsenic additions used in older smelting traditions that replicate some of the hardening effect of tin where tin is scarce or expensive, the charcoal fuel quantities and bellows stroke rates required to maintain the correct smelting temperature for each alloy type, and the quenching schedules that control the final hardness of cast pieces — along with a sample set of alloy test bars cast at each composition for direct comparison of surface colour, hardness under a file stroke, and response to cold-working. −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCopperMerchantAway() {
  const a = state.imperialCopperMerchant;
  if (!a?.active) return { ok: false, reason: 'No copper merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_COPPER_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🔶 The imperial copper merchant covers the ingot wagon and continues along the trade road toward the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
