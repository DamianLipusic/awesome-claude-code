/**
 * EmpireOS — Wandering Incense Maker (T356).
 *
 * Every 12–16 minutes (Bronze Age+, 8+ player tiles), a wandering incense
 * maker arrives bearing dried herbs, fragrant resins, and a portable brazier
 * for blending ceremonial incense. The player has 80 seconds to decide.
 *
 * Choices:
 *   🕯️ Prepare Sacred Incense  — pay 20 food + 15 mana
 *        → +0.20 food/s for 2.5 min · +18 prestige · +12 morale
 *   🌿 Purchase Aromatic Blends — pay 20 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   👋 Send Away               — dismiss (no reward)
 *
 * state.wanderingIncenseMaker = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalIncense:      number,
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
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const INCENSE_FOOD_COST          = 20;
export const INCENSE_MANA_COST          = 15;
export const INCENSE_FOOD_RATE          = 0.20;
export const INCENSE_PRESTIGE_REWARD    = 18;
export const INCENSE_MORALE_REWARD      = 12;
export const INCENSE_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST         = 20;
export const PURCHASE_GOLD_RATE         = 0.15;
export const PURCHASE_PRESTIGE_REWARD   = 12;
export const PURCHASE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingIncenseMaker() {
  if (!state.wanderingIncenseMaker) {
    state.wanderingIncenseMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalIncense:     0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingIncenseMaker;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalIncense    === undefined) s.totalIncense    = 0;
  if (s.totalPurchases  === undefined) s.totalPurchases  = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingIncenseMakerTick() {
  const a = state.wanderingIncenseMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_INCENSE_MAKER_CHANGED, { expired: true });
      addMessage('🕯️ The wandering incense maker extinguishes the portable brazier, wraps the fragrant resin cakes in waxed cloth, and packs away the dried herbs before departing to seek a temple or court with a greater appreciation for sacred aromas.', 'info');
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
  emit(Events.WANDERING_INCENSE_MAKER_CHANGED, { spawned: true });
  addMessage('🕯️ A wandering incense maker arrives bearing bundles of dried lavender, cedar chips, frankincense tears, and myrrh resin — ingredients for the sacred blends used in temple ceremonies throughout the known world. They offer to prepare a special ceremonial incense for the empire\'s temples or to sell a collection of exotic aromatic blends prized by merchants and nobles alike. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingIncenseMaker() { return state.wanderingIncenseMaker?.active ?? null; }
export function getIncenseMakerSecsLeft() {
  const a = state.wanderingIncenseMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function prepareSacredIncense() {
  const a = state.wanderingIncenseMaker;
  if (!a?.active) return { ok: false, reason: 'No incense maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The incense maker has departed.' };
  if ((state.resources.food ?? 0) < INCENSE_FOOD_COST) return { ok: false, reason: `Need ${INCENSE_FOOD_COST} food.` };
  if ((state.resources.mana ?? 0) < INCENSE_MANA_COST) return { ok: false, reason: `Need ${INCENSE_MANA_COST} mana.` };
  state.resources.food -= INCENSE_FOOD_COST;
  state.resources.mana -= INCENSE_MANA_COST;
  changeMorale(INCENSE_MORALE_REWARD);
  awardPrestige(INCENSE_PRESTIGE_REWARD, 'Commissioned sacred ceremonial incense from the wandering incense maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'incenseMakerIncense');
    state.randomEvents.activeModifiers.push({
      id: 'incenseMakerIncense', resource: 'food',
      rateMult: 1 + (INCENSE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + INCENSE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalIncense = (a.totalIncense ?? 0) + 1;
  emit(Events.WANDERING_INCENSE_MAKER_CHANGED, { incense: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🕯️ The incense maker tends the portable brazier with patient skill, blending frankincense, myrrh, and sacred herbs in precise proportions before pouring the mixture into ornate temple censers. As the fragrant smoke fills the temples and public spaces, citizens feel a deep spiritual calm descend upon the city — priests report more worshippers, farmers feel blessed by the sacred aromas, and the whole empire's productivity lifts on a cloud of sacred fragrance! −${INCENSE_FOOD_COST} food · −${INCENSE_MANA_COST} mana · +${INCENSE_PRESTIGE_REWARD} prestige · +${INCENSE_MORALE_REWARD} morale. Food surge: +${INCENSE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseAromaticBlends() {
  const a = state.wanderingIncenseMaker;
  if (!a?.active) return { ok: false, reason: 'No incense maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The incense maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased exotic aromatic blends from the wandering incense maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'incenseMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'incenseMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_INCENSE_MAKER_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The incense maker opens a beautifully carved chest to reveal carefully packaged blends — rosewater-soaked cedar for relaxation, peppercorn-and-clove for energy, sandalwood for focus. Merchants recognise their value immediately and purchase them as luxury gifts, while nobles use them to scent their halls — the exotic trade in aromatic goods becomes a profitable new commercial venture for the empire! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendIncenseMakerAway() {
  const a = state.wanderingIncenseMaker;
  if (!a?.active) return { ok: false, reason: 'No incense maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_INCENSE_MAKER_CHANGED, { dismissed: true });
  addMessage('🕯️ The wandering incense maker bows graciously, extinguishes the portable brazier with a gentle wave of incense smoke, and wraps the fragrant resins and herbs before departing to share their aromatic arts with a more receptive court.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
