/**
 * EmpireOS — Imperial Thread Merchant (T444).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), an imperial thread
 * merchant arrives at the settlement with a lacquered chest of fine thread
 * wound on polished wooden bobbins — silk thread reeled from cocoons sourced
 * at the great sericulture farms along the southern trade road, each skein
 * dyed to consistent weight-fast colour using mordanted pigments sourced from
 * the dyeing towns that line the rivers descending from the mountains, the
 * thread graded by count and twist into the precise weights needed for warp
 * threads in high-tension floor looms, weft threads for the floating pattern
 * weaves that produce the brocaded borders seen in court textiles, and the
 * finer counts used by embroiderers working goldwork and needlepoint panels
 * for altar cloths and royal garments — bearing also a collection of
 * illuminated sample cards showing the standard colour ranges available from
 * the merchant's regular suppliers, together with a written guarantee of
 * consistent colour-matching across separate dye lots for large orders — and
 * offering to arrange a standing imperial thread supply for the settlement's
 * weaving workshops and embroidery ateliers, or to sell a substantial purchase
 * of the finest thread collection from the current season's dyehouse output.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🧵 Arrange Imperial Thread Supply   — pay 25 food + 20 gold
 *        → +0.22 food/s for 2.5 min · +22 prestige · +12 morale
 *   📦 Purchase Silk Thread Collection  — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.imperialThreadMerchant = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_FOOD_COST        = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_FOOD_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 22;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_MANA_COST          = 20;
export const PURCHASE_MANA_RATE          = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialThreadMerchant() {
  if (!state.imperialThreadMerchant) {
    state.imperialThreadMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialThreadMerchant;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialThreadMerchantTick() {
  const a = state.imperialThreadMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_THREAD_MERCHANT_CHANGED, { expired: true });
      addMessage('🧵 The imperial thread merchant closes the lacquered chest, secures the bobbin trays, and departs along the merchant road to the next settlement on the trade route.', 'info');
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
  emit(Events.IMPERIAL_THREAD_MERCHANT_CHANGED, { spawned: true });
  addMessage('🧵 An imperial thread merchant arrives at the settlement bearing a lacquered chest of finest silk thread wound on polished wooden bobbins — dyed to consistent weight-fast colours and graded by count for warp, weft, and embroidery work — offering to arrange a standing imperial thread supply for the settlement\'s weaving workshops and embroidery ateliers, or to sell a substantial collection from the current season\'s finest dyehouse output. Respond within 80 seconds.', 'info');
}

export function getActiveImperialThreadMerchant() { return state.imperialThreadMerchant?.active ?? null; }
export function getThreadMerchantSecsLeft() {
  const a = state.imperialThreadMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function arrangeImperialThreadSupply() {
  const a = state.imperialThreadMerchant;
  if (!a?.active) return { ok: false, reason: 'No thread merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The thread merchant has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Arranged imperial thread supply with the imperial thread merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'threadMerchantCommission');
    state.randomEvents.activeModifiers.push({
      id: 'threadMerchantCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_THREAD_MERCHANT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧵 The thread merchant produces a formal contract written on vellum with the merchant house seal — committing to regular deliveries of graded silk thread in the full standard colour range to the settlement's weaving quarter, with guaranteed colour-matching across consecutive lots so that long-format brocade commissions can be completed without visible tonal breaks in the pattern work — the delivery schedule timed to arrive at the beginning of each new weaving commission so the workshops never stand idle waiting for materials — raising the output of the weaving workshops and embroidery ateliers across the settlement and generating considerable visible prosperity in the textile quarter! −${COMMISSION_FOOD_COST} food · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSilkThreadCollection() {
  const a = state.imperialThreadMerchant;
  if (!a?.active) return { ok: false, reason: 'No thread merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The thread merchant has departed.' };
  if ((state.resources.mana ?? 0) < PURCHASE_MANA_COST) return { ok: false, reason: `Need ${PURCHASE_MANA_COST} mana.` };
  state.resources.mana -= PURCHASE_MANA_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased silk thread collection from the imperial thread merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'threadMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'threadMerchantPurchase', resource: 'mana',
      rateMult: 1 + (PURCHASE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_THREAD_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📦 The thread merchant opens the lacquered chest and sets out the full bobbin trays — the complete current season's output from the finest dyehouses on the southern trade road: a dozen bobbins of the deepest ultramarine spun from the highest-grade silk reeled from cocoons grown on mulberry plantations under rigorous quality control, a matching dozen in the rich madder crimson that holds its depth through hard laundering, the three weights of undyed natural ecru silk for workshops that prefer to dye in-house, and a selection of the metallic effect threads — the gilded wrapping thread and the silverwork thread used for goldwork embroidery on vestments and court garments — all carefully wound to prevent tangling and packed in the waxed paper-lined trays that protect the delicate fibres from moisture and abrasion during transport. −${PURCHASE_MANA_COST} mana · +${PURCHASE_PRESTIGE_REWARD} prestige. Mana surge: +${PURCHASE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendThreadMerchantAway() {
  const a = state.imperialThreadMerchant;
  if (!a?.active) return { ok: false, reason: 'No thread merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_THREAD_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🧵 The imperial thread merchant closes the lacquered chest with a respectful bow and departs along the merchant road to the next settlement on the trade route.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
