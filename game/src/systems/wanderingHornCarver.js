/**
 * EmpireOS — Wandering Horn Carver (T445).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering horn carver
 * arrives at the settlement carrying a satchel of finished pieces worked from
 * cattle horns, deer antler, and wild boar tusk collected over months of
 * patient accumulation from hunters' middens and slaughterhouse discards —
 * each horn blank boiled soft in water before being pressed flat between
 * weighted boards and left to set into useful sheets that can be sawn,
 * filed, and polished into knife handles, spoon bowls, comb teeth, drinking
 * vessels, and decorative inlay panels with a warm amber translucency that
 * no wood or stone can match — capable of carving hunting call horns that
 * carry farther than any wooden instrument, powder flasks that are both
 * waterproof and shock-resistant, and lantern windows thin enough to let
 * through candlelight without cracking in the flame's heat — offering to
 * commission a complete set of horn artifacts for the settlement's workshops
 * and ceremonial halls, or to share the full methods for processing and
 * carving horn that allow the settlement's own craftspeople to work local
 * animal horn into high-quality finished goods. The player has 80 seconds
 * to decide.
 *
 * Choices:
 *   🦌 Commission Horn Artifacts   — pay 20 food + 10 stone
 *        → +0.20 food/s for 2.5 min · +15 prestige · +8 morale
 *   📖 Purchase Horn-Carving Lore  — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.wanderingHornCarver = {
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

export const COMMISSION_FOOD_COST          = 20;
export const COMMISSION_STONE_COST         = 10;
export const COMMISSION_FOOD_RATE          = 0.20;
export const COMMISSION_PRESTIGE_REWARD    = 15;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 10;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingHornCarver() {
  if (!state.wanderingHornCarver) {
    state.wanderingHornCarver = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingHornCarver;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingHornCarverTick() {
  const a = state.wanderingHornCarver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_HORN_CARVER_CHANGED, { expired: true });
      addMessage('🦌 The wandering horn carver wraps the remaining pieces in oiled cloth and departs down the track toward the next settlement.', 'info');
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
  emit(Events.WANDERING_HORN_CARVER_CHANGED, { spawned: true });
  addMessage('🦌 A wandering horn carver arrives at the settlement carrying a satchel of finely worked horn artifacts — knife handles, drinking vessels, decorative inlay panels, and hunting call horns — offering to commission a complete set of horn artifacts for the settlement\'s workshops and ceremonial halls, or to share the full methods for processing and carving horn from local animal stock. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingHornCarver() { return state.wanderingHornCarver?.active ?? null; }
export function getHornCarverSecsLeft() {
  const a = state.wanderingHornCarver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionHornArtifacts() {
  const a = state.wanderingHornCarver;
  if (!a?.active) return { ok: false, reason: 'No horn carver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The horn carver has departed.' };
  if ((state.resources.food  ?? 0) < COMMISSION_FOOD_COST)  return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.food  -= COMMISSION_FOOD_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned horn artifacts from the wandering horn carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'horncarverCommission');
    state.randomEvents.activeModifiers.push({
      id: 'horncarverCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_HORN_CARVER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🦌 The horn carver sets up a small workbench and spends the afternoon filling an order of carved horn goods — knife handles shaped from thick cattle horn with decorative carved grip lines, deep drinking cups turned from a single ox horn with the interior polished mirror-smooth, powder flasks with horn bodies and fitted bone stoppers, and a set of hunting call horns cut and tuned to carry three distinct pitches across open farmland and woodland alike — each piece wrapped in oiled linen and stacked in the settlement's storehouse alongside the grindstones and tool handles — along with a supply of raw blanks boiled soft and pressed flat for the settlement's own horn-working projects. −${COMMISSION_FOOD_COST} food · −${COMMISSION_STONE_COST} stone · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseHornCarvingLore() {
  const a = state.wanderingHornCarver;
  if (!a?.active) return { ok: false, reason: 'No horn carver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The horn carver has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased horn-carving lore from the wandering horn carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'horncarverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'horncarverPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_HORN_CARVER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The horn carver shares the complete methods of the craft — the indicators for selecting horns with the right wall thickness and natural curve for each application, the boiling times and weighting pressures needed to straighten and flatten curved horn into uniform sheets without cracking the keratin structure, the marking and sawing sequence that wastes the least material when cutting handles and comb blanks from the pressed sheet, the file and scraper progression for smoothing the cut faces from coarse to fine without leaving heat marks, and the final polish with pumice and tallow that brings up the amber translucency that distinguishes horn from cheaper bone — enabling the settlement's craftspeople to turn local livestock horn into high-quality finished goods for tools, vessels, and trade. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendHornCarverAway() {
  const a = state.wanderingHornCarver;
  if (!a?.active) return { ok: false, reason: 'No horn carver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_HORN_CARVER_CHANGED, { dismissed: true });
  addMessage('🦌 The wandering horn carver wraps the remaining pieces in oiled cloth and departs with a courteous nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
