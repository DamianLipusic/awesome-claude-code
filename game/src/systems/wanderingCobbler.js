/**
 * EmpireOS — Wandering Cobbler (T329).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a skilled wandering
 * cobbler arrives at the imperial court, offering to craft footwear and
 * share their leatherworking expertise. The player has 80 seconds to decide.
 *
 * Choices:
 *   👞 Craft Imperial Footwear — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +8 morale
 *   📜 Share Cobbling Craft   — pay 18 gold
 *        → +0.15 gold/s for 2 min   · +12 prestige
 *   🚶 Send Away              — dismiss (no reward)
 *
 * state.wanderingCobbler = {
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST          = 20;
export const COMMISSION_WOOD_COST          = 15;
export const COMMISSION_FOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 18;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCobbler() {
  if (!state.wanderingCobbler) {
    state.wanderingCobbler = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingCobbler;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingCobblerTick() {
  const a = state.wanderingCobbler;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_COBBLER_CHANGED, { expired: true });
      addMessage('👞 The wandering cobbler packs their awls, lasts, and leather scraps back into their travel kit and sets off down the road to the next town.', 'info');
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
  emit(Events.WANDERING_COBBLER_CHANGED, { spawned: true });
  addMessage('👞 A wandering cobbler arrives at the imperial gates carrying a workbench of fine tools and a collection of expertly crafted boots. They offer to outfit the imperial court or share the secrets of their craft. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingCobbler() { return state.wanderingCobbler?.active ?? null; }
export function getCobblerSecsLeft() {
  const a = state.wanderingCobbler?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function craftImperialFootwear() {
  const a = state.wanderingCobbler;
  if (!a?.active) return { ok: false, reason: 'No cobbler present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cobbler has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial footwear from the wandering cobbler');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cobblerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'cobblerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_COBBLER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`👞 The cobbler sets up a workshop in the imperial quarter, crafting sturdy boots for soldiers and court officials. Well-shod workers move faster and fatigue less, boosting agricultural productivity across the empire! −${COMMISSION_FOOD_COST} food · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function shareCobblingCraft() {
  const a = state.wanderingCobbler;
  if (!a?.active) return { ok: false, reason: 'No cobbler present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The cobbler has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Learned cobbling craft from the wandering cobbler');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cobblerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'cobblerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_COBBLER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The cobbler shares the secrets of lasting, welting, and sole construction with imperial craftsmen. Local artisans apply these techniques to produce finer goods sold at premium prices across the empire! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCobblerAway() {
  const a = state.wanderingCobbler;
  if (!a?.active) return { ok: false, reason: 'No cobbler present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_COBBLER_CHANGED, { dismissed: true });
  addMessage('👞 The wandering cobbler nods respectfully, bundles their tools back into their travel pack, and heads off toward other imperial settlements.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
