/**
 * EmpireOS — Wandering Thatcher (T413).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering thatcher
 * arrives at the palace bearing bundles of long water-reed, rye straw, and
 * prepared sedge grass — offering to thatch the imperial halls, granary roofs,
 * and garrison longhouses with tight ridge-capped weatherproof layers that shed
 * rain and insulate against winter cold, or to share the centuries-old
 * thatching techniques for selecting, sorting, and layering the finest
 * water-reed and straw to produce roofs that last a generation. The player
 * has 80 seconds to decide.
 *
 * Choices:
 *   🌾 Thatch Imperial Halls        — pay 20 wood + 10 food
 *        → +0.22 wood/s for 2.5 min · +15 prestige · +8 morale
 *   🏠 Purchase Thatching Craft     — pay 18 gold
 *        → +0.15 food/s for 2 min · +10 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingThatcher = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalThatched:    number,
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

export const THATCH_WOOD_COST           = 20;
export const THATCH_FOOD_COST           = 10;
export const THATCH_WOOD_RATE           = 0.22;
export const THATCH_PRESTIGE_REWARD     = 15;
export const THATCH_MORALE_REWARD       = 8;
export const THATCH_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST         = 18;
export const PURCHASE_FOOD_RATE         = 0.15;
export const PURCHASE_PRESTIGE_REWARD   = 10;
export const PURCHASE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingThatcher() {
  if (!state.wanderingThatcher) {
    state.wanderingThatcher = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalThatched:   0,
      totalPurchased:  0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingThatcher;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalThatched   === undefined) s.totalThatched   = 0;
  if (s.totalPurchased  === undefined) s.totalPurchased  = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingThatcherTick() {
  const a = state.wanderingThatcher;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_THATCHER_CHANGED, { expired: true });
      addMessage('🌾 The wandering thatcher bundles the unused water-reed and rye straw back onto the cart, secures the hazel-rod spars and thatching needles in their canvas satchel, and departs the palace — the imperial hall thatching and craft-lore offer passing unrealised as the artisan\'s cart of bundled reed and straw disappears down the gatehouse road.', 'info');
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
  emit(Events.WANDERING_THATCHER_CHANGED, { spawned: true });
  addMessage('🌾 A wandering thatcher arrives at the palace bearing bundles of long water-reed, rye straw, and prepared sedge grass — offering to thatch the imperial halls, granary roofs, and garrison longhouses with tight ridge-capped weatherproof layers that shed rain and insulate against winter cold, or to share the centuries-old thatching techniques for selecting, sorting, and layering the finest water-reed and straw to produce roofs that last a generation. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingThatcher() { return state.wanderingThatcher?.active ?? null; }
export function getThatcherSecsLeft() {
  const a = state.wanderingThatcher?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function thatchImperialHalls() {
  const a = state.wanderingThatcher;
  if (!a?.active) return { ok: false, reason: 'No thatcher present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The thatcher has departed.' };
  if ((state.resources.wood ?? 0) < THATCH_WOOD_COST) return { ok: false, reason: `Need ${THATCH_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < THATCH_FOOD_COST) return { ok: false, reason: `Need ${THATCH_FOOD_COST} food.` };
  state.resources.wood -= THATCH_WOOD_COST;
  state.resources.food -= THATCH_FOOD_COST;
  changeMorale(THATCH_MORALE_REWARD);
  awardPrestige(THATCH_PRESTIGE_REWARD, 'Thatched imperial halls with the wandering thatcher');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'thatcherHalls');
    state.randomEvents.activeModifiers.push({
      id: 'thatcherHalls', resource: 'wood',
      rateMult: 1 + (THATCH_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + THATCH_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalThatched = (a.totalThatched ?? 0) + 1;
  emit(Events.WANDERING_THATCHER_CHANGED, { thatched: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌾 The thatcher lays the first course of water-reed along the eaves and works upward row by row, pinning each layer with split-hazel spars twisted into thatching hooks and driven deep with a legget — the sedge-grass ridge is combed smooth, sewn in a diamond pattern, and sealed with a final row of clay-washed reed that sheds the heaviest rain without a drip, and every hall, granary, and longhouse across the imperial grounds is reroofed with the warm, insulating layers that keep grain dry, soldiers comfortable, and spirits high through every season! −${THATCH_WOOD_COST} wood · −${THATCH_FOOD_COST} food · +${THATCH_PRESTIGE_REWARD} prestige · +${THATCH_MORALE_REWARD} morale. Wood surge: +${THATCH_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseThatchingCraft() {
  const a = state.wanderingThatcher;
  if (!a?.active) return { ok: false, reason: 'No thatcher present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The thatcher has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased thatching craft from the wandering thatcher');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'thatcherCraft');
    state.randomEvents.activeModifiers.push({
      id: 'thatcherCraft', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.WANDERING_THATCHER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏠 The thatcher opens the well-thumbed pattern book and demonstrates how to grade water-reed by stem diameter and moisture content, how to tie each bundle with a consistent twist to prevent slippage, and how to lay the overlapping courses at the precise angle that channels rain cleanly off the eave without undercutting the layer beneath — the imperial farmhands and granary workers absorb the techniques and apply the same careful layering and moisture-management principles to the storage and handling of grain across every imperial storehouse and barn! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendThatcherAway() {
  const a = state.wanderingThatcher;
  if (!a?.active) return { ok: false, reason: 'No thatcher present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_THATCHER_CHANGED, { dismissed: true });
  addMessage('🌾 The wandering thatcher reloads the bundles of water-reed and rye straw onto the cart, tucks the hazel-rod spars and thatching needles into their canvas satchel, and departs the palace — the faint rustle of bundled reed fading as the cart rolls through the gatehouse arch.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
