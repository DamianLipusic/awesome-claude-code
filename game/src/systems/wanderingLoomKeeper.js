/**
 * EmpireOS — Wandering Loom Keeper (T475).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering loom keeper
 * arrives at the settlement carrying a collapsible upright loom disassembled
 * into numbered sections that fit inside a long canvas sack — the two-beam frame,
 * the heddle rod and its string heddles, the shed stick, and the beater batten —
 * along with a set of finished cloth samples showing the weave structures that
 * the loom can produce: a balanced tabby cloth in undyed flax, a striped twill
 * in alternating light and dark weft threads, and a warp-faced belt woven in
 * chevron pattern — offering to commission a supply of woven cloth for the
 * settlement's households, or to sell the loom-weaving lore so local weavers
 * can establish an independent cloth-making practice.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪡 Commission Woven Cloth Works  — pay 20 wood + 15 food
 *        → +0.20 food/s for 2.5 min · +15 prestige · +8 morale
 *   📜 Purchase Loom-Weaving Lore   — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.wanderingLoomKeeper = {
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

export const COMMISSION_WOOD_COST            = 20;
export const COMMISSION_FOOD_COST            = 15;
export const COMMISSION_FOOD_RATE            = 0.20;
export const COMMISSION_PRESTIGE_REWARD      = 15;
export const COMMISSION_MORALE_REWARD        = 8;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST              = 18;
export const PURCHASE_GOLD_RATE              = 0.15;
export const PURCHASE_PRESTIGE_REWARD        = 10;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingLoomKeeper() {
  if (!state.wanderingLoomKeeper) {
    state.wanderingLoomKeeper = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingLoomKeeper;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingLoomKeeperTick() {
  const a = state.wanderingLoomKeeper;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_LOOM_KEEPER_CHANGED, { expired: true });
      addMessage('🪡 The wandering loom keeper repacks the frame sections into the canvas sack, rolls the heddle strings around the heddle rod, and sets off along the track to the next settlement.', 'info');
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
  emit(Events.WANDERING_LOOM_KEEPER_CHANGED, { spawned: true });
  addMessage('🪡 A wandering loom keeper arrives carrying a collapsible upright loom in a long canvas sack — the two-beam frame, heddle rod with string heddles, shed stick, and beater batten — along with finished cloth samples in undyed tabby weave, striped twill, and chevron-pattern belt. The keeper offers to commission a supply of woven cloth for the settlement\'s households, or to sell the loom-weaving lore so local weavers can establish an independent cloth-making practice. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingLoomKeeper() { return state.wanderingLoomKeeper?.active ?? null; }
export function getLoomKeeperSecsLeft() {
  const a = state.wanderingLoomKeeper?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionWovenClothWorks() {
  const a = state.wanderingLoomKeeper;
  if (!a?.active) return { ok: false, reason: 'No loom keeper present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The loom keeper has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned woven cloth works from the wandering loom keeper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'loomKeeperCommission');
    state.randomEvents.activeModifiers.push({
      id: 'loomKeeperCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_LOOM_KEEPER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪡 The loom keeper assembles the frame in an open space beside the settlement's main weaving shed, aligning the uprights and locking the beam mortises before stringing the warp — counting the threads in groups of four so the threading sequence for the heddles can be confirmed against the pattern card before a single weft thread is passed. The tabby cloth goes on the loom first because the balanced weave requires no special heddle sequence and serves as the reference cloth for testing thread tension: if the weft threads beat in square rather than pulling the selvedge inward, the warp tension is correct. The twill comes next, the keeper narrating each heddle change to the settlement's weavers gathered around the frame so they can follow the lifting sequence without needing to consult the card again. By the time the commission is complete the settlement's households have a supply of serviceable woven cloth and the weaving shed is running at a pace that shows what a well-tensioned loom can produce. −${COMMISSION_WOOD_COST} wood −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseLoomWeavingLore() {
  const a = state.wanderingLoomKeeper;
  if (!a?.active) return { ok: false, reason: 'No loom keeper present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The loom keeper has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased loom-weaving lore from the wandering loom keeper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'loomKeeperPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'loomKeeperPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_LOOM_KEEPER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The loom keeper produces a cloth-bound handbook covering the full practice of upright-loom weaving: the initial section deals with warp preparation — calculating thread count from the desired cloth width, estimating length from the warp-to-weft shrinkage characteristic of the local flax, and warping the back beam evenly so the tension is consistent across the full width before the first heddle is threaded. A middle section covers the common weave structures — tabby, twill, and the warp-faced belt technique — with pattern cards giving the heddle-lifting sequence for each shed in sequence, annotated with the errors that a learner is most likely to make and the visual check that confirms the shed is clear before the shuttle is passed. A final section treats cloth finishing: the wet-finishing process that sets the weave and controls final shrinkage, and the nap-raising and shearing method used to produce a smooth face on the heavier twill cloths. The settlement's weavers work through the materials together over several evenings, each learning to set up and tension the loom independently before moving on to the weave structures. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLoomKeeperAway() {
  const a = state.wanderingLoomKeeper;
  if (!a?.active) return { ok: false, reason: 'No loom keeper present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_LOOM_KEEPER_CHANGED, { dismissed: true });
  addMessage('🪡 The wandering loom keeper repacks the frame sections into the canvas sack, rolls the heddle strings around the heddle rod, and sets off along the track to the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
