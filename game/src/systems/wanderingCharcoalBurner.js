/**
 * EmpireOS — Wandering Charcoal Burner (T465).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering charcoal
 * burner arrives carrying a covered iron pot of glowing hardwood coals and a
 * bundle of green timber poles ready to be stacked into a mound — explaining
 * the slow-smouldering technique whereby stacked roundwood is covered with
 * earth and turf to restrict airflow, then lit at the top through a single
 * vent and allowed to carbonise over three to five days until the mound cools
 * to a dull gleam and the covering is stripped back to reveal a heap of
 * dense, lightweight charcoal that burns hotter and cleaner than any green
 * wood, ideal for smiths' forges, metal smelters, and pottery kilns — offering
 * to commission a full charcoal works beside the settlement timber store, or
 * to impart the burning craft so local woodsmen can manage the process
 * independently year round. The player has 80 seconds to decide.
 *
 * Choices:
 *   🪵 Commission Charcoal Works      — pay 20 wood + 15 food
 *        → +0.22 wood/s for 2.5 min · +15 prestige · +8 morale
 *   📜 Purchase Charcoal Burning Lore — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.wanderingCharcoalBurner = {
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

export const COMMISSION_WOOD_COST           = 20;
export const COMMISSION_FOOD_COST           = 15;
export const COMMISSION_WOOD_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD     = 15;
export const COMMISSION_MORALE_REWARD       = 8;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST             = 18;
export const PURCHASE_GOLD_RATE             = 0.15;
export const PURCHASE_PRESTIGE_REWARD       = 10;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCharcoalBurner() {
  if (!state.wanderingCharcoalBurner) {
    state.wanderingCharcoalBurner = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingCharcoalBurner;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingCharcoalBurnerTick() {
  const a = state.wanderingCharcoalBurner;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_CHARCOAL_BURNER_CHANGED, { expired: true });
      addMessage('🪵 The wandering charcoal burner smothers the iron pot of coals, bundles the timber poles across the shoulder, and trudges away through the tree line in search of another settlement with a need for a proper charcoal works.', 'info');
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
  emit(Events.WANDERING_CHARCOAL_BURNER_CHANGED, { spawned: true });
  addMessage('🪵 A wandering charcoal burner arrives at the settlement carrying a covered iron pot of glowing hardwood coals and a bundle of green timber poles — explaining the slow-smouldering mound technique where stacked roundwood is covered in earth and turf to restrict airflow and allowed to carbonise over three to five days into dense, lightweight charcoal that burns hotter and cleaner than any green wood: perfect for smiths\' forges, smelters, and pottery kilns. The burner offers to commission a full charcoal works beside the timber store, or to teach the full craft for independent year-round production. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingCharcoalBurner() { return state.wanderingCharcoalBurner?.active ?? null; }
export function getCharcoalBurnerSecsLeft() {
  const a = state.wanderingCharcoalBurner?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCharcoalWorks() {
  const a = state.wanderingCharcoalBurner;
  if (!a?.active) return { ok: false, reason: 'No charcoal burner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The charcoal burner has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned a charcoal works from the wandering charcoal burner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'charcoalBurnerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'charcoalBurnerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_CHARCOAL_BURNER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The charcoal burner selects a flat clearing beside the timber store and begins laying out the mound — arranging the roundwood billets in a dense hemisphere around a central chimney post, each layer of wood leaned inward so the pile tapers toward a crown, covered with a thick blanket of turf and packed earth that seals every gap except the vent at the top. The chimney post is withdrawn once the covering is complete, and the fire lit at the top vent: a slow smouldering that sends a thin thread of blue smoke skyward for the first twenty-four hours, thickening to a pale grey as the carbonisation front advances downward through the mass, the whole mound breathing with subtle shifts in the smoke column that the burner reads to judge whether any gap has opened and needs patching. After three full days the vent is sealed and the mound left to cool, until the burner strips back the covering to reveal a hemisphere of gleaming black charcoal ready for the forges and kilns. −${COMMISSION_WOOD_COST} wood −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCharcoalBurningLore() {
  const a = state.wanderingCharcoalBurner;
  if (!a?.active) return { ok: false, reason: 'No charcoal burner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The charcoal burner has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased charcoal burning lore from the wandering charcoal burner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'charcoalBurnerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'charcoalBurnerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_CHARCOAL_BURNER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The charcoal burner opens a battered leather-bound notebook filled with careful diagrams and margin notes accumulated over two decades of itinerant burning: the ideal moisture content of timber at stacking — green enough to resist ignition but dry enough to carbonise cleanly, typically harvested in early autumn and stacked under cover for six weeks; the proportions of the mound by diameter and height that give the most even carbonisation; the precise turf-and-earth covering thickness — too thin and air leaks in, too thick and the fire suffocates; the smoke-reading guide, with sketches showing the colour and density of smoke at each stage of the burn alongside the corrective action required if the column turns black or vanishes entirely. A separate section covers the economics of different wood species: the relative carbon yield, the suitability for different forge temperatures, the species to be cut in rotation so the coppice recovers within a single generation. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCharcoalBurnerAway() {
  const a = state.wanderingCharcoalBurner;
  if (!a?.active) return { ok: false, reason: 'No charcoal burner present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_CHARCOAL_BURNER_CHANGED, { dismissed: true });
  addMessage('🪵 The wandering charcoal burner smothers the iron pot of coals, bundles the timber poles across the shoulder, and trudges away through the tree line in search of another settlement with a need for a proper charcoal works.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
