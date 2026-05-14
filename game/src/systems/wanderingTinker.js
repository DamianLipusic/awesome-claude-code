/**
 * EmpireOS — Wandering Tinker (T275).
 *
 * Every 11–16 minutes (Iron Age+, 10+ player tiles), a wandering tinker
 * arrives with tools and expertise in metalwork and craftsmanship. The player
 * has 75 seconds to decide.
 *
 * Choices:
 *   🔧 Commission Repairs       — pay 25 iron + 10 wood
 *        → +0.15 iron/s for 2.5 min + 18 prestige + 8 morale
 *   🛠️ Purchase Crafted Tools   — pay 20 gold
 *        → +15 iron + 10 prestige
 *   👋 Send Away               — dismiss (no reward)
 *
 * state.wanderingTinker = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
 *   totalPurchases:    number,
 *   totalDismissals:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST      = 25;
export const COMMISSION_WOOD_COST      = 10;
export const COMMISSION_IRON_RATE      = 0.15;
export const COMMISSION_DURATION_TICKS = Math.round(2.5 * 60 * TICKS_PER_SECOND);
export const COMMISSION_PRESTIGE_REWARD = 18;
export const COMMISSION_MORALE_REWARD   = 8;

export const PURCHASE_GOLD_COST        = 20;
export const PURCHASE_IRON_REWARD      = 15;
export const PURCHASE_PRESTIGE_REWARD  = 10;

export function initWanderingTinker() {
  if (!state.wanderingTinker) {
    state.wanderingTinker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  if (state.wanderingTinker.nextSpawnTick    === undefined) state.wanderingTinker.nextSpawnTick    = _nextSpawnTick();
  if (state.wanderingTinker.totalVisits      === undefined) state.wanderingTinker.totalVisits      = 0;
  if (state.wanderingTinker.totalCommissions === undefined) state.wanderingTinker.totalCommissions = 0;
  if (state.wanderingTinker.totalPurchases   === undefined) state.wanderingTinker.totalPurchases   = 0;
  if (state.wanderingTinker.totalDismissals  === undefined) state.wanderingTinker.totalDismissals  = 0;
}

export function wanderingTinkerTick() {
  const wt = state.wanderingTinker;
  if (!wt) return;
  if (wt.active) {
    if (state.tick >= wt.active.expiresAt) {
      wt.active = null; wt.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_TINKER_CHANGED, { expired: true });
      addMessage('🔧 The wandering tinker packs up their tools and moves on to the next settlement.', 'info');
    }
    return;
  }
  if (state.tick < wt.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  wt.active      = { expiresAt: state.tick + WINDOW_TICKS };
  wt.totalVisits = (wt.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_TINKER_CHANGED, { spawned: true });
  addMessage('🔧 A wandering tinker renowned for metalwork and craftsmanship has arrived at the imperial gates! Their cart is laden with tools and spare parts. Decide within 75 seconds.', 'info');
}

export function getActiveWanderingTinker() { return state.wanderingTinker?.active ?? null; }
export function getTinkerSecsLeft() {
  const a = state.wanderingTinker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTinkerRepairs() {
  const wt = state.wanderingTinker;
  if (!wt?.active) return { ok: false, reason: 'No tinker present.' };
  if (state.tick >= wt.active.expiresAt) return { ok: false, reason: 'The tinker has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned expert repairs from a wandering tinker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tinkerRepairs');
    state.randomEvents.activeModifiers.push({
      id: 'tinkerRepairs', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  wt.active = null; wt.nextSpawnTick = _nextSpawnTick(); wt.totalCommissions = (wt.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_TINKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔧 The tinker sets to work! Imperial forges are repaired and optimised. −${COMMISSION_IRON_COST} iron · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron output boosted: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseTinkerTools() {
  const wt = state.wanderingTinker;
  if (!wt?.active) return { ok: false, reason: 'No tinker present.' };
  if (state.tick >= wt.active.expiresAt) return { ok: false, reason: 'The tinker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  state.resources.iron  = (state.resources.iron ?? 0) + PURCHASE_IRON_REWARD;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased crafted tools from a wandering tinker');
  wt.active = null; wt.nextSpawnTick = _nextSpawnTick(); wt.totalPurchases = (wt.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_TINKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🛠️ Fine crafted tools acquired from the tinker's cart! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_IRON_REWARD} iron · +${PURCHASE_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

export function sendTinkerAway() {
  const wt = state.wanderingTinker;
  if (!wt?.active) return { ok: false, reason: 'No tinker present.' };
  wt.active = null; wt.nextSpawnTick = _nextSpawnTick(); wt.totalDismissals = (wt.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_TINKER_CHANGED, { dismissed: true });
  addMessage('🔧 The wandering tinker is politely turned away from the imperial gates.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
