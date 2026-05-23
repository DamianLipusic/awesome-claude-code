/**
 * EmpireOS — Wandering Gem Polisher (T375).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a skilled gem polisher
 * arrives at court carrying a velvet-lined case of uncut stones, polishing
 * wheels of finest emery cloth, and a collection of finished royal gems
 * — offering to craft a commission of polished royal gems for the treasury
 * or to share advanced polishing techniques with the imperial lapidaries.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   💎 Commission Royal Gem Collection — pay 20 iron + 15 stone
 *        → +0.20 iron/s for 2.5 min · +22 prestige · +10 morale
 *   🔬 Purchase Polishing Techniques — pay 22 gold
 *        → +0.15 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.wanderingGemPolisher = {
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

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST          = 20;
export const COMMISSION_STONE_COST         = 15;
export const COMMISSION_IRON_RATE          = 0.20;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 22;
export const PURCHASE_STONE_RATE           = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingGemPolisher() {
  if (!state.wanderingGemPolisher) {
    state.wanderingGemPolisher = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingGemPolisher;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingGemPolisherTick() {
  const a = state.wanderingGemPolisher;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_GEM_POLISHER_CHANGED, { expired: true });
      addMessage('💎 The wandering gem polisher carefully wraps the polishing wheels back in leather, closes the velvet case of uncut stones, and bows graciously before departing down the road to the next imperial court.', 'info');
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
  emit(Events.WANDERING_GEM_POLISHER_CHANGED, { spawned: true });
  addMessage('💎 A wandering gem polisher arrives at the palace gates carrying a velvet-lined case of uncut stones, polishing wheels of finest emery cloth, and a dazzling portfolio of finished royal gems — offering to craft a commission of polished gems for the imperial treasury or share advanced lapidary techniques with your court artisans. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingGemPolisher() { return state.wanderingGemPolisher?.active ?? null; }
export function getGemPolisherSecsLeft() {
  const a = state.wanderingGemPolisher?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalGemCollection() {
  const a = state.wanderingGemPolisher;
  if (!a?.active) return { ok: false, reason: 'No gem polisher present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The gem polisher has departed.' };
  if ((state.resources.iron  ?? 0) < COMMISSION_IRON_COST)  return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.iron  -= COMMISSION_IRON_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned a royal gem collection from the wandering gem polisher');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'gemPolisherCommission');
    state.randomEvents.activeModifiers.push({
      id: 'gemPolisherCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_GEM_POLISHER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💎 The gem polisher sets up the polishing wheels and works through the night, transforming rough ore into brilliantly faceted gems — the dazzling royal collection draws merchants and traders to the palace, energising the iron trade routes and stimulating production across the foundries! −${COMMISSION_IRON_COST} iron · −${COMMISSION_STONE_COST} stone · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchasePolishingTechniques() {
  const a = state.wanderingGemPolisher;
  if (!a?.active) return { ok: false, reason: 'No gem polisher present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The gem polisher has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased polishing techniques from the wandering gem polisher');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'gemPolisherPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'gemPolisherPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_GEM_POLISHER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔬 The gem polisher demonstrates abrasive wheel-cutting and fine grit polishing techniques to the imperial quarrymen — the stone workers immediately apply these precision methods to their extraction and finishing work, dramatically improving yield quality and quarry output! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGemPolisherAway() {
  const a = state.wanderingGemPolisher;
  if (!a?.active) return { ok: false, reason: 'No gem polisher present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_GEM_POLISHER_CHANGED, { dismissed: true });
  addMessage('💎 The wandering gem polisher nods respectfully, gathers the velvet case, and heads back down the road — the soft clink of polishing wheels fading into the distance.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
