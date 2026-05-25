/**
 * EmpireOS — Wandering Bronze Smith (T399).
 *
 * Every 11–15 minutes (Iron Age+, 10+ player tiles), a wandering bronze smith
 * arrives at the imperial forge district carrying a heavy bronze-bound tool chest,
 * leather bellows, and an assortment of finely hammered copper-tin alloy samples
 * and crucible molds — offering to commission extraordinary imperial bronze works
 * and cast-metal armaments for the military smithies, or to share closely-guarded
 * alloying formulas and metal-quenching techniques with the imperial ore workers.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🔱 Commission Imperial Bronze Works  — pay 25 iron + 15 gold
 *        → +0.22 iron/s for 2.5 min · +20 prestige · +10 morale
 *   🪨 Purchase Alloy Techniques          — pay 20 stone
 *        → +0.15 stone/s for 2 min · +12 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.wanderingBronzeSmith = {
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST        = 25;
export const COMMISSION_GOLD_COST        = 15;
export const COMMISSION_IRON_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 20;
export const COMMISSION_MORALE_REWARD    = 10;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST         = 20;
export const PURCHASE_STONE_RATE         = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingBronzeSmith() {
  if (!state.wanderingBronzeSmith) {
    state.wanderingBronzeSmith = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingBronzeSmith;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function wanderingBronzeSmithTick() {
  const a = state.wanderingBronzeSmith;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_BRONZE_SMITH_CHANGED, { expired: true });
      addMessage('🔱 The wandering bronze smith secures the bronze-bound tool chest, wraps the crucible molds in oiled cloth, and nods respectfully before departing from the forge district — the sharp scent of hot metal and flux fading on the breeze.', 'info');
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
  emit(Events.WANDERING_BRONZE_SMITH_CHANGED, { spawned: true });
  addMessage('🔱 A wandering bronze smith arrives at the imperial forge district carrying a heavy bronze-bound tool chest, leather bellows, and an assortment of finely hammered copper-tin alloy samples and crucible molds — offering to commission extraordinary imperial bronze works and cast-metal armaments, or to share alloying formulas and metal-quenching techniques with the imperial ore workers. Respond within 75 seconds.', 'info');
}

export function getActiveWanderingBronzeSmith() { return state.wanderingBronzeSmith?.active ?? null; }
export function getBronzeSmithSecsLeft() {
  const a = state.wanderingBronzeSmith?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialBronzeWorks() {
  const a = state.wanderingBronzeSmith;
  if (!a?.active) return { ok: false, reason: 'No bronze smith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bronze smith has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial bronze works from the wandering bronze smith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bronzeSmithCommission');
    state.randomEvents.activeModifiers.push({
      id: 'bronzeSmithCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_BRONZE_SMITH_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔱 The bronze smith fires the forge to a roaring orange heat, smelting copper and tin ingots into gleaming alloy bars before hammering and casting magnificent bronze armaments, ceremonial fittings, and precision tools that are distributed throughout the imperial smithies and military workshops — inspiring the master smiths with advanced alloying techniques that dramatically boost iron and metal production! −${COMMISSION_IRON_COST} iron · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseAlloyTechniques() {
  const a = state.wanderingBronzeSmith;
  if (!a?.active) return { ok: false, reason: 'No bronze smith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bronze smith has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased alloy techniques from the wandering bronze smith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bronzeSmithPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'bronzeSmithPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_BRONZE_SMITH_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪨 The bronze smith exchanges prized alloy formulas for cut stone — demonstrating how bronze-edged cutting tools and hardened alloy chisels transform raw stone extraction, with the imperial quarrymen eagerly adopting the new chisel-quenching and stone-splitting methods that unlock deeper seams and dramatically boost quarry output! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBronzeSmithAway() {
  const a = state.wanderingBronzeSmith;
  if (!a?.active) return { ok: false, reason: 'No bronze smith present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_BRONZE_SMITH_CHANGED, { dismissed: true });
  addMessage('🔱 The wandering bronze smith secures the tool chest and wraps the crucible molds before nodding respectfully and departing from the forge district — the faint scent of metal and flux fading on the forge-wind.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
