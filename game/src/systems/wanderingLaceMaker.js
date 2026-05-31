/**
 * EmpireOS — Wandering Lace Maker (T467).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering lace maker
 * arrives at the settlement carrying a leather roll of bobbins, a brass
 * lace-pillow frame stuffed with horsehair, and several yards of finished
 * lacework — delicate patterns of knotted linen thread ranging from simple
 * diamond lattices to the elaborate floral medallions favoured by the
 * nobility — offering to commission a batch of royal lacework panels for the
 * settlement's ceremonial halls, or to sell the pattern drafts she carries
 * so the settlement's own weavers can begin producing lacework independently.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪢 Commission Royal Lacework   — pay 20 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +10 morale
 *   📜 Purchase Lace-Making Patterns — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.wanderingLaceMaker = {
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
export const COMMISSION_PRESTIGE_REWARD      = 18;
export const COMMISSION_MORALE_REWARD        = 10;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST              = 18;
export const PURCHASE_GOLD_RATE              = 0.15;
export const PURCHASE_PRESTIGE_REWARD        = 12;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingLaceMaker() {
  if (!state.wanderingLaceMaker) {
    state.wanderingLaceMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingLaceMaker;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingLaceMakerTick() {
  const a = state.wanderingLaceMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_LACE_MAKER_CHANGED, { expired: true });
      addMessage('🪢 The wandering lace maker rolls up the bobbins into the leather case, tucks the lace-pillow under one arm, and sets off down the road to the next settlement, the finished lacework panels folded neatly over her basket.', 'info');
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
  emit(Events.WANDERING_LACE_MAKER_CHANGED, { spawned: true });
  addMessage('🪢 A wandering lace maker arrives at the settlement carrying a leather roll of bobbins, a brass lace-pillow frame, and several yards of finished lacework — delicate knotted linen ranging from simple diamond lattices to elaborate floral medallions. She offers to commission a batch of royal lacework panels for the settlement\'s ceremonial halls, or to sell her pattern drafts so local weavers can begin production independently. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingLaceMaker() { return state.wanderingLaceMaker?.active ?? null; }
export function getLaceMakerSecsLeft() {
  const a = state.wanderingLaceMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalLacework() {
  const a = state.wanderingLaceMaker;
  if (!a?.active) return { ok: false, reason: 'No lace maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lace maker has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned royal lacework from the wandering lace maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'laceMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'laceMakerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_LACE_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪢 The lace maker sets up her pillow on the council room table, pins the pattern draft to the backing cloth, and begins demonstrating the bobbin-twist sequence — each thread looped around its neighbour in the precise crossover pattern that creates the raised texture the nobility prize so highly. Over the following hours she produces a dozen lacework panels: some destined for ceremonial altar cloths, others for the decorative borders of the hall's hanging banners, and one long strip intended to frame the entrance archway during festival days. The quality and intricacy of the work draws admiring attention from across the settlement, boosting spirits and the prestige of the household. −${COMMISSION_FOOD_COST} food −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseLaceMakingPatterns() {
  const a = state.wanderingLaceMaker;
  if (!a?.active) return { ok: false, reason: 'No lace maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lace maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased lace-making patterns from the wandering lace maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'laceMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'laceMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_LACE_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The lace maker unrolls a set of pricked pattern cards — stiff parchment sheets each punctured with hundreds of pin-holes in the exact positions the bobbins must follow — together with a written key explaining the notation she uses to mark which threads cross over which and the spacing required for each stitch size. A supplementary sheet diagrams the way the finished lace should be starched and stretched over a blocking board so it dries to the correct dimensions without puckering. The settlement's weavers study the cards with growing interest and begin setting up their own bobbin pillows before the afternoon is out. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLaceMakerAway() {
  const a = state.wanderingLaceMaker;
  if (!a?.active) return { ok: false, reason: 'No lace maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_LACE_MAKER_CHANGED, { dismissed: true });
  addMessage('🪢 The wandering lace maker rolls up the bobbins into the leather case, tucks the lace-pillow under one arm, and sets off down the road to the next settlement, the finished lacework panels folded neatly over her basket.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
