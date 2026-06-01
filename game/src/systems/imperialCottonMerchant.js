/**
 * EmpireOS — Imperial Cotton Merchant (T470).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), an imperial cotton
 * merchant arrives at the settlement bearing bolts of raw cotton wadding in
 * hemp sacks, a sample book of finished cloth weights ranging from gauze-thin
 * muslin to dense canvas, and a ledger of established trade contacts in the
 * cotton-growing river valleys — offering to arrange a seasonal cotton
 * trade agreement that would supply the settlement's weavers with a reliable
 * bale shipment each quarter, or to sell a manual of cotton weaving lore
 * compiled from the textile workshops of the southern provinces.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🌿 Arrange Cotton Trade          — pay 25 food + 20 gold
 *        → +0.22 food/s for 2.5 min · +20 prestige · +12 morale
 *   📜 Purchase Cotton Weaving Lore  — pay 20 wood
 *        → +0.18 wood/s for 2 min · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.imperialCottonMerchant = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalTrades:        number,
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const TRADE_FOOD_COST                 = 25;
export const TRADE_GOLD_COST                 = 20;
export const TRADE_FOOD_RATE                 = 0.22;
export const TRADE_PRESTIGE_REWARD           = 20;
export const TRADE_MORALE_REWARD             = 12;
export const TRADE_DURATION_TICKS            = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST              = 20;
export const PURCHASE_WOOD_RATE              = 0.18;
export const PURCHASE_PRESTIGE_REWARD        = 15;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialCottonMerchant() {
  if (!state.imperialCottonMerchant) {
    state.imperialCottonMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalTrades:      0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialCottonMerchant;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalTrades        === undefined) s.totalTrades        = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialCottonMerchantTick() {
  const a = state.imperialCottonMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_COTTON_MERCHANT_CHANGED, { expired: true });
      addMessage('🌿 The imperial cotton merchant closes the sample book, ties the sacks back onto the pack frame, and departs to seek a more receptive trading partner elsewhere.', 'info');
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
  emit(Events.IMPERIAL_COTTON_MERCHANT_CHANGED, { spawned: true });
  addMessage('🌿 An imperial cotton merchant arrives bearing bolts of raw cotton wadding in hemp sacks and a sample book of finished cloth weights — from gauze-thin muslin to dense canvas — along with a ledger of trade contacts in the southern cotton-growing river valleys. The merchant offers to arrange a seasonal cotton trade agreement supplying the settlement\'s weavers with reliable bale shipments, or to sell a manual of cotton weaving lore compiled from the region\'s textile workshops. Respond within 80 seconds.', 'info');
}

export function getActiveImperialCottonMerchant() { return state.imperialCottonMerchant?.active ?? null; }
export function getCottonMerchantSecsLeft() {
  const a = state.imperialCottonMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function arrangeCottonTrade() {
  const a = state.imperialCottonMerchant;
  if (!a?.active) return { ok: false, reason: 'No cotton merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cotton merchant has departed.' };
  if ((state.resources.food ?? 0) < TRADE_FOOD_COST) return { ok: false, reason: `Need ${TRADE_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < TRADE_GOLD_COST) return { ok: false, reason: `Need ${TRADE_GOLD_COST} gold.` };
  state.resources.food -= TRADE_FOOD_COST;
  state.resources.gold -= TRADE_GOLD_COST;
  changeMorale(TRADE_MORALE_REWARD);
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Arranged cotton trade with the imperial cotton merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cottonMerchantTrade');
    state.randomEvents.activeModifiers.push({
      id: 'cottonMerchantTrade', resource: 'food',
      rateMult: 1 + (TRADE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.IMPERIAL_COTTON_MERCHANT_CHANGED, { traded: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The merchant opens the ledger to the river-valley contacts page and walks through the agreement: bales of raw cotton ginned and pressed into standard weights will arrive at the settlement's receiving yard each quarter-season, accompanied by a manifest listing the staple length and harvest origin of each bale so the weavers can sort by quality before loading the looms. The merchant witnesses the signed agreement with a wax seal from the provincial trade guild and dispatches a rider to inform the first bale-supplier before the ink is fully dry. The settlement's weavers, relieved of the uncertainty of irregular supply, begin planning a modest expansion of the weaving shed. −${TRADE_FOOD_COST} food −${TRADE_GOLD_COST} gold · +${TRADE_PRESTIGE_REWARD} prestige · +${TRADE_MORALE_REWARD} morale. Food surge: +${TRADE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCottonWeavingLore() {
  const a = state.imperialCottonMerchant;
  if (!a?.active) return { ok: false, reason: 'No cotton merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cotton merchant has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased cotton weaving lore from the imperial cotton merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cottonMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'cottonMerchantPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_COTTON_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The merchant produces a compact manual of cotton weaving lore — chapters on setting the loom reed to the correct sett for each cloth weight, the way to pre-tension the warp threads so they feed evenly past the heddles without developing the small crimps that weaken the finished cloth, and the sequence of picks required to produce the characteristic diagonal twill that gives the most durable work-cloth its characteristic ribbed surface. A concluding chapter details the washing and fulling process that shrinks raw cloth to finished dimensions, including the specific temperatures and agitation patterns that prevent uneven felting. The settlement's weavers study the manual with evident appreciation, adapting their existing loom arrangements to the new methods before the next weaving run begins. −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCottonMerchantAway() {
  const a = state.imperialCottonMerchant;
  if (!a?.active) return { ok: false, reason: 'No cotton merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_COTTON_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🌿 The imperial cotton merchant closes the sample book, ties the sacks back onto the pack frame, and departs to seek a more receptive trading partner elsewhere.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
