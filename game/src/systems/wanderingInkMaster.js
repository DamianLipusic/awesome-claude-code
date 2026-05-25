/**
 * EmpireOS — Wandering Ink Master (T397).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), a wandering ink master
 * arrives at court bearing lacquered writing cases, fine brushes, and vials of
 * rare pigment-infused inks — offering to commission extraordinary imperial scrollwork
 * and illuminated edicts for the palace archives, or to share closely-guarded formulas
 * for rare mineral inks and calligraphic pigments with the imperial scribes and artists.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🖋️ Commission Imperial Scrollwork  — pay 25 mana + 20 gold
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +10 morale
 *   📜 Purchase Rare Ink Formulas      — pay 20 wood
 *        → +0.18 wood/s for 2 min · +15 prestige
 *   🚶 Send Away                       — dismiss (no reward)
 *
 * state.wanderingInkMaster = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST        = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_MANA_RATE        = 0.25;
export const COMMISSION_PRESTIGE_REWARD  = 22;
export const COMMISSION_MORALE_REWARD    = 10;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST          = 20;
export const PURCHASE_WOOD_RATE          = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingInkMaster() {
  if (!state.wanderingInkMaster) {
    state.wanderingInkMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingInkMaster;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function wanderingInkMasterTick() {
  const a = state.wanderingInkMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_INK_MASTER_CHANGED, { expired: true });
      addMessage('🖋️ The wandering ink master carefully seals the pigment vials, ties the brush rolls, and latches the lacquered writing case shut before bowing respectfully and departing from the court — the faint scent of rare minerals and dried pigments lingering in the corridor.', 'info');
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
  emit(Events.WANDERING_INK_MASTER_CHANGED, { spawned: true });
  addMessage('🖋️ A wandering ink master arrives at court bearing lacquered writing cases, fine brushes, and vials of rare pigment-infused inks — offering to commission extraordinary imperial scrollwork and illuminated edicts for the palace archives, or to share closely-guarded formulas for rare mineral inks with the imperial scribes and artists. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingInkMaster() { return state.wanderingInkMaster?.active ?? null; }
export function getInkMasterSecsLeft() {
  const a = state.wanderingInkMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialScrollwork() {
  const a = state.wanderingInkMaster;
  if (!a?.active) return { ok: false, reason: 'No ink master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The ink master has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial scrollwork from the wandering ink master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'inkMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'inkMasterCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_INK_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🖋️ The ink master sets to work with extraordinary precision — composing, brushing, and illuminating magnificent imperial edicts and ceremonial scrolls that are mounted throughout the palace halls and archive chambers, inspiring the imperial scholars and mages with their elegance and awakening potent arcane energies! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRareInkFormulas() {
  const a = state.wanderingInkMaster;
  if (!a?.active) return { ok: false, reason: 'No ink master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The ink master has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased rare ink formulas from the wandering ink master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'inkMasterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'inkMasterPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_INK_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The ink master unfurls a collection of closely-guarded formula scrolls — ancient mineral extraction recipes, bark-tannin preparation guides, and rare pigment-binding methods that the imperial woodworkers eagerly adopt, unlocking new techniques for treating, preserving, and refining imperial timber that boost workshop productivity! −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendInkMasterAway() {
  const a = state.wanderingInkMaster;
  if (!a?.active) return { ok: false, reason: 'No ink master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_INK_MASTER_CHANGED, { dismissed: true });
  addMessage('🖋️ The wandering ink master carefully seals the pigment vials and ties the brush rolls before bowing respectfully and departing from the court — the faint mineral scent of the rare inks fading down the palace corridor.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
