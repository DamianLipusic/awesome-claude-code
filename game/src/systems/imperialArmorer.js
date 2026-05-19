/**
 * EmpireOS — Imperial Armorer (T336).
 *
 * Every 14–19 minutes (Iron Age+, 10+ player tiles), a master imperial armorer
 * arrives bearing expertly crafted plate armor, chainmail patterns, and offers
 * to forge premium protective gear for the empire's forces.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ⚔️ Forge Imperial Armor   — pay 25 iron + 15 wood
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +12 morale
 *   🪨 Share Armor Techniques — pay 20 stone
 *        → +0.18 stone/s for 2 min  · +15 prestige
 *   🚶 Send Away              — dismiss (no reward)
 *
 * state.imperialArmorer = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalForged:      number,
 *   totalShared:      number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const FORGE_IRON_COST           = 25;
export const FORGE_WOOD_COST           = 15;
export const FORGE_IRON_RATE           = 0.22;
export const FORGE_PRESTIGE_REWARD     = 22;
export const FORGE_MORALE_REWARD       = 12;
export const FORGE_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TECHNIQUES_STONE_COST     = 20;
export const TECHNIQUES_STONE_RATE     = 0.18;
export const TECHNIQUES_PRESTIGE_REWARD = 15;
export const TECHNIQUES_DURATION_TICKS = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialArmorer() {
  if (!state.imperialArmorer) {
    state.imperialArmorer = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalForged:     0,
      totalShared:     0,
      totalDismissals: 0,
    };
  }
  const s = state.imperialArmorer;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalForged     === undefined) s.totalForged     = 0;
  if (s.totalShared     === undefined) s.totalShared     = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function imperialArmorerTick() {
  const a = state.imperialArmorer;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_ARMORER_CHANGED, { expired: true });
      addMessage('⚔️ The imperial armorer carefully packs their tools, loads armor patterns onto a sturdy cart, and departs the palace grounds to serve the next garrison.', 'info');
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
  emit(Events.IMPERIAL_ARMORER_CHANGED, { spawned: true });
  addMessage('⚔️ A master imperial armorer arrives bearing expertly crafted plate armor, intricate chainmail patterns, and offers to forge premium protective gear for the empire\'s forces and military infrastructure. Respond within 80 seconds.', 'info');
}

export function getActiveImperialArmorer() { return state.imperialArmorer?.active ?? null; }
export function getArmorerSecsLeft() {
  const a = state.imperialArmorer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function forgeImperialArmor() {
  const a = state.imperialArmorer;
  if (!a?.active) return { ok: false, reason: 'No armorer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The armorer has departed.' };
  if ((state.resources.iron ?? 0) < FORGE_IRON_COST) return { ok: false, reason: `Need ${FORGE_IRON_COST} iron.` };
  if ((state.resources.wood ?? 0) < FORGE_WOOD_COST) return { ok: false, reason: `Need ${FORGE_WOOD_COST} wood.` };
  state.resources.iron -= FORGE_IRON_COST;
  state.resources.wood -= FORGE_WOOD_COST;
  changeMorale(FORGE_MORALE_REWARD);
  awardPrestige(FORGE_PRESTIGE_REWARD, 'Commissioned imperial armor forging from the armorer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'armorerForge');
    state.randomEvents.activeModifiers.push({
      id: 'armorerForge', resource: 'iron',
      rateMult: 1 + (FORGE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + FORGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalForged = (a.totalForged ?? 0) + 1;
  emit(Events.IMPERIAL_ARMORER_CHANGED, { forged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚔️ The armorer sets up a forge in the imperial quarter, crafting suits of gleaming plate armor, flexible chainmail hauberks, and reinforced shields for the empire's finest warriors. Military morale soars across every garrison! −${FORGE_IRON_COST} iron · −${FORGE_WOOD_COST} wood · +${FORGE_PRESTIGE_REWARD} prestige · +${FORGE_MORALE_REWARD} morale. Iron surge: +${FORGE_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function shareArmorTechniques() {
  const a = state.imperialArmorer;
  if (!a?.active) return { ok: false, reason: 'No armorer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The armorer has departed.' };
  if ((state.resources.stone ?? 0) < TECHNIQUES_STONE_COST) return { ok: false, reason: `Need ${TECHNIQUES_STONE_COST} stone.` };
  state.resources.stone -= TECHNIQUES_STONE_COST;
  awardPrestige(TECHNIQUES_PRESTIGE_REWARD, 'Learned armor-making techniques from the imperial armorer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'armorerTech');
    state.randomEvents.activeModifiers.push({
      id: 'armorerTech', resource: 'stone',
      rateMult: 1 + (TECHNIQUES_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + TECHNIQUES_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalShared = (a.totalShared ?? 0) + 1;
  emit(Events.IMPERIAL_ARMORER_CHANGED, { shared: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪨 The armorer demonstrates how to use stone molds, grinding wheels, and hardening techniques to shape and reinforce iron ingots into durable armor components. Imperial quarries and workshops improve their efficiency! −${TECHNIQUES_STONE_COST} stone · +${TECHNIQUES_PRESTIGE_REWARD} prestige. Stone surge: +${TECHNIQUES_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendArmorerAway() {
  const a = state.imperialArmorer;
  if (!a?.active) return { ok: false, reason: 'No armorer present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_ARMORER_CHANGED, { dismissed: true });
  addMessage('⚔️ The imperial armorer bows respectfully, secures their tools and patterns, and departs the palace to serve the border garrisons awaiting their deliveries.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
