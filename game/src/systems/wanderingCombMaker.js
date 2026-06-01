/**
 * EmpireOS — Wandering Comb Maker (T471).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering comb maker
 * arrives at the settlement carrying a leather roll of bone-working tools —
 * fine-toothed saws for cutting the blank, rasps and rifflers for shaping the
 * spine, and polishing cloths impregnated with beeswax — along with a tray of
 * finished combs in graded sizes: narrow-toothed dressing combs carved from ox
 * shoulder-blade, broader parting combs with a decorated spine, and a few
 * double-sided combs with coarse teeth on one edge and fine on the other for
 * clearing tangles before the final pass — offering to commission a batch of
 * bone combs for the settlement's households, or to sell the comb-making craft
 * so the settlement's own artisans can begin independent production.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪮 Commission Bone Comb Set      — pay 20 food + 10 stone
 *        → +0.20 food/s for 2.5 min · +15 prestige · +8 morale
 *   📜 Purchase Comb-Making Craft    — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.wanderingCombMaker = {
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST            = 20;
export const COMMISSION_STONE_COST           = 10;
export const COMMISSION_FOOD_RATE            = 0.20;
export const COMMISSION_PRESTIGE_REWARD      = 15;
export const COMMISSION_MORALE_REWARD        = 8;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST              = 18;
export const PURCHASE_GOLD_RATE              = 0.15;
export const PURCHASE_PRESTIGE_REWARD        = 10;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCombMaker() {
  if (!state.wanderingCombMaker) {
    state.wanderingCombMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingCombMaker;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingCombMakerTick() {
  const a = state.wanderingCombMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_COMB_MAKER_CHANGED, { expired: true });
      addMessage('🪮 The wandering comb maker rolls up the bone-working tools, wraps the unsold combs in a cloth, and heads down the road to the next settlement.', 'info');
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
  emit(Events.WANDERING_COMB_MAKER_CHANGED, { spawned: true });
  addMessage('🪮 A wandering comb maker arrives carrying a leather roll of bone-working tools — fine-toothed saws, rasps, and beeswax polishing cloths — along with a tray of finished combs: narrow dressing combs carved from ox shoulder-blade, broader parting combs with decorated spines, and double-sided combs for clearing tangles before the final pass. The maker offers to commission a batch of bone combs for the settlement\'s households, or to sell the comb-making craft so local artisans can begin independent production. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingCombMaker() { return state.wanderingCombMaker?.active ?? null; }
export function getCombMakerSecsLeft() {
  const a = state.wanderingCombMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionBoneCombSet() {
  const a = state.wanderingCombMaker;
  if (!a?.active) return { ok: false, reason: 'No comb maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The comb maker has departed.' };
  if ((state.resources.food  ?? 0) < COMMISSION_FOOD_COST)  return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.food  -= COMMISSION_FOOD_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned bone comb set from the wandering comb maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'combMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'combMakerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_COMB_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪮 The comb maker selects a smooth ox shoulder-blade from the bundle, scribes the tooth-line with a marking awl, and sets to work with the fine-toothed saw — cutting each tooth with a steady pull stroke and checking the spacing against a bone template worn smooth from years of use. Once the blank is cut, a sequence of rasps brings the spine to its rounded profile; a folded polishing cloth loaded with beeswax burnishes the surface until the bone takes on a warm translucence. The finished combs are distributed to the settlement's households: narrow-toothed ones for the weavers who need to dress thread, broader models for the families who want an everyday parting comb, and the double-sided variety for the soldiers whose kit inspections demand a presentable appearance. The general comfort of the settlement improves noticeably. −${COMMISSION_FOOD_COST} food −${COMMISSION_STONE_COST} stone · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCombMakingCraft() {
  const a = state.wanderingCombMaker;
  if (!a?.active) return { ok: false, reason: 'No comb maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The comb maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased comb-making craft from the wandering comb maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'combMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'combMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_COMB_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The comb maker produces a folded instruction sheet — thick vellum covered in scaled diagrams of tooth-spacing jigs drawn at working size, with annotated sequences showing the order of saw cuts required to keep the teeth parallel when working freehand without a guiding fence. A second sheet details the selection of raw bone by density and grain, the soaking and drying cycle that prevents the blank from splitting during cutting, and the burnishing strokes that load beeswax into the surface pores to give the finished comb its characteristic warm sheen without leaving a sticky residue that would catch lint. The settlement's artisans work through the instructions methodically, cutting their first practice blanks from offcuts before committing to the best shoulder-blades in the stock. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCombMakerAway() {
  const a = state.wanderingCombMaker;
  if (!a?.active) return { ok: false, reason: 'No comb maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_COMB_MAKER_CHANGED, { dismissed: true });
  addMessage('🪮 The wandering comb maker rolls up the bone-working tools, wraps the unsold combs in a cloth, and heads down the road to the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
