/**
 * EmpireOS — Wandering Paper Maker (T371).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), a wandering paper
 * maker arrives at court bearing bundles of linen pulp, reed sheets, and
 * iron gall ink — offering to produce fine illuminated writing sheets for
 * the imperial scriptorium or sell quality paper stock to the court scholars.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📜 Commission Illuminated Sheets — pay 20 wood + 15 mana
 *        → +0.22 mana/s for 2.5 min · +20 prestige · +8 morale
 *   📄 Purchase Fine Paper          — pay 18 gold
 *        → +0.15 gold/s for 2 min  · +12 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingPaperMaker = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_WOOD_COST          = 20;
export const COMMISSION_MANA_COST          = 15;
export const COMMISSION_MANA_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 20;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingPaperMaker() {
  if (!state.wanderingPaperMaker) {
    state.wanderingPaperMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingPaperMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingPaperMakerTick() {
  const a = state.wanderingPaperMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_PAPER_MAKER_CHANGED, { expired: true });
      addMessage('📜 The wandering paper maker carefully rolls the unsold linen sheets and tucks the iron gall ink into the travel satchel, bowing politely before heading off toward the next scholarly town along the road.', 'info');
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
  emit(Events.WANDERING_PAPER_MAKER_CHANGED, { spawned: true });
  addMessage('📜 A wandering paper maker arrives at the palace gates laden with bundles of finely pressed linen sheets, smooth reed parchment, and vials of shimmering iron gall ink — offering to illuminate writing sheets for the imperial scriptorium or sell their finest paper stock to the court scholars. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingPaperMaker() { return state.wanderingPaperMaker?.active ?? null; }
export function getPaperMakerSecsLeft() {
  const a = state.wanderingPaperMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionIlluminatedSheets() {
  const a = state.wanderingPaperMaker;
  if (!a?.active) return { ok: false, reason: 'No paper maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The paper maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.mana -= COMMISSION_MANA_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned illuminated sheets from the wandering paper maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'paperMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'paperMakerCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_PAPER_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The paper maker sets up the pressing frames in the palace scriptorium — dozens of exquisitely illuminated sheets bearing the imperial crest are produced, inspiring the court scholars and clergy alike. The scriptorium hums with creative energy as the illuminated texts flow! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_MANA_COST} mana · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseFinePaper() {
  const a = state.wanderingPaperMaker;
  if (!a?.active) return { ok: false, reason: 'No paper maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The paper maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased fine paper from the wandering paper maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'paperMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'paperMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_PAPER_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📄 Crates of smooth cream-coloured writing sheets — sized for royal proclamations and diplomatic correspondence — are delivered to the palace archive. Foreign ambassadors marvel at the quality of the imperial documents and increase their trade commitments! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendPaperMakerAway() {
  const a = state.wanderingPaperMaker;
  if (!a?.active) return { ok: false, reason: 'No paper maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_PAPER_MAKER_CHANGED, { dismissed: true });
  addMessage('📜 The wandering paper maker nods courteously, bundles the linen sheets and ink vials back into the travel satchel, and heads off down the cobbled road toward the next town — the faint rustle of fine parchment fading with their footsteps.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
