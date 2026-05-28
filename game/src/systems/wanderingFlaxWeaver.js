/**
 * EmpireOS — Wandering Flax Weaver (T435).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering flax weaver
 * arrives at the settlement carrying a portable upright loom strapped to a
 * wooden frame on their back — the warp threads already dressed with
 * water-retted linen yarn spun from the long bast fibres separated from
 * flax stalks by retting in slow-moving water for ten to fourteen days then
 * dried, broken on a flax brake to remove the woody shive, scutched with a
 * wooden blade to separate the long line fibres from the short tow,
 * and hackled through a board of iron pins to align the fibres into a
 * smooth, lustrous preparation ready for spinning on a drop spindle or
 * supported spindle bowl into a fine, even yarn with natural lustre —
 * offering to commission a full run of linen cloth woven in the settlement's
 * local colours using the fine bleached and fulled linen that raises the
 * prestige of the court's household linen, or to share the complete
 * water-retting and preparation sequence that allows the settlement's
 * weavers to produce linen cloth reliably from field-grown flax. The
 * player has 80 seconds to decide.
 *
 * Choices:
 *   🌿 Commission Linen Cloth   — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +8 morale
 *   📖 Purchase Weaving Lore    — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away               — dismiss (no reward)
 *
 * state.wanderingFlaxWeaver = {
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

export const COMMISSION_FOOD_COST        = 20;
export const COMMISSION_WOOD_COST        = 15;
export const COMMISSION_FOOD_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 18;
export const COMMISSION_MORALE_REWARD    = 8;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingFlaxWeaver() {
  if (!state.wanderingFlaxWeaver) {
    state.wanderingFlaxWeaver = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingFlaxWeaver;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingFlaxWeaverTick() {
  const a = state.wanderingFlaxWeaver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_FLAX_WEAVER_CHANGED, { expired: true });
      addMessage('🌿 The wandering flax weaver unstraps the portable loom from the frame, re-rolls the dressed warp threads around the warp beam, folds the heddles into their storage ties, and re-packs the retting knives and hackle board into the linen bundle before departing along the road.', 'info');
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
  emit(Events.WANDERING_FLAX_WEAVER_CHANGED, { spawned: true });
  addMessage('🌿 A wandering flax weaver arrives at the settlement carrying a portable upright loom strapped to a wooden frame on their back — the warp threads already dressed with water-retted linen yarn spun from long bast fibres separated from flax stalks by retting in slow-moving water, then dried, broken on a flax brake, scutched, and hackled into a smooth lustrous preparation — offering to commission a run of fine bleached linen cloth woven in the settlement\'s colours, or to share the complete water-retting and preparation sequence for reliable linen production from field-grown flax. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingFlaxWeaver() { return state.wanderingFlaxWeaver?.active ?? null; }
export function getFlaxWeaverSecsLeft() {
  const a = state.wanderingFlaxWeaver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionLinenCloth() {
  const a = state.wanderingFlaxWeaver;
  if (!a?.active) return { ok: false, reason: 'No flax weaver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The flax weaver has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned linen cloth from the wandering flax weaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'flaxWeaverCommission');
    state.randomEvents.activeModifiers.push({
      id: 'flaxWeaverCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_FLAX_WEAVER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The flax weaver sets up the portable loom in the courtyard and works through the full run of cloth — setting the shed with the heddle stick, passing the shuttle with the linen weft yarn through the open shed, beating each weft pick firmly down with the beater sword to pack the weave tightly, and advancing the cloth beam as the width of fine plain-weave linen cloth grows steadily — delivering a length of high-quality bleached linen cloth finished with a tablet-woven selvedge border in the settlement's colours that elevates the household textile collection and brings notable prestige to the court's formal occasions! −${COMMISSION_FOOD_COST} food · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseWeavingLore() {
  const a = state.wanderingFlaxWeaver;
  if (!a?.active) return { ok: false, reason: 'No flax weaver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The flax weaver has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased weaving lore from the wandering flax weaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'flaxWeaverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'flaxWeaverPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_FLAX_WEAVER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The flax weaver shares the complete water-retting and preparation sequence — the optimal water temperature and retting duration that separates the bast fibres without damaging the cellulose structure, the drying method that preserves fibre length for line spinning rather than degrading it to the shorter tow grade, the brake technique that removes woody shive without breaking the long fibres, the scutching stroke angle that cleans the line without unnecessary waste, and the hackle pin spacing sequence from coarse to fine that aligns the fibres into the smooth, lustrous preparation that spins into high-quality linen yarn — knowledge that allows the settlement's weavers to produce fine linen cloth reliably from field-grown flax without dependence on imported cloth. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFlaxWeaverAway() {
  const a = state.wanderingFlaxWeaver;
  if (!a?.active) return { ok: false, reason: 'No flax weaver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_FLAX_WEAVER_CHANGED, { dismissed: true });
  addMessage('🌿 The wandering flax weaver re-straps the portable loom to the wooden frame and departs along the road with a respectful nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
