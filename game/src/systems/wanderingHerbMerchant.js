/**
 * EmpireOS — Wandering Herb Merchant (T395).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering herb merchant
 * arrives at the imperial gates carrying wicker baskets overflowing with dried
 * herbs, medicinal roots, aromatic bundles, and pressed botanical remedies —
 * offering to prepare a restorative collection of herbal remedies for the empire's
 * citizens, or to share ancient herb-cultivation and medicinal brewing lore with
 * the imperial healers and kitcheners.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🌿 Commission Herbal Remedies  — pay 25 food
 *        → +0.25 food/s for 2.5 min · +18 prestige · +12 morale
 *   📜 Purchase Herb Lore          — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.wanderingHerbMerchant = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST        = 25;
export const COMMISSION_FOOD_RATE        = 0.25;
export const COMMISSION_PRESTIGE_REWARD  = 18;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingHerbMerchant() {
  if (!state.wanderingHerbMerchant) {
    state.wanderingHerbMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingHerbMerchant;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function wanderingHerbMerchantTick() {
  const a = state.wanderingHerbMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_HERB_MERCHANT_CHANGED, { expired: true });
      addMessage('🌿 The wandering herb merchant carefully packs away the unsold remedies, drapes a linen cloth over the baskets, and bows respectfully before departing from the capital — the fragrant scent of dried herbs and medicinal roots lingering on the breeze as the merchant vanishes down the road.', 'info');
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
  emit(Events.WANDERING_HERB_MERCHANT_CHANGED, { spawned: true });
  addMessage('🌿 A wandering herb merchant arrives at the imperial gates carrying wicker baskets overflowing with dried herbs, medicinal roots, aromatic bundles, and pressed botanical remedies — offering to prepare a restorative collection of herbal remedies for the empire\'s citizens, or to share ancient herb-cultivation and medicinal brewing lore with the imperial healers. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingHerbMerchant() { return state.wanderingHerbMerchant?.active ?? null; }
export function getHerbMerchantSecsLeft() {
  const a = state.wanderingHerbMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionHerbalRemedies() {
  const a = state.wanderingHerbMerchant;
  if (!a?.active) return { ok: false, reason: 'No herb merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The herb merchant has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned herbal remedies from the wandering herb merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'herbMerchantCommission');
    state.randomEvents.activeModifiers.push({
      id: 'herbMerchantCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_HERB_MERCHANT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The herb merchant sets to work with practiced hands — grinding, blending, and pressing botanical remedies that are distributed throughout the city's households and barracks, restoring vigour and vitality to the empire's workers and lifting spirits across the realm. The herbal boost inspires greater agricultural productivity! −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseHerbLore() {
  const a = state.wanderingHerbMerchant;
  if (!a?.active) return { ok: false, reason: 'No herb merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The herb merchant has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased herb lore from the wandering herb merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'herbMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'herbMerchantPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_HERB_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The herb merchant unfurls a collection of hand-illustrated herb guides — ancient cultivation charts, drying and pressing methods, and medicinal brewing recipes that the imperial apothecaries eagerly adopt, establishing thriving herb markets and lucrative botanical trade routes that steadily enrich the imperial treasury! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendHerbMerchantAway() {
  const a = state.wanderingHerbMerchant;
  if (!a?.active) return { ok: false, reason: 'No herb merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_HERB_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🌿 The herb merchant carefully packs away the unsold remedies, drapes a linen cloth over the baskets, and bows respectfully before departing from the capital — the fragrant herbal scent fading on the breeze.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
