/**
 * EmpireOS — Wandering Pitch Maker (T451).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering pitch maker
 * arrives at the settlement carrying a set of sealed clay pots filled with
 * black pine pitch and birch tar — thick viscous substances produced by the
 * slow pyrolysis of resinous wood and birch bark in clay-sealed kilns at
 * controlled temperatures, each batch tested by stretching a cooled thread
 * between finger and thumb to verify elasticity and by pressing a thumb into
 * the surface at room temperature to confirm the right balance of hardness
 * and adhesion — along with broad flat spatulas for application, samples of
 * pitch-caulked timber planks showing watertight seams, and a series of small
 * iron pots for heating pitch to working temperature over a fire, offering to
 * commission a complete pitch works installation that will supply the
 * settlement's boat builders and barrel makers with high-quality waterproofing
 * compound through the coming season, or to share the full pyrolysis and
 * blending methods that allow the settlement's own workers to produce
 * consistent-quality pitch from the local woodland without specialist
 * assistance. The player has 80 seconds to decide.
 *
 * Choices:
 *   🪵 Commission Pitch Works         — pay 20 wood + 15 food
 *        → +0.22 wood/s for 2.5 min · +15 prestige · +8 morale
 *   📖 Purchase Pitch-Making Lore     — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.wanderingPitchMaker = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
 *   totalPurchases:      number,
 *   totalDismissals:     number,
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
export const COMMISSION_FOOD_COST          = 15;
export const COMMISSION_WOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingPitchMaker() {
  if (!state.wanderingPitchMaker) {
    state.wanderingPitchMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingPitchMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingPitchMakerTick() {
  const a = state.wanderingPitchMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_PITCH_MAKER_CHANGED, { expired: true });
      addMessage('🪵 The wandering pitch maker seals the clay pots, wraps the iron heating vessels in sacking, and departs along the forest track toward the next settlement.', 'info');
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
  emit(Events.WANDERING_PITCH_MAKER_CHANGED, { spawned: true });
  addMessage('🪵 A wandering pitch maker arrives at the settlement carrying sealed clay pots of black pine pitch and birch tar — thick viscous waterproofing compounds produced by slow pyrolysis in sealed kilns — along with application spatulas, sample caulked timber planks, and iron heating pots, offering to commission a complete pitch works installation for boat builders and barrel makers, or to share the full pyrolysis and blending methods. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingPitchMaker() { return state.wanderingPitchMaker?.active ?? null; }
export function getPitchMakerSecsLeft() {
  const a = state.wanderingPitchMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionPitchWorks() {
  const a = state.wanderingPitchMaker;
  if (!a?.active) return { ok: false, reason: 'No pitch maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The pitch maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned pitch works from the wandering pitch maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'pitchmakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'pitchmakerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_PITCH_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The pitch maker sets up a small kiln in the settlement yard using a shallow pit lined with clay, fills it with split resinous pine billets, seals the top with a clay and sand mixture leaving only a small vent hole, and maintains a slow controlled burn over several hours while collecting the dark liquid pitch that drains through a tap at the base into the prepared clay storage pots — producing a full season's supply of waterproofing compound for the settlement's boat builders, barrel coopers, and rope makers, along with a batch of the harder birch tar suitable for sealing ironwork against rust and cementing tool handles. −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchasePitchMakingLore() {
  const a = state.wanderingPitchMaker;
  if (!a?.active) return { ok: false, reason: 'No pitch maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The pitch maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased pitch-making lore from the wandering pitch maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'pitchmakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'pitchmakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_PITCH_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The pitch maker shares the complete pyrolysis and blending methods — the kiln construction specifications that produce the right internal temperature gradient to drive off the volatile oils first and leave the non-volatile pitch compounds to drain as liquid rather than burning away completely, the wood selection criteria distinguishing the high-resin pine species whose heartwood yields the black waterproof pitch from the lower-resin varieties that produce only thin brown tar unsuitable for caulking, the temperature tests using a weighted wire probe inserted through the vent hole to confirm the charge has reached carbonisation without over-firing, the two-stage collection method that separates the softer pine pitch collected at lower temperatures from the harder birch tar that emerges at higher temperatures and is suitable for different applications, and the blending ratios for mixing the two types to produce compounds of intermediate hardness suitable for rope coating, iron preservation, and timber caulking. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendPitchMakerAway() {
  const a = state.wanderingPitchMaker;
  if (!a?.active) return { ok: false, reason: 'No pitch maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_PITCH_MAKER_CHANGED, { dismissed: true });
  addMessage('🪵 The wandering pitch maker seals the clay pots carefully and departs with a nod toward the forest track.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
