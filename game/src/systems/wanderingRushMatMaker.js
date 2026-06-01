/**
 * EmpireOS — Wandering Rush Mat Maker (T473).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering rush mat maker
 * arrives at the settlement carrying bundles of dried sedge and bulrush harvested
 * from the nearest marsh — long straight stems sorted by thickness and cured flat
 * under weighted boards to remove the natural curve — along with a set of finished
 * mats in several weave styles: a simple over-under tabby weave for doorstep use,
 * a tighter twill weave for the floor of the chieftain's hall, and a coiled-rush
 * mat sealed with a ring of braided stems around the edge to keep it from fraying
 * at the corners — offering to commission a supply of rush floor-coverings for the
 * settlement's households, or to sell the rush mat-weaving craft so local artisans
 * can maintain an independent supply.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🌾 Commission Rush Mat Collection   — pay 20 food + 15 wood
 *        → +0.20 food/s for 2.5 min · +15 prestige · +8 morale
 *   📜 Purchase Rush Mat Craft          — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.wanderingRushMatMaker = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST            = 20;
export const COMMISSION_WOOD_COST            = 15;
export const COMMISSION_FOOD_RATE            = 0.20;
export const COMMISSION_PRESTIGE_REWARD      = 15;
export const COMMISSION_MORALE_REWARD        = 8;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST              = 18;
export const PURCHASE_GOLD_RATE              = 0.15;
export const PURCHASE_PRESTIGE_REWARD        = 10;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingRushMatMaker() {
  if (!state.wanderingRushMatMaker) {
    state.wanderingRushMatMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingRushMatMaker;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingRushMatMakerTick() {
  const a = state.wanderingRushMatMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_RUSH_MAT_MAKER_CHANGED, { expired: true });
      addMessage('🌾 The wandering rush mat maker bundles up the unsold mats, ties the dried sedge into a carry-pack, and continues along the marsh track to the next settlement.', 'info');
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
  emit(Events.WANDERING_RUSH_MAT_MAKER_CHANGED, { spawned: true });
  addMessage('🌾 A wandering rush mat maker arrives carrying bundles of dried sedge and bulrush sorted by thickness — along with finished mats in tabby weave for doorstep use, tighter twill weave for hall floors, and coiled-rush mats sealed with braided edges. The maker offers to commission a supply of rush floor-coverings for the settlement\'s households, or to sell the rush mat-weaving craft so local artisans can maintain an independent supply. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingRushMatMaker() { return state.wanderingRushMatMaker?.active ?? null; }
export function getRushMatMakerSecsLeft() {
  const a = state.wanderingRushMatMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRushMatCollection() {
  const a = state.wanderingRushMatMaker;
  if (!a?.active) return { ok: false, reason: 'No rush mat maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The rush mat maker has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned rush mat collection from the wandering rush mat maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'rushMatMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'rushMatMakerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_RUSH_MAT_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌾 The mat maker selects the longest and most uniform stems from the bundle and begins the commission at once, working the tabby weave with a speed and regularity that comes from years of practice — the shuttle fingers moving in a continuous rhythm that keeps the weft threads lying parallel without the need to beat them flat after each pass. The twill-weave mats for the hall take somewhat longer; the maker pauses every few rows to check the diagonal alignment against a straight-edge before proceeding. The coiled mats are finished last, each edge-braid stitched through the final rush course with a bone needle so the border lies flat under foot-traffic without lifting at the corners. The settlement's households receive their allotment and the general quality of daily domestic life improves noticeably. −${COMMISSION_FOOD_COST} food −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRushMatCraft() {
  const a = state.wanderingRushMatMaker;
  if (!a?.active) return { ok: false, reason: 'No rush mat maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The rush mat maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased rush mat craft from the wandering rush mat maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'rushMatMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'rushMatMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_RUSH_MAT_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The mat maker produces a folded instruction sheet — thick vellum covered in annotated diagrams showing the harvest season for each variety of marsh plant, the drying and curing schedule that prevents the stems from moulding before the weave is complete, and the sequence of weft passes required to set up each of the three weave structures correctly from the first row. A second section covers the edge treatments: the braided border stitch that seals a coiled mat, the folded hem that keeps a tabby-weave mat from ravelling, and the method of weighting a finished mat with stones while it dries flat so the coiled sections lie true. The settlement's artisans work through the materials methodically, and by the end of the first week several households are producing their own replacement mats without needing to wait for the next visiting maker. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendRushMatMakerAway() {
  const a = state.wanderingRushMatMaker;
  if (!a?.active) return { ok: false, reason: 'No rush mat maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_RUSH_MAT_MAKER_CHANGED, { dismissed: true });
  addMessage('🌾 The wandering rush mat maker bundles up the unsold mats, ties the dried sedge into a carry-pack, and continues along the marsh track to the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
