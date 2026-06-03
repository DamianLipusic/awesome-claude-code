/**
 * EmpireOS — Wandering Shellworker (T485).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering shellworker
 * arrives at the settlement carrying a large wicker tray covered with a damp
 * cloth — beneath which are arranged sorted collections of coastal shells
 * selected for uniformity of colour and thickness: pale limpet caps from the
 * high-tide rocks, olive-green whelks with their characteristic ridged whorls,
 * flat white oyster valves with their irregular edges smoothed by sustained
 * friction against a sandstone grinding block, and the small cowrie shells
 * prized for their naturally polished surface and symmetrical aperture — along
 * with the hand tools of the shellwork trade: a bow drill fitted with a
 * hardened flint tip for boring clean holes through shell walls without
 * cracking the surrounding material, a leather burnishing pad charged with
 * fine river sand for polishing cut edges, and a selection of finished
 * ornaments including a graduated necklace, a belt clasp, and a set of
 * ceremonial headband fittings to show the range of the craft.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🐚 Commission Shell Ornaments       — pay 20 food + 15 wood
 *        → +0.20 food/s for 2.5 min · +15 prestige · +8 morale
 *   🪄 Purchase Shellwork Craft          — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.wanderingShellworker = {
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

export const COMMISSION_FOOD_COST            = 20;
export const COMMISSION_WOOD_COST            = 15;
export const COMMISSION_FOOD_RATE            = 0.20;
export const COMMISSION_PRESTIGE_REWARD      = 15;
export const COMMISSION_MORALE_REWARD        = 8;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST              = 18;
export const PURCHASE_GOLD_RATE              = 0.15;
export const PURCHASE_PRESTIGE_REWARD        = 10;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingShellworker() {
  if (!state.wanderingShellworker) {
    state.wanderingShellworker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingShellworker;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingShellworkerTick() {
  const a = state.wanderingShellworker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SHELLWORKER_CHANGED, { expired: true });
      addMessage('🐚 The wandering shellworker covers the tray with its damp cloth, secures the tools in their roll, and continues along the coast road to the next settlement.', 'info');
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
  emit(Events.WANDERING_SHELLWORKER_CHANGED, { spawned: true });
  addMessage('🐚 A wandering shellworker arrives carrying a large wicker tray of sorted coastal shells — pale limpet caps, ridged whelks, smooth oyster valves, and polished cowries — along with a bow drill, a leather burnishing pad, and finished ornaments including a graduated necklace, a belt clasp, and ceremonial headband fittings. The shellworker offers to commission a set of shell ornaments for the settlement\'s ceremonial use, or to teach the shellwork craft so the settlement\'s craftspeople can work with locally gathered materials. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingShellworker() { return state.wanderingShellworker?.active ?? null; }
export function getShellworkerSecsLeft() {
  const a = state.wanderingShellworker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionShellOrnaments() {
  const a = state.wanderingShellworker;
  if (!a?.active) return { ok: false, reason: 'No shellworker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The shellworker has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned shell ornaments from the wandering shellworker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'shellworkerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'shellworkerCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_SHELLWORKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🐚 The shellworker selects the finest specimens from the tray — examining each shell against the light to check for hairline cracks or uneven wall thickness that would cause a failure during drilling — and begins the commission set by sorting the chosen pieces into three groups: the limpet caps and large whelks for the belt clasp fittings that require robust wall material capable of bearing a metal pin without fracture, the flat oyster valves for the necklace pendants where a broad reflecting surface is more important than wall strength, and the small cowries for the headband fittings where their naturally polished surface eliminates the polishing stage and the tight aperture allows a secure cord attachment without additional drilling. The drilling work begins with the softest shells to calibrate the drill-tip pressure before moving to the harder whelk material — the tip advanced with a slow steady rotation rather than applied downward force, the shell held against a packed sand bed that absorbs the exit stroke without splitting the base material. Each piece is finished with the burnishing pad, the edges bevelled at a shallow angle that catches the light differently from the flat face and creates the visual depth that distinguishes a well-made shell ornament from a simple perforated disc. The completed set is wrapped in the damp cloth for presentation. −${COMMISSION_FOOD_COST} food −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseShellworkCraft() {
  const a = state.wanderingShellworker;
  if (!a?.active) return { ok: false, reason: 'No shellworker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The shellworker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased shellwork craft from the wandering shellworker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'shellworkerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'shellworkerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_SHELLWORKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪄 The shellwork craft manual opens with shell selection and harvest timing: the best quality shells for ornamental work are collected in the season after the spring tides when the intertidal zone is exposed long enough to allow careful selection rather than rapid gathering, since the value of shell material lies entirely in the quality of each individual piece — a single shell with clean symmetry and consistent wall thickness is worth ten gathered hastily in uncertain conditions. The drilling section details the geometry of the bow drill setup: the flint tip must be centred precisely on the marked hole position before applying rotation, since the first few strokes establish a shallow cone that guides all subsequent work — a tip that begins off-centre will produce a hole that migrates across the shell face and exits at an angle that weakens the surrounding wall. The polishing section explains the sequence of abrasive grades from coarse river sand through fine beach sand to the leather burnishing stage: each grade removes the scratch pattern left by the previous grade rather than removing material directly, so the time spent at each stage is determined by when the previous scratch pattern disappears rather than by a fixed duration. The settlement's craftspeople practise on the spare shell pieces in the tray under the shellworker's guidance, progressing through each stage until a presentable necklace pendant is finished. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendShellworkerAway() {
  const a = state.wanderingShellworker;
  if (!a?.active) return { ok: false, reason: 'No shellworker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SHELLWORKER_CHANGED, { dismissed: true });
  addMessage('🐚 The wandering shellworker covers the tray with its damp cloth, secures the tools in their roll, and continues along the coast road to the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
