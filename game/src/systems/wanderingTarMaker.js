/**
 * EmpireOS — Wandering Tar Maker (T439).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering tar maker
 * arrives at the settlement leading a cart loaded with birch bark billets
 * and pine root sections collected from forest clearings and storm-felled
 * trees along the road — the bark stripped and rolled into tight cylinders
 * sealed at one end with clay, the pine root sections split to expose the
 * resinous heartwood that releases the heaviest tar fraction when heated in
 * an earthen kiln built from packed clay over a stone-lined fire pit, the
 * volatile distillate condensing in a clay-sealed collection vessel buried
 * in the earth beside the kiln where the cool soil chills the vapour to a
 * dark viscous liquid that flows like cold honey and hardens in cold air
 * to a tacky solid that waterproofs ship planking, timber roof structures,
 * rope and cordage, leather harness, and the iron ferrules of tool handles
 * against rust and rot through seasons of wet weather — offering to
 * commission a full tar kiln run built at the edge of the settlement and
 * burned over two days using the settlement's own timber and provision
 * stores to yield a full barrel of high-quality wood tar, or to share the
 * complete dry distillation and condensation sequence that allows the
 * settlement's own craftsmen to produce building and preservation tar
 * reliably from local forest materials. The player has 80 seconds to
 * decide.
 *
 * Choices:
 *   🔥 Commission Tar Kiln Works    — pay 20 wood + 15 food
 *        → +0.20 wood/s for 2.5 min · +15 prestige · +8 morale
 *   📖 Purchase Distillation Techniques — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingTarMaker = {
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
export const COMMISSION_FOOD_COST        = 15;
export const COMMISSION_WOOD_RATE        = 0.20;
export const COMMISSION_PRESTIGE_REWARD  = 15;
export const COMMISSION_MORALE_REWARD    = 8;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 10;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingTarMaker() {
  if (!state.wanderingTarMaker) {
    state.wanderingTarMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingTarMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingTarMakerTick() {
  const a = state.wanderingTarMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_TAR_MAKER_CHANGED, { expired: true });
      addMessage('🔥 The wandering tar maker re-loads the birch bark rolls and pine root billets onto the cart and departs along the road before the distillation window closes.', 'info');
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
  emit(Events.WANDERING_TAR_MAKER_CHANGED, { spawned: true });
  addMessage('🔥 A wandering tar maker arrives at the settlement leading a cart loaded with birch bark rolls and resinous pine root billets collected from forest clearings, offering to commission a full tar kiln run burned over two days using local timber and provisions to yield a full barrel of high-quality wood tar for waterproofing and preservation, or to share the complete dry distillation and condensation sequence for reliable tar production from local forest materials. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingTarMaker() { return state.wanderingTarMaker?.active ?? null; }
export function getTarMakerSecsLeft() {
  const a = state.wanderingTarMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTarKilnWorks() {
  const a = state.wanderingTarMaker;
  if (!a?.active) return { ok: false, reason: 'No tar maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The tar maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned tar kiln works from the wandering tar maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tarMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'tarMakerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_TAR_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔥 The tar maker selects a sheltered hollow at the edge of the settlement and constructs the earthen kiln — packing the clay walls to the measured thickness that insulates the retort from direct flame while transmitting heat evenly through the bark and pine root charge, building the condensation vessel from clay-sealed sections buried in the cool earth to collect the dark viscous distillate that flows from the taphole — running the kiln through two days of controlled burning that yields a full barrel of highest-quality wood tar prized by the settlement's shipwrights, carpenters, and rope-makers for its exceptional waterproofing and preservation properties, and bringing welcome prosperity to the maintenance and construction works! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseDistillationTechniques() {
  const a = state.wanderingTarMaker;
  if (!a?.active) return { ok: false, reason: 'No tar maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The tar maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased distillation techniques from the wandering tar maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tarMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'tarMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_TAR_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The tar maker shares the complete dry distillation and condensation sequence — the bark selection criteria that identifies the highest resin-content birch bark and pine root from their characteristic aromatic scent and dense grain structure, the kiln proportions that maintain an even retort temperature without charring the outer bark layers before the inner layers have yielded their tar fraction, the clay-seal technique for the condensation vessel joints that prevents volatile fraction loss while allowing pressure equalisation through the taphole, and the collection timing that separates the light pine spirit from the heavy wood tar fraction for different preservation applications — knowledge that allows the settlement's craftsmen to produce quality waterproofing and preservation tar reliably from the forest materials available in every season. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendTarMakerAway() {
  const a = state.wanderingTarMaker;
  if (!a?.active) return { ok: false, reason: 'No tar maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_TAR_MAKER_CHANGED, { dismissed: true });
  addMessage('🔥 The wandering tar maker re-loads the bark rolls and pine billets onto the cart and departs along the road with a respectful nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
