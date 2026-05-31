/**
 * EmpireOS — Wandering Tallow Chandler (T461).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering tallow chandler
 * arrives at the settlement carrying bundles of rush-wicks and blocks of rendered
 * animal fat — pale yellowish tallow pressed into wooden moulds, the surface
 * showing the fine cross-hatched texture left by the cheesecloth used to strain
 * the hot fat as it was ladled from the rendering cauldron — along with the full
 * complement of chandlery tools: the dipping frames that hold a dozen wicks
 * simultaneously as they are lowered into a tallow bath and withdrawn in a
 * single smooth motion to build up concentric layers of solidified fat; the
 * bleached linen molds for casting dipped tapers into uniform round cylinders;
 * and a copper vessel of beeswax for the fine outer coat applied in the final
 * dipping to give the finished candle a harder, slower-burning surface than
 * tallow alone — offering to commission a complete run of tallow candles for
 * the settlement's halls and workshops, or to teach the full chandlery craft so
 * the settlement's own craftspeople can render and dip candles year-round.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🕯️ Commission Tallow Candles     — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +15 prestige · +8 morale
 *   📜 Purchase Chandler's Formulas  — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.wanderingTallowChandler = {
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

export const COMMISSION_FOOD_COST           = 20;
export const COMMISSION_WOOD_COST           = 15;
export const COMMISSION_FOOD_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD     = 15;
export const COMMISSION_MORALE_REWARD       = 8;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST             = 18;
export const PURCHASE_GOLD_RATE             = 0.15;
export const PURCHASE_PRESTIGE_REWARD       = 10;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingTallowChandler() {
  if (!state.wanderingTallowChandler) {
    state.wanderingTallowChandler = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingTallowChandler;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingTallowChandlerTick() {
  const a = state.wanderingTallowChandler;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_TALLOW_CHANDLER_CHANGED, { expired: true });
      addMessage('🕯️ The wandering tallow chandler bundles up the dipping frames and wicks and departs to the next settlement requiring chandlery services.', 'info');
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
  emit(Events.WANDERING_TALLOW_CHANDLER_CHANGED, { spawned: true });
  addMessage('🕯️ A wandering tallow chandler arrives at the settlement carrying bundles of rush-wicks and blocks of rendered animal fat — pale yellowish tallow pressed into wooden moulds — along with dipping frames that hold a dozen wicks simultaneously, bleached linen molds for casting uniform tapers, and a copper vessel of beeswax for the fine outer coat that gives the finished candle a harder, slower-burning surface than tallow alone. The chandler offers to commission a complete run of tallow candles for the settlement\'s halls and workshops, or to teach the full chandlery craft so the settlement\'s own craftspeople can render and dip candles year-round. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingTallowChandler() { return state.wanderingTallowChandler?.active ?? null; }
export function getTallowChandlerSecsLeft() {
  const a = state.wanderingTallowChandler?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTallowCandles() {
  const a = state.wanderingTallowChandler;
  if (!a?.active) return { ok: false, reason: 'No tallow chandler present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The chandler has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned tallow candles from the wandering tallow chandler');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tallowChandlerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'tallowChandlerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_TALLOW_CHANDLER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🕯️ The chandler establishes a temporary rendering station at the edge of the settlement — a large iron cauldron suspended over a slow wood fire, the raw fat scraps from the butchery loaded in batches and stirred continuously as the tissue breaks down and the liquid tallow separates from the crackling residue, then ladled through cheesecloth into wooden moulds to set overnight into pale yellow blocks with the characteristic fine cross-hatching on the surface. The dipping frames are rigged over a second vessel of molten tallow kept at the precise temperature where it flows smoothly but sets quickly on contact with the cooler wick, each frame carrying twelve wicks lowered and raised in a single smooth motion to build up concentric layers of solidified fat until the taper reaches the required diameter, then finished with a final coat of beeswax from the copper vessel. The completed candles are sorted by length and stored in bundles tied with rush, enough to light the settlement's halls and workshops through the coming months. −${COMMISSION_FOOD_COST} food −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseChandlerFormulas() {
  const a = state.wanderingTallowChandler;
  if (!a?.active) return { ok: false, reason: 'No tallow chandler present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The chandler has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased chandler\'s formulas from the wandering tallow chandler');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tallowChandlerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'tallowChandlerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_TALLOW_CHANDLER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The chandler unpacks a worn leather roll containing the full body of chandlery knowledge accumulated over years of itinerant craft work — the rendering temperatures for different animal fats and their effect on the finished tallow's hardness and burn rate; the proportions of beeswax to add to tallow for candles intended for fine interiors where a clean, odour-free flame is required; the precise dipping temperature for building up layers quickly without the taper becoming uneven or the wick wandering off-centre; the wick preparation techniques — sizing with starch paste to stiffen the fibre and produce a clean, self-trimming flame rather than a mushrooming mass of charred cotton; the bleaching methods for producing white rather than yellow tapers when pale candles are preferred for ceremonial use; and the trade arrangements for securing a reliable supply of rendered fat through the butchery trade on favourable terms. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendTallowChandlerAway() {
  const a = state.wanderingTallowChandler;
  if (!a?.active) return { ok: false, reason: 'No tallow chandler present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_TALLOW_CHANDLER_CHANGED, { dismissed: true });
  addMessage('🕯️ The wandering tallow chandler bundles up the dipping frames and wicks and departs to the next settlement requiring chandlery services.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
