/**
 * EmpireOS — Wandering Brickmaker (T443).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering brickmaker
 * arrives at the settlement with a mule laden with freshly fired bricks from
 * a temporary field kiln set up a morning's walk distant — each brick a dense
 * rectangular block of local alluvial clay mixed with fine sand and small
 * quantities of crushed grog from broken rejects to reduce shrinkage cracking
 * during the long firing, shaped by hand in a sanded wooden mould smoothed by
 * years of use, turned out on a sand-strewn board to dry in the open air for
 * several days under a lightweight reed shelter before being carefully stacked
 * in the updraught kiln built from the previous batch's rejects with spaces
 * between the bricks for the firewood fuel to circulate heat evenly through
 * the three-day firing that converts the soft clay into a hard durable ceramic
 * capable of supporting walls, paving floors, and lining furnace chambers
 * without weathering or spalling in frost — offering to commission a complete
 * run of kiln-fired building bricks for the settlement's construction projects
 * and workshop furnace linings, or to share the full moulding, drying, and
 * kiln-stacking methods that allow the settlement's own workers to produce
 * reliable bricks from the local clay deposits. The player has 80 seconds to
 * decide.
 *
 * Choices:
 *   🧱 Commission Kiln-Fired Brickworks  — pay 20 stone + 15 food
 *        → +0.22 stone/s for 2.5 min · +18 prestige · +10 morale
 *   📖 Purchase Brick-Firing Lore        — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                         — dismiss (no reward)
 *
 * state.wanderingBrickmaker = {
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

export const COMMISSION_STONE_COST       = 20;
export const COMMISSION_FOOD_COST        = 15;
export const COMMISSION_STONE_RATE       = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 18;
export const COMMISSION_MORALE_REWARD    = 10;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingBrickmaker() {
  if (!state.wanderingBrickmaker) {
    state.wanderingBrickmaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingBrickmaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingBrickmakerTick() {
  const a = state.wanderingBrickmaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_BRICKMAKER_CHANGED, { expired: true });
      addMessage('🧱 The wandering brickmaker loads the remaining bricks back onto the mule and departs along the clay road toward the next settlement.', 'info');
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
  emit(Events.WANDERING_BRICKMAKER_CHANGED, { spawned: true });
  addMessage('🧱 A wandering brickmaker arrives at the settlement with a mule laden with freshly kiln-fired bricks — offering to commission a complete run of building bricks for the settlement\'s construction projects and workshop furnace linings, or to share the full moulding, drying, and kiln-stacking methods for reliable brick production from local clay deposits. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingBrickmaker() { return state.wanderingBrickmaker?.active ?? null; }
export function getBrickmakerSecsLeft() {
  const a = state.wanderingBrickmaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionKilnFiredBrickworks() {
  const a = state.wanderingBrickmaker;
  if (!a?.active) return { ok: false, reason: 'No brickmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The brickmaker has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.food  ?? 0) < COMMISSION_FOOD_COST)  return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.food  -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned kiln-fired brickworks from the wandering brickmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'brickmakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'brickmakerCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_BRICKMAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧱 The brickmaker establishes a working yard at the edge of the settlement — setting up the wooden drying boards, stacking the unfired clay blocks in careful rows with proper spacing, and firing a full kiln charge in the temporary updraught kiln built from the last batch's rejects — producing a complete consignment of dense, well-fired building bricks in the standard stretcher size for wall construction, wider header bricks for corners and structural piers, and tapered arch bricks for doorway and window surrounds — together with a quantity of smaller furnace bricks cut to fit the curved lining of workshop hearths and smelting chambers where ordinary stone would crack under thermal cycling — filling the stonemason's yard with a reliable, uniform building material that raises the pace and quality of all construction work across the settlement! −${COMMISSION_STONE_COST} stone · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseBrickFiringLore() {
  const a = state.wanderingBrickmaker;
  if (!a?.active) return { ok: false, reason: 'No brickmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The brickmaker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased brick-firing lore from the wandering brickmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'brickmakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'brickmakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_BRICKMAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The brickmaker shares the complete methods for kiln-fired brick production — the clay prospecting indicators that identify alluvial deposits with the right particle size distribution and natural iron content for good colour and hardness, the sand and grog tempering ratios that reduce cracking in the wet clay during drying and firing, the wooden mould dimensions and sanding technique that produce bricks that unmould cleanly and stack level without rocking, the outdoor drying calendar that avoids rain damage and frost cracking during the critical first three days, and the kiln stacking patterns with optimum spacing between bricks for even heat penetration through the full charge — knowledge that allows the settlement's own workers to produce reliable kiln-fired bricks from local clay deposits for all construction and furnace lining purposes. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBrickmakerAway() {
  const a = state.wanderingBrickmaker;
  if (!a?.active) return { ok: false, reason: 'No brickmaker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_BRICKMAKER_CHANGED, { dismissed: true });
  addMessage('🧱 The wandering brickmaker loads the remaining bricks back onto the mule and departs with a respectful nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
