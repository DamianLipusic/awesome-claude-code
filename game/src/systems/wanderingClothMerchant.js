/**
 * EmpireOS — Wandering Cloth Merchant (T455).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering cloth merchant
 * arrives at the settlement with a handcart loaded with bolts of undyed and
 * naturally-dyed linen, folded lengths of heavier wool broadcloth woven on a
 * horizontal loom using a weighted heddle to produce an even balanced weave,
 * rolls of bleached linen thread for hemming, a selection of small bone needles
 * and iron pins wrapped in a square of felt, sample swatches showing the dye
 * lot consistency achieved with different mordants — alum, iron, tannin — that
 * fix the vegetable dyes into the fibre and prevent fading through repeated
 * washing in river water, and a set of scale weights used for trading cloth by
 * the measured ell, offering to sell a consignment of fine cloth at a fair price
 * to supply the settlement's tailors and weavers through the coming season, or
 * to exchange a set of regional price lists and weaving pattern tablets that
 * allow the settlement's own weavers to improve their thread counts and produce
 * cloth of a higher quality that commands better prices at the market. The
 * player has 80 seconds to decide.
 *
 * Choices:
 *   🧵 Purchase Fine Cloth            — pay 20 food
 *        → +0.22 food/s for 2.5 min · +18 prestige · +10 morale
 *   📖 Trade for Textile Knowledge    — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.wanderingClothMerchant = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalPurchases:      number,
 *   totalTrades:         number,
 *   totalDismissals:     number,
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

export const PURCHASE_FOOD_COST            = 20;
export const PURCHASE_FOOD_RATE            = 0.22;
export const PURCHASE_PRESTIGE_REWARD      = 18;
export const PURCHASE_MORALE_REWARD        = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TRADE_GOLD_COST               = 18;
export const TRADE_GOLD_RATE               = 0.15;
export const TRADE_PRESTIGE_REWARD         = 12;
export const TRADE_DURATION_TICKS          = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingClothMerchant() {
  if (!state.wanderingClothMerchant) {
    state.wanderingClothMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalPurchases:   0,
      totalTrades:      0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingClothMerchant;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalTrades      === undefined) s.totalTrades      = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingClothMerchantTick() {
  const a = state.wanderingClothMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_CLOTH_MERCHANT_CHANGED, { expired: true });
      addMessage('🧵 The wandering cloth merchant secures the bolts of linen and broadcloth back onto the handcart, tucks the scale weights into their felt pouch, and wheels away along the road toward the next market town.', 'info');
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
  emit(Events.WANDERING_CLOTH_MERCHANT_CHANGED, { spawned: true });
  addMessage('🧵 A wandering cloth merchant arrives with a handcart loaded with bolts of undyed and naturally-dyed linen, lengths of heavier wool broadcloth woven on a horizontal loom, rolls of bleached linen thread, bone needles and iron pins, sample swatches showing dye lot consistency achieved with alum, iron, and tannin mordants, and scale weights for trading cloth by the measured ell — offering to sell a season\'s supply of fine cloth to the settlement\'s tailors and weavers, or to exchange regional price lists and weaving pattern tablets to improve local thread counts. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingClothMerchant() { return state.wanderingClothMerchant?.active ?? null; }
export function getClothMerchantSecsLeft() {
  const a = state.wanderingClothMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function purchaseFineCloth() {
  const a = state.wanderingClothMerchant;
  if (!a?.active) return { ok: false, reason: 'No cloth merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cloth merchant has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  changeMorale(PURCHASE_MORALE_REWARD);
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased fine cloth from the wandering cloth merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'clothmerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'clothmerchantPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_CLOTH_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧵 The cloth merchant unloads the full consignment from the handcart — measuring out the ordered lengths of linen and broadcloth with a folding wooden ell stick calibrated to the regional standard, cutting each piece cleanly with shears along a chalk line drawn across the face of the cloth, rolling each length around a smooth rod, wrapping in undyed linen to protect against dust and moisture, and stacking the wrapped bolts in the settlement's dry store beside the weaving shed — leaving the tailors and weavers supplied with consistent-quality material that will produce garments of noticeably better drape and durability than the coarser locally-spun cloth they have been working with. −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige · +${PURCHASE_MORALE_REWARD} morale. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function tradeForTextileKnowledge() {
  const a = state.wanderingClothMerchant;
  if (!a?.active) return { ok: false, reason: 'No cloth merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cloth merchant has departed.' };
  if ((state.resources.gold ?? 0) < TRADE_GOLD_COST) return { ok: false, reason: `Need ${TRADE_GOLD_COST} gold.` };
  state.resources.gold -= TRADE_GOLD_COST;
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Traded for textile knowledge from the wandering cloth merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'clothmerchantTrade');
    state.randomEvents.activeModifiers.push({
      id: 'clothmerchantTrade', resource: 'gold',
      rateMult: 1 + (TRADE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.WANDERING_CLOTH_MERCHANT_CHANGED, { traded: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The cloth merchant unpacks a set of carved wooden pattern tablets used to record weaving drafts — each tablet showing the threading sequence for the heddles and the treadle tie-up required to produce a particular weave structure, expressed as a grid of filled and empty squares that the weaver reads column by column as the shuttle passes — along with a written price list showing the market rates per ell for different grades of linen and wool cloth at the main regional markets, the premium paid for consistent thread counts versus variable hand-spun yarn, and the mordant recipes that stabilise the most commercially valuable dye colours, giving the settlement's weavers the technical information needed to improve the quality and consistency of their output and to understand which products are worth the additional preparation time. −${TRADE_GOLD_COST} gold · +${TRADE_PRESTIGE_REWARD} prestige. Gold surge: +${TRADE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendClothMerchantAway() {
  const a = state.wanderingClothMerchant;
  if (!a?.active) return { ok: false, reason: 'No cloth merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_CLOTH_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🧵 The wandering cloth merchant reloads the bolts onto the handcart and continues along the road toward the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
