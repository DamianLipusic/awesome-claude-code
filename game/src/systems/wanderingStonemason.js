/**
 * EmpireOS — Wandering Stonemason (T311).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a master stonemason
 * arrives seeking imperial commissions for grand construction projects.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🏛️ Commission Grand Stoneworks   — pay 30 stone + 20 iron
 *        → +0.2 stone/s for 2.5 min · +22 prestige · +10 morale
 *   🔨 Exchange Master Techniques    — pay 25 gold
 *        → +0.15 iron/s for 2 min · +18 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.wanderingStonemason = {
 *   active:               { expiresAt: tick } | null,
 *   nextSpawnTick:        tick,
 *   totalVisits:          number,
 *   totalCommissions:     number,
 *   totalExchanges:       number,
 *   totalDismissals:      number,
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
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const STONEWORKS_STONE_COST      = 30;
export const STONEWORKS_IRON_COST       = 20;
export const STONEWORKS_STONE_RATE      = 0.2;
export const STONEWORKS_PRESTIGE_REWARD = 22;
export const STONEWORKS_MORALE_REWARD   = 10;
export const STONEWORKS_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TECHNIQUES_GOLD_COST       = 25;
export const TECHNIQUES_IRON_RATE       = 0.15;
export const TECHNIQUES_PRESTIGE_REWARD = 18;
export const TECHNIQUES_DURATION_TICKS  = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingStonemason() {
  if (!state.wanderingStonemason) {
    state.wanderingStonemason = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalExchanges:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingStonemason;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalExchanges   === undefined) s.totalExchanges   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingStonemasonTick() {
  const a = state.wanderingStonemason;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_STONEMASON_CHANGED, { expired: true });
      addMessage('🏛️ The wandering stonemason packs their chisels and mallet, bows respectfully, and continues on their journey to find another empire worthy of their craft.', 'info');
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
  emit(Events.WANDERING_STONEMASON_CHANGED, { spawned: true });
  addMessage('🏛️ A wandering stonemason arrives at the imperial court, their weathered hands bearing the tools of a master craftsman. They have built temples, aqueducts, and fortification walls across the known world, and now seek a worthy commission from your empire. Respond within 75 seconds.', 'info');
}

export function getActiveStonemason() { return state.wanderingStonemason?.active ?? null; }
export function getStonemasonSecsLeft() {
  const a = state.wanderingStonemason?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGrandStoneworks() {
  const a = state.wanderingStonemason;
  if (!a?.active) return { ok: false, reason: 'No stonemason present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The stonemason has departed.' };
  if ((state.resources.stone ?? 0) < STONEWORKS_STONE_COST) return { ok: false, reason: `Need ${STONEWORKS_STONE_COST} stone.` };
  if ((state.resources.iron  ?? 0) < STONEWORKS_IRON_COST)  return { ok: false, reason: `Need ${STONEWORKS_IRON_COST} iron.` };
  state.resources.stone -= STONEWORKS_STONE_COST;
  state.resources.iron  -= STONEWORKS_IRON_COST;
  changeMorale(STONEWORKS_MORALE_REWARD);
  awardPrestige(STONEWORKS_PRESTIGE_REWARD, 'Commissioned grand stoneworks from a master stonemason');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'stonemasonStoneworks');
    state.randomEvents.activeModifiers.push({
      id: 'stonemasonStoneworks', resource: 'stone',
      rateMult: 1 + (STONEWORKS_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + STONEWORKS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_STONEMASON_CHANGED, { stoneworks: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏛️ The master stonemason directs teams of imperial quarrymen with expert precision, applying advanced cutting and dressing techniques that dramatically increase the yield of each stone block! Their knowledge of grain lines and fracture patterns transforms raw quarry output into perfectly shaped building stones. −${STONEWORKS_STONE_COST} stone · −${STONEWORKS_IRON_COST} iron · +${STONEWORKS_PRESTIGE_REWARD} prestige · +${STONEWORKS_MORALE_REWARD} morale. Stonework surge: +${STONEWORKS_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeMasterTechniques() {
  const a = state.wanderingStonemason;
  if (!a?.active) return { ok: false, reason: 'No stonemason present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The stonemason has departed.' };
  if ((state.resources.gold ?? 0) < TECHNIQUES_GOLD_COST) return { ok: false, reason: `Need ${TECHNIQUES_GOLD_COST} gold.` };
  state.resources.gold -= TECHNIQUES_GOLD_COST;
  awardPrestige(TECHNIQUES_PRESTIGE_REWARD, 'Exchanged master construction techniques with a stonemason');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'stonemasonTechniques');
    state.randomEvents.activeModifiers.push({
      id: 'stonemasonTechniques', resource: 'iron',
      rateMult: 1 + (TECHNIQUES_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + TECHNIQUES_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalExchanges = (a.totalExchanges ?? 0) + 1;
  emit(Events.WANDERING_STONEMASON_CHANGED, { techniques: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔨 The stonemason shares their knowledge of advanced tool-making and metal hardening techniques with your imperial smiths. Their expertise in creating razor-sharp chisels and durable picks from iron dramatically improves the efficiency of mining and metalworking operations across the empire! −${TECHNIQUES_GOLD_COST} gold · +${TECHNIQUES_PRESTIGE_REWARD} prestige. Tool surge: +${TECHNIQUES_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendStonemasonAway() {
  const a = state.wanderingStonemason;
  if (!a?.active) return { ok: false, reason: 'No stonemason present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_STONEMASON_CHANGED, { dismissed: true });
  addMessage('🏛️ The wandering stonemason bows with professional dignity, tucks their tools under one arm, and continues their journey seeking an empire worthy of their masonry arts.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
