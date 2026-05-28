/**
 * EmpireOS — Wandering Dye Merchant (T433).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering dye
 * merchant arrives at the settlement carrying a heavy pack of dry pigment
 * cakes wrapped in oiled linen — blocks of weld yellow ground from the
 * dried flowering tops of reseda luteola gathered at peak colour, woad
 * cakes pressed from the fermented and dried pulped leaf mass of isatis
 * tinctoria plants cut before the seed sets, madder blocks made from
 * the ground dried roots of rubia tinctorum lifted in the third year
 * when the alizarin content reaches its maximum, and a sealed clay pot
 * of imported kermes granules — the dried bodies of the scale insect
 * Kermes vermilio scraped from the bark of kermes oak in late spring
 * before the dye content is lost to reproduction — along with a set
 * of alum mordant cakes and the tin-salt fixatives needed to shift the
 * hue range toward the crimson and scarlet end of the spectrum — offering
 * to commission a full dye works that colours the settlement's cloth
 * output in prestige imperial colours for the season, or to share the
 * mordanting and vatting knowledge that keeps a dye workshop running
 * reliably from locally-available materials. The player has 80 seconds
 * to decide.
 *
 * Choices:
 *   🎨 Commission Royal Dyes   — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +10 morale
 *   📖 Purchase Dye Secrets    — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away               — dismiss (no reward)
 *
 * state.wanderingDyeMerchant = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST            = 20;
export const COMMISSION_WOOD_COST            = 15;
export const COMMISSION_FOOD_RATE            = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 18;
export const COMMISSION_MORALE_REWARD        = 10;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST              = 18;
export const PURCHASE_GOLD_RATE              = 0.15;
export const PURCHASE_PRESTIGE_REWARD        = 12;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingDyeMerchant() {
  if (!state.wanderingDyeMerchant) {
    state.wanderingDyeMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingDyeMerchant;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingDyeMerchantTick() {
  const a = state.wanderingDyeMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_DYE_MERCHANT_CHANGED, { expired: true });
      addMessage('🎨 The wandering dye merchant rewraps the pigment cakes in oiled linen, re-stoppers the kermes pot, and re-shoulders the heavy dye pack — departing along the trade road as the distinctive mineral smell of dry pigment slowly fades from the air.', 'info');
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
  emit(Events.WANDERING_DYE_MERCHANT_CHANGED, { spawned: true });
  addMessage('🎨 A wandering dye merchant arrives carrying a heavy pack of dry pigment cakes wrapped in oiled linen — weld yellow, woad blue, madder red blocks, and a sealed clay pot of kermes granules — along with alum mordant cakes and tin-salt fixatives for shifting hue toward imperial crimson — offering to commission a full dye works that colours the settlement\'s cloth output in prestige imperial colours for the season, or to share the mordanting and vatting knowledge that keeps a dye workshop running reliably from locally-available materials. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingDyeMerchant() { return state.wanderingDyeMerchant?.active ?? null; }
export function getDyeMerchantSecsLeft() {
  const a = state.wanderingDyeMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalDyes() {
  const a = state.wanderingDyeMerchant;
  if (!a?.active) return { ok: false, reason: 'No dye merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The dye merchant has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned royal dyes from the wandering dye merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dyeMerchantCommission');
    state.randomEvents.activeModifiers.push({
      id: 'dyeMerchantCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_DYE_MERCHANT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The dye merchant sets up the mordanting vats in sequence — first steeping the cloth lengths in the alum mordant bath to fix the metal salt into the fibre matrix before dyeing, then working through the colour sequence from the lightest weld yellow through the woad blue saddle-bath to the madder red overdye that deepens the blue toward the imperial purple, finishing with the scarlet override using kermes and tin-salt fixative that locks the crimson firmly into the surface of the fibre — delivering cloth dyed in the full range of prestige imperial colours that elevates the settlement's textile goods to the highest trade value and brings exceptional recognition to the court's appearance at every formal occasion! −${COMMISSION_FOOD_COST} food · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseDyeSecrets() {
  const a = state.wanderingDyeMerchant;
  if (!a?.active) return { ok: false, reason: 'No dye merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The dye merchant has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased dye secrets from the wandering dye merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dyeMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'dyeMerchantPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_DYE_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The dye merchant shares the accumulated mordanting and vatting knowledge — the alum concentration ratios that produce the deepest mordant bite without damaging wool fibre, the temperature sequence for the weld bath that extracts maximum luteolin without degrading the yellow to brown, the woad vat maintenance method using urine fermentation and wheat bran as the reduction agents that keep the indigo in its soluble leuco form ready for oxygen reoxidation on the fibre surface, and the madder root selection criteria that distinguishes three-year alizarin-rich roots from younger ones — knowledge that allows the settlement's dye workshop to produce the full range of imperial colours reliably from locally-sourced plant materials without dependence on imported dyestuffs. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendDyeMerchantAway() {
  const a = state.wanderingDyeMerchant;
  if (!a?.active) return { ok: false, reason: 'No dye merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_DYE_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🎨 The wandering dye merchant rewraps the pigment cakes and re-shoulders the dye pack, departing along the trade road with a respectful nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
