/**
 * EmpireOS — Wandering Flute Maker (T483).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering flute maker
 * arrives at the settlement carrying a bundle of dried river reeds bound in
 * linen cord — each reed selected for uniform wall thickness and straightness
 * of grain, sorted into sets of matching bore diameter and cut to graduated
 * lengths that produce a pentatonic scale when the end aperture is blown at
 * the correct angle — along with a small bone-handled knife, a thin heated
 * wire for burning the finger-hole positions into the reed wall at measured
 * intervals from the lower end, and a finished demonstration flute on which
 * the maker plays a short ascending sequence to show the tone quality and
 * range of the instrument — offering to commission a set of reed flutes for
 * the settlement's ceremonial use, or to teach the flute-making craft so
 * the settlement's craftspeople can produce their own instruments from
 * locally gathered materials.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🎵 Commission Reed Flutes            — pay 20 food
 *        → +0.20 food/s for 2.5 min · +15 prestige · +10 morale
 *   🎶 Purchase Flute-Making Craft        — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.wanderingFluteMaker = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_FOOD_COST            = 20;
export const COMMISSION_FOOD_RATE            = 0.20;
export const COMMISSION_PRESTIGE_REWARD      = 15;
export const COMMISSION_MORALE_REWARD        = 10;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST              = 18;
export const PURCHASE_GOLD_RATE              = 0.15;
export const PURCHASE_PRESTIGE_REWARD        = 10;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingFluteMaker() {
  if (!state.wanderingFluteMaker) {
    state.wanderingFluteMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingFluteMaker;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingFluteMakerTick() {
  const a = state.wanderingFluteMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_FLUTE_MAKER_CHANGED, { expired: true });
      addMessage('🎵 The wandering flute maker wraps the reed bundle in its linen cord, packs the knife and wire, and continues along the road to the next settlement.', 'info');
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
  emit(Events.WANDERING_FLUTE_MAKER_CHANGED, { spawned: true });
  addMessage('🎵 A wandering flute maker arrives carrying a bundle of dried river reeds — each selected for uniform wall thickness, sorted into matched bore sets, and cut to graduated lengths that produce a pentatonic scale — along with a bone-handled knife, a heated wire for burning finger-hole positions, and a finished demonstration flute. The maker plays a short ascending sequence to show the tone quality and range of the instrument, then offers to commission a set of reed flutes for the settlement\'s ceremonial use, or to teach the flute-making craft from locally gathered materials. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingFluteMaker() { return state.wanderingFluteMaker?.active ?? null; }
export function getFluteMakerSecsLeft() {
  const a = state.wanderingFluteMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionReedFlutes() {
  const a = state.wanderingFluteMaker;
  if (!a?.active) return { ok: false, reason: 'No flute maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The flute maker has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned reed flutes from the wandering flute maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'fluteMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'fluteMakerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_FLUTE_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎵 The flute maker selects the straightest reeds from the bundle and begins the commission set by cutting each reed to length against a marked bone template — the longest at full arm-span for the lowest note, then each successive reed trimmed shorter by the measured interval that raises the pitch by a single pentatonic step, the cut made with a single pass of the bone-handled knife at a slight angle to leave a clean bore opening without split fibres at the rim. The finger-hole positions are burned into each reed one at a time using the heated wire held perpendicular to the wall surface — each hole's position measured from the lower end with a knotted cord calibrated against the maker's demonstration flute, the wire held steady while the smoke clears from the char so the aperture can be checked against a probe of known diameter before moving to the next position. The maker tests the finished set by playing them in sequence from lowest to highest, adjusting the bore of any hole that produces a slightly flat or sharp pitch by paring the opening with the knife tip until the note centres cleanly at the correct pitch in the pentatonic sequence. The completed set is presented to the settlement with the demonstration flute kept as a tuning reference for future maintenance. −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseFluteMakingCraft() {
  const a = state.wanderingFluteMaker;
  if (!a?.active) return { ok: false, reason: 'No flute maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The flute maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased flute-making craft from the wandering flute maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'fluteMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'fluteMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_FLUTE_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎶 The flute maker's craft manual opens with reed selection: the species of river reed that produces the best flute material grows in the slower reaches of shallow watercourses where the flow rate is low enough to allow uniform wall deposition without the thin-walled sections that cause cracking under playing pressure — the ideal harvest time is in late autumn after the first frost has begun to dry the reed from the inside, because a reed harvested green will shrink unevenly as it cures and produce bore variations that cannot be corrected by any amount of careful cutting. The bore sizing section explains the relationship between the bore diameter and the pitch range of the finished instrument: a narrow bore relative to the length produces a higher fundamental pitch and a clear, penetrating tone suitable for outdoor ceremony, while a wide bore relative to the length gives a lower pitch and a fuller, warmer sound that carries better in enclosed spaces. The finger-hole placement section gives the complete calculation method for the pentatonic scale: beginning from the lower end opening and stepping up the reed by fractions of the total sounding length determined by the simple ratios that produce the harmonic steps of the scale, with the adjustment factors that compensate for the acoustical effect of the reed wall thickness on the effective tube length at each hole position. The settlement's most attentive craftspeople work through the production of a practice instrument under the maker's instruction, correcting each step against the standard before the session ends. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFluteMakerAway() {
  const a = state.wanderingFluteMaker;
  if (!a?.active) return { ok: false, reason: 'No flute maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_FLUTE_MAKER_CHANGED, { dismissed: true });
  addMessage('🎵 The wandering flute maker wraps the reed bundle in its linen cord, packs the knife and wire, and continues along the road to the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
