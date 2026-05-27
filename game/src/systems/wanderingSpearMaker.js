/**
 * EmpireOS — Wandering Spear Maker (T421).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering spear maker
 * arrives at the settlement carrying a bundle of fire-hardened ash shafts
 * wrapped in oiled leather, iron-tipped hunting points attached with sinew
 * lashing, balanced throwing spears for hunting aurochs and wild boar across
 * the frontier, and short thrusting spears for garrison use — offering to
 * commission a full set of hunting spears for the empire's frontier hunters
 * and garrison troops, or to share the spear-crafting lore that keeps every
 * workshop supplied with straight-shafted, well-balanced hunting implements.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🏹 Commission Hunting Spears  — pay 20 wood + 10 food
 *        → +0.22 food/s for 2.5 min · +15 prestige · +8 morale
 *   📖 Purchase Spear-Crafting Lore — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.wanderingSpearMaker = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_WOOD_COST          = 20;
export const COMMISSION_FOOD_COST          = 10;
export const COMMISSION_FOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingSpearMaker() {
  if (!state.wanderingSpearMaker) {
    state.wanderingSpearMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingSpearMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingSpearMakerTick() {
  const a = state.wanderingSpearMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SPEAR_MAKER_CHANGED, { expired: true });
      addMessage('🏹 The wandering spear maker re-bundles the ash shafts, wraps the iron-tipped points in oiled hide, and departs along the frontier path — the faint creak of leather lashing and knock of bundled poles fading into the treeline.', 'info');
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
  emit(Events.WANDERING_SPEAR_MAKER_CHANGED, { spawned: true });
  addMessage('🏹 A wandering spear maker arrives at the settlement carrying fire-hardened ash shafts wrapped in oiled leather, iron-tipped hunting points attached with sinew lashing, balanced throwing spears for frontier hunting, and short thrusting spears for garrison defence — offering to commission a full set of hunting implements for the empire\'s hunters and troops, or to share the spear-crafting lore that keeps every workshop stocked with well-balanced spears. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingSpearMaker() { return state.wanderingSpearMaker?.active ?? null; }
export function getSpearMakerSecsLeft() {
  const a = state.wanderingSpearMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionHuntingSpears() {
  const a = state.wanderingSpearMaker;
  if (!a?.active) return { ok: false, reason: 'No spear maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The spear maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned hunting spears from the wandering spear maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'spearmakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'spearmakerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_SPEAR_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏹 The spear maker selects the straightest ash poles from the bundle, trims each shaft to perfect length and balance, attaches iron-tipped hunting points with tight sinew lashing sealed with pine pitch, and delivers balanced throwing spears to the frontier hunters and short thrusting spears to the garrison troops — the improved implements enabling more efficient hunts across the wilderness and keeping the garrison better armed through every campaign season! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSpearCraftingLore() {
  const a = state.wanderingSpearMaker;
  if (!a?.active) return { ok: false, reason: 'No spear maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The spear maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased spear-crafting lore from the wandering spear maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'spearmakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'spearmakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_SPEAR_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The spear maker shares the selection criteria for ideal shaft wood — straight-grained ash cut in winter when sap is low — the sinew-lashing technique that bonds iron points to shafts without splitting, the fire-hardening method that toughens the butt-end wood against splitting on impact, and the shaft-taper ratios that give each spear its balanced throwing weight — knowledge that allows every workshop craftsman to produce correctly-weighted hunting implements from locally-sourced timber without specialist guidance! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSpearMakerAway() {
  const a = state.wanderingSpearMaker;
  if (!a?.active) return { ok: false, reason: 'No spear maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SPEAR_MAKER_CHANGED, { dismissed: true });
  addMessage('🏹 The wandering spear maker re-bundles the ash poles, wraps the iron tips in oiled cloth, and heads back down the frontier path — nodding respectfully before disappearing into the woodland edge.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
