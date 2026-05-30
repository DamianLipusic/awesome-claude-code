/**
 * EmpireOS — Wandering Flax Spinner (T453).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering flax spinner
 * arrives at the settlement pulling a hand cart loaded with bundles of retted
 * flax straw — the dried stalks steeped in a slow stream for two weeks until
 * the woody shive separates cleanly from the long bast fibres that run the
 * full length of the stalk and emerge from the retting pool in pale cream
 * ribbons when the dew-retted mats are broken on the grooved wooden breaker
 * board and beaten free of the last shive fragments on the scutching stone
 * with a flat wooden blade, then drawn through the hackle — a board set with
 * rows of long iron pins — to comb out short tow fibres and align the long
 * line fibres into a silky sliver that feeds smoothly onto the distaff and
 * draws down to a fine, strong linen thread on the drop spindle weighted with
 * a fired clay whorl, the thread reeled onto a netting frame for bleaching in
 * morning dew on the grass — offering to commission a full linen thread works
 * built at the edge of the settlement using local timber and provisions to
 * yield strong linen thread for the settlement's weavers and rope-makers, or
 * to share the complete retting, breaking, scutching, hackling, and spinning
 * sequence for reliable linen production from flax grown in local fields.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🧵 Commission Linen Thread Works    — pay 20 wood + 15 food
 *        → +0.20 wood/s for 2.5 min · +15 prestige · +8 morale
 *   📖 Purchase Spinning Techniques     — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.wanderingFlaxSpinner = {
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_WOOD_COST        = 20;
export const COMMISSION_FOOD_COST        = 15;
export const COMMISSION_WOOD_RATE        = 0.20;
export const COMMISSION_PRESTIGE_REWARD  = 15;
export const COMMISSION_MORALE_REWARD    = 8;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 10;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingFlaxSpinner() {
  if (!state.wanderingFlaxSpinner) {
    state.wanderingFlaxSpinner = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingFlaxSpinner;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingFlaxSpinnerTick() {
  const a = state.wanderingFlaxSpinner;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_FLAX_SPINNER_CHANGED, { expired: true });
      addMessage('🧵 The wandering flax spinner re-bundles the retted straw onto the hand cart and departs along the road before the spinning window closes.', 'info');
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
  emit(Events.WANDERING_FLAX_SPINNER_CHANGED, { spawned: true });
  addMessage('🧵 A wandering flax spinner arrives pulling a hand cart loaded with bundles of retted flax straw — pale cream bast fibres separated from the woody shive by two weeks of stream retting — offering to commission a full linen thread works built at the edge of the settlement using local timber and provisions to yield strong linen thread for the settlement\'s weavers and rope-makers, or to share the complete retting, breaking, scutching, and spinning sequence for reliable linen production. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingFlaxSpinner() { return state.wanderingFlaxSpinner?.active ?? null; }
export function getFlaxSpinnerSecsLeft() {
  const a = state.wanderingFlaxSpinner?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionLinenThreadWorks() {
  const a = state.wanderingFlaxSpinner;
  if (!a?.active) return { ok: false, reason: 'No flax spinner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The flax spinner has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned linen thread works from the wandering flax spinner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'flaxSpinnerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'flaxSpinnerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_FLAX_SPINNER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧵 The flax spinner selects a sheltered corner of the settlement yard and constructs the linen thread works — laying out the retting frames of crossed ash poles above a slow-running mill leat, building the grooved breaker board from split oak and pinned iron teeth, mounting the scutching stone between timber supports at the height that allows a full backward sweep of the wooden blade, and assembling the long-toothed hackle board that combs the line fibres into a continuous silky sliver that feeds smoothly onto the distaff — producing strong linen thread from each successive bundle of retted straw that brings welcome strength and durability to the settlement's weaving and rope-making works! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSpinningTechniques() {
  const a = state.wanderingFlaxSpinner;
  if (!a?.active) return { ok: false, reason: 'No flax spinner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The flax spinner has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased spinning techniques from the wandering flax spinner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'flaxSpinnerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'flaxSpinnerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_FLAX_SPINNER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The flax spinner shares the complete linen-making sequence — the water temperature and duration that produces the cleanest retting without over-softening the long bast fibres, the breaker board tooth spacing that removes shive in a single pass without snapping the line fibres, the scutching blade angle and stroke rhythm that clears the last shive fragments while leaving the fibres aligned parallel, the hackle pin density that separates tow from line without breaking the long fibres, and the spindle whorl weight that produces the correct twist angle for a strong fine thread from the particular flax varieties grown in the local valley fields — knowledge that allows the settlement's craftswomen to produce reliable linen thread from every harvest of flax straw. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFlaxSpinnerAway() {
  const a = state.wanderingFlaxSpinner;
  if (!a?.active) return { ok: false, reason: 'No flax spinner present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_FLAX_SPINNER_CHANGED, { dismissed: true });
  addMessage('🧵 The wandering flax spinner re-bundles the retted straw onto the hand cart and departs along the road with a polite nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
