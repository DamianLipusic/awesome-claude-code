/**
 * EmpireOS — Wandering Dressmaker (T383).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a skilled dressmaker
 * arrives at court carrying bolts of fine fabric, silver needles, and an
 * array of ornate thread — offering to sew a magnificent set of imperial
 * gowns for the palace household, or to sell rare dressmaking patterns and
 * embroidery secrets to the court seamstresses.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   👗 Sew Imperial Gowns         — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +8 morale
 *   🧵 Purchase Dressmaking Patterns — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.wanderingDressmaker = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalSewings:      number,
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const SEW_FOOD_COST             = 20;
export const SEW_WOOD_COST             = 15;
export const SEW_FOOD_RATE             = 0.22;
export const SEW_PRESTIGE_REWARD       = 18;
export const SEW_MORALE_REWARD         = 8;
export const SEW_DURATION_TICKS        = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST        = 18;
export const PURCHASE_GOLD_RATE        = 0.15;
export const PURCHASE_PRESTIGE_REWARD  = 12;
export const PURCHASE_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingDressmaker() {
  if (!state.wanderingDressmaker) {
    state.wanderingDressmaker = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalSewings:    0,
      totalPurchases:  0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingDressmaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalSewings     === undefined) s.totalSewings     = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingDressmakertick() {
  const a = state.wanderingDressmaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_DRESSMAKER_CHANGED, { expired: true });
      addMessage('👗 The wandering dressmaker folds the bolt of fine fabric with practiced care, tucks the silver needles into a cushioned case, and departs with an elegant curtsy — leaving behind only the faint scent of lavender and the quiet rustle of silk.', 'info');
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
  emit(Events.WANDERING_DRESSMAKER_CHANGED, { spawned: true });
  addMessage('👗 A skilled wandering dressmaker arrives at the palace gate carrying bolts of fine fabric, silver needles, and spools of ornate thread — offering to sew a magnificent collection of imperial gowns for the royal household, or to share prized dressmaking patterns and embroidery secrets with the court seamstresses. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingDressmaker() { return state.wanderingDressmaker?.active ?? null; }
export function getDressmakertSecsLeft() {
  const a = state.wanderingDressmaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function sewImperialGowns() {
  const a = state.wanderingDressmaker;
  if (!a?.active) return { ok: false, reason: 'No dressmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The dressmaker has departed.' };
  if ((state.resources.food ?? 0) < SEW_FOOD_COST) return { ok: false, reason: `Need ${SEW_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < SEW_WOOD_COST) return { ok: false, reason: `Need ${SEW_WOOD_COST} wood.` };
  state.resources.food -= SEW_FOOD_COST;
  state.resources.wood -= SEW_WOOD_COST;
  changeMorale(SEW_MORALE_REWARD);
  awardPrestige(SEW_PRESTIGE_REWARD, 'Commissioned imperial gowns from the wandering dressmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dressmakertSew');
    state.randomEvents.activeModifiers.push({
      id: 'dressmakertSew', resource: 'food',
      rateMult: 1 + (SEW_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + SEW_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalSewings = (a.totalSewings ?? 0) + 1;
  emit(Events.WANDERING_DRESSMAKER_CHANGED, { sewn: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`👗 The dressmaker sets up a portable loom in the palace sewing room and crafts a breathtaking collection of embroidered imperial gowns — the splendid garments delight the court nobility, sparking a fashion craze that inspires festivals, feasts, and a surge of celebratory cooking across the empire! −${SEW_FOOD_COST} food · −${SEW_WOOD_COST} wood · +${SEW_PRESTIGE_REWARD} prestige · +${SEW_MORALE_REWARD} morale. Food surge: +${SEW_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseDressmakingPatterns() {
  const a = state.wanderingDressmaker;
  if (!a?.active) return { ok: false, reason: 'No dressmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The dressmaker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased dressmaking patterns from the wandering dressmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dressmakertPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'dressmakertPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_DRESSMAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧵 The dressmaker spreads out an exquisite collection of pattern books and embroidery guides on the palace table — court seamstresses eagerly study the intricate designs, creating fashion-forward garments commissioned by nobles and wealthy merchants whose payments flow steadily into the imperial treasury! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendDressmakertAway() {
  const a = state.wanderingDressmaker;
  if (!a?.active) return { ok: false, reason: 'No dressmaker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_DRESSMAKER_CHANGED, { dismissed: true });
  addMessage('👗 The dressmaker gathers the bolts of fine fabric with quiet grace, places the silver needles and thread in a travelling case, and departs through the palace gates — the soft swish of skirts fading as the craftsperson vanishes into the city streets.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
