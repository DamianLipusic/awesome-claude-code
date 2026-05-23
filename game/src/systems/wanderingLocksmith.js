/**
 * EmpireOS — Wandering Locksmith (T377).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a master locksmith
 * arrives at the palace gates bearing a leather satchel filled with
 * precision-crafted iron picks, tumblers, and intricate vault mechanisms
 * — offering to forge custom imperial vault locks for the royal treasury
 * or share lock-making craft secrets with the palace artisans.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🔐 Craft Imperial Vault Locks — pay 20 iron + 15 stone
 *        → +0.22 iron/s for 2.5 min · +20 prestige · +10 morale
 *   🗝️ Share Lock-Making Craft — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.wanderingLocksmith = {
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

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const FORGE_IRON_COST           = 20;
export const FORGE_STONE_COST          = 15;
export const FORGE_IRON_RATE           = 0.22;
export const FORGE_PRESTIGE_REWARD     = 20;
export const FORGE_MORALE_REWARD       = 10;
export const FORGE_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const SHARE_GOLD_COST           = 18;
export const SHARE_GOLD_RATE           = 0.15;
export const SHARE_PRESTIGE_REWARD     = 12;
export const SHARE_DURATION_TICKS      = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingLocksmith() {
  if (!state.wanderingLocksmith) {
    state.wanderingLocksmith = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalForged:     0,
      totalShared:     0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingLocksmith;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalForged      === undefined) s.totalForged      = 0;
  if (s.totalShared      === undefined) s.totalShared      = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingLocksmithTick() {
  const a = state.wanderingLocksmith;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_LOCKSMITH_CHANGED, { expired: true });
      addMessage('🔐 The wandering locksmith carefully packs the iron tumblers and engraved vault mechanisms back into the leather satchel, bows politely to the palace guards, and departs down the cobblestone road — the faint clink of metal tools fading into the distance.', 'info');
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
  emit(Events.WANDERING_LOCKSMITH_CHANGED, { spawned: true });
  addMessage('🔐 A wandering locksmith arrives at the palace gates bearing a leather satchel filled with precision-crafted iron picks, tumblers, and intricate vault mechanisms — offering to forge custom imperial vault locks for the royal treasury or share lock-making craft secrets with the palace artisans. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingLocksmith() { return state.wanderingLocksmith?.active ?? null; }
export function getLocksmithSecsLeft() {
  const a = state.wanderingLocksmith?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function craftImperialVaultLocks() {
  const a = state.wanderingLocksmith;
  if (!a?.active) return { ok: false, reason: 'No locksmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The locksmith has departed.' };
  if ((state.resources.iron ?? 0) < FORGE_IRON_COST) return { ok: false, reason: `Need ${FORGE_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < FORGE_STONE_COST) return { ok: false, reason: `Need ${FORGE_STONE_COST} stone.` };
  state.resources.iron  -= FORGE_IRON_COST;
  state.resources.stone -= FORGE_STONE_COST;
  changeMorale(FORGE_MORALE_REWARD);
  awardPrestige(FORGE_PRESTIGE_REWARD, 'Crafted imperial vault locks with the wandering locksmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'locksmithForge');
    state.randomEvents.activeModifiers.push({
      id: 'locksmithForge', resource: 'iron',
      rateMult: 1 + (FORGE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + FORGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalForged = (a.totalForged ?? 0) + 1;
  emit(Events.WANDERING_LOCKSMITH_CHANGED, { forged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔐 The master locksmith sets up a portable forge in the palace courtyard and meticulously crafts an exquisite series of imperial vault locks from the finest iron — the treasury's newly secured vaults inspire the palace smiths to dramatically improve their iron-working precision and output rates! −${FORGE_IRON_COST} iron · −${FORGE_STONE_COST} stone · +${FORGE_PRESTIGE_REWARD} prestige · +${FORGE_MORALE_REWARD} morale. Iron surge: +${FORGE_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function shareLockMakingCraft() {
  const a = state.wanderingLocksmith;
  if (!a?.active) return { ok: false, reason: 'No locksmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The locksmith has departed.' };
  if ((state.resources.gold ?? 0) < SHARE_GOLD_COST) return { ok: false, reason: `Need ${SHARE_GOLD_COST} gold.` };
  state.resources.gold -= SHARE_GOLD_COST;
  awardPrestige(SHARE_PRESTIGE_REWARD, 'Purchased lock-making craft secrets from the wandering locksmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'locksmithShare');
    state.randomEvents.activeModifiers.push({
      id: 'locksmithShare', resource: 'gold',
      rateMult: 1 + (SHARE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + SHARE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalShared = (a.totalShared ?? 0) + 1;
  emit(Events.WANDERING_LOCKSMITH_CHANGED, { shared: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗝️ The locksmith spends an afternoon with the palace artisans, teaching them the intricate craft of tumbler alignment, spring tensioning, and key-cut geometry — the workshops immediately apply these precision techniques to improve the quality of tools and trade goods sold in the imperial markets, boosting merchant revenue! −${SHARE_GOLD_COST} gold · +${SHARE_PRESTIGE_REWARD} prestige. Gold surge: +${SHARE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLocksmithAway() {
  const a = state.wanderingLocksmith;
  if (!a?.active) return { ok: false, reason: 'No locksmith present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_LOCKSMITH_CHANGED, { dismissed: true });
  addMessage('🔐 The wandering locksmith gives a respectful nod, tucks the leather satchel under one arm, and disappears through the palace gates — the faint jingle of iron tumblers fading down the cobblestone road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
