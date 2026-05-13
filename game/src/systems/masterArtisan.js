/**
 * EmpireOS — Master Artisan Visit (T252).
 *
 * Every 14–19 minutes (Iron Age+, 10+ player tiles), a renowned master
 * artisan visits the empire offering their exceptional craft skills.
 * The player has 85 seconds to decide.
 *
 * Choices:
 *   🔨 Hire the Artisan   — pay 70 gold → +60 prestige, +0.15 iron/s for 3 min
 *   🎦 Commission Pieces  — pay 40 wood + 20 stone → +80 gold, +30 prestige
 *   👋 Bid Farewell       — no cost
 *
 * state.masterArtisan = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalHired:       number,
 *   totalCommissioned: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 85 * TICKS_PER_SECOND;
const MIN_AGE          = 2;
const MIN_PLAYER_TILES = 10;

export const HIRE_GOLD_COST        = 70;
export const HIRE_PRESTIGE_REWARD  = 60;
export const HIRE_IRON_RATE        = 0.15;
export const HIRE_DURATION_TICKS   = 3 * 60 * TICKS_PER_SECOND;

export const COMMISSION_WOOD_COST       = 40;
export const COMMISSION_STONE_COST      = 20;
export const COMMISSION_GOLD_REWARD     = 80;
export const COMMISSION_PRESTIGE_REWARD = 30;

export function initMasterArtisan() {
  if (!state.masterArtisan) {
    state.masterArtisan = { active: null, nextSpawnTick: _nextSpawnTick(), totalVisits: 0, totalHired: 0, totalCommissioned: 0 };
  }
  if (state.masterArtisan.nextSpawnTick     === undefined) state.masterArtisan.nextSpawnTick     = _nextSpawnTick();
  if (state.masterArtisan.totalVisits       === undefined) state.masterArtisan.totalVisits       = 0;
  if (state.masterArtisan.totalHired        === undefined) state.masterArtisan.totalHired        = 0;
  if (state.masterArtisan.totalCommissioned === undefined) state.masterArtisan.totalCommissioned = 0;
}

export function masterArtisanTick() {
  const a = state.masterArtisan;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active        = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.MASTER_ARTISAN_CHANGED, { expired: true });
      addMessage('🔨 The master artisan has departed without accepting an offer.', 'info');
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
  emit(Events.MASTER_ARTISAN_CHANGED, { spawned: true });
  addMessage('🔨 A renowned master artisan has arrived seeking patronage! Their exceptional craft could greatly benefit the empire. Respond within 85 seconds.', 'info');
}

export function getActiveMasterArtisan() { return state.masterArtisan?.active ?? null; }
export function getMasterArtisanSecsLeft() {
  const a = state.masterArtisan?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function hireMasterArtisan() {
  const a = state.masterArtisan;
  if (!a?.active) return { ok: false, reason: 'No artisan present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The artisan has departed.' };
  if ((state.resources.gold ?? 0) < HIRE_GOLD_COST) return { ok: false, reason: `Need ${HIRE_GOLD_COST} gold.` };
  state.resources.gold -= HIRE_GOLD_COST;
  awardPrestige(HIRE_PRESTIGE_REWARD, 'Master artisan patronage elevated imperial craftsmanship');
  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'masterArtisanHire');
    state.randomEvents.activeModifiers.push({ id: 'masterArtisanHire', resource: 'iron', rateMult: 1 + (HIRE_IRON_RATE / Math.max(0.001, (state.rates?.iron ?? 1))), expiresAt: state.tick + HIRE_DURATION_TICKS });
  }
  a.active        = null; a.nextSpawnTick = _nextSpawnTick(); a.totalHired    = (a.totalHired ?? 0) + 1;
  emit(Events.MASTER_ARTISAN_CHANGED, { hired: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔨 The master artisan begins work! +${HIRE_PRESTIGE_REWARD} prestige, +${HIRE_IRON_RATE} iron/s for 3 minutes as the workshops thrive.`, 'windfall');
  return { ok: true };
}

export function commissionArtisanPieces() {
  const a = state.masterArtisan;
  if (!a?.active) return { ok: false, reason: 'No artisan present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The artisan has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.wood  -= COMMISSION_WOOD_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  const goldCap = state.caps?.gold ?? 9999;
  state.resources.gold = Math.min(goldCap, (state.resources.gold ?? 0) + COMMISSION_GOLD_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Master artisan pieces sold at premium prices');
  a.active            = null; a.nextSpawnTick     = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.MASTER_ARTISAN_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎦 The artisan crafts magnificent pieces! +${COMMISSION_GOLD_REWARD} gold, +${COMMISSION_PRESTIGE_REWARD} prestige from the sale of masterworks.`, 'windfall');
  return { ok: true };
}

export function bidArtisanFarewell() {
  const a = state.masterArtisan;
  if (!a?.active) return { ok: false, reason: 'No artisan present.' };
  a.active        = null; a.nextSpawnTick = _nextSpawnTick();
  emit(Events.MASTER_ARTISAN_CHANGED, { dismissed: true });
  addMessage('👋 The master artisan bids farewell and continues their journey.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }