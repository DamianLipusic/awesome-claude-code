/**
 * EmpireOS — Wandering Fruit Merchant (T477).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering fruit merchant
 * arrives at the settlement with a pair of laden panniers on a pack mule —
 * one side carrying sun-dried figs packed in layers of dry grass, the other
 * holding sealed clay jars of grape must and pomegranate syrup — along with a
 * cloth roll of orchard management notes describing which rootstocks suit
 * heavy clay soils versus the shallow stony ground at the settlement's edge,
 * the pruning schedule that produces full-sized fruit in alternate years rather
 * than a heavy crop one year and almost nothing the next, and the varieties
 * that ripen earliest and so extend the harvest season forward into late summer
 * rather than concentrating the full crop in a narrow window — offering to
 * arrange a seasonal supply of orchard produce for the settlement's stores,
 * or to sell the accumulated orchard management knowledge so local growers can
 * establish a productive permanent planting of their own.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🍎 Arrange Seasonal Supply      — pay 25 food
 *        → +0.20 food/s for 2.5 min · +15 prestige · +8 morale
 *   📜 Purchase Orchard Secrets     — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingFruitMerchant = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalArrangements:  number,
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const ARRANGE_FOOD_COST              = 25;
export const ARRANGE_FOOD_RATE              = 0.20;
export const ARRANGE_PRESTIGE_REWARD        = 15;
export const ARRANGE_MORALE_REWARD          = 8;
export const ARRANGE_DURATION_TICKS         = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST             = 18;
export const PURCHASE_GOLD_RATE             = 0.15;
export const PURCHASE_PRESTIGE_REWARD       = 10;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingFruitMerchant() {
  if (!state.wanderingFruitMerchant) {
    state.wanderingFruitMerchant = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalArrangements: 0,
      totalPurchases:    0,
      totalDismissals:   0,
    };
  }
  const s = state.wanderingFruitMerchant;
  if (s.nextSpawnTick       === undefined) s.nextSpawnTick       = _nextSpawnTick();
  if (s.totalVisits         === undefined) s.totalVisits         = 0;
  if (s.totalArrangements   === undefined) s.totalArrangements   = 0;
  if (s.totalPurchases      === undefined) s.totalPurchases      = 0;
  if (s.totalDismissals     === undefined) s.totalDismissals     = 0;
}

export function wanderingFruitMerchantTick() {
  const a = state.wanderingFruitMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_FRUIT_MERCHANT_CHANGED, { expired: true });
      addMessage('🍎 The wandering fruit merchant reloads the panniers onto the mule, secures the strap across the pack-saddle, and continues along the road to the next settlement.', 'info');
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
  emit(Events.WANDERING_FRUIT_MERCHANT_CHANGED, { spawned: true });
  addMessage('🍎 A wandering fruit merchant arrives with a laden pack mule — one pannier holding sun-dried figs packed in dry grass, the other carrying sealed jars of grape must and pomegranate syrup — along with orchard management notes on rootstock selection, pruning schedules, and early-ripening varieties. The merchant offers to arrange a seasonal supply of orchard produce for the settlement\'s stores, or to sell the accumulated orchard knowledge so local growers can establish a productive permanent planting. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingFruitMerchant() { return state.wanderingFruitMerchant?.active ?? null; }
export function getFruitMerchantSecsLeft() {
  const a = state.wanderingFruitMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function arrangeSeasonalSupply() {
  const a = state.wanderingFruitMerchant;
  if (!a?.active) return { ok: false, reason: 'No fruit merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The fruit merchant has departed.' };
  if ((state.resources.food ?? 0) < ARRANGE_FOOD_COST) return { ok: false, reason: `Need ${ARRANGE_FOOD_COST} food.` };
  state.resources.food -= ARRANGE_FOOD_COST;
  changeMorale(ARRANGE_MORALE_REWARD);
  awardPrestige(ARRANGE_PRESTIGE_REWARD, 'Arranged seasonal fruit supply from the wandering fruit merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'fruitMerchantArrange');
    state.randomEvents.activeModifiers.push({
      id: 'fruitMerchantArrange', resource: 'food',
      rateMult: 1 + (ARRANGE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + ARRANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalArrangements = (a.totalArrangements ?? 0) + 1;
  emit(Events.WANDERING_FRUIT_MERCHANT_CHANGED, { arranged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍎 The merchant unloads the panniers and tallies the consignment with the settlement's stores keeper — the figs go into the dry storage room in their grass packing to keep them from clumping in humid weather, the grape must is decanted into the settlement's own jars with a layer of olive oil floated on top to keep air from reaching the surface, and the pomegranate syrup is set aside as a concentrated sweetener for the cookhouse. The arrangement covers the full season: the merchant will return at each harvest with a proportioned share of the year's crop, adjusted for the yield of the particular variety, so the settlement's stores receive a reliable addition of preserved fruit that supplements the grain and pulse stores through the months when fresh food is scarce. The cookhouse makes immediate use of the first delivery — adding small quantities of the syrup and dried fruit to the morning porridge and the evening stew — and the improvement in the settlement's diet is immediately remarked on. −${ARRANGE_FOOD_COST} food · +${ARRANGE_PRESTIGE_REWARD} prestige · +${ARRANGE_MORALE_REWARD} morale. Food surge: +${ARRANGE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseOrchardSecrets() {
  const a = state.wanderingFruitMerchant;
  if (!a?.active) return { ok: false, reason: 'No fruit merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The fruit merchant has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased orchard management knowledge from the wandering fruit merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'fruitMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'fruitMerchantPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_FRUIT_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The merchant unrolls the cloth notes and goes through each section with the settlement's most experienced grower: the rootstock section explains how a deep-rooting quince stock suits the heavy river-bottom soils while a shallower pear stock performs better on the stony upland plots, and how the union between rootstock and scion should be made in late winter when the sap is still below the bud union so the healing callus forms cleanly. The pruning calendar sets out the three-year establishment sequence — short heading cuts in year one to build the framework, longer extension cuts in year two to fill the allotted space, and the first light thinning of fruiting spurs in year three — with sketched diagrams showing the angle and distance from a bud at which each cut should be made. The variety section lists a dozen named sorts by their ripening date and keeping quality, identifying two early-ripening varieties that will ripen six weeks before the main crop and can be sold or eaten fresh before preservation becomes necessary, and two late-keeping varieties whose fruit holds sound in a cool store well into the following spring. The settlement's growers work through the material together, identifying the sections most relevant to the soils and climate they already know, and begin to plan how the knowledge can be put to use in the planting that autumn. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFruitMerchantAway() {
  const a = state.wanderingFruitMerchant;
  if (!a?.active) return { ok: false, reason: 'No fruit merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_FRUIT_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🍎 The wandering fruit merchant reloads the panniers onto the mule, secures the strap across the pack-saddle, and continues along the road to the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
