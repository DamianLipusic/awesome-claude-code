/**
 * EmpireOS — Wandering Coppersmith (T379).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a skilled coppersmith
 * arrives at the palace courtyard bearing a portable forge, hammers, and a
 * collection of raw copper ingots — offering to commission a set of finely
 * crafted copper tools for the imperial workshops, or to sell the secrets of
 * coppersmithing craft to the palace artisans.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🔧 Commission Copper Tools — pay 20 iron + 15 gold
 *        → +0.20 iron/s for 2.5 min · +18 prestige · +10 morale
 *   🪙 Purchase Coppersmith Secrets — pay 18 stone
 *        → +0.15 stone/s for 2 min · +12 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.wanderingCoppersmith = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_IRON_COST           = 20;
export const COMMISSION_GOLD_COST           = 15;
export const COMMISSION_IRON_RATE           = 0.20;
export const COMMISSION_PRESTIGE_REWARD     = 18;
export const COMMISSION_MORALE_REWARD       = 10;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST            = 18;
export const PURCHASE_STONE_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD       = 12;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCoppersmith() {
  if (!state.wanderingCoppersmith) {
    state.wanderingCoppersmith = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingCoppersmith;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingCoppersmithTick() {
  const a = state.wanderingCoppersmith;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_COPPERSMITH_CHANGED, { expired: true });
      addMessage('🔧 The wandering coppersmith banks the coals of the portable forge, packs away the copper ingots and hammers into a well-worn satchel, and strides off down the road — the rhythmic clang of tools fading into the distance.', 'info');
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
  emit(Events.WANDERING_COPPERSMITH_CHANGED, { spawned: true });
  addMessage('🔧 A skilled wandering coppersmith arrives at the palace courtyard bearing a portable forge, hammers, and a collection of gleaming copper ingots — offering to craft a fine set of copper tools for the imperial workshops, or to share the ancient secrets of coppersmithing craft with the palace artisans. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingCoppersmith() { return state.wanderingCoppersmith?.active ?? null; }
export function getCoppersmithSecsLeft() {
  const a = state.wanderingCoppersmith?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCopperTools() {
  const a = state.wanderingCoppersmith;
  if (!a?.active) return { ok: false, reason: 'No coppersmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The coppersmith has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned copper tools from the wandering coppersmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'coppersmithCommission');
    state.randomEvents.activeModifiers.push({
      id: 'coppersmithCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_COPPERSMITH_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔧 The coppersmith fires up the portable forge in the palace courtyard and hammers out a superb set of copper-alloy tools — the blades hold a remarkably sharp edge and the handles are perfectly balanced, inspiring the imperial workshops to greatly improve their metalworking efficiency and iron output rates! −${COMMISSION_IRON_COST} iron · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCoppersmithSecrets() {
  const a = state.wanderingCoppersmith;
  if (!a?.active) return { ok: false, reason: 'No coppersmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The coppersmith has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased coppersmith secrets from the wandering coppersmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'coppersmithPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'coppersmithPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_COPPERSMITH_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪙 The coppersmith reveals ancient techniques for alloying copper with stone minerals to create harder, more durable implements — the palace quarrymen immediately adopt these methods, using the improved chisels and picks to greatly accelerate their stone-cutting work in the imperial quarries! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCoppersmithAway() {
  const a = state.wanderingCoppersmith;
  if (!a?.active) return { ok: false, reason: 'No coppersmith present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_COPPERSMITH_CHANGED, { dismissed: true });
  addMessage('🔧 The wandering coppersmith gives a brief nod, tucks the copper ingots back into the satchel, and heads off down the cobblestone road — the soft clinking of metal fading as the familiar silhouette disappears around the palace corner.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
