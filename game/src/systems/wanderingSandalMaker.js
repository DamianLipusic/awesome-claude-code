/**
 * EmpireOS — Wandering Sandal Maker (T469).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering sandal maker
 * arrives at the settlement carrying a leather satchel of tanning tools, a
 * wooden last in several sizes, and a bundle of finished sandals — sturdy
 * leather soles with braided thong straps, some plain and serviceable,
 * others tooled with geometric patterns along the toe-strap and heel-cup —
 * offering to commission a batch of leather sandals for the settlement's
 * workers and soldiers, or to sell the sandal-making craft so the settlement's
 * own cobblers can begin independent production.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   👡 Commission Leather Sandals    — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +15 prestige · +10 morale
 *   📜 Purchase Sandal-Making Craft  — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.wanderingSandalMaker = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST            = 20;
export const COMMISSION_WOOD_COST            = 15;
export const COMMISSION_FOOD_RATE            = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 15;
export const COMMISSION_MORALE_REWARD        = 10;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST              = 18;
export const PURCHASE_GOLD_RATE              = 0.15;
export const PURCHASE_PRESTIGE_REWARD        = 10;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingSandalMaker() {
  if (!state.wanderingSandalMaker) {
    state.wanderingSandalMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingSandalMaker;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingSandalMakerTick() {
  const a = state.wanderingSandalMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SANDAL_MAKER_CHANGED, { expired: true });
      addMessage('👡 The wandering sandal maker packs up the last and the tanning tools, ties the bundle of finished sandals over one shoulder, and sets off down the dusty road to the next settlement.', 'info');
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
  emit(Events.WANDERING_SANDAL_MAKER_CHANGED, { spawned: true });
  addMessage('👡 A wandering sandal maker arrives carrying a leather satchel of tanning tools, a wooden last in several sizes, and a bundle of finished sandals — sturdy leather soles with braided thong straps, some plain, others tooled with geometric patterns along the toe-strap. The maker offers to commission leather sandals for the settlement\'s workers and soldiers, or to sell the sandal-making craft so local cobblers can begin independent production. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingSandalMaker() { return state.wanderingSandalMaker?.active ?? null; }
export function getSandalMakerSecsLeft() {
  const a = state.wanderingSandalMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionLeatherSandals() {
  const a = state.wanderingSandalMaker;
  if (!a?.active) return { ok: false, reason: 'No sandal maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The sandal maker has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned leather sandals from the wandering sandal maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sandalMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'sandalMakerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_SANDAL_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`👡 The sandal maker sets the wooden last on the workbench, selects a hide from the satchel, and begins cutting the sole pattern — a sweeping oval traced around a clay footprint taken from one of the settlement's guards. Over the following hours the maker produces dozens of pairs: plain walking sandals with flat soles for the farmhands and woodcutters, sturdier models with a raised heel-cup and ankle-lace for the soldiers who spend long days on patrol, and a few presentation pairs with tooled vine-scroll borders intended for festival days or formal occasions. The well-shod workers move through the settlement with noticeably greater ease, lifting the general mood. −${COMMISSION_FOOD_COST} food −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSandalMakingCraft() {
  const a = state.wanderingSandalMaker;
  if (!a?.active) return { ok: false, reason: 'No sandal maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The sandal maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased sandal-making craft from the wandering sandal maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'sandalMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'sandalMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_SANDAL_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The sandal maker produces a folded instruction sheet — thick vellum covered in neat diagrams of sole patterns drawn at full scale, with numbered sequences showing the order in which the lace-holes should be punched and the correct direction for the stitching awl so the thread seats flush with the leather surface rather than riding proud where it would fray against road grit. A second page details the selection of hides by thickness and grain direction, the soaking times required to achieve pliability without losing tensile strength, and the way to burnish the sole edge with a bone folder to prevent splitting at the corners. The settlement's cobblers work through the instructions with growing confidence, ready to begin the first production run before the week is out. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSandalMakerAway() {
  const a = state.wanderingSandalMaker;
  if (!a?.active) return { ok: false, reason: 'No sandal maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SANDAL_MAKER_CHANGED, { dismissed: true });
  addMessage('👡 The wandering sandal maker packs up the last and the tanning tools, ties the bundle of finished sandals over one shoulder, and sets off down the dusty road to the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
