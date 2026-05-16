/**
 * EmpireOS — Wandering Jeweler (T299).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a master jeweler
 * arrives carrying rare gemstones and the knowledge to craft regal regalia
 * fit for an emperor. The player has 80 seconds to decide.
 *
 * Choices:
 *   💎 Commission Royal Regalia — pay 25 iron + 20 stone
 *        → +0.2 iron/s for 2.5 min · +22 prestige · +10 morale
 *   💍 Purchase Rare Gems       — pay 30 gold
 *        → +0.15 stone/s for 2 min · +18 prestige
 *   👋 Send Away                — dismiss (no reward)
 *
 * state.wanderingJeweler = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalRegalia:        number,
 *   totalGems:           number,
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
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const REGALIA_IRON_COST       = 25;
export const REGALIA_STONE_COST      = 20;
export const REGALIA_IRON_RATE       = 0.2;
export const REGALIA_PRESTIGE_REWARD = 22;
export const REGALIA_MORALE_REWARD   = 10;
export const REGALIA_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const GEMS_GOLD_COST          = 30;
export const GEMS_STONE_RATE         = 0.15;
export const GEMS_PRESTIGE_REWARD    = 18;
export const GEMS_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingJeweler() {
  if (!state.wanderingJeweler) {
    state.wanderingJeweler = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalRegalia:    0,
      totalGems:       0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingJeweler;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalRegalia    === undefined) s.totalRegalia    = 0;
  if (s.totalGems       === undefined) s.totalGems       = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingJewelerTick() {
  const a = state.wanderingJeweler;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_JEWELER_CHANGED, { expired: true });
      addMessage('💎 The wandering jeweler carefully packs their gemstones and jeweler\'s tools back into padded cases, bows respectfully, and continues their journey through distant lands.', 'info');
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
  emit(Events.WANDERING_JEWELER_CHANGED, { spawned: true });
  addMessage('💎 A master wandering jeweler arrives at the imperial court, their padded cases gleaming with rare gemstones, finished regalia, and the accumulated knowledge of a lifetime spent crafting treasures for distant kings. Respond within 80 seconds.', 'info');
}

export function getActiveJeweler() { return state.wanderingJeweler?.active ?? null; }
export function getJewelerSecsLeft() {
  const a = state.wanderingJeweler?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalRegalia() {
  const a = state.wanderingJeweler;
  if (!a?.active) return { ok: false, reason: 'No jeweler present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The jeweler has departed.' };
  if ((state.resources.iron  ?? 0) < REGALIA_IRON_COST)  return { ok: false, reason: `Need ${REGALIA_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < REGALIA_STONE_COST) return { ok: false, reason: `Need ${REGALIA_STONE_COST} stone.` };
  state.resources.iron  -= REGALIA_IRON_COST;
  state.resources.stone -= REGALIA_STONE_COST;
  changeMorale(REGALIA_MORALE_REWARD);
  awardPrestige(REGALIA_PRESTIGE_REWARD, 'Commissioned royal regalia from a wandering jeweler');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'jewelerRegalia');
    state.randomEvents.activeModifiers.push({
      id: 'jewelerRegalia', resource: 'iron',
      rateMult: 1 + (REGALIA_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + REGALIA_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalRegalia = (a.totalRegalia ?? 0) + 1;
  emit(Events.WANDERING_JEWELER_CHANGED, { regalia: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💎 The jeweler crafts breathtaking imperial regalia adorned with rare gems, inspiring the realm's smiths and stonemasons to work with renewed purpose and precision! −${REGALIA_IRON_COST} iron · −${REGALIA_STONE_COST} stone · +${REGALIA_PRESTIGE_REWARD} prestige · +${REGALIA_MORALE_REWARD} morale. Crafting surge: +${REGALIA_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRareGems() {
  const a = state.wanderingJeweler;
  if (!a?.active) return { ok: false, reason: 'No jeweler present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The jeweler has departed.' };
  if ((state.resources.gold ?? 0) < GEMS_GOLD_COST) return { ok: false, reason: `Need ${GEMS_GOLD_COST} gold.` };
  state.resources.gold -= GEMS_GOLD_COST;
  awardPrestige(GEMS_PRESTIGE_REWARD, 'Purchased rare gems from a wandering jeweler');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'jewelerGems');
    state.randomEvents.activeModifiers.push({
      id: 'jewelerGems', resource: 'stone',
      rateMult: 1 + (GEMS_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + GEMS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalGems = (a.totalGems ?? 0) + 1;
  emit(Events.WANDERING_JEWELER_CHANGED, { gems: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💍 The jeweler's rare gemstones inspire the imperial quarrymen, who discover new extraction techniques buried in the gem deposits themselves! −${GEMS_GOLD_COST} gold · +${GEMS_PRESTIGE_REWARD} prestige. Quarry surge: +${GEMS_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendJewelerAway() {
  const a = state.wanderingJeweler;
  if (!a?.active) return { ok: false, reason: 'No jeweler present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_JEWELER_CHANGED, { dismissed: true });
  addMessage('💎 The wandering jeweler nods with quiet dignity, repacks their precious wares, and sets off on the road toward the next kingdom with treasures to offer.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
