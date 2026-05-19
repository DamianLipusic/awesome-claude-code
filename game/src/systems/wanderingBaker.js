/**
 * EmpireOS — Wandering Baker (T335).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a skilled wandering baker
 * arrives at the imperial gates bearing flour sacks, proving baskets, and
 * ancient recipes for breads and pastries beloved across the realm.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🥖 Bake Imperial Bread  — pay 25 food
 *        → +0.25 food/s for 2.5 min · +18 prestige · +10 morale
 *   📜 Share Baking Secrets — pay 18 gold
 *        → +0.15 gold/s for 2 min   · +12 prestige
 *   🚶 Send Away            — dismiss (no reward)
 *
 * state.wanderingBaker = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalBaked:       number,
 *   totalShared:      number,
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

export const BAKE_FOOD_COST           = 25;
export const BAKE_FOOD_RATE           = 0.25;
export const BAKE_PRESTIGE_REWARD     = 18;
export const BAKE_MORALE_REWARD       = 10;
export const BAKE_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const SHARE_GOLD_COST          = 18;
export const SHARE_GOLD_RATE          = 0.15;
export const SHARE_PRESTIGE_REWARD    = 12;
export const SHARE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingBaker() {
  if (!state.wanderingBaker) {
    state.wanderingBaker = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalBaked:      0,
      totalShared:     0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingBaker;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalBaked      === undefined) s.totalBaked      = 0;
  if (s.totalShared     === undefined) s.totalShared     = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingBakerTick() {
  const a = state.wanderingBaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_BAKER_CHANGED, { expired: true });
      addMessage('🥖 The wandering baker carefully wraps their remaining loaves, stows their proving baskets, and sets off toward the next settlement on their bread-making circuit.', 'info');
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
  emit(Events.WANDERING_BAKER_CHANGED, { spawned: true });
  addMessage('🥖 A wandering baker arrives at the imperial gates bearing heavy sacks of fine flour, carved proving baskets, and ancient family recipes for breads and pastries beloved across many kingdoms. They offer to bake provisions for the empire or share their craft secrets. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingBaker() { return state.wanderingBaker?.active ?? null; }
export function getBakerSecsLeft() {
  const a = state.wanderingBaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function bakeImperialBread() {
  const a = state.wanderingBaker;
  if (!a?.active) return { ok: false, reason: 'No baker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The baker has departed.' };
  if ((state.resources.food ?? 0) < BAKE_FOOD_COST) return { ok: false, reason: `Need ${BAKE_FOOD_COST} food.` };
  state.resources.food -= BAKE_FOOD_COST;
  changeMorale(BAKE_MORALE_REWARD);
  awardPrestige(BAKE_PRESTIGE_REWARD, 'Commissioned imperial bread baking from the wandering baker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bakerBake');
    state.randomEvents.activeModifiers.push({
      id: 'bakerBake', resource: 'food',
      rateMult: 1 + (BAKE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + BAKE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalBaked = (a.totalBaked ?? 0) + 1;
  emit(Events.WANDERING_BAKER_CHANGED, { baked: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🥖 The baker fires up the imperial ovens, producing loaves of nourishing bread, sweet pastries, and hearty pies for citizens throughout the realm. Well-fed communities grow more productive and content! −${BAKE_FOOD_COST} food · +${BAKE_PRESTIGE_REWARD} prestige · +${BAKE_MORALE_REWARD} morale. Food surge: +${BAKE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function shareBakingSecrets() {
  const a = state.wanderingBaker;
  if (!a?.active) return { ok: false, reason: 'No baker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The baker has departed.' };
  if ((state.resources.gold ?? 0) < SHARE_GOLD_COST) return { ok: false, reason: `Need ${SHARE_GOLD_COST} gold.` };
  state.resources.gold -= SHARE_GOLD_COST;
  awardPrestige(SHARE_PRESTIGE_REWARD, 'Acquired baking secrets from the wandering baker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bakerShare');
    state.randomEvents.activeModifiers.push({
      id: 'bakerShare', resource: 'gold',
      rateMult: 1 + (SHARE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + SHARE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalShared = (a.totalShared ?? 0) + 1;
  emit(Events.WANDERING_BAKER_CHANGED, { shared: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The baker shares prized family recipes, yeast cultivation techniques, and market-pricing secrets with imperial merchants. Profitable bakeries begin trading across the empire, boosting commerce! −${SHARE_GOLD_COST} gold · +${SHARE_PRESTIGE_REWARD} prestige. Gold surge: +${SHARE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBakerAway() {
  const a = state.wanderingBaker;
  if (!a?.active) return { ok: false, reason: 'No baker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_BAKER_CHANGED, { dismissed: true });
  addMessage('🥖 The wandering baker nods respectfully, hoists their flour sacks, and trudges off toward the next village on their long bread-baking circuit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
