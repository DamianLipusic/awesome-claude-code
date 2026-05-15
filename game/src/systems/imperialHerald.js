/**
 * EmpireOS — Imperial Herald (T287).
 *
 * Every 15–19 minutes (Medieval Age+, 10+ player tiles), a resplendent imperial
 * herald arrives bearing golden trumpets and imperial proclamations, offering to
 * spread the empire's glory throughout the land. The player has 80 seconds to decide.
 *
 * Choices:
 *   📯 Proclaim Imperial Victory — pay 40 gold
 *        → +0.2 gold/s for 2.5 min · +28 prestige · +10 morale
 *   📜 Announce Royal Decree     — free
 *        → +15 prestige · +10 morale
 *   👋 Send Away                 — dismiss (no reward)
 *
 * state.imperialHerald = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalProclamations:  number,
 *   totalAnnouncements:  number,
 *   totalDismissals:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const PROCLAIM_GOLD_COST          = 40;
export const PROCLAIM_GOLD_RATE          = 0.2;
export const PROCLAIM_PRESTIGE_REWARD    = 28;
export const PROCLAIM_MORALE_REWARD      = 10;
export const PROCLAIM_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const ANNOUNCE_PRESTIGE_REWARD    = 15;
export const ANNOUNCE_MORALE_REWARD      = 10;

export function initImperialHerald() {
  if (!state.imperialHerald) {
    state.imperialHerald = {
      active:             null,
      nextSpawnTick:      _nextSpawnTick(),
      totalVisits:        0,
      totalProclamations: 0,
      totalAnnouncements: 0,
      totalDismissals:    0,
    };
  }
  if (state.imperialHerald.nextSpawnTick      === undefined) state.imperialHerald.nextSpawnTick      = _nextSpawnTick();
  if (state.imperialHerald.totalVisits        === undefined) state.imperialHerald.totalVisits        = 0;
  if (state.imperialHerald.totalProclamations === undefined) state.imperialHerald.totalProclamations = 0;
  if (state.imperialHerald.totalAnnouncements === undefined) state.imperialHerald.totalAnnouncements = 0;
  if (state.imperialHerald.totalDismissals    === undefined) state.imperialHerald.totalDismissals    = 0;
}

export function imperialHeraldTick() {
  const ih = state.imperialHerald;
  if (!ih) return;
  if (ih.active) {
    if (state.tick >= ih.active.expiresAt) {
      ih.active = null; ih.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_HERALD_CHANGED, { expired: true });
      addMessage('📯 The imperial herald rolls up their proclamations and rides onward to the next province.', 'info');
    }
    return;
  }
  if (state.tick < ih.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  ih.active      = { expiresAt: state.tick + WINDOW_TICKS };
  ih.totalVisits = (ih.totalVisits ?? 0) + 1;
  emit(Events.IMPERIAL_HERALD_CHANGED, { spawned: true });
  addMessage('📯 A resplendent imperial herald arrives at the imperial gates, golden trumpets gleaming, bearing proclamations of imperial glory to spread throughout the realm. Respond within 80 seconds.', 'info');
}

export function getActiveImperialHerald() { return state.imperialHerald?.active ?? null; }
export function getHeraldSecsLeft() {
  const a = state.imperialHerald?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function proclaimImperialVictory() {
  const ih = state.imperialHerald;
  if (!ih?.active) return { ok: false, reason: 'No herald present.' };
  if (state.tick >= ih.active.expiresAt) return { ok: false, reason: 'The herald has departed.' };
  if ((state.resources.gold ?? 0) < PROCLAIM_GOLD_COST) return { ok: false, reason: `Need ${PROCLAIM_GOLD_COST} gold.` };
  state.resources.gold -= PROCLAIM_GOLD_COST;
  changeMorale(PROCLAIM_MORALE_REWARD);
  awardPrestige(PROCLAIM_PRESTIGE_REWARD, 'Commissioned imperial victory proclamations from the herald');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'heraldProclaim');
    state.randomEvents.activeModifiers.push({
      id: 'heraldProclaim', resource: 'gold',
      rateMult: 1 + (PROCLAIM_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PROCLAIM_DURATION_TICKS,
    });
  }
  ih.active = null; ih.nextSpawnTick = _nextSpawnTick(); ih.totalProclamations = (ih.totalProclamations ?? 0) + 1;
  emit(Events.IMPERIAL_HERALD_CHANGED, { proclaimed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📯 The herald's golden trumpets ring across the land, proclaiming imperial greatness and inspiring merchants to trade with renewed vigour! −${PROCLAIM_GOLD_COST} gold · +${PROCLAIM_PRESTIGE_REWARD} prestige · +${PROCLAIM_MORALE_REWARD} morale. Trade surge: +${PROCLAIM_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function announceRoyalDecree() {
  const ih = state.imperialHerald;
  if (!ih?.active) return { ok: false, reason: 'No herald present.' };
  if (state.tick >= ih.active.expiresAt) return { ok: false, reason: 'The herald has departed.' };
  changeMorale(ANNOUNCE_MORALE_REWARD);
  awardPrestige(ANNOUNCE_PRESTIGE_REWARD, 'The imperial herald announced a royal decree throughout the realm');
  ih.active = null; ih.nextSpawnTick = _nextSpawnTick(); ih.totalAnnouncements = (ih.totalAnnouncements ?? 0) + 1;
  emit(Events.IMPERIAL_HERALD_CHANGED, { announced: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The imperial herald's proclamation rings through town squares and village greens, lifting spirits across the realm! +${ANNOUNCE_PRESTIGE_REWARD} prestige · +${ANNOUNCE_MORALE_REWARD} morale.`, 'windfall');
  return { ok: true };
}

export function sendHeraldAway() {
  const ih = state.imperialHerald;
  if (!ih?.active) return { ok: false, reason: 'No herald present.' };
  ih.active = null; ih.nextSpawnTick = _nextSpawnTick(); ih.totalDismissals = (ih.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_HERALD_CHANGED, { dismissed: true });
  addMessage('📯 The imperial herald is thanked and rides onward to carry news to the distant provinces.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
