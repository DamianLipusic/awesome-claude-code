/**
 * EmpireOS — Wandering Inkmaker (T345).
 *
 * Every 13–17 minutes (Medieval Age+, 8+ player tiles), a wandering inkmaker
 * arrives bearing rare pigments, oak-gall ink, and illuminated script samples
 * from distant scriptoria. The player has 80 seconds to decide.
 *
 * Choices:
 *   🖊️ Commission Illuminated Scripts — pay 20 mana + 15 gold
 *        → +0.22 mana/s for 2.5 min · +20 prestige · +8 morale
 *   🪵 Purchase Ink Formulas          — pay 18 wood
 *        → +0.18 wood/s for 2 min    · +12 prestige
 *   👋 Send Away                      — dismiss (no reward)
 *
 * state.wanderingInkmaker = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissioned: number,
 *   totalPurchased:    number,
 *   totalDismissals:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_MANA_COST       = 20;
export const COMMISSION_GOLD_COST       = 15;
export const COMMISSION_MANA_RATE       = 0.22;
export const COMMISSION_PRESTIGE_REWARD = 20;
export const COMMISSION_MORALE_REWARD   = 8;
export const COMMISSION_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST         = 18;
export const PURCHASE_WOOD_RATE         = 0.18;
export const PURCHASE_PRESTIGE_REWARD   = 12;
export const PURCHASE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingInkmaker() {
  if (!state.wanderingInkmaker) {
    state.wanderingInkmaker = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalCommissioned: 0,
      totalPurchased:    0,
      totalDismissals:   0,
    };
  }
  const s = state.wanderingInkmaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissioned === undefined) s.totalCommissioned = 0;
  if (s.totalPurchased    === undefined) s.totalPurchased    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingInkmakerTick() {
  const a = state.wanderingInkmaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_INKMAKER_CHANGED, { expired: true });
      addMessage('🖊️ The wandering inkmaker carefully seals their pigment jars, wraps the quill bundles in wax paper, and departs to supply the next imperial scriptorium along their trade route.', 'info');
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
  emit(Events.WANDERING_INKMAKER_CHANGED, { spawned: true });
  addMessage('🖊️ A wandering inkmaker arrives at the imperial court bearing rare lapis-lazuli pigments, oak-gall writing ink, and beautifully illuminated script samples from distant monastic scriptoria. They offer to produce exquisite illuminated manuscripts or to supply the empire with their prized ink formulas and woodcraft techniques. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingInkmaker() { return state.wanderingInkmaker?.active ?? null; }
export function getInkmakerSecsLeft() {
  const a = state.wanderingInkmaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionIlluminatedScripts() {
  const a = state.wanderingInkmaker;
  if (!a?.active) return { ok: false, reason: 'No inkmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The inkmaker has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned illuminated scripts from a wandering inkmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'inkmakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'inkmakerCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.WANDERING_INKMAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🖊️ The inkmaker sets up their grinding stones and quill-cutting boards in the imperial scriptorium, producing magnificent illuminated manuscripts in lapis-lazuli blue, vermillion red, and hammered gold leaf. Scholars and clergy are inspired by the sublime artistry! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Scholarly surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseInkFormulas() {
  const a = state.wanderingInkmaker;
  if (!a?.active) return { ok: false, reason: 'No inkmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The inkmaker has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased ink formulas from a wandering inkmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'inkmakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'inkmakerPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.WANDERING_INKMAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The inkmaker shares their prized formulas for oak-gall-based ink and the precise wood-soaking techniques that yield the finest quill-cutting timber. Imperial foresters adopt the wood-treatment methods with enthusiasm! −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Woodcraft surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendInkmakerAway() {
  const a = state.wanderingInkmaker;
  if (!a?.active) return { ok: false, reason: 'No inkmaker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_INKMAKER_CHANGED, { dismissed: true });
  addMessage('🖊️ The wandering inkmaker bows politely, packs their pigment cases and quill bundles, and continues along the scriptorium circuit to the next imperial settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
