/**
 * EmpireOS — Wandering Drum Maker (T419).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering drum maker
 * arrives at the palace carrying seasoned oak and elm stave-drums with double
 * goat-hide heads, carved bone tensioning pegs, rope lacings dyed in ochre
 * and charcoal, and a set of padded willow beaters — offering to commission a
 * complete set of ceremonial drums for the palace courtyard and garrison parade
 * ground, or to sell the drum-making craft compendium detailing the stave-
 * selection, hide-soaking, tension-tuning, and beater-padding techniques that
 * produce drums whose resonance can be heard across three hilltops.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🥁 Commission Ceremonial Drums — pay 20 wood + 10 food
 *        → +0.22 wood/s for 2.5 min · +15 prestige · +10 morale
 *   📖 Purchase Drum-Making Craft  — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.wanderingDrumMaker = {
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_WOOD_COST          = 20;
export const COMMISSION_FOOD_COST          = 10;
export const COMMISSION_WOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingDrumMaker() {
  if (!state.wanderingDrumMaker) {
    state.wanderingDrumMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingDrumMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingDrumMakerTick() {
  const a = state.wanderingDrumMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_DRUM_MAKER_CHANGED, { expired: true });
      addMessage('🥁 The wandering drum maker re-laces the goat-hide heads, bundles the oak stave-drums and padded willow beaters back onto the cart, bows respectfully, and departs the palace — the hollow resonance of the rolling drum cases fading as the cart disappears down the gatehouse road.', 'info');
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
  emit(Events.WANDERING_DRUM_MAKER_CHANGED, { spawned: true });
  addMessage('🥁 A wandering drum maker arrives at the palace carrying seasoned oak and elm stave-drums with double goat-hide heads, carved bone tensioning pegs, rope lacings dyed in ochre and charcoal, and padded willow beaters — offering to commission a complete set of ceremonial drums for the palace courtyard and garrison parade ground, or to sell the drum-making craft compendium detailing stave-selection, hide-soaking, and tension-tuning techniques that produce drums whose resonance can be heard across three hilltops. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingDrumMaker() { return state.wanderingDrumMaker?.active ?? null; }
export function getDrumMakerSecsLeft() {
  const a = state.wanderingDrumMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCeremonialDrums() {
  const a = state.wanderingDrumMaker;
  if (!a?.active) return { ok: false, reason: 'No drum maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The drum maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned ceremonial drums from the wandering drum maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'drumMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'drumMakerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_DRUM_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🥁 The drum maker selects the straightest-grained oak staves, soaks the double goat-hide heads in brine until they become supple as cloth, laces them onto each frame with the traditional double-loop rope pattern, drives the carved bone tensioning pegs to a deep resonant pitch, and delivers bass ceremony drums, mid-range signal drums, and high treble parade drums to every palace courtyard post and garrison parade ground — the rhythmic thunder of the assembled drum corps rolling across the city quarters and lifting the garrison's spirits with every morning muster! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseDrumMakingCraft() {
  const a = state.wanderingDrumMaker;
  if (!a?.active) return { ok: false, reason: 'No drum maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The drum maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased drum-making craft from the wandering drum maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'drumMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'drumMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_DRUM_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The drum maker opens the craft compendium and explains the four-step stave-selection test for detecting cross-grain weaknesses, the brine-concentration schedule that makes goat-hide heads resilient to humidity changes, the double-loop rope-lacing pattern that distributes tension evenly across the entire head circumference, and the bone-peg tapering angle that locks tuning at pitch for six months without re-tensioning — the imperial carpenters and market craftsmen absorb each technique and apply the same meticulous selection, soaking, and tensioning discipline to every timber frame and cordage contract they commission! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendDrumMakerAway() {
  const a = state.wanderingDrumMaker;
  if (!a?.active) return { ok: false, reason: 'No drum maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_DRUM_MAKER_CHANGED, { dismissed: true });
  addMessage('🥁 The wandering drum maker re-laces the goat-hide heads, secures the oak stave-drums and padded beaters onto the cart, bows respectfully, and departs the palace — the hollow resonance of the rolling cases fading as the cart rounds the gatehouse.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
