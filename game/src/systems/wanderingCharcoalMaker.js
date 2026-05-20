/**
 * EmpireOS — Wandering Charcoal Maker (T342).
 *
 * Every 13–17 minutes (Stone Age+, 6+ player tiles), a skilled wandering
 * charcoal maker arrives at the imperial gates bearing smouldering charcoal
 * sacks, blackened iron tongs, and the ancient art of slow-burning kilns
 * that have fuelled smelters and forges across the realm.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪵 Commission Charcoal Works — pay 20 wood + 10 food
 *        → +0.20 iron/s for 2.5 min · +15 prestige · +8 morale
 *   📜 Purchase Char-Burning Lore — pay 18 gold
 *        → +0.15 food/s for 2 min  · +10 prestige
 *   🚶 Send Away            — dismiss (no reward)
 *
 * state.wanderingCharcoalMaker = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissioned:   number,
 *   totalPurchased:      number,
 *   totalDismissals:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_WOOD_COST      = 20;
export const COMMISSION_FOOD_COST      = 10;
export const COMMISSION_IRON_RATE      = 0.20;
export const COMMISSION_PRESTIGE_REWARD = 15;
export const COMMISSION_MORALE_REWARD  = 8;
export const COMMISSION_DURATION_TICKS = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST        = 18;
export const PURCHASE_FOOD_RATE        = 0.15;
export const PURCHASE_PRESTIGE_REWARD  = 10;
export const PURCHASE_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCharcoalMaker() {
  if (!state.wanderingCharcoalMaker) {
    state.wanderingCharcoalMaker = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalCommissioned: 0,
      totalPurchased:    0,
      totalDismissals:   0,
    };
  }
  const s = state.wanderingCharcoalMaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissioned === undefined) s.totalCommissioned = 0;
  if (s.totalPurchased    === undefined) s.totalPurchased    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingCharcoalMakerTick() {
  const a = state.wanderingCharcoalMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_CHARCOAL_MAKER_CHANGED, { expired: true });
      addMessage('🪵 The wandering charcoal maker douses their demonstration kiln, shoulders their charcoal sacks, and sets off toward the next smelting settlement on their long route.', 'info');
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
  emit(Events.WANDERING_CHARCOAL_MAKER_CHANGED, { spawned: true });
  addMessage('🪵 A wandering charcoal maker arrives at the imperial gates bearing heavy sacks of high-grade charcoal, blackened iron tongs, and ancient kiln-building secrets. They offer to establish charcoal works to fuel the empire\'s forges or share their slow-burning techniques with imperial smiths. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingCharcoalMaker() { return state.wanderingCharcoalMaker?.active ?? null; }
export function getCharcoalMakerSecsLeft() {
  const a = state.wanderingCharcoalMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCharcoalWorks() {
  const a = state.wanderingCharcoalMaker;
  if (!a?.active) return { ok: false, reason: 'No charcoal maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The charcoal maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned charcoal works from the wandering charcoal maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'charcoalCommission');
    state.randomEvents.activeModifiers.push({
      id: 'charcoalCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.WANDERING_CHARCOAL_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The charcoal maker constructs a series of slow-burning earthen kilns on the imperial estate, producing high-grade charcoal that burns hotter and longer than raw wood. Imperial forges and smelters roar with newfound intensity, dramatically increasing iron output! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCharBurningLore() {
  const a = state.wanderingCharcoalMaker;
  if (!a?.active) return { ok: false, reason: 'No charcoal maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The charcoal maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Acquired char-burning lore from the wandering charcoal maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'charcoalPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'charcoalPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.WANDERING_CHARCOAL_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The charcoal maker shares techniques for slow-burning kilns, charcoal storage, and cooking over steady coals with imperial cooks and food processors. Better-preserved and more efficiently cooked provisions fill the imperial stores! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCharcoalMakerAway() {
  const a = state.wanderingCharcoalMaker;
  if (!a?.active) return { ok: false, reason: 'No charcoal maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_CHARCOAL_MAKER_CHANGED, { dismissed: true });
  addMessage('🪵 The wandering charcoal maker nods respectfully, shoulders their heavy charcoal sacks and iron tongs, and trudges off toward the next forge settlement on their long supply circuit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
