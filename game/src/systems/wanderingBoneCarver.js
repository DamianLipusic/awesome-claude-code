/**
 * EmpireOS — Wandering Bone Carver (T386).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering bone
 * carver arrives at court carrying a satchel of polished animal bones,
 * antler pieces, and carving tools — offering to commission a set of
 * ancestral carved totems for the palace shrines, or to sell a collection
 * of rare bone carving patterns and techniques to the court artisans.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🦴 Commission Ancestral Carvings — pay 20 food + 10 stone
 *        → +0.20 food/s for 2.5 min · +15 prestige · +10 morale
 *   🗿 Purchase Carved Artifacts     — pay 18 gold
 *        → +0.15 stone/s for 2 min · +10 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.wanderingBoneCarver = {
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
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST        = 20;
export const COMMISSION_STONE_COST       = 10;
export const COMMISSION_FOOD_RATE        = 0.20;
export const COMMISSION_PRESTIGE_REWARD  = 15;
export const COMMISSION_MORALE_REWARD    = 10;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_STONE_RATE         = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 10;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingBoneCarver() {
  if (!state.wanderingBoneCarver) {
    state.wanderingBoneCarver = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingBoneCarver;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function wanderingBoneCarverTick() {
  const a = state.wanderingBoneCarver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_BONE_CARVER_CHANGED, { expired: true });
      addMessage('🦴 The wandering bone carver wraps the polished animal bones and antler pieces back in a leather satchel with practiced care, and departs down the road — the soft clatter of carved pendants fading as the artisan disappears over the ridge.', 'info');
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
  emit(Events.WANDERING_BONE_CARVER_CHANGED, { spawned: true });
  addMessage('🦴 A wandering bone carver arrives at the settlement carrying a satchel of polished animal bones, carved antler pieces, and fine flint tools — offering to commission a set of ancestral carved totems for the palace shrines and hunting lodges, or to share rare bone carving patterns and ancient craft techniques with the settlement artisans. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingBoneCarver() { return state.wanderingBoneCarver?.active ?? null; }
export function getBoneCarverSecsLeft() {
  const a = state.wanderingBoneCarver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionAncestralCarvings() {
  const a = state.wanderingBoneCarver;
  if (!a?.active) return { ok: false, reason: 'No bone carver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bone carver has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.food  -= COMMISSION_FOOD_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned ancestral carvings from the wandering bone carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'boneCarverCommission');
    state.randomEvents.activeModifiers.push({
      id: 'boneCarverCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_BONE_CARVER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🦴 The bone carver works swiftly and skillfully, producing a magnificent set of ancestral carved totems depicting great hunts, revered spirits, and founding heroes — the powerful figures are installed in the palace shrines and hunting lodges, inspiring the people with ancestral pride and sparking a wave of communal feasting and celebration! −${COMMISSION_FOOD_COST} food · −${COMMISSION_STONE_COST} stone · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCarvedArtifacts() {
  const a = state.wanderingBoneCarver;
  if (!a?.active) return { ok: false, reason: 'No bone carver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bone carver has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased carved artifacts from the wandering bone carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'boneCarverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'boneCarverPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_BONE_CARVER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗿 The bone carver presents a fascinating array of carved bone pendants, inscribed antler pieces, and ancient totem figurines — the artisans eagerly study the intricate techniques, incorporating the ancient patterns into their stone-working craft and producing beautifully carved stonework sought by nobles and traders! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBoneCarverAway() {
  const a = state.wanderingBoneCarver;
  if (!a?.active) return { ok: false, reason: 'No bone carver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_BONE_CARVER_CHANGED, { dismissed: true });
  addMessage('🦴 The bone carver gathers the satchel of carved bones and antler pieces with quiet acceptance, and departs down the road — the faint rattle of carved pendants fading as the wandering artisan disappears over the ridge.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
