/**
 * EmpireOS — Ancient Library Keeper (T308).
 *
 * Every 15–20 minutes (Medieval Age+, 10+ player tiles), an ancient library
 * keeper emerges from a hidden archive with rare texts and forbidden knowledge.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📚 Access Forbidden Archives — pay 30 mana
 *        → +0.3 mana/s for 2.5 min · +25 prestige · +8 morale
 *   📜 Purchase Rare Manuscripts — pay 35 gold
 *        → +0.2 gold/s for 2 min · +20 prestige
 *   🚶 Send Away                 — dismiss (no reward)
 *
 * state.ancientLibraryKeeper = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalArchiveAccess:  number,
 *   totalPurchases:      number,
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
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const ARCHIVE_MANA_COST           = 30;
export const ARCHIVE_MANA_RATE           = 0.3;
export const ARCHIVE_PRESTIGE_REWARD     = 25;
export const ARCHIVE_MORALE_REWARD       = 8;
export const ARCHIVE_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const MANUSCRIPTS_GOLD_COST       = 35;
export const MANUSCRIPTS_GOLD_RATE       = 0.2;
export const MANUSCRIPTS_PRESTIGE_REWARD = 20;
export const MANUSCRIPTS_DURATION_TICKS  = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initAncientLibraryKeeper() {
  if (!state.ancientLibraryKeeper) {
    state.ancientLibraryKeeper = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalArchiveAccess: 0,
      totalPurchases:    0,
      totalDismissals:   0,
    };
  }
  const s = state.ancientLibraryKeeper;
  if (s.nextSpawnTick       === undefined) s.nextSpawnTick       = _nextSpawnTick();
  if (s.totalVisits         === undefined) s.totalVisits         = 0;
  if (s.totalArchiveAccess  === undefined) s.totalArchiveAccess  = 0;
  if (s.totalPurchases      === undefined) s.totalPurchases      = 0;
  if (s.totalDismissals     === undefined) s.totalDismissals     = 0;
}

export function ancientLibraryKeeperTick() {
  const a = state.ancientLibraryKeeper;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.ANCIENT_LIBRARY_KEEPER_CHANGED, { expired: true });
      addMessage('📚 The ancient library keeper clasps their tome of forbidden knowledge shut, adjusts their spectacles, and vanishes back into the labyrinthine archives from which they came.', 'info');
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
  emit(Events.ANCIENT_LIBRARY_KEEPER_CHANGED, { spawned: true });
  addMessage('📚 An ancient library keeper materialises at the palace entrance, bearing a lantern in one hand and a tome of extraordinary rarity in the other. They claim to guard archives of forbidden knowledge from civilisations long forgotten. Respond within 80 seconds.', 'info');
}

export function getActiveLibraryKeeper() { return state.ancientLibraryKeeper?.active ?? null; }
export function getLibraryKeeperSecsLeft() {
  const a = state.ancientLibraryKeeper?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function accessForbiddenArchives() {
  const a = state.ancientLibraryKeeper;
  if (!a?.active) return { ok: false, reason: 'No library keeper present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The keeper has departed.' };
  if ((state.resources.mana ?? 0) < ARCHIVE_MANA_COST) return { ok: false, reason: `Need ${ARCHIVE_MANA_COST} mana.` };
  state.resources.mana -= ARCHIVE_MANA_COST;
  changeMorale(ARCHIVE_MORALE_REWARD);
  awardPrestige(ARCHIVE_PRESTIGE_REWARD, 'Accessed the forbidden archives of the ancient library keeper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'libraryArchive');
    state.randomEvents.activeModifiers.push({
      id: 'libraryArchive', resource: 'mana',
      rateMult: 1 + (ARCHIVE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + ARCHIVE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalArchiveAccess = (a.totalArchiveAccess ?? 0) + 1;
  emit(Events.ANCIENT_LIBRARY_KEEPER_CHANGED, { archive: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📚 The library keeper leads the imperial scholars deep into the forbidden archives! Ancient texts describing lost magical formulae and arcane rituals are transcribed by candlelight, dramatically accelerating mystical research across the empire! −${ARCHIVE_MANA_COST} mana · +${ARCHIVE_PRESTIGE_REWARD} prestige · +${ARCHIVE_MORALE_REWARD} morale. Arcane surge: +${ARCHIVE_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRareManuscripts() {
  const a = state.ancientLibraryKeeper;
  if (!a?.active) return { ok: false, reason: 'No library keeper present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The keeper has departed.' };
  if ((state.resources.gold ?? 0) < MANUSCRIPTS_GOLD_COST) return { ok: false, reason: `Need ${MANUSCRIPTS_GOLD_COST} gold.` };
  state.resources.gold -= MANUSCRIPTS_GOLD_COST;
  awardPrestige(MANUSCRIPTS_PRESTIGE_REWARD, 'Purchased rare manuscripts from the ancient library keeper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'libraryManuscripts');
    state.randomEvents.activeModifiers.push({
      id: 'libraryManuscripts', resource: 'gold',
      rateMult: 1 + (MANUSCRIPTS_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + MANUSCRIPTS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.ANCIENT_LIBRARY_KEEPER_CHANGED, { manuscripts: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The rare manuscripts are acquired and distributed to the empire's trading houses and merchant guilds. The ancient commercial wisdom encoded within transforms trade practices, opening new profitable routes and opportunities! −${MANUSCRIPTS_GOLD_COST} gold · +${MANUSCRIPTS_PRESTIGE_REWARD} prestige. Commerce surge: +${MANUSCRIPTS_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLibraryKeeperAway() {
  const a = state.ancientLibraryKeeper;
  if (!a?.active) return { ok: false, reason: 'No library keeper present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.ANCIENT_LIBRARY_KEEPER_CHANGED, { dismissed: true });
  addMessage('📚 The ancient library keeper nods with quiet dignity, extinguishes their lantern, and withdraws back into the shadows between the great stone shelves of their hidden archive.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
