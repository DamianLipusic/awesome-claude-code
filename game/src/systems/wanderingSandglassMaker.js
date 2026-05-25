/**
 * EmpireOS — Wandering Sandglass Maker (T405).
 *
 * Every 12–17 minutes (Stone Age+, 6+ player tiles), a wandering sandglass maker
 * arrives at the palace workshops carrying a set of delicate blown-glass hourglasses
 * filled with fine sea-sand, river silt, and crushed crystal — offering to craft
 * a series of imperial hourglasses for the palace timekeepers, or to share the
 * arcane secrets of glass-sand measurement and fine abrasive compounding.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ⏳ Commission Imperial Hourglasses  — pay 20 stone + 15 gold
 *        → +0.20 stone/s for 2.5 min · +18 prestige · +10 morale
 *   🪨 Purchase Glass-Sand Lore         — pay 18 iron
 *        → +0.15 iron/s for 2 min · +12 prestige
 *   🚶 Send Away                         — dismiss (no reward)
 *
 * state.wanderingSandglassMaker = {
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
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_STONE_COST         = 20;
export const COMMISSION_GOLD_COST          = 15;
export const COMMISSION_STONE_RATE         = 0.20;
export const COMMISSION_PRESTIGE_REWARD    = 18;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_IRON_COST            = 18;
export const PURCHASE_IRON_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingSandglassMaker() {
  if (!state.wanderingSandglassMaker) {
    state.wanderingSandglassMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingSandglassMaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingSandglassMakerTick() {
  const a = state.wanderingSandglassMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SANDGLASS_MAKER_CHANGED, { expired: true });
      addMessage('⏳ The sandglass maker carefully wraps the delicate blown-glass hourglasses back in their travelling case and departs the palace workshops — the soft whisper of fine sea-sand draining through polished glass fading with the creak of the cart.', 'info');
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
  emit(Events.WANDERING_SANDGLASS_MAKER_CHANGED, { spawned: true });
  addMessage('⏳ A wandering sandglass maker arrives at the palace workshops carrying a set of delicate blown-glass hourglasses filled with fine sea-sand, river silt, and crushed crystal — offering to craft imperial hourglasses for the palace timekeepers, or to share the arcane secrets of glass-sand measurement and fine abrasive compounding. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingSandglassMaker() { return state.wanderingSandglassMaker?.active ?? null; }
export function getSandglassMakerSecsLeft() {
  const a = state.wanderingSandglassMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialHourglasses() {
  const a = state.wanderingSandglassMaker;
  if (!a?.active) return { ok: false, reason: 'No sandglass maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The sandglass maker has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST)   return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial hourglasses from the wandering sandglass maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sandglassMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'sandglassMakerCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_SANDGLASS_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⏳ The sandglass maker selects the finest sea-sand, amber river silt, and crushed quartz crystal, blowing precision glass bulbs and calibrating each chamber against the palace water-clock — the finished imperial hourglasses are installed in the workshops, kitchens, and guard stations, setting a new tempo of industrious precision that spurs the quarry teams and masons to work in disciplined measured intervals! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseGlassSandLore() {
  const a = state.wanderingSandglassMaker;
  if (!a?.active) return { ok: false, reason: 'No sandglass maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The sandglass maker has departed.' };
  if ((state.resources.iron ?? 0) < PURCHASE_IRON_COST) return { ok: false, reason: `Need ${PURCHASE_IRON_COST} iron.` };
  state.resources.iron -= PURCHASE_IRON_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased glass-sand lore from the wandering sandglass maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sandglassMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'sandglassMakerPurchase', resource: 'iron',
      rateMult: 1 + (PURCHASE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_SANDGLASS_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪨 The sandglass maker shares a compendium of abrasive mineral compounds — fine sands, crushed emery, ground pumice, and polishing grit blends — demonstrating how the precise grading and application of each mineral dramatically improves the efficiency of iron filing, chisel sharpening, and metal-surface finishing in the imperial forges and smithies, accelerating iron production across the empire! −${PURCHASE_IRON_COST} iron · +${PURCHASE_PRESTIGE_REWARD} prestige. Iron surge: +${PURCHASE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSandglassMakerAway() {
  const a = state.wanderingSandglassMaker;
  if (!a?.active) return { ok: false, reason: 'No sandglass maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SANDGLASS_MAKER_CHANGED, { dismissed: true });
  addMessage('⏳ The sandglass maker carefully repacks the delicate blown-glass hourglasses and departs the palace — the whisper of sea-sand draining through polished crystal fading into the quiet of the courtyard.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
