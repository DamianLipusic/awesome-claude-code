/**
 * EmpireOS — Wandering Amber Carver (T449).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering amber
 * carver arrives at the settlement carrying a leather satchel of raw Baltic
 * amber nodules — irregular lumps of fossilised tree resin ranging from
 * pale lemon yellow through deep cognac orange to rare cloudy white, some
 * containing perfectly preserved insects and plant fragments trapped millions
 * of years before the settlement was founded — along with a set of graduated
 * copper burins, a fine-grained sandstone grinding block, and a collection
 * of finished pieces including pendants, gaming counters, decorative pommel
 * caps, and a pair of amber-inlaid bracelet cuffs, offering to commission a
 * full set of amber ornaments and amulets for the settlement's nobles and
 * merchants to wear and gift as marks of status, or to share the complete
 * carving and polishing methods that allow the settlement's own craft workers
 * to source and work Baltic amber from the northern trade routes without
 * waiting for a travelling specialist. The player has 80 seconds to decide.
 *
 * Choices:
 *   🪨 Commission Amber Ornaments    — pay 20 stone + 15 gold
 *        → +0.22 stone/s for 2.5 min · +18 prestige · +8 morale
 *   📖 Purchase Amber Carving Lore   — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.wanderingAmberCarver = {
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

export const COMMISSION_STONE_COST         = 20;
export const COMMISSION_GOLD_COST          = 15;
export const COMMISSION_STONE_RATE         = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 18;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 18;
export const PURCHASE_GOLD_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingAmberCarver() {
  if (!state.wanderingAmberCarver) {
    state.wanderingAmberCarver = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingAmberCarver;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingAmberCarverTick() {
  const a = state.wanderingAmberCarver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_AMBER_CARVER_CHANGED, { expired: true });
      addMessage('🪨 The wandering amber carver packs the remaining raw nodules back into the leather satchel and departs along the northern road toward the next settlement.', 'info');
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
  emit(Events.WANDERING_AMBER_CARVER_CHANGED, { spawned: true });
  addMessage('🪨 A wandering amber carver arrives at the settlement carrying a leather satchel of raw Baltic amber nodules — irregular lumps of fossilised resin in shades from pale lemon to deep cognac — along with copper burins, a sandstone grinding block, and finished pieces including pendants, gaming counters, and amber-inlaid bracelet cuffs, offering to commission a full set of amber ornaments for the settlement\'s nobles, or to share the complete carving and polishing methods. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingAmberCarver() { return state.wanderingAmberCarver?.active ?? null; }
export function getAmberCarverSecsLeft() {
  const a = state.wanderingAmberCarver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionAmberOrnaments() {
  const a = state.wanderingAmberCarver;
  if (!a?.active) return { ok: false, reason: 'No amber carver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The amber carver has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned amber ornaments from the wandering amber carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'ambercarverCommission');
    state.randomEvents.activeModifiers.push({
      id: 'ambercarverCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_AMBER_CARVER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪨 The amber carver sets up a low work bench in the settlement courtyard and spends the morning rough-shaping each nodule with a copper burin before moving to progressively finer sandstone blocks for grinding and a final polish with a scrap of dampened woollen cloth and powdered chalk — producing a set of graduated pendants drilled at the suspension point with a bronze awl, a dozen flat gaming counters with incised ring-and-dot patterns on the reverse, decorative pommel caps for the marshal's ceremonial sword and two senior officers' daggers, and a pair of matched bracelet cuffs with amber bosses set into shaped bone bezels — each piece wrapped individually in linen cloth and delivered to the great hall stores for distribution as gifts and diplomatic tokens. −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseAmberCarvingLore() {
  const a = state.wanderingAmberCarver;
  if (!a?.active) return { ok: false, reason: 'No amber carver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The amber carver has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased amber carving lore from the wandering amber carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'ambercarverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'ambercarverPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_AMBER_CARVER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The amber carver shares the full working methods — the visual tests that distinguish high-quality Baltic amber from local tree resins and from the various amber-coloured minerals that northern merchants sometimes substitute, the burin angles and stroke directions that prevent the brittle resin from fracturing along internal stress lines, the correct abrasive sequence from coarse sandstone through limestone through fine chalk that removes tool marks without generating excessive heat from friction that would cloud the surface, the drilling approach using a weighted bow-drill with a bronze awl point wetted with beeswax so the stone powder is continuously cleared from the cutting edge, and the final cold-polishing technique with chalk powder on dampened wool that brings out the deep internal colour without dulling the surface — enabling the settlement's craft workers to work Baltic amber purchased through the northern trade routes without specialist assistance. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendAmberCarverAway() {
  const a = state.wanderingAmberCarver;
  if (!a?.active) return { ok: false, reason: 'No amber carver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_AMBER_CARVER_CHANGED, { dismissed: true });
  addMessage('🪨 The wandering amber carver packs the raw nodules back into the leather satchel and departs with a courteous nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
