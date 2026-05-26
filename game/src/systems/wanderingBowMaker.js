/**
 * EmpireOS — Wandering Bow Maker (T411).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a wandering bow maker
 * arrives at the palace bearing long-stave yew blanks, ox-horn tip laminates,
 * waxed linen strings, and a kit of drawknives, spokeshaves, and fletching
 * jigs — offering to craft a full consignment of war-grade composite longbows
 * for the imperial archer corps, or to share the specialist stave-selection,
 * moisture-tempering, and tension-calibration secrets that produce the most
 * powerful and accurate bows in the known world. The player has 80 seconds to decide.
 *
 * Choices:
 *   🏹 Commission Imperial Longbows   — pay 25 wood + 15 iron
 *        → +0.22 wood/s for 2.5 min · +20 prestige · +10 morale
 *   🪵 Purchase Bowyer Secrets        — pay 20 gold
 *        → +0.15 iron/s for 2 min · +15 prestige
 *   🚶 Send Away                       — dismiss (no reward)
 *
 * state.wanderingBowMaker = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalPurchased:     number,
 *   totalDismissals:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_WOOD_COST          = 25;
export const COMMISSION_IRON_COST          = 15;
export const COMMISSION_WOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 20;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 20;
export const PURCHASE_IRON_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingBowMaker() {
  if (!state.wanderingBowMaker) {
    state.wanderingBowMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchased:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingBowMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchased   === undefined) s.totalPurchased   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingBowMakerTick() {
  const a = state.wanderingBowMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_BOW_MAKER_CHANGED, { expired: true });
      addMessage('🏹 The wandering bow maker slides the long-stave yew blanks back into their oilcloth wraps, secures the ox-horn tip laminates and fletching jigs in the travelling chest, and departs the palace — the bow commission and bowyer-secrets offer passing unrealised as the cart of drawknives and spokeshaves disappears down the gatehouse road.', 'info');
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
  emit(Events.WANDERING_BOW_MAKER_CHANGED, { spawned: true });
  addMessage('🏹 A wandering bow maker arrives at the palace bearing long-stave yew blanks, ox-horn tip laminates, waxed linen strings, and a kit of drawknives, spokeshaves, and fletching jigs — offering to craft a full consignment of war-grade composite longbows for the imperial archer corps, or to share the specialist stave-selection, moisture-tempering, and tension-calibration secrets that produce the most powerful and accurate bows in the known world. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingBowMaker() { return state.wanderingBowMaker?.active ?? null; }
export function getBowMakerSecsLeft() {
  const a = state.wanderingBowMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialLongbows() {
  const a = state.wanderingBowMaker;
  if (!a?.active) return { ok: false, reason: 'No bow maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bow maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.iron -= COMMISSION_IRON_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial longbows from the wandering bow maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bowmakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'bowmakerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_BOW_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏹 The bow maker lays the long-stave yew blanks across the workshop trestles, pulling each stave through a heated bending frame to work out the grain-tension before scribing the precise taper profile with a marking awl — ox-horn tips are fitted, lapped with iron-reinforced bindings, and each finished longbow is strung with a waxed linen string tested at full draw against a measured force-gauge, delivering the imperial archers the most powerful war bows ever issued from the palace armoury and raising the production capacity of every timber stockpile feeding the fletcher's workshop! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_IRON_COST} iron · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseBoyerSecrets() {
  const a = state.wanderingBowMaker;
  if (!a?.active) return { ok: false, reason: 'No bow maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bow maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased bowyer secrets from the wandering bow maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bowmakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'bowmakerPurchase', resource: 'iron',
      rateMult: 1 + (PURCHASE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.WANDERING_BOW_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The bow maker opens the annotated stave-grading ledger and explains the moisture-content readings, ring-density assessments, and sapwood-to-heartwood ratios that separate a battlefield-grade longbow stave from inferior timber — the palace smiths and armourers absorb the precision metalwork tolerances used in iron-reinforced bow fittings and immediately begin applying the same exacting material-selection principles to the iron stock entering the forge, raising the yield efficiency of every ore-processing and toolmaking operation across the armoury! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Iron surge: +${PURCHASE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBowMakerAway() {
  const a = state.wanderingBowMaker;
  if (!a?.active) return { ok: false, reason: 'No bow maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_BOW_MAKER_CHANGED, { dismissed: true });
  addMessage('🏹 The wandering bow maker rewraps the long-stave yew blanks in their oilcloth covers, bundles the ox-horn tip laminates back into the travelling chest alongside the fletching jigs and spokeshaves, and departs the palace — the soft creak of the bow press fading as the artisan\'s cart rolls out through the gatehouse.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
