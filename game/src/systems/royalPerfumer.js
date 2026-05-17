/**
 * EmpireOS — Royal Perfumer (T304).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a celebrated royal
 * perfumer arrives bearing exotic aromatic essences and the secrets of
 * imperial fragrance crafting. The player has 80 seconds to decide.
 *
 * Choices:
 *   🌸 Create Imperial Fragrance  — pay 20 food + 15 gold
 *        → +0.2 food/s for 2.5 min · +18 prestige · +12 morale
 *   🌿 Purchase Aromatic Herbs    — pay 22 food
 *        → +0.15 food/s for 2 min · +10 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.royalPerfumer = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalFragrances:     number,
 *   totalHerbs:          number,
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
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const FRAGRANCE_FOOD_COST        = 20;
export const FRAGRANCE_GOLD_COST        = 15;
export const FRAGRANCE_FOOD_RATE        = 0.2;
export const FRAGRANCE_PRESTIGE_REWARD  = 18;
export const FRAGRANCE_MORALE_REWARD    = 12;
export const FRAGRANCE_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const HERBS_FOOD_COST            = 22;
export const HERBS_FOOD_RATE            = 0.15;
export const HERBS_PRESTIGE_REWARD      = 10;
export const HERBS_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initRoyalPerfumer() {
  if (!state.royalPerfumer) {
    state.royalPerfumer = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalFragrances: 0,
      totalHerbs:      0,
      totalDismissals: 0,
    };
  }
  const s = state.royalPerfumer;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalFragrances  === undefined) s.totalFragrances  = 0;
  if (s.totalHerbs       === undefined) s.totalHerbs       = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function royalPerfumerTick() {
  const a = state.royalPerfumer;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.ROYAL_PERFUMER_CHANGED, { expired: true });
      addMessage('🌸 The royal perfumer carefully reseals his prized essence vials, packs away the gilded atomisers, and departs the imperial court to seek a more appreciative patron.', 'info');
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
  emit(Events.ROYAL_PERFUMER_CHANGED, { spawned: true });
  addMessage('🌸 A celebrated royal perfumer arrives bearing exquisite essence vials and aromatic herb bundles gathered from the most fragrant gardens across the known world, offering their craft to the empire. Respond within 80 seconds.', 'info');
}

export function getActivePerfumer() { return state.royalPerfumer?.active ?? null; }
export function getPerfumerSecsLeft() {
  const a = state.royalPerfumer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function createImperialFragrance() {
  const a = state.royalPerfumer;
  if (!a?.active) return { ok: false, reason: 'No perfumer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The perfumer has departed.' };
  if ((state.resources.food ?? 0) < FRAGRANCE_FOOD_COST) return { ok: false, reason: `Need ${FRAGRANCE_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < FRAGRANCE_GOLD_COST) return { ok: false, reason: `Need ${FRAGRANCE_GOLD_COST} gold.` };
  state.resources.food -= FRAGRANCE_FOOD_COST;
  state.resources.gold -= FRAGRANCE_GOLD_COST;
  changeMorale(FRAGRANCE_MORALE_REWARD);
  awardPrestige(FRAGRANCE_PRESTIGE_REWARD, 'Created imperial fragrance with the royal perfumer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'perfumerFragrance');
    state.randomEvents.activeModifiers.push({
      id: 'perfumerFragrance', resource: 'food',
      rateMult: 1 + (FRAGRANCE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + FRAGRANCE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalFragrances = (a.totalFragrances ?? 0) + 1;
  emit(Events.ROYAL_PERFUMER_CHANGED, { fragrance: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌸 The perfumer blends a magnificent imperial fragrance that lifts spirits across the empire. Citizens celebrate with renewed vigour and agricultural festivals bloom throughout the lands! −${FRAGRANCE_FOOD_COST} food · −${FRAGRANCE_GOLD_COST} gold · +${FRAGRANCE_PRESTIGE_REWARD} prestige · +${FRAGRANCE_MORALE_REWARD} morale. Harvest surge: +${FRAGRANCE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseAromaticHerbs() {
  const a = state.royalPerfumer;
  if (!a?.active) return { ok: false, reason: 'No perfumer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The perfumer has departed.' };
  if ((state.resources.food ?? 0) < HERBS_FOOD_COST) return { ok: false, reason: `Need ${HERBS_FOOD_COST} food.` };
  state.resources.food -= HERBS_FOOD_COST;
  awardPrestige(HERBS_PRESTIGE_REWARD, 'Purchased aromatic herbs from the royal perfumer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'perfumerHerbs');
    state.randomEvents.activeModifiers.push({
      id: 'perfumerHerbs', resource: 'food',
      rateMult: 1 + (HERBS_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + HERBS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalHerbs = (a.totalHerbs ?? 0) + 1;
  emit(Events.ROYAL_PERFUMER_CHANGED, { herbs: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The perfumer's aromatic herb bundles are distributed to the empire's farmers and gardeners, stimulating cultivation and enhancing crop yields through natural fertilisation techniques! −${HERBS_FOOD_COST} food · +${HERBS_PRESTIGE_REWARD} prestige. Cultivation surge: +${HERBS_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendPerfumerAway() {
  const a = state.royalPerfumer;
  if (!a?.active) return { ok: false, reason: 'No perfumer present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.ROYAL_PERFUMER_CHANGED, { dismissed: true });
  addMessage('🌸 The royal perfumer bows graciously, carefully repacks the precious essence vials, and departs with their aromatic treasures toward more welcoming courts.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
