/**
 * EmpireOS — Imperial Fresco Painter (T432).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), an imperial
 * fresco painter arrives at the settlement carrying a set of ox-hair
 * brushes packed in a wooden case lined with raw fleece to protect
 * the bristle ends from deformation during travel — brushes ranging
 * from the broad flat brush used to apply the intonaco scratch coat
 * and the coarser arriccio below it, through medium rounds for the
 * main figure outlines laid in sinopia on the dry wall before
 * plastering, down to the finest point brush whose bristles taper
 * to a single hair width for the gold-leaf detail work and the
 * catchlight placed in each eye to bring the figure to life — along
 * with a full set of dry pigments ground to the particle size that
 * bonds permanently into the wet lime plaster as it carbonates
 * rather than sitting on the surface where it can be abraded away
 * by damp cloth or condensation — offering to paint a full programme
 * of imperial frescoes across the great hall walls in the buon fresco
 * method that will remain legible for centuries, or to share the
 * accumulated knowledge of plaster preparation, pigment selection,
 * and brushwork sequence that allows any trained wall-painter to
 * produce durable images of the highest quality from local materials.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🖌️ Commission Imperial Frescoes   — pay 25 mana + 20 gold
 *        → +0.22 mana/s for 2.5 min · +22 prestige · +10 morale
 *   📖 Purchase Painting Techniques   — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                       — dismiss (no reward)
 *
 * state.imperialFrescoPainter = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST            = 25;
export const COMMISSION_GOLD_COST            = 20;
export const COMMISSION_MANA_RATE            = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 22;
export const COMMISSION_MORALE_REWARD        = 10;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST             = 20;
export const PURCHASE_STONE_RATE             = 0.18;
export const PURCHASE_PRESTIGE_REWARD        = 15;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialFrescoPainter() {
  if (!state.imperialFrescoPainter) {
    state.imperialFrescoPainter = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialFrescoPainter;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialFrescoPainterTick() {
  const a = state.imperialFrescoPainter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_FRESCO_PAINTER_CHANGED, { expired: true });
      addMessage('🖌️ The imperial fresco painter repacks the ox-hair brushes in the fleece-lined case and the dry pigments in their stoppered clay pots, hoists the painted reference scrolls under one arm, and departs toward the next commission awaiting across the mountains — the faint smell of slaked lime in the air the only trace of the visit.', 'info');
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
  emit(Events.IMPERIAL_FRESCO_PAINTER_CHANGED, { spawned: true });
  addMessage('🖌️ An imperial fresco painter arrives at the settlement carrying ox-hair brushes packed in a fleece-lined wooden case — ranging from the broad flat brush for arriccio and intonaco plaster coats through medium rounds for sinopia outlines, down to the finest point brush for gold-leaf detail work — along with dry pigments ground to the particle size that bonds permanently into wet lime plaster as it carbonates, together with reference scrolls showing imperial iconographic programmes in the buon fresco method — offering to paint a full programme of imperial frescoes across the great hall walls that will remain legible for centuries, or to share the accumulated craft knowledge of plaster preparation, pigment selection, and brushwork sequence for ongoing self-sufficiency. Respond within 80 seconds.', 'info');
}

export function getActiveImperialFrescoPainter() { return state.imperialFrescoPainter?.active ?? null; }
export function getFrescoPainterSecsLeft() {
  const a = state.imperialFrescoPainter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialFrescoes() {
  const a = state.imperialFrescoPainter;
  if (!a?.active) return { ok: false, reason: 'No fresco painter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The fresco painter has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial frescoes from the fresco painter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'frescoPainterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'frescoPainterCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_FRESCO_PAINTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🖌️ The fresco painter prepares the great hall walls through a full sequence of plaster coats — first the arriccio mixed with crushed terracotta aggregate for adhesion and crack resistance, then the smooth intonaco applied in daily giornata sections precisely sized to what can be painted before the lime surface carbonates and closes to new pigment — drawing the sinopia composition outline in iron-oxide red on each section before plastering so the design remains visible through the wet coat, then working section by section from the upper register downward applying pigment ground to the fineness that bonds permanently into the lime matrix as it sets, the gold-leaf detail work and the fine catchlight strokes in the eyes completed last with the point brush — the completed programme covering every wall surface of the great hall with images that will remain vivid and legible across the coming centuries without fading or flaking! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchasePaintingTechniques() {
  const a = state.imperialFrescoPainter;
  if (!a?.active) return { ok: false, reason: 'No fresco painter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The fresco painter has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased painting techniques from the imperial fresco painter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'frescoPainterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'frescoPainterPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_FRESCO_PAINTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The fresco painter shares the accumulated craft knowledge spanning plaster preparation, pigment selection, and brushwork sequence — the lime-slaking method that produces putty aged long enough for the calcium hydroxide crystals to be fully hydrated before application so the intonaco coat achieves maximum density and minimum shrinkage cracking, the aggregate grading that produces an arriccio coat rough enough to key the intonaco without being so coarse that it telegraphs through the surface layer, the particle-size testing for each pigment that identifies whether the ground material is fine enough to bond into the carbonating matrix or coarse enough to sit loose on the surface where damp will gradually undermine it, the giornata sizing method that matches each daily section to the precise area that can be fully painted before the lime closes — knowledge that allows any trained wall-painter to produce durable images of the highest quality from materials available at any well-supplied settlement. −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendFrescoPainterAway() {
  const a = state.imperialFrescoPainter;
  if (!a?.active) return { ok: false, reason: 'No fresco painter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_FRESCO_PAINTER_CHANGED, { dismissed: true });
  addMessage('🖌️ The imperial fresco painter repacks the ox-hair brushes and dry pigments and departs toward the next commission awaiting in the next province.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
