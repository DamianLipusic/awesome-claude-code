/**
 * EmpireOS — Wandering Basketweaver (T341).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a skilled wandering
 * basketweaver arrives at the imperial gates bearing river reeds, dyed strips
 * of wood, and ancient weaving patterns stretching back generations.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🧺 Weave Imperial Baskets  — pay 20 wood
 *        → +0.22 wood/s for 2.5 min · +18 prestige · +8 morale
 *   📜 Purchase Weaving Patterns — pay 18 gold
 *        → +0.15 gold/s for 2 min   · +12 prestige
 *   🚶 Send Away            — dismiss (no reward)
 *
 * state.wanderingBasketweaver = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalWoven:          number,
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const WEAVE_WOOD_COST           = 20;
export const WEAVE_WOOD_RATE           = 0.22;
export const WEAVE_PRESTIGE_REWARD     = 18;
export const WEAVE_MORALE_REWARD       = 8;
export const WEAVE_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST        = 18;
export const PURCHASE_GOLD_RATE        = 0.15;
export const PURCHASE_PRESTIGE_REWARD  = 12;
export const PURCHASE_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingBasketweaver() {
  if (!state.wanderingBasketweaver) {
    state.wanderingBasketweaver = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalWoven:      0,
      totalPurchased:  0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingBasketweaver;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalWoven      === undefined) s.totalWoven      = 0;
  if (s.totalPurchased  === undefined) s.totalPurchased  = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingBasketweaverTick() {
  const a = state.wanderingBasketweaver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_BASKETWEAVER_CHANGED, { expired: true });
      addMessage('🧺 The wandering basketweaver carefully rolls up their weaving samples, gathers their river reeds, and sets off to the next settlement on their craft circuit.', 'info');
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
  emit(Events.WANDERING_BASKETWEAVER_CHANGED, { spawned: true });
  addMessage('🧺 A wandering basketweaver arrives at the imperial gates bearing bundles of river reeds, dyed wood strips, and ancient family weaving patterns passed down through generations. They offer to weave storage baskets for the empire or share their craft secrets with local artisans. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingBasketweaver() { return state.wanderingBasketweaver?.active ?? null; }
export function getBasketweaverSecsLeft() {
  const a = state.wanderingBasketweaver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function weaveImperialBaskets() {
  const a = state.wanderingBasketweaver;
  if (!a?.active) return { ok: false, reason: 'No basketweaver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The basketweaver has departed.' };
  if ((state.resources.wood ?? 0) < WEAVE_WOOD_COST) return { ok: false, reason: `Need ${WEAVE_WOOD_COST} wood.` };
  state.resources.wood -= WEAVE_WOOD_COST;
  changeMorale(WEAVE_MORALE_REWARD);
  awardPrestige(WEAVE_PRESTIGE_REWARD, 'Commissioned imperial basket weaving from the wandering basketweaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'basketweaverWeave');
    state.randomEvents.activeModifiers.push({
      id: 'basketweaverWeave', resource: 'wood',
      rateMult: 1 + (WEAVE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + WEAVE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalWoven = (a.totalWoven ?? 0) + 1;
  emit(Events.WANDERING_BASKETWEAVER_CHANGED, { woven: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧺 The basketweaver sets up their workshop in the imperial courtyard, producing hundreds of sturdy storage baskets, market hampers, and decorative wicker goods for citizens throughout the realm. Efficient storage enables greater harvest yields! −${WEAVE_WOOD_COST} wood · +${WEAVE_PRESTIGE_REWARD} prestige · +${WEAVE_MORALE_REWARD} morale. Wood surge: +${WEAVE_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseWeavingPatterns() {
  const a = state.wanderingBasketweaver;
  if (!a?.active) return { ok: false, reason: 'No basketweaver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The basketweaver has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Acquired weaving patterns from the wandering basketweaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'basketweaverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'basketweaverPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.WANDERING_BASKETWEAVER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The basketweaver shares intricate family weaving patterns, dyeing recipes, and market-stall techniques with imperial craftspeople. Local artisan workshops begin producing beautiful wicker goods for sale across the empire, boosting commerce! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBasketweaverAway() {
  const a = state.wanderingBasketweaver;
  if (!a?.active) return { ok: false, reason: 'No basketweaver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_BASKETWEAVER_CHANGED, { dismissed: true });
  addMessage('🧺 The wandering basketweaver nods respectfully, bundles up their river reeds and weaving samples, and trudges off toward the next village on their long craft circuit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
