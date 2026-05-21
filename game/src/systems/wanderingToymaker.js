/**
 * EmpireOS — Wandering Toymaker (T349).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering toymaker
 * arrives at the imperial court carrying hand-carved wooden toys, painted
 * figurines, and delightful curiosities that enchant children and adults alike.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪀 Commission Royal Toys      — pay 20 wood
 *        → +0.2 wood/s for 2.5 min · +15 prestige · +12 morale
 *   🎁 Share Crafting Patterns    — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   👋 Send Away                  — dismiss (no reward)
 *
 * state.wanderingToymaker = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalToys:        number,
 *   totalPatterns:    number,
 *   totalDismissals:  number,
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

export const TOYS_WOOD_COST          = 20;
export const TOYS_WOOD_RATE          = 0.2;
export const TOYS_PRESTIGE_REWARD    = 15;
export const TOYS_MORALE_REWARD      = 12;
export const TOYS_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PATTERNS_GOLD_COST      = 18;
export const PATTERNS_GOLD_RATE      = 0.15;
export const PATTERNS_PRESTIGE_REWARD = 10;
export const PATTERNS_DURATION_TICKS = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingToymaker() {
  if (!state.wanderingToymaker) {
    state.wanderingToymaker = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalToys:       0,
      totalPatterns:   0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingToymaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalToys        === undefined) s.totalToys        = 0;
  if (s.totalPatterns    === undefined) s.totalPatterns    = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingToymakerTick() {
  const a = state.wanderingToymaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_TOYMAKER_CHANGED, { expired: true });
      addMessage('🪀 The wandering toymaker carefully packs the carved wooden horses, painted tin soldiers, and whittled figurines back into the travelling chest, and sets off down the road to enchant another village.', 'info');
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
  emit(Events.WANDERING_TOYMAKER_CHANGED, { spawned: true });
  addMessage('🪀 A wandering toymaker arrives at the imperial court with a cart brimming with beautifully crafted wooden toys, painted figurines, and clever mechanical curiosities that delight the court children and nobles alike. They offer to craft a special royal toy collection, or share their intricate crafting patterns with imperial workshops. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingToymaker() { return state.wanderingToymaker?.active ?? null; }
export function getToymakerSecsLeft() {
  const a = state.wanderingToymaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalToys() {
  const a = state.wanderingToymaker;
  if (!a?.active) return { ok: false, reason: 'No toymaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The toymaker has departed.' };
  if ((state.resources.wood ?? 0) < TOYS_WOOD_COST) return { ok: false, reason: `Need ${TOYS_WOOD_COST} wood.` };
  state.resources.wood -= TOYS_WOOD_COST;
  changeMorale(TOYS_MORALE_REWARD);
  awardPrestige(TOYS_PRESTIGE_REWARD, 'Commissioned royal toys from the wandering toymaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'toymakertoys');
    state.randomEvents.activeModifiers.push({
      id: 'toymakertoys', resource: 'wood',
      rateMult: 1 + (TOYS_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + TOYS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalToys = (a.totalToys ?? 0) + 1;
  emit(Events.WANDERING_TOYMAKER_CHANGED, { toys: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪀 The toymaker sets to work in the imperial workshop, carving an exquisite set of royal toys — painted wooden knights, miniature siege engines, and gilded rocking horses — that bring immense joy to the court children and noble families! The display of craftsmanship inspires imperial woodworkers to refine their techniques. −${TOYS_WOOD_COST} wood · +${TOYS_PRESTIGE_REWARD} prestige · +${TOYS_MORALE_REWARD} morale. Craft surge: +${TOYS_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function shareCraftingPatterns() {
  const a = state.wanderingToymaker;
  if (!a?.active) return { ok: false, reason: 'No toymaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The toymaker has departed.' };
  if ((state.resources.gold ?? 0) < PATTERNS_GOLD_COST) return { ok: false, reason: `Need ${PATTERNS_GOLD_COST} gold.` };
  state.resources.gold -= PATTERNS_GOLD_COST;
  awardPrestige(PATTERNS_PRESTIGE_REWARD, 'Purchased crafting patterns from the wandering toymaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'toymakerpatterns');
    state.randomEvents.activeModifiers.push({
      id: 'toymakerpatterns', resource: 'gold',
      rateMult: 1 + (PATTERNS_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PATTERNS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPatterns = (a.totalPatterns ?? 0) + 1;
  emit(Events.WANDERING_TOYMAKER_CHANGED, { patterns: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎁 The toymaker opens a worn leather portfolio filled with intricate diagrams, material lists, and pricing guides for dozens of beloved toy designs. Imperial artisans and market craftsmen eagerly study the patterns, creating new product lines that attract prosperous merchant families and foreign buyers! −${PATTERNS_GOLD_COST} gold · +${PATTERNS_PRESTIGE_REWARD} prestige. Trade surge: +${PATTERNS_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendToymakerAway() {
  const a = state.wanderingToymaker;
  if (!a?.active) return { ok: false, reason: 'No toymaker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_TOYMAKER_CHANGED, { dismissed: true });
  addMessage('🪀 The wandering toymaker cheerfully tips their brightly painted hat, loads the cart of carved toys and wooden figurines back onto a painted wagon, and trundles off down the road toward the next town, whistling a merry tune.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
