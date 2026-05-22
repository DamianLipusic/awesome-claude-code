/**
 * EmpireOS — Wandering Glove Maker (T369).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering glove maker
 * arrives at the palace gates with fine leathers, linen padding, and stitching
 * thread, offering to craft riding gloves for the imperial cavalry or sell
 * artisan leather gloves. The player has 80 seconds to decide.
 *
 * Choices:
 *   🧤 Craft Riding Gloves   — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +8 morale
 *   🪡 Purchase Leather Gloves — pay 18 gold
 *        → +0.15 gold/s for 2 min  · +12 prestige
 *   🚶 Send Away               — dismiss (no reward)
 *
 * state.wanderingGloveMaker = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCrafts:        number,
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const CRAFT_FOOD_COST           = 20;
export const CRAFT_WOOD_COST           = 15;
export const CRAFT_FOOD_RATE           = 0.22;
export const CRAFT_PRESTIGE_REWARD     = 18;
export const CRAFT_MORALE_REWARD       = 8;
export const CRAFT_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST        = 18;
export const PURCHASE_GOLD_RATE        = 0.15;
export const PURCHASE_PRESTIGE_REWARD  = 12;
export const PURCHASE_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingGloveMaker() {
  if (!state.wanderingGloveMaker) {
    state.wanderingGloveMaker = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalCrafts:     0,
      totalPurchases:  0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingGloveMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCrafts      === undefined) s.totalCrafts      = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingGloveMakerTick() {
  const a = state.wanderingGloveMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_GLOVE_MAKER_CHANGED, { expired: true });
      addMessage('🧤 The wandering glove maker wraps up the fine leather cuttings and stitching thread, packs the travel kit, and strides off down the road — the scent of tanned hide lingering at the gates.', 'info');
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
  emit(Events.WANDERING_GLOVE_MAKER_CHANGED, { spawned: true });
  addMessage('🧤 A wandering glove maker arrives at the palace courtyard bearing bundles of supple calf leather, linen padding, and coloured stitching thread — offering to craft fine riding gloves for the imperial cavalry or sell their finest artisan leather gloves to the court. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingGloveMaker() { return state.wanderingGloveMaker?.active ?? null; }
export function getGloveMakerSecsLeft() {
  const a = state.wanderingGloveMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function craftRidingGloves() {
  const a = state.wanderingGloveMaker;
  if (!a?.active) return { ok: false, reason: 'No glove maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The glove maker has departed.' };
  if ((state.resources.food ?? 0) < CRAFT_FOOD_COST) return { ok: false, reason: `Need ${CRAFT_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < CRAFT_WOOD_COST) return { ok: false, reason: `Need ${CRAFT_WOOD_COST} wood.` };
  state.resources.food -= CRAFT_FOOD_COST;
  state.resources.wood -= CRAFT_WOOD_COST;
  changeMorale(CRAFT_MORALE_REWARD);
  awardPrestige(CRAFT_PRESTIGE_REWARD, 'Commissioned riding gloves from the wandering glove maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'gloveMakerCraft');
    state.randomEvents.activeModifiers.push({
      id: 'gloveMakerCraft', resource: 'food',
      rateMult: 1 + (CRAFT_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + CRAFT_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCrafts = (a.totalCrafts ?? 0) + 1;
  emit(Events.WANDERING_GLOVE_MAKER_CHANGED, { crafted: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧤 The glove maker sets up a stitching bench in the palace stables — dozens of supple riding gloves are fitted to the imperial cavalry, the warm leather grip boosting both morale and the riders' endurance on campaign. The surplus gloves sell briskly at market, spurring agricultural trade! −${CRAFT_FOOD_COST} food · −${CRAFT_WOOD_COST} wood · +${CRAFT_PRESTIGE_REWARD} prestige · +${CRAFT_MORALE_REWARD} morale. Food surge: +${CRAFT_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseLeatherGloves() {
  const a = state.wanderingGloveMaker;
  if (!a?.active) return { ok: false, reason: 'No glove maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The glove maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased leather gloves from the wandering glove maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'gloveMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'gloveMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_GLOVE_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪡 Exquisitely stitched leather gloves — in deep chestnut, midnight black, and ivory cream — are distributed among the court nobles and imperial officers. The luxury craftwork draws admiration from foreign visitors and fills the palace treasury with appreciative trade coin! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGloveMakerAway() {
  const a = state.wanderingGloveMaker;
  if (!a?.active) return { ok: false, reason: 'No glove maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_GLOVE_MAKER_CHANGED, { dismissed: true });
  addMessage('🧤 The wandering glove maker nods graciously, bundles the leather cuttings and stitching needles back into the travel pack, and sets off down the road toward the next town — the faint creak of leather receding with their footsteps.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
