/**
 * EmpireOS — Imperial Teak Merchant (T486).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), an imperial teak
 * merchant arrives at the settlement managing a small ox-cart loaded with
 * seasoned teak planks of varying widths and thicknesses — each plank air-dried
 * for a minimum of three years in the merchant's covered yard and marked on its
 * end grain with a chalk notation recording the tree's origin region, the
 * harvest season, and the measured moisture content at the time of assessment
 * — along with a sample box containing cross-section offcuts that show the
 * characteristic interlocked grain pattern, the even distribution of the
 * silica deposits that give teak its resistance to bladed tools and moisture
 * penetration, and the natural oil content visible on the freshly cut face as
 * a slight sheen that prevents adhesion of water droplets — offering to
 * commission a set of teak fittings for the settlement's buildings and harbour
 * works, or to sell the current cargo of seasoned planks directly into the
 * settlement's timber stores at the imperial fixed-quality price.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪵 Commission Teak Fittings          — pay 25 wood + 20 gold
 *        → +0.22 wood/s for 2.5 min · +22 prestige · +12 morale
 *   📦 Purchase Teak Stores              — pay 20 food
 *        → +0.18 food/s for 2 min · +15 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.imperialTeakMerchant = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_WOOD_COST            = 25;
export const COMMISSION_GOLD_COST            = 20;
export const COMMISSION_WOOD_RATE            = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 22;
export const COMMISSION_MORALE_REWARD        = 12;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST              = 20;
export const PURCHASE_FOOD_RATE              = 0.18;
export const PURCHASE_PRESTIGE_REWARD        = 15;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialTeakMerchant() {
  if (!state.imperialTeakMerchant) {
    state.imperialTeakMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialTeakMerchant;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialTeakMerchantTick() {
  const a = state.imperialTeakMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_TEAK_MERCHANT_CHANGED, { expired: true });
      addMessage('🪵 The imperial teak merchant loads the remaining planks back onto the ox-cart and guides it toward the next settlement on the imperial supply route.', 'info');
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
  emit(Events.IMPERIAL_TEAK_MERCHANT_CHANGED, { spawned: true });
  addMessage('🪵 An imperial teak merchant arrives managing an ox-cart loaded with seasoned teak planks — each air-dried for three years and marked with chalk notations recording origin, harvest season, and moisture content — along with a sample box of cross-section offcuts showing the interlocked grain, silica distribution, and natural oil sheen of the material. The merchant offers to commission a set of teak fittings for the settlement\'s buildings and harbour works, or to sell the current cargo of seasoned planks at the imperial fixed-quality price. Respond within 80 seconds.', 'info');
}

export function getActiveImperialTeakMerchant() { return state.imperialTeakMerchant?.active ?? null; }
export function getTeakMerchantSecsLeft() {
  const a = state.imperialTeakMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTeakFittings() {
  const a = state.imperialTeakMerchant;
  if (!a?.active) return { ok: false, reason: 'No teak merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The teak merchant has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned teak fittings from the imperial teak merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'teakMerchantCommission');
    state.randomEvents.activeModifiers.push({
      id: 'teakMerchantCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_TEAK_MERCHANT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The merchant unloads the selected planks and begins the commission by measuring the settlement's fitting requirements against the available stock — the door frames and window surrounds that form the primary set require planks with a stable, consistent grain running parallel to the plank face so that seasonal movement occurs uniformly across the width rather than in unpredictable diagonal directions that would rack the joints over time. The harbour fittings present a different requirement: the bollard caps and cleats that take rope loads in alternating directions need timber with the interlocked grain characteristic that prevents splitting under eccentric loading — material that a straight-grained timber would cleave cleanly along the fibre direction under the same load that the interlocked grain resists by forcing any fracture to change direction repeatedly across the growth layers. The cutting plan is drawn on the chalk face of the sample board — matching each piece of the commission to the section of the available planks that provides the best grain orientation for its particular function — and the joinery work proceeds with tools kept sharp enough to shave cleanly across the silica-laden fibres without tearing the surface. The completed fittings are installed while the merchant remains to supervise the joint-fitting and confirm that the commission is complete to the imperial standard. −${COMMISSION_WOOD_COST} wood −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseTeakStores() {
  const a = state.imperialTeakMerchant;
  if (!a?.active) return { ok: false, reason: 'No teak merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The teak merchant has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased teak stores from the imperial teak merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'teakMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'teakMerchantPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_TEAK_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📦 The merchant measures out the agreed portion of cargo — selecting the planks that represent the best value for general settlement use from the current stock: a mix of widths that will serve the most common joinery applications, with a proportion of narrow stock suitable for cladding and trim work as well as the wider planks needed for structural components. The transfer is recorded in the merchant's register with the moisture content of each plank noted against the settlement's account — the merchant explains that the notation exists so that a future transaction can establish whether the timber was worked at the correct moisture level for its application, since teak worked wet will shrink and open joints as it dries while teak worked too dry in a humid region will absorb moisture and swell, both conditions causing problems in finished work that can be avoided by matching the timber's moisture content to the conditions of its final installation. The settlement's timber store is organised to keep the new stock segregated from existing materials of unknown provenance so the craftspeople can select the correct material for premium work that requires documented quality. −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendTeakMerchantAway() {
  const a = state.imperialTeakMerchant;
  if (!a?.active) return { ok: false, reason: 'No teak merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_TEAK_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🪵 The imperial teak merchant loads the remaining planks back onto the ox-cart and guides it toward the next settlement on the imperial supply route.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
