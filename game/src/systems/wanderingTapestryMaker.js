/**
 * EmpireOS — Wandering Tapestry Maker (T387).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a wandering tapestry
 * maker arrives at court carrying bolts of richly dyed wool and intricate
 * loom patterns — offering to weave a magnificent imperial tapestry for the
 * throne room walls, or to sell rare weaving patterns and techniques to the
 * court artisans.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🧶 Commission Imperial Tapestry — pay 25 wood + 20 gold
 *        → +0.25 wood/s for 2.5 min · +20 prestige · +12 morale
 *   🎨 Purchase Tapestry Patterns   — pay 20 gold
 *        → +0.18 gold/s for 2 min · +15 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingTapestryMaker = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_WOOD_COST        = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_WOOD_RATE        = 0.25;
export const COMMISSION_PRESTIGE_REWARD  = 20;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 20;
export const PURCHASE_GOLD_RATE          = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingTapestryMaker() {
  if (!state.wanderingTapestryMaker) {
    state.wanderingTapestryMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingTapestryMaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function wanderingTapestryMakerTick() {
  const a = state.wanderingTapestryMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_TAPESTRY_MAKER_CHANGED, { expired: true });
      addMessage('🧶 The wandering tapestry maker gently folds the unfinished cloth and loom patterns back into the travel chest, and sets off down the road — the soft rattle of wooden shuttle pins fading as the artisan disappears around the bend.', 'info');
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
  emit(Events.WANDERING_TAPESTRY_MAKER_CHANGED, { spawned: true });
  addMessage('🧶 A wandering tapestry maker arrives at court carrying bolts of richly dyed wool, intricate hand-painted loom patterns, and finely carved wooden shuttles — offering to weave a magnificent imperial tapestry for the throne room walls, or to share rare weaving patterns and ancient craft techniques with the court artisans. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingTapestryMaker() { return state.wanderingTapestryMaker?.active ?? null; }
export function getTapestryMakerSecsLeft() {
  const a = state.wanderingTapestryMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialTapestry() {
  const a = state.wanderingTapestryMaker;
  if (!a?.active) return { ok: false, reason: 'No tapestry maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The tapestry maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial tapestry from the wandering tapestry maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tapestryMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'tapestryMakerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_TAPESTRY_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧶 The tapestry maker sets up the great loom in the throne room and works for three days and nights, producing a breathtaking imperial tapestry depicting the founding of the empire, great battles won, and noble ancestors — the magnificent artwork fills the court with pride and inspires the woodworkers and weavers of the settlement to greater feats of craft! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseTapestryPatterns() {
  const a = state.wanderingTapestryMaker;
  if (!a?.active) return { ok: false, reason: 'No tapestry maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The tapestry maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased tapestry patterns from the wandering tapestry maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tapestryMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'tapestryMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_TAPESTRY_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The tapestry maker presents an exquisite collection of intricate weaving patterns — flowing geometric designs, mythological figures, and heraldic emblems that the court artisans eagerly incorporate into luxury fabrics and decorative cloths sought by nobles and wealthy merchants throughout the empire! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendTapestryMakerAway() {
  const a = state.wanderingTapestryMaker;
  if (!a?.active) return { ok: false, reason: 'No tapestry maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_TAPESTRY_MAKER_CHANGED, { dismissed: true });
  addMessage('🧶 The tapestry maker carefully rolls the wool bolts and loom patterns back into the travel chest, and departs with quiet dignity — the faint creak of the wooden cart fading as the wandering artisan disappears down the road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
