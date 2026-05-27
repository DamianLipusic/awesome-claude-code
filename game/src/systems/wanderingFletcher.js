/**
 * EmpireOS — Wandering Fletcher (T423).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering fletcher
 * arrives at the settlement carrying bundled straight ash shafts cut to
 * uniform length, goose-feather flights split and trimmed to matching
 * width, iron-tipped hunting points hammered to a consistent tang and
 * shoulder, finished arrow bundles with flights glued and bound with fine
 * waxed thread, and a set of pattern gauges used to cut and trim shafts to
 * the precise draw-length of the empire's bow hunters — offering to
 * commission a full supply of hunting arrows for the settlement's bow
 * hunters and garrison archers, or to share the fletching craft that keeps
 * every workshop producing flight-stable arrows without specialist guidance.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🏹 Commission Arrow Bundles    — pay 20 wood + 10 food
 *        → +0.22 food/s for 2.5 min · +15 prestige · +8 morale
 *   📖 Purchase Fletching Craft    — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.wanderingFletcher = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissions: number,
 *   totalPurchases:   number,
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

export const COMMISSION_WOOD_COST          = 20;
export const COMMISSION_FOOD_COST          = 10;
export const COMMISSION_FOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingFletcher() {
  if (!state.wanderingFletcher) {
    state.wanderingFletcher = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingFletcher;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingFletcherTick() {
  const a = state.wanderingFletcher;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_FLETCHER_CHANGED, { expired: true });
      addMessage('🏹 The wandering fletcher re-bundles the ash shafts, wraps the feathered arrows in oiled linen, and departs along the woodland trail — the faint knock of bundled arrow shafts and creak of the carry-frame fading into the treeline.', 'info');
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
  emit(Events.WANDERING_FLETCHER_CHANGED, { spawned: true });
  addMessage('🏹 A wandering fletcher arrives at the settlement carrying bundled straight ash shafts cut to uniform length, goose-feather flights split and trimmed to matching width, iron-tipped hunting points hammered to a consistent tang, finished arrow bundles with flights bound in waxed thread, and pattern gauges for cutting shafts to the precise draw-length of the empire\'s bow hunters — offering to commission a full supply of hunting arrows for the settlement\'s archers, or to share the fletching craft that keeps every workshop producing flight-stable arrows. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingFletcher() { return state.wanderingFletcher?.active ?? null; }
export function getFletcherSecsLeft() {
  const a = state.wanderingFletcher?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionArrowBundles() {
  const a = state.wanderingFletcher;
  if (!a?.active) return { ok: false, reason: 'No fletcher present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The fletcher has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned arrow bundles from the wandering fletcher');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'fletcherCommission');
    state.randomEvents.activeModifiers.push({
      id: 'fletcherCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_FLETCHER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏹 The fletcher selects the straightest ash shafts from the bundle, trims each to the draw-length of the settlement's bow hunters using the pattern gauge, splits and smooths matched goose-feather flights, attaches iron hunting points with a tight waxed-thread binding sealed with pine pitch, and delivers balanced flight-stable arrows to the bow hunters' supply store and the garrison archery reserve — the improved ammunition enabling far more efficient hunts across the wilderness frontier and keeping the garrison archers well-supplied through every campaign season! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseFletchingCraft() {
  const a = state.wanderingFletcher;
  if (!a?.active) return { ok: false, reason: 'No fletcher present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The fletcher has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased fletching craft from the wandering fletcher');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'fletcherPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'fletcherPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_FLETCHER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The fletcher shares the shaft-selection criteria for ideal arrow wood — straight-grained ash cut in late autumn when moisture is low — the flight-split and trimming technique that produces matched feathering from a single goose feather, the tang-fitting method that seats iron points without splitting the shaft shoulder, and the waxed-thread binding pattern that holds flights firmly through repeated shots in wet weather — knowledge that allows every workshop craftsman to produce correctly-balanced hunting arrows from locally-sourced materials without specialist guidance! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFletcherAway() {
  const a = state.wanderingFletcher;
  if (!a?.active) return { ok: false, reason: 'No fletcher present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_FLETCHER_CHANGED, { dismissed: true });
  addMessage('🏹 The wandering fletcher re-bundles the finished arrows in oiled linen wrapping, hoists the carry-frame onto one shoulder, and heads back down the woodland trail — nodding respectfully before disappearing into the treeline.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
