/**
 * EmpireOS — Imperial Sugar Merchant (T484).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), an imperial sugar
 * merchant arrives at the settlement leading a mule loaded with two wicker
 * panniers — each pannier packed with canvas sacks of different grades of
 * crystallised cane sugar: a coarse raw muscovado with a dark treacle smell
 * from the molasses retained in the crystals, a pale refined loaf sugar
 * sealed in paper wrappers pressed into dense cones, and a small quantity
 * of powdered sugar in stoppered clay pots for use in confectionery and as a
 * preservative for preserved fruits — along with a letter of introduction
 * from the imperial trade authority granting the right to establish a
 * licensed sugar trade depot at the settlement, or to sell a portion of the
 * current cargo directly into the settlement's food stores at the imperial
 * fixed price.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🍬 Establish Sugar Trade              — pay 30 food + 20 gold
 *        → +0.25 food/s for 2.5 min · +22 prestige · +12 morale
 *   🛍️ Purchase Sugar Stores              — pay 25 food
 *        → +0.18 food/s for 2 min · +15 prestige
 *   🚶 Send Away                           — dismiss (no reward)
 *
 * state.imperialSugarMerchant = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalEstablished:   number,
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const ESTABLISH_FOOD_COST             = 30;
export const ESTABLISH_GOLD_COST             = 20;
export const ESTABLISH_FOOD_RATE             = 0.25;
export const ESTABLISH_PRESTIGE_REWARD       = 22;
export const ESTABLISH_MORALE_REWARD         = 12;
export const ESTABLISH_DURATION_TICKS        = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST              = 25;
export const PURCHASE_FOOD_RATE              = 0.18;
export const PURCHASE_PRESTIGE_REWARD        = 15;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSugarMerchant() {
  if (!state.imperialSugarMerchant) {
    state.imperialSugarMerchant = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalEstablished:  0,
      totalPurchases:    0,
      totalDismissals:   0,
    };
  }
  const s = state.imperialSugarMerchant;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalEstablished   === undefined) s.totalEstablished   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialSugarMerchantTick() {
  const a = state.imperialSugarMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SUGAR_MERCHANT_CHANGED, { expired: true });
      addMessage('🍬 The imperial sugar merchant reloads the panniers onto the mule and continues along the trade road to the next settlement on the imperial route.', 'info');
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
  emit(Events.IMPERIAL_SUGAR_MERCHANT_CHANGED, { spawned: true });
  addMessage('🍬 An imperial sugar merchant arrives leading a mule loaded with wicker panniers — packed with coarse muscovado in canvas sacks, pale refined loaf sugar pressed into paper-wrapped cones, and powdered sugar in stoppered clay pots — along with a letter of introduction from the imperial trade authority granting the right to establish a licensed sugar trade depot at the settlement, or to purchase a portion of the current cargo directly into the settlement\'s food stores at the imperial fixed price. Respond within 80 seconds.', 'info');
}

export function getActiveImperialSugarMerchant() { return state.imperialSugarMerchant?.active ?? null; }
export function getSugarMerchantSecsLeft() {
  const a = state.imperialSugarMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishSugarTrade() {
  const a = state.imperialSugarMerchant;
  if (!a?.active) return { ok: false, reason: 'No sugar merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The sugar merchant has departed.' };
  if ((state.resources.food ?? 0) < ESTABLISH_FOOD_COST) return { ok: false, reason: `Need ${ESTABLISH_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < ESTABLISH_GOLD_COST) return { ok: false, reason: `Need ${ESTABLISH_GOLD_COST} gold.` };
  state.resources.food -= ESTABLISH_FOOD_COST;
  state.resources.gold -= ESTABLISH_GOLD_COST;
  changeMorale(ESTABLISH_MORALE_REWARD);
  awardPrestige(ESTABLISH_PRESTIGE_REWARD, 'Established sugar trade depot with the imperial sugar merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sugarMerchantEstablish');
    state.randomEvents.activeModifiers.push({
      id: 'sugarMerchantEstablish', resource: 'food',
      rateMult: 1 + (ESTABLISH_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + ESTABLISH_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalEstablished = (a.totalEstablished ?? 0) + 1;
  emit(Events.IMPERIAL_SUGAR_MERCHANT_CHANGED, { established: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍬 The merchant reviews the letter of introduction with the settlement's record-keeper and selects a suitable building on the market side of the settlement square for the depot — a dry, well-ventilated space with thick walls that will maintain a stable temperature through the seasonal changes that cause refined sugar to absorb moisture and clump in damp conditions. The muscovado sacks are stacked against the back wall on raised timber pallets that prevent ground moisture from wicking up into the canvas, each sack tied at the neck with a loop of cord that can be released and resealed without cutting so the contents can be checked and portions removed without exposing the full quantity to air. The loaf-sugar cones go onto the upper shelves in their paper wrappers, separated from the muscovado storage by a partition that prevents the treacle smell of the raw sugar from contaminating the refined product's clean sweetness. The merchant draws up a schedule of incoming shipments — the frequency of deliveries and the quantities of each grade to be held in stock — and records the depot's location on the imperial trade route map alongside the contact arrangements for the settlement's appointed sugar factor who will manage purchases and accounts with arriving merchants. The supply chain is confirmed by the return of a countersigned copy of the letter to the imperial trade authority's nearest office. −${ESTABLISH_FOOD_COST} food −${ESTABLISH_GOLD_COST} gold · +${ESTABLISH_PRESTIGE_REWARD} prestige · +${ESTABLISH_MORALE_REWARD} morale. Food surge: +${ESTABLISH_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSugarStores() {
  const a = state.imperialSugarMerchant;
  if (!a?.active) return { ok: false, reason: 'No sugar merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The sugar merchant has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased sugar stores from the imperial sugar merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sugarMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'sugarMerchantPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SUGAR_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🛍️ The merchant opens both panniers and measures out the agreed portion of cargo for the settlement's stores: a full sack of muscovado transferred directly to the settlement's dry storage, three loaf-sugar cones in their paper wrappers set aside for the settlement's cooks and healers who use refined sugar in preparations that require precise sweetness without the colour and flavour variation of raw sugar, and two clay pots of powdered sugar sealed with wax for preserving the autumn fruit harvest. The merchant provides a brief account of the correct storage conditions for each grade: muscovado keeps best in a sealed sack in a cool dry space away from strong-smelling foodstuffs, since the molasses content is hygroscopic and will absorb both moisture and odours through the canvas weave; loaf sugar in its paper cone can be stored in a slightly warmer space since the refining process has removed most of the moisture-attracting compounds, but should be kept above the floor on a shelf to prevent rising damp from softening the paper and loosening the cone shape; and powdered sugar must be kept in a sealed container at all times since the fine particle size makes it especially prone to moisture absorption. The settlement's cook acknowledges the storage instructions and arranges the new stocks alongside the existing food supplies. −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSugarMerchantAway() {
  const a = state.imperialSugarMerchant;
  if (!a?.active) return { ok: false, reason: 'No sugar merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SUGAR_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🍬 The imperial sugar merchant reloads the panniers onto the mule and continues along the trade road to the next settlement on the imperial route.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
