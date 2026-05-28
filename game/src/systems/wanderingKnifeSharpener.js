/**
 * EmpireOS — Wandering Knife Sharpener (T431).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a wandering
 * knife sharpener arrives at the settlement carrying a worn leather
 * satchel packed with water stones graded from coarse grit through
 * medium to the fine finishing stone whose surface has been lapped
 * flat so many times the original quarry roughness is entirely gone
 * and replaced by a mirror-smooth face that raises a wire edge on
 * even the most abused blade in three or four careful strokes — a
 * strop of horsehide tacked to a smooth oak board that aligns the
 * wire edge without removing steel — and a set of hand-forged angle
 * guides that hold each blade at the precise bevel angle matching
 * the original grind so that the sharpener restores the geometry
 * the smith intended rather than rounding the secondary bevel into
 * a convex shape that rolls rather than slices — offering to
 * sharpen the settlement's full inventory of iron tools and blades
 * to a working edge that holds through a full season of daily use,
 * or to share the accumulated knowledge of stone selection, angle
 * judgement, and strop technique that allows any settlement smith
 * to maintain cutting edges to a professional standard between visits.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🔪 Sharpen Imperial Tools       — pay 15 iron
 *        → +0.20 iron/s for 2.5 min · +18 prestige · +8 morale
 *   📖 Purchase Sharpening Lore     — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.wanderingKnifeSharpener = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalSharpenings: number,
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

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const SHARPEN_IRON_COST            = 15;
export const SHARPEN_IRON_RATE            = 0.20;
export const SHARPEN_PRESTIGE_REWARD      = 18;
export const SHARPEN_MORALE_REWARD        = 8;
export const SHARPEN_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST           = 18;
export const PURCHASE_GOLD_RATE           = 0.15;
export const PURCHASE_PRESTIGE_REWARD     = 12;
export const PURCHASE_DURATION_TICKS      = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingKnifeSharpener() {
  if (!state.wanderingKnifeSharpener) {
    state.wanderingKnifeSharpener = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalSharpenings: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingKnifeSharpener;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalSharpenings === undefined) s.totalSharpenings = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingKnifeSharpenerTick() {
  const a = state.wanderingKnifeSharpener;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_KNIFE_SHARPENER_CHANGED, { expired: true });
      addMessage('🔪 The wandering knife sharpener repacks the leather satchel of stones, buckles the strop board under one arm, and departs along the road to the next settlement — the faint ringing of the angle guides against each other fading as the figure rounds the market corner and heads toward the valley track.', 'info');
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
  emit(Events.WANDERING_KNIFE_SHARPENER_CHANGED, { spawned: true });
  addMessage('🔪 A wandering knife sharpener arrives at the settlement carrying a leather satchel packed with water stones graded from coarse through medium to a mirror-smooth finishing stone, a horsehide strop tacked to an oak board, and hand-forged angle guides that hold each blade at the precise bevel angle matching the original smith\'s grind — offering to sharpen the settlement\'s full inventory of iron tools to a working edge that holds through a full season of daily use, or to share the accumulated knowledge of stone selection, angle judgement, and strop technique for ongoing self-sufficiency. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingKnifeSharpener() { return state.wanderingKnifeSharpener?.active ?? null; }
export function getKnifeSharpenerSecsLeft() {
  const a = state.wanderingKnifeSharpener?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function sharpenImperialTools() {
  const a = state.wanderingKnifeSharpener;
  if (!a?.active) return { ok: false, reason: 'No knife sharpener present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The knife sharpener has departed.' };
  if ((state.resources.iron ?? 0) < SHARPEN_IRON_COST) return { ok: false, reason: `Need ${SHARPEN_IRON_COST} iron.` };
  state.resources.iron -= SHARPEN_IRON_COST;
  changeMorale(SHARPEN_MORALE_REWARD);
  awardPrestige(SHARPEN_PRESTIGE_REWARD, 'Sharpened imperial tools with the wandering knife sharpener');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'knifeSharpenerSharpen');
    state.randomEvents.activeModifiers.push({
      id: 'knifeSharpenerSharpen', resource: 'iron',
      rateMult: 1 + (SHARPEN_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + SHARPEN_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalSharpenings = (a.totalSharpenings ?? 0) + 1;
  emit(Events.WANDERING_KNIFE_SHARPENER_CHANGED, { sharpened: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔪 The knife sharpener unpacks the full set of stones and works through every blade, cleaver, draw-knife, and scraper in the settlement stores — beginning with the coarse stone to re-establish the bevel on the most worn tools, progressing through the medium stone to refine the scratch pattern until the edge catches the thumbnail cleanly across the full width, finishing on the mirror stone with five strokes per side to raise a wire edge that shaves arm hair without effort, then stropping each blade on the horsehide until the wire rolls away and leaves a keen apex that will hold through daily use across the coming months. Every cutting tool in the settlement emerges from the sharpening session with a working edge that reduces the iron lost to repeated re-grinding and extends the effective life of each tool between rework cycles! −${SHARPEN_IRON_COST} iron · +${SHARPEN_PRESTIGE_REWARD} prestige · +${SHARPEN_MORALE_REWARD} morale. Iron surge: +${SHARPEN_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSharpeningLore() {
  const a = state.wanderingKnifeSharpener;
  if (!a?.active) return { ok: false, reason: 'No knife sharpener present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The knife sharpener has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased sharpening lore from the wandering knife sharpener');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'knifeSharpenerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'knifeSharpenerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_KNIFE_SHARPENER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The knife sharpener shares the accumulated craft knowledge across stone selection, angle judgement, and strop technique — the method for reading a worn bevel under a raking light to identify whether the primary angle has been rounded by previous sharpeners working without guides, the grit sequence that efficiently removes metal on coarse stone without creating a deep scratch pattern that the finer stones must then spend twice as long erasing, the thumb-pressure variation that applies more metal removal to the heel of a long blade without lifting the handle from the flat plane, the strop loading technique using a trace of fine abrasive compound that polishes the apex without introducing a rounded convex profile — knowledge that allows every settlement smith to maintain all cutting tools to a professional standard using nothing more than a good set of stones and consistent angle discipline. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendKnifeSharpenerAway() {
  const a = state.wanderingKnifeSharpener;
  if (!a?.active) return { ok: false, reason: 'No knife sharpener present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_KNIFE_SHARPENER_CHANGED, { dismissed: true });
  addMessage('🔪 The wandering knife sharpener repacks the leather satchel of stones and departs along the road to the next settlement on the seasonal sharpening circuit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
