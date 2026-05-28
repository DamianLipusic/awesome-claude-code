/**
 * EmpireOS — Wandering Wicker Weaver (T441).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering wicker
 * weaver arrives at the settlement carrying a bundle of freshly-cut willow
 * withies harvested from the riverside stands at dawn — the long straight
 * first-year growth selected for the finest weaving, stripped of side shoots,
 * soaked overnight in the shallow backwater to restore the moisture that keeps
 * the rods supple without splitting at the curves where they pass under the
 * horizontal stakes driven into the turned wooden base of each basket or
 * hurdle — bearing the full kit of the itinerant weaver: the splitting iron for
 * dividing thick butts into working strands, the lap board for finishing the
 * scallom border that locks the final rows, and the packing iron used to beat
 * each round tight against the previous to produce a firm impermeable weave
 * for storage baskets, grain measures, and fish traps that command a reliable
 * market at every settlement along the river road — offering to commission a
 * complete run of wicker furniture and storage goods for the settlement's
 * storehouses and workshops using the finest Somerset-style full willow weave
 * on turned wooden stands, or to share the complete splitting, staking, and
 * border techniques that allow the settlement's own craftspeople to produce
 * serviceable wicker goods from locally harvested withies. The player has 80
 * seconds to decide.
 *
 * Choices:
 *   🧺 Commission Wicker Works      — pay 20 wood
 *        → +0.22 wood/s for 2.5 min · +18 prestige · +8 morale
 *   📖 Purchase Weaving Patterns    — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingWickerWeaver = {
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

export const COMMISSION_WOOD_COST        = 20;
export const COMMISSION_WOOD_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 18;
export const COMMISSION_MORALE_REWARD    = 8;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingWickerWeaver() {
  if (!state.wanderingWickerWeaver) {
    state.wanderingWickerWeaver = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingWickerWeaver;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingWickerWeaverTick() {
  const a = state.wanderingWickerWeaver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_WICKER_WEAVER_CHANGED, { expired: true });
      addMessage('🧺 The wandering wicker weaver bundles the soaked willow withies back into the carry cloth and departs along the road to the next settlement.', 'info');
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
  emit(Events.WANDERING_WICKER_WEAVER_CHANGED, { spawned: true });
  addMessage('🧺 A wandering wicker weaver arrives at the settlement carrying a bundle of freshly-cut willow withies and a full kit of splitting irons, lap boards, and packing irons — offering to commission a complete run of wicker furniture and storage goods for the storehouses and workshops using fine Somerset-style full willow weave on turned wooden stands, or to share the complete splitting, staking, and border techniques for reliable wicker production from locally harvested withies. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingWickerWeaver() { return state.wanderingWickerWeaver?.active ?? null; }
export function getWickerWeaverSecsLeft() {
  const a = state.wanderingWickerWeaver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionWickerWorks() {
  const a = state.wanderingWickerWeaver;
  if (!a?.active) return { ok: false, reason: 'No wicker weaver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The wicker weaver has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned wicker works from the wandering wicker weaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'wickerWeaverCommission');
    state.randomEvents.activeModifiers.push({
      id: 'wickerWeaverCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_WICKER_WEAVER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧺 The wicker weaver establishes a working area at the edge of the storehouse yard — soaking the final withies, staking out the base rounds, and weaving the full Somerset pattern through the upright stakes with the skilled rhythm of a craftsperson who has completed hundreds of commissions — producing a complete set of handled storage baskets in graduated sizes for grain, root vegetables, and dried goods, a set of broad low trays for drying herbs and small seeds on the storehouse racks, and a set of carrying panniers fitted to the pack frame dimensions used by the settlement's porters — each piece finished with the scallom border that locks the final weaving round against the stake tops and prevents unravelling under hard daily use — filling the storehouses with well-made equipment that raises the efficiency of every food storage and distribution task and generates visible pride and confidence among the storehouse workers! −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseWeavingPatterns() {
  const a = state.wanderingWickerWeaver;
  if (!a?.active) return { ok: false, reason: 'No wicker weaver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The wicker weaver has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased weaving patterns from the wandering wicker weaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'wickerWeaverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'wickerWeaverPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_WICKER_WEAVER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The wicker weaver shares the complete splitting, staking, and border techniques — the withy harvesting calendar that identifies the optimal cutting window in the first weeks after leaf-fall when the bark clings tightly to the rod and the wood bends without splitting at the sharpest curves, the soaking schedule for stored dry rods that restores workable suppleness without over-softening the fibre, the staking sequence for round and oval bases that produces even upright spacing around the full circumference, the under-over weave patterns for the standard check weave, twisted rope weave, and open lattice weave used in different basket types, and the three-rod wale technique for strengthening the sides at the base join and at the border — knowledge that allows the settlement's craftspeople to produce serviceable wicker goods for domestic and trade purposes from withies harvested in the riverside stands each winter. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendWickerWeaverAway() {
  const a = state.wanderingWickerWeaver;
  if (!a?.active) return { ok: false, reason: 'No wicker weaver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_WICKER_WEAVER_CHANGED, { dismissed: true });
  addMessage('🧺 The wandering wicker weaver bundles the soaked willow withies back into the carry cloth and departs along the road with a respectful nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
