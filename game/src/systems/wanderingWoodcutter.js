/**
 * EmpireOS — Wandering Woodcutter (T429).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering
 * woodcutter arrives at the settlement carrying a broad-bladed felling
 * axe with a hickory handle worn smooth by years of daily swinging
 * through timber of every hardness and grain pattern — oak, ash, elm,
 * hornbeam, and coppiced hazel cut at the correct point in the rotation
 * to produce straight, knot-free poles and billets of consistent cross-
 * section, the felled trunks limbed and crosscut into manageable lengths
 * on the spot before being bundled into faggots and stacked in the order
 * that minimises the number of lifts needed to load and shift the final
 * pile — together with a long-handled splitting maul that parts the billets
 * cleanly along the grain with one or two strokes, leaving a flat-faced
 * firewood piece that stacks tightly and seasons quickly with good air
 * circulation between the rows — offering to commission a full run of
 * firewood bundles from the current standing timber, or to share the
 * accumulated forest management lore that allows every settlement woodward
 * to select the right species, cut cycle, and stacking method for maximum
 * yield and minimum waste year after year.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪓 Commission Firewood Bundles   — pay 20 wood
 *        → +0.22 wood/s for 2.5 min · +15 prestige · +8 morale
 *   📖 Purchase Forest Management Lore — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                       — dismiss (no reward)
 *
 * state.wanderingWoodcutter = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissions: number,
 *   totalPurchases:   number,
 *   totalDismissals:  number,
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

export const COMMISSION_WOOD_COST           = 20;
export const COMMISSION_WOOD_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD     = 15;
export const COMMISSION_MORALE_REWARD       = 8;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST             = 18;
export const PURCHASE_GOLD_RATE             = 0.15;
export const PURCHASE_PRESTIGE_REWARD       = 10;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingWoodcutter() {
  if (!state.wanderingWoodcutter) {
    state.wanderingWoodcutter = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingWoodcutter;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingWoodcutterTick() {
  const a = state.wanderingWoodcutter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_WOODCUTTER_CHANGED, { expired: true });
      addMessage('🪓 The wandering woodcutter shoulders the broad-bladed felling axe, tucks the splitting maul under one arm, and departs along the woodland track — the rhythmic sound of the axe handle tapping against a belt loop fading as the figure rounds the treeline and heads toward the next settlement on the seasonal circuit.', 'info');
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
  emit(Events.WANDERING_WOODCUTTER_CHANGED, { spawned: true });
  addMessage('🪓 A wandering woodcutter arrives at the settlement carrying a broad-bladed felling axe with a hickory handle worn smooth by years of daily swinging through oak, ash, elm, hornbeam, and coppiced hazel — the felled trunks limbed, crosscut, and bundled into faggots stacked in the order that minimises lifting, together with a long-handled splitting maul that parts billets cleanly along the grain into flat-faced firewood pieces that stack tightly and season quickly — offering to commission a full run of firewood bundles from the current standing timber, or to share the accumulated forest management lore that allows every settlement woodward to select the right species, cut cycle, and stacking method. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingWoodcutter() { return state.wanderingWoodcutter?.active ?? null; }
export function getWoodcutterSecsLeft() {
  const a = state.wanderingWoodcutter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionFirewoodBundles() {
  const a = state.wanderingWoodcutter;
  if (!a?.active) return { ok: false, reason: 'No woodcutter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The woodcutter has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned firewood bundles from the wandering woodcutter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'woodcutterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'woodcutterCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_WOODCUTTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪓 The woodcutter selects the nearest stand of mature oak and ash, swings the broad-bladed axe in a series of measured undercuts that bring each trunk down cleanly without splitting the butt, trims the limbs back to the main stem with quick angled strokes, crosscuts the trunk into billet lengths matched to the settlement hearth size, and drives the splitting maul through each billet with two or three well-placed blows that part the wood cleanly along the grain — stacking the resulting flat-faced firewood pieces in tightly interlocked rows with the cut face outward for air circulation, the whole operation completed in a fraction of the time a settlement crew would take using the available tools. The woodsheds fill with seasoning timber that will burn hot and clean through the coming months! −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseForestManagementLore() {
  const a = state.wanderingWoodcutter;
  if (!a?.active) return { ok: false, reason: 'No woodcutter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The woodcutter has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased forest management lore from the wandering woodcutter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'woodcutterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'woodcutterPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_WOODCUTTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The woodcutter shares the accumulated forest management knowledge gathered across many years and many woodland types — the species identification method that distinguishes fast-growing timber worth coppicing on a seven-year rotation from slow-growing heartwood worth felling on a thirty-year standard rotation, the visual inspection that identifies which standing trees have developed the internal ring-shake or shake-prone grain that causes split billets to crumble in the hearth rather than burn cleanly, the coppice-stool management sequence that keeps each stool producing straight poles of consistent diameter indefinitely without replanting, and the faggot-bundling tie method that produces a bundle firm enough to carry without a frame but loose enough to dry evenly across the full bundle width — knowledge that allows every settlement woodward to manage the surrounding woodland for maximum sustained yield and minimum wasted effort across every season! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendWoodcutterAway() {
  const a = state.wanderingWoodcutter;
  if (!a?.active) return { ok: false, reason: 'No woodcutter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_WOODCUTTER_CHANGED, { dismissed: true });
  addMessage('🪓 The wandering woodcutter nods politely, shoulders the broad-bladed axe, and departs along the woodland track leading toward the next settlement on the seasonal circuit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
