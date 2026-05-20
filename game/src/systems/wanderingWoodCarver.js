/**
 * EmpireOS — Wandering Wood Carver (T337).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a skilled wandering wood
 * carver arrives bearing chisels, gouges, and finished examples of decorative
 * carvings, figurines, and intricate relief panels that could adorn the
 * empire's halls and marketplaces.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪵 Commission Decorative Carvings — pay 20 wood
 *        → +0.22 wood/s for 2.5 min · +18 prestige · +8 morale
 *   📜 Purchase Carving Templates     — pay 18 gold
 *        → +0.15 gold/s for 2 min   · +12 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.wanderingWoodCarver = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissioned: number,
 *   totalPurchased:   number,
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
export const COMMISSION_WOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 18;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingWoodCarver() {
  if (!state.wanderingWoodCarver) {
    state.wanderingWoodCarver = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalCommissioned: 0,
      totalPurchased:    0,
      totalDismissals:   0,
    };
  }
  const s = state.wanderingWoodCarver;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissioned=== undefined) s.totalCommissioned= 0;
  if (s.totalPurchased   === undefined) s.totalPurchased   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingWoodCarverTick() {
  const a = state.wanderingWoodCarver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_WOOD_CARVER_CHANGED, { expired: true });
      addMessage('🪵 The wandering wood carver wraps their chisels in oiled cloth, loads their finished carvings onto a handcart, and continues their journey to the next settlement on their circuit.', 'info');
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
  emit(Events.WANDERING_WOOD_CARVER_CHANGED, { spawned: true });
  addMessage('🪵 A wandering wood carver arrives at the imperial gates bearing fine chisels, hand gouges, and beautiful examples of decorative relief panels, figurines, and ornamental carvings crafted from rare hardwoods. They offer to commission grand works for the empire or share their carving templates. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingWoodCarver() { return state.wanderingWoodCarver?.active ?? null; }
export function getWoodCarverSecsLeft() {
  const a = state.wanderingWoodCarver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionDecorativeCarvings() {
  const a = state.wanderingWoodCarver;
  if (!a?.active) return { ok: false, reason: 'No wood carver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The wood carver has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned decorative carvings from the wandering wood carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'woodCarverCommission');
    state.randomEvents.activeModifiers.push({
      id: 'woodCarverCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.WANDERING_WOOD_CARVER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The wood carver sets up their workshop in the imperial courtyard, sculpting intricate relief panels for the great hall, carved decorative pillars for the palace gardens, and detailed figurines for the treasury. Citizens marvel at the craftsmanship! −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCarvingTemplates() {
  const a = state.wanderingWoodCarver;
  if (!a?.active) return { ok: false, reason: 'No wood carver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The wood carver has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased carving templates from the wandering wood carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'woodCarverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'woodCarverPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.WANDERING_WOOD_CARVER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The carver hands over a collection of detailed template scrolls, pattern guides, and hand-drawn technical diagrams for producing decorative woodwork at scale. Imperial workshops begin selling carved goods at premium prices! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendWoodCarverAway() {
  const a = state.wanderingWoodCarver;
  if (!a?.active) return { ok: false, reason: 'No wood carver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_WOOD_CARVER_CHANGED, { dismissed: true });
  addMessage('🪵 The wandering wood carver nods politely, bundles their chisels and finished pieces, and sets off down the road toward the next town on their carving circuit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
