/**
 * EmpireOS — Wandering Pigment Merchant (T459).
 *
 * Every 12–16 minutes (Bronze Age+, 8+ player tiles), a wandering pigment
 * merchant arrives at the settlement carrying leather-strapped sample cases
 * fitted with divided wooden trays — each compartment holding a small
 * quantity of a different mineral pigment in its raw form: ochres and siennas
 * in shades from pale yellow through burnt orange to deep reddish-brown
 * depending on iron oxide content and firing temperature; azurite and malachite
 * ground to different fineness producing gradations from pale aquamarine to
 * deep verdigris; galena for black; red lead and white lead in sealed clay
 * pots; vermilion in a separate compartment because the mercury compound stains
 * other pigments on contact; each sample accompanied by a note in cramped
 * script indicating the source quarry, the extraction and preparation method,
 * and the price per standardised weight — offering to supply enough mineral
 * pigments to coat all significant settlement buildings with tinted lime wash,
 * the pigments delivered in fired clay pots sealed with beeswax; or to sell a
 * comprehensive mineral dye manual covering extraction, mordant preparation,
 * and fixing techniques for woven textiles. The player has 80 seconds to decide.
 *
 * Choices:
 *   🎨 Arrange Pigment Supply       — pay 20 stone + 15 gold
 *        → +0.22 stone/s for 2.5 min · +18 prestige · +10 morale
 *   📚 Purchase Dye Formulas        — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingPigmentMerchant = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalArrangements:   number,
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
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const ARRANGE_STONE_COST           = 20;
export const ARRANGE_GOLD_COST            = 15;
export const ARRANGE_STONE_RATE           = 0.22;
export const ARRANGE_PRESTIGE_REWARD      = 18;
export const ARRANGE_MORALE_REWARD        = 10;
export const ARRANGE_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST           = 18;
export const PURCHASE_GOLD_RATE           = 0.15;
export const PURCHASE_PRESTIGE_REWARD     = 12;
export const PURCHASE_DURATION_TICKS      = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingPigmentMerchant() {
  if (!state.wanderingPigmentMerchant) {
    state.wanderingPigmentMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalArrangements: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingPigmentMerchant;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalArrangements  === undefined) s.totalArrangements  = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingPigmentMerchantTick() {
  const a = state.wanderingPigmentMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_PIGMENT_MERCHANT_CHANGED, { expired: true });
      addMessage('🎨 The wandering pigment merchant carefully repacks the mineral sample trays into the leather cases, secures the lids over the fired-clay pigment pots, and departs to the next settlement along the trade road.', 'info');
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
  emit(Events.WANDERING_PIGMENT_MERCHANT_CHANGED, { spawned: true });
  addMessage('🎨 A wandering pigment merchant arrives at the settlement with leather-strapped sample cases — divided wooden trays holding mineral pigments in their raw form: ochres and siennas ranging from pale yellow through burnt orange to deep reddish-brown, azurite and malachite ground to gradations of aquamarine and verdigris, galena for black, vermilion in a sealed compartment — offering to supply fired-clay pots of tinted lime wash pigments for all settlement buildings, or to sell a comprehensive mineral dye manual covering extraction, mordant preparation, and textile-fixing techniques. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingPigmentMerchant() { return state.wanderingPigmentMerchant?.active ?? null; }
export function getPigmentMerchantSecsLeft() {
  const a = state.wanderingPigmentMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function arrangePigmentSupply() {
  const a = state.wanderingPigmentMerchant;
  if (!a?.active) return { ok: false, reason: 'No pigment merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The pigment merchant has departed.' };
  if ((state.resources.stone ?? 0) < ARRANGE_STONE_COST) return { ok: false, reason: `Need ${ARRANGE_STONE_COST} stone.` };
  if ((state.resources.gold  ?? 0) < ARRANGE_GOLD_COST)  return { ok: false, reason: `Need ${ARRANGE_GOLD_COST} gold.` };
  state.resources.stone -= ARRANGE_STONE_COST;
  state.resources.gold  -= ARRANGE_GOLD_COST;
  changeMorale(ARRANGE_MORALE_REWARD);
  awardPrestige(ARRANGE_PRESTIGE_REWARD, 'Arranged mineral pigment supply from the wandering pigment merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'pigmentArrange');
    state.randomEvents.activeModifiers.push({
      id: 'pigmentArrange', resource: 'stone',
      rateMult: 1 + (ARRANGE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + ARRANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalArrangements = (a.totalArrangements ?? 0) + 1;
  emit(Events.WANDERING_PIGMENT_MERCHANT_CHANGED, { arranged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The pigment merchant weighs out the stone blocks with a hand balance and nods with satisfaction — explaining that the flat-grained quartzite is particularly suited as a grinding slab for mineral pigments, the surface hard enough to fracture the azurite crystals without introducing iron contamination that would shift the colour toward green — then opens the full sample portfolio and marks the source quarry locations on a rough map, indicating the ochre banks near the eastern drainage where the iron-rich clay weathers out in seasonal rains, the azurite veins at the limestone contact in the northern hills, and the galena lens exposed in the old stream cut — information that will allow the settlement's quarrymen to source their own mineral pigments directly rather than depending on travelling merchants. −${ARRANGE_STONE_COST} stone −${ARRANGE_GOLD_COST} gold · +${ARRANGE_PRESTIGE_REWARD} prestige · +${ARRANGE_MORALE_REWARD} morale. Stone surge: +${ARRANGE_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseDyeFormulas() {
  const a = state.wanderingPigmentMerchant;
  if (!a?.active) return { ok: false, reason: 'No pigment merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The pigment merchant has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased mineral dye formulas from the wandering pigment merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'pigmentPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'pigmentPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_PIGMENT_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📚 The pigment merchant produces a thick manuscript bound in worn leather — pages of close-written text organised by mineral type, covering extraction and preparation for each pigment class: the ochre and sienna earths, which require only washing to separate the pigment-rich fraction from coarse sand and gravel, followed by levigation in still water to classify the particles by size, then low-temperature firing in sealed clay vessels to deepen the colour from yellow through orange to the red-browns of burnt sienna; the malachite and azurite carbonates, which must be carefully separated from associated calcite and quartz by selective grinding and flotation before being levigated to the fineness required for painting; the mineral dye formulas themselves, covering the alum mordant preparation from potash alum dissolved in rainwater, the tannin pre-mordant sequence that improves affinity between the mineral pigment and wool or linen fibre, and the finishing baths that fix the colour and resist washing — techniques that will allow the settlement's weavers to produce brilliantly coloured textiles commanding premium prices in distant markets. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendPigmentMerchantAway() {
  const a = state.wanderingPigmentMerchant;
  if (!a?.active) return { ok: false, reason: 'No pigment merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_PIGMENT_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🎨 The wandering pigment merchant repacks the mineral sample cases and departs to find another settlement interested in the pigment stock.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
