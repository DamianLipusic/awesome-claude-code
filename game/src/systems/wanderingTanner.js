/**
 * EmpireOS — Wandering Tanner (T343).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a skilled wandering
 * tanner arrives at the imperial gates bearing cured hides, bark-tanning
 * vats, and generations of leatherworking knowledge honed along the great
 * trade roads. The player has 80 seconds to decide.
 *
 * Choices:
 *   🦬 Commission Imperial Leatherworks — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +10 morale
 *   📜 Purchase Tanning Secrets — pay 18 gold
 *        → +0.15 gold/s for 2 min  · +12 prestige
 *   🚶 Send Away            — dismiss (no reward)
 *
 * state.wanderingTanner = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissioned:   number,
 *   totalPurchased:      number,
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

export const COMMISSION_FOOD_COST        = 20;
export const COMMISSION_WOOD_COST        = 15;
export const COMMISSION_FOOD_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 18;
export const COMMISSION_MORALE_REWARD    = 10;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingTanner() {
  if (!state.wanderingTanner) {
    state.wanderingTanner = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalCommissioned: 0,
      totalPurchased:    0,
      totalDismissals:   0,
    };
  }
  const s = state.wanderingTanner;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissioned === undefined) s.totalCommissioned = 0;
  if (s.totalPurchased    === undefined) s.totalPurchased    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingTannerTick() {
  const a = state.wanderingTanner;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_TANNER_CHANGED, { expired: true });
      addMessage('🦬 The wandering tanner carefully rolls up their sample hides, loads the tanning vats back onto their cart, and rides off down the trade road toward the next settlement on their circuit.', 'info');
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
  emit(Events.WANDERING_TANNER_CHANGED, { spawned: true });
  addMessage('🦬 A wandering tanner arrives at the imperial gates bearing cured hides, bark-tanning vats, and generations of leatherworking knowledge. They offer to establish imperial leatherworks or share ancient tanning secrets with local craftsmen. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingTanner() { return state.wanderingTanner?.active ?? null; }
export function getTannerSecsLeft() {
  const a = state.wanderingTanner?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionLeatherworks() {
  const a = state.wanderingTanner;
  if (!a?.active) return { ok: false, reason: 'No tanner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The tanner has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial leatherworks from the wandering tanner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tannerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'tannerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.WANDERING_TANNER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🦬 The tanner establishes a series of bark-tanning pits and drying racks on the imperial estate, producing premium leather for saddles, armour, and trade goods. The smell of curing hides fills the air as production soars! −${COMMISSION_FOOD_COST} food · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseTanningSecrets() {
  const a = state.wanderingTanner;
  if (!a?.active) return { ok: false, reason: 'No tanner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The tanner has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Acquired tanning secrets from the wandering tanner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tannerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'tannerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.WANDERING_TANNER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The tanner shares bark-tanning ratios, hide-stretching techniques, and premium leather-finishing secrets with imperial craftsmen. Trade goods fetch higher prices at market as leather quality improves! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendTannerAway() {
  const a = state.wanderingTanner;
  if (!a?.active) return { ok: false, reason: 'No tanner present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_TANNER_CHANGED, { dismissed: true });
  addMessage('🦬 The wandering tanner nods respectfully, loads their cured hides and bark-tanning vats back onto their cart, and sets off down the trade road toward the next settlement on their long circuit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
