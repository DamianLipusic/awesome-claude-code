/**
 * EmpireOS — Imperial Knifesmith (T424).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), an imperial knifesmith
 * arrives at the palace workshop carrying a presentation case of folded-iron
 * hunting blades with bone and antler handles, a set of skinning knives with
 * shallow hollow-ground bevels for clean pelt work, butchering blades with
 * broad stock and full-length edges for carcass processing, garrison utility
 * knives with clip-point tips and leather-wrapped grips for campaign use, and
 * a grinding wheel mounted on a wheeled bench for edge-dressing and honing
 * blades already in service — offering to commission a full blade collection
 * for the palace hunters, garrison troops, and market butchers, or to share
 * the blade-craft knowledge that keeps every smithy producing sharp-edged
 * cutting tools from the empire's iron stocks without specialist supervision.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ⚔️ Commission Blade Collection  — pay 25 iron + 15 gold
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +10 morale
 *   📖 Purchase Blade Craft         — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.imperialKnifesmith = {
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

export const COMMISSION_IRON_COST          = 25;
export const COMMISSION_GOLD_COST          = 15;
export const COMMISSION_IRON_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST           = 20;
export const PURCHASE_STONE_RATE           = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialKnifesmith() {
  if (!state.imperialKnifesmith) {
    state.imperialKnifesmith = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialKnifesmith;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialKnifesmithTick() {
  const a = state.imperialKnifesmith;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_KNIFESMITH_CHANGED, { expired: true });
      addMessage('⚔️ The imperial knifesmith closes the presentation case, wraps the grinding wheel in canvas, and departs the palace workshop — the faint ring of steel on the cobblestones and scent of honing oil fading as the cart rolls away through the gatehouse arch.', 'info');
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
  emit(Events.IMPERIAL_KNIFESMITH_CHANGED, { spawned: true });
  addMessage('⚔️ An imperial knifesmith arrives at the palace workshop carrying a presentation case of folded-iron hunting blades with bone and antler handles, skinning knives with hollow-ground bevels for clean pelt work, butchering blades with broad stock for carcass processing, garrison utility knives with clip-point tips and leather-wrapped grips, and a grinding wheel for edge-dressing blades already in service — offering to commission a full blade collection for the palace hunters and garrison, or to share the blade-craft that keeps every smithy producing sharp-edged cutting tools from the empire\'s iron stocks. Respond within 80 seconds.', 'info');
}

export function getActiveImperialKnifesmith() { return state.imperialKnifesmith?.active ?? null; }
export function getKnifesmithSecsLeft() {
  const a = state.imperialKnifesmith?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionBladeCollection() {
  const a = state.imperialKnifesmith;
  if (!a?.active) return { ok: false, reason: 'No knifesmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The knifesmith has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned blade collection from the imperial knifesmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'knifesmithCommission');
    state.randomEvents.activeModifiers.push({
      id: 'knifesmithCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_KNIFESMITH_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚔️ The knifesmith selects the purest iron stock from the palace forge, folds and shapes each blade through repeated heating and hammering until the grain is tight and even throughout, grinds the hunting blades to a shallow convex bevel that holds an edge through repeated use in the field, hollows the skinning-knife faces for clean cutting separation from membrane, cuts and fits bone and antler handles to the palace hunters' grip measurements, and delivers the full collection to the chief huntsman, garrison quartermaster, and market butchers' guild — the sharp, properly-fitted blades enabling more efficient hunting operations and more productive use of every carcass brought in from the frontier! −${COMMISSION_IRON_COST} iron · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseBladeCraft() {
  const a = state.imperialKnifesmith;
  if (!a?.active) return { ok: false, reason: 'No knifesmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The knifesmith has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased blade craft from the imperial knifesmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'knifesmithPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'knifesmithPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_KNIFESMITH_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The knifesmith demonstrates the iron grain-reading technique that identifies the purest sections of raw stock by the colour and texture of the surface scale, the fold-count method that produces consistent edge hardness without over-working the metal into brittleness, the bevel-angle guide for matching blade geometry to its intended cutting task — shallow convex for hunting blades, hollow-ground for skinning work, flat for heavy butchering — and the handle-fitting method that seats bone and antler grips without introducing stress fractures through the tang shoulder — craft knowledge that allows every palace smithy to improve the quality and consistency of cutting tools produced from standard iron stock! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendKnifesmithAway() {
  const a = state.imperialKnifesmith;
  if (!a?.active) return { ok: false, reason: 'No knifesmith present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_KNIFESMITH_CHANGED, { dismissed: true });
  addMessage('⚔️ The imperial knifesmith closes the presentation case, wraps the grinding wheel in canvas, and departs the palace workshop — bowing respectfully before the cart rolls away through the gatehouse arch.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
