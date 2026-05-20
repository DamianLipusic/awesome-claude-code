/**
 * EmpireOS — Wandering Embroiderer (T339).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a skilled wandering
 * embroiderer arrives bearing needles, coloured threads, silk-work frames,
 * and finished examples of ornate banners, tapestries, and royal garments
 * embellished with gold-threaded heraldic designs.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪡 Embroider Imperial Banners — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +10 morale
 *   📜 Purchase Needlework Patterns — pay 18 gold
 *        → +0.15 gold/s for 2 min   · +12 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.wanderingEmbroiderer = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalEmbroidered: number,
 *   totalPurchased:   number,
 *   totalDismissals:  number,
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

export const EMBROIDER_FOOD_COST          = 20;
export const EMBROIDER_WOOD_COST          = 15;
export const EMBROIDER_FOOD_RATE          = 0.22;
export const EMBROIDER_PRESTIGE_REWARD    = 18;
export const EMBROIDER_MORALE_REWARD      = 10;
export const EMBROIDER_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST           = 18;
export const PURCHASE_GOLD_RATE           = 0.15;
export const PURCHASE_PRESTIGE_REWARD     = 12;
export const PURCHASE_DURATION_TICKS      = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingEmbroiderer() {
  if (!state.wanderingEmbroiderer) {
    state.wanderingEmbroiderer = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalEmbroidered: 0,
      totalPurchased:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingEmbroiderer;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalEmbroidered === undefined) s.totalEmbroidered = 0;
  if (s.totalPurchased   === undefined) s.totalPurchased   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingEmbroidererTick() {
  const a = state.wanderingEmbroiderer;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_EMBROIDERER_CHANGED, { expired: true });
      addMessage('🪡 The wandering embroiderer gathers their needles, silk threads, and half-finished banner frames, carefully wraps their finest samples in oilcloth, and continues their journey to the next town on their embroidery circuit.', 'info');
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
  emit(Events.WANDERING_EMBROIDERER_CHANGED, { spawned: true });
  addMessage('🪡 A wandering embroiderer arrives at the imperial gates bearing silk-work frames, skeins of gold and silver thread, and stunning examples of ornate heraldic banners, embroidered tapestries, and royal ceremonial garments. They offer to embroider magnificent works for the empire or share their needlework pattern scrolls. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingEmbroiderer() { return state.wanderingEmbroiderer?.active ?? null; }
export function getEmbroidererSecsLeft() {
  const a = state.wanderingEmbroiderer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function embroiderImperialBanners() {
  const a = state.wanderingEmbroiderer;
  if (!a?.active) return { ok: false, reason: 'No embroiderer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The embroiderer has departed.' };
  if ((state.resources.food ?? 0) < EMBROIDER_FOOD_COST) return { ok: false, reason: `Need ${EMBROIDER_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < EMBROIDER_WOOD_COST) return { ok: false, reason: `Need ${EMBROIDER_WOOD_COST} wood.` };
  state.resources.food -= EMBROIDER_FOOD_COST;
  state.resources.wood -= EMBROIDER_WOOD_COST;
  changeMorale(EMBROIDER_MORALE_REWARD);
  awardPrestige(EMBROIDER_PRESTIGE_REWARD, 'Embroidered imperial banners with the wandering embroiderer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'embroidererBanners');
    state.randomEvents.activeModifiers.push({
      id: 'embroidererBanners', resource: 'food',
      rateMult: 1 + (EMBROIDER_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + EMBROIDER_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalEmbroidered = (a.totalEmbroidered ?? 0) + 1;
  emit(Events.WANDERING_EMBROIDERER_CHANGED, { embroidered: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪡 The embroiderer sets up their frame in the imperial hall and begins stitching magnificent heraldic banners with gold and silver thread, ornate ceremonial pennants for the palace gates, and embroidered crests for the royal guard. Citizens swell with pride at the splendid new imperial imagery! −${EMBROIDER_FOOD_COST} food · −${EMBROIDER_WOOD_COST} wood · +${EMBROIDER_PRESTIGE_REWARD} prestige · +${EMBROIDER_MORALE_REWARD} morale. Food surge: +${EMBROIDER_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseNeedleworkPatterns() {
  const a = state.wanderingEmbroiderer;
  if (!a?.active) return { ok: false, reason: 'No embroiderer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The embroiderer has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased needlework patterns from the wandering embroiderer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'embroidererPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'embroidererPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.WANDERING_EMBROIDERER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The embroiderer hands over a collection of intricate needlework pattern scrolls, stitch diagrams, and colour-guide manuscripts for producing embroidered heraldic devices at scale. Imperial textile workshops begin selling fine embroidered goods at premium prices! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendEmbroidererAway() {
  const a = state.wanderingEmbroiderer;
  if (!a?.active) return { ok: false, reason: 'No embroiderer present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_EMBROIDERER_CHANGED, { dismissed: true });
  addMessage('🪡 The wandering embroiderer nods politely, carefully bundles their silk threads and needlework frames, and sets off down the road toward the next settlement on their embroidery circuit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
