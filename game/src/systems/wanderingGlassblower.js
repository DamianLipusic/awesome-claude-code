/**
 * EmpireOS — Wandering Glassblower (T285).
 *
 * Every 12–17 minutes (Iron Age+, 10+ player tiles), a wandering glassblower
 * arrives with molten art and knowledge of their ancient craft to offer their
 * services to the empire. The player has 80 seconds to decide.
 *
 * Choices:
 *   🔮 Commission Crystal Vessels — pay 25 iron + 20 stone
 *        → +0.15 iron/s for 2 min · +20 prestige · +8 morale
 *   🌊 Learn Glassblowing Arts    — pay 20 gold
 *        → +0.12 stone/s for 2.5 min · +15 prestige
 *   👋 Send Away                  — dismiss (no reward)
 *
 * state.wanderingGlassblower = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissions: number,
 *   totalLearned:     number,
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
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST       = 25;
export const COMMISSION_STONE_COST      = 20;
export const COMMISSION_IRON_RATE       = 0.15;
export const COMMISSION_PRESTIGE_REWARD = 20;
export const COMMISSION_MORALE_REWARD   = 8;
export const COMMISSION_DURATION_TICKS  = Math.round(2 * 60 * TICKS_PER_SECOND);

export const LEARN_GOLD_COST            = 20;
export const LEARN_STONE_RATE           = 0.12;
export const LEARN_PRESTIGE_REWARD      = 15;
export const LEARN_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export function initWanderingGlassblower() {
  if (!state.wanderingGlassblower) {
    state.wanderingGlassblower = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalLearned:     0,
      totalDismissals:  0,
    };
  }
  if (state.wanderingGlassblower.nextSpawnTick    === undefined) state.wanderingGlassblower.nextSpawnTick    = _nextSpawnTick();
  if (state.wanderingGlassblower.totalVisits      === undefined) state.wanderingGlassblower.totalVisits      = 0;
  if (state.wanderingGlassblower.totalCommissions === undefined) state.wanderingGlassblower.totalCommissions = 0;
  if (state.wanderingGlassblower.totalLearned     === undefined) state.wanderingGlassblower.totalLearned     = 0;
  if (state.wanderingGlassblower.totalDismissals  === undefined) state.wanderingGlassblower.totalDismissals  = 0;
}

export function wanderingGlassblowerTick() {
  const wg = state.wanderingGlassblower;
  if (!wg) return;
  if (wg.active) {
    if (state.tick >= wg.active.expiresAt) {
      wg.active = null; wg.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_GLASSBLOWER_CHANGED, { expired: true });
      addMessage('🔮 The wandering glassblower packs their tools and drifts onward to the next settlement.', 'info');
    }
    return;
  }
  if (state.tick < wg.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  wg.active      = { expiresAt: state.tick + WINDOW_TICKS };
  wg.totalVisits = (wg.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_GLASSBLOWER_CHANGED, { spawned: true });
  addMessage('🔮 A wandering glassblower arrives at the imperial court, their cart laden with shimmering crystal vessels and delicate glasswork of rare beauty. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingGlassblower() { return state.wanderingGlassblower?.active ?? null; }
export function getGlassblowerSecsLeft() {
  const a = state.wanderingGlassblower?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCrystalVessels() {
  const wg = state.wanderingGlassblower;
  if (!wg?.active) return { ok: false, reason: 'No glassblower present.' };
  if (state.tick >= wg.active.expiresAt) return { ok: false, reason: 'The glassblower has departed.' };
  if ((state.resources.iron  ?? 0) < COMMISSION_IRON_COST)  return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.iron  -= COMMISSION_IRON_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned crystal vessels from a wandering glassblower');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'glassblowerVessels');
    state.randomEvents.activeModifiers.push({
      id: 'glassblowerVessels', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  wg.active = null; wg.nextSpawnTick = _nextSpawnTick(); wg.totalCommissions = (wg.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_GLASSBLOWER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔮 Exquisite crystal vessels grace the imperial halls, inspiring the smelters to work with renewed precision! −${COMMISSION_IRON_COST} iron · −${COMMISSION_STONE_COST} stone · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Metalwork mastery: +${COMMISSION_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function learnGlassblowingArts() {
  const wg = state.wanderingGlassblower;
  if (!wg?.active) return { ok: false, reason: 'No glassblower present.' };
  if (state.tick >= wg.active.expiresAt) return { ok: false, reason: 'The glassblower has departed.' };
  if ((state.resources.gold ?? 0) < LEARN_GOLD_COST) return { ok: false, reason: `Need ${LEARN_GOLD_COST} gold.` };
  state.resources.gold -= LEARN_GOLD_COST;
  awardPrestige(LEARN_PRESTIGE_REWARD, 'Learned glassblowing arts from a wandering artisan');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'glassblowerArts');
    state.randomEvents.activeModifiers.push({
      id: 'glassblowerArts', resource: 'stone',
      rateMult: 1 + (LEARN_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + LEARN_DURATION_TICKS,
    });
  }
  wg.active = null; wg.nextSpawnTick = _nextSpawnTick(); wg.totalLearned = (wg.totalLearned ?? 0) + 1;
  emit(Events.WANDERING_GLASSBLOWER_CHANGED, { learned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌊 Ancient glassblowing techniques inspire quarry workers to extract stone with artisanal care! −${LEARN_GOLD_COST} gold · +${LEARN_PRESTIGE_REWARD} prestige. Stone craft: +${LEARN_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGlassblowerAway() {
  const wg = state.wanderingGlassblower;
  if (!wg?.active) return { ok: false, reason: 'No glassblower present.' };
  wg.active = null; wg.nextSpawnTick = _nextSpawnTick(); wg.totalDismissals = (wg.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_GLASSBLOWER_CHANGED, { dismissed: true });
  addMessage('🔮 The wandering glassblower is thanked and continues their journey across the empire roads.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
