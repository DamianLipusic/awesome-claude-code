/**
 * EmpireOS — Wandering Tinsmith (T332).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a skilled wandering
 * tinsmith arrives at the imperial court bearing tools and samples of fine
 * tinwork. The player has 80 seconds to decide.
 *
 * Choices:
 *   🔧 Commission Tin Vessels — pay 20 iron + 15 gold
 *        → +0.22 iron/s for 2.5 min · +20 prestige · +10 morale
 *   📜 Purchase Tinsmithing Craft — pay 18 wood
 *        → +0.15 wood/s for 2 min   · +12 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.wanderingTinsmith = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalPurchases:     number,
 *   totalDismissals:    number,
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
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_IRON_COST          = 20;
export const COMMISSION_GOLD_COST          = 15;
export const COMMISSION_IRON_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 20;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST            = 18;
export const PURCHASE_WOOD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingTinsmith() {
  if (!state.wanderingTinsmith) {
    state.wanderingTinsmith = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingTinsmith;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingTinsmithTick() {
  const a = state.wanderingTinsmith;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_TINSMITH_CHANGED, { expired: true });
      addMessage('🔧 The wandering tinsmith packs their soldering tools and tin samples back into their travel chest and departs the imperial court to seek other commissions.', 'info');
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
  emit(Events.WANDERING_TINSMITH_CHANGED, { spawned: true });
  addMessage('🔧 A wandering tinsmith arrives at the imperial gates carrying a chest of gleaming tin vessels, tools, and alloy samples. They offer to establish a tinworks for the imperial stores or share the secrets of their craft. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingTinsmith() { return state.wanderingTinsmith?.active ?? null; }
export function getTinsmithSecsLeft() {
  const a = state.wanderingTinsmith?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTinVessels() {
  const a = state.wanderingTinsmith;
  if (!a?.active) return { ok: false, reason: 'No tinsmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The tinsmith has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned tin vessels from the wandering tinsmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tinsmithCommission');
    state.randomEvents.activeModifiers.push({
      id: 'tinsmithCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_TINSMITH_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔧 The tinsmith sets up a workshop in the imperial forge district, producing durable tin vessels for storage and transport. Their efficient metalworking techniques inspire imperial smiths to extract and process ore with greater skill! −${COMMISSION_IRON_COST} iron · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseTinsmithingCraft() {
  const a = state.wanderingTinsmith;
  if (!a?.active) return { ok: false, reason: 'No tinsmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The tinsmith has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased tinsmithing craft from the wandering tinsmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tinsmithPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'tinsmithPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_TINSMITH_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The tinsmith shares the secrets of flux preparation, tin-lead alloys, and efficient solder jointing. Imperial carpenters and woodworkers apply these metalworking insights to improve their own craft, making better use of timber throughout the empire! −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendTinsmithAway() {
  const a = state.wanderingTinsmith;
  if (!a?.active) return { ok: false, reason: 'No tinsmith present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_TINSMITH_CHANGED, { dismissed: true });
  addMessage('🔧 The wandering tinsmith nods politely, secures their tin samples back in the chest, and heads off down the road toward the next imperial settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
