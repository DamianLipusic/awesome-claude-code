/**
 * EmpireOS — Wandering Gemcutter (T281).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a wandering gemcutter
 * bearing a chest of raw gemstones and expert crafting tools arrives,
 * seeking patronage and materials. The player has 80 seconds to decide.
 *
 * Choices:
 *   💎 Commission Gem Setting    — pay 20 stone + 15 iron
 *        → +0.15 iron/s for 2.5 min · +25 prestige · +10 morale
 *   🔮 Purchase Gemstone Arts    — pay 35 gold
 *        → +0.1 stone/s for 2 min · +20 prestige
 *   👋 Send Away                 — dismiss (no reward)
 *
 * state.wanderingGemcutter = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissions: number,
 *   totalPurchases:   number,
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

export const COMMISSION_STONE_COST      = 20;
export const COMMISSION_IRON_COST       = 15;
export const COMMISSION_IRON_RATE       = 0.15;
export const COMMISSION_PRESTIGE_REWARD = 25;
export const COMMISSION_MORALE_REWARD   = 10;
export const COMMISSION_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST         = 35;
export const PURCHASE_STONE_RATE        = 0.1;
export const PURCHASE_PRESTIGE_REWARD   = 20;
export const PURCHASE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingGemcutter() {
  if (!state.wanderingGemcutter) {
    state.wanderingGemcutter = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  if (state.wanderingGemcutter.nextSpawnTick    === undefined) state.wanderingGemcutter.nextSpawnTick    = _nextSpawnTick();
  if (state.wanderingGemcutter.totalVisits      === undefined) state.wanderingGemcutter.totalVisits      = 0;
  if (state.wanderingGemcutter.totalCommissions === undefined) state.wanderingGemcutter.totalCommissions = 0;
  if (state.wanderingGemcutter.totalPurchases   === undefined) state.wanderingGemcutter.totalPurchases   = 0;
  if (state.wanderingGemcutter.totalDismissals  === undefined) state.wanderingGemcutter.totalDismissals  = 0;
}

export function wanderingGemcutterTick() {
  const wg = state.wanderingGemcutter;
  if (!wg) return;
  if (wg.active) {
    if (state.tick >= wg.active.expiresAt) {
      wg.active = null; wg.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_GEMCUTTER_CHANGED, { expired: true });
      addMessage('💎 The wandering gemcutter packs their tools and gems and departs for the next great city.', 'info');
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
  emit(Events.WANDERING_GEMCUTTER_CHANGED, { spawned: true });
  addMessage('💎 A wandering gemcutter bearing a chest of dazzling raw gemstones and precision cutting tools has arrived at the imperial palace, their gem-setting skills renowned across the realm. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingGemcutter() { return state.wanderingGemcutter?.active ?? null; }
export function getGemcutterSecsLeft() {
  const a = state.wanderingGemcutter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGemSetting() {
  const wg = state.wanderingGemcutter;
  if (!wg?.active) return { ok: false, reason: 'No gemcutter present.' };
  if (state.tick >= wg.active.expiresAt) return { ok: false, reason: 'The gemcutter has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.iron  ?? 0) < COMMISSION_IRON_COST)  return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.iron  -= COMMISSION_IRON_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned exquisite gem settings from a wandering gemcutter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'gemcutterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'gemcutterCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  wg.active = null; wg.nextSpawnTick = _nextSpawnTick(); wg.totalCommissions = (wg.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_GEMCUTTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💎 The gemcutter's intricate settings inspire imperial craftsmen to new heights of metallurgy! −${COMMISSION_STONE_COST} stone · −${COMMISSION_IRON_COST} iron · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Refined ironwork flows: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseGemstoneArts() {
  const wg = state.wanderingGemcutter;
  if (!wg?.active) return { ok: false, reason: 'No gemcutter present.' };
  if (state.tick >= wg.active.expiresAt) return { ok: false, reason: 'The gemcutter has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased gemstone arts knowledge from a wandering gemcutter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'gemcutterArts');
    state.randomEvents.activeModifiers.push({
      id: 'gemcutterArts', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  wg.active = null; wg.nextSpawnTick = _nextSpawnTick(); wg.totalPurchases = (wg.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_GEMCUTTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔮 Gemstone cutting techniques revolutionize imperial quarrying methods! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Refined extraction: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGemcutterAway() {
  const wg = state.wanderingGemcutter;
  if (!wg?.active) return { ok: false, reason: 'No gemcutter present.' };
  wg.active = null; wg.nextSpawnTick = _nextSpawnTick(); wg.totalDismissals = (wg.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_GEMCUTTER_CHANGED, { dismissed: true });
  addMessage('💎 The wandering gemcutter is politely thanked and continues their journey to distant gem markets.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
