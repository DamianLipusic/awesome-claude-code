/**
 * EmpireOS — Imperial Silk Dyer (T450).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), an imperial silk
 * dyer arrives at the settlement carrying a set of sealed ceramic jars
 * containing prepared dyestuffs — a deep indigo paste extracted from woad
 * leaves fermented in a limestone vat, a brilliant crimson powder ground
 * from dried kermes insects harvested from the Mediterranean oak scrub, a
 * rich ochre made by roasting iron-bearing clay nodules at controlled
 * temperatures, and a violet mordant solution of alum and fermented grape
 * must that fixes all of the above colours permanently in silk thread and
 * woven cloth without fading in wash water or sunlight — along with a set
 * of graduated copper dye vats, a bundle of sample silk panels showing the
 * achievable colour range, and a complete set of mordanting charts mapping
 * temperature, time, and concentration to final shade, offering to commission
 * a full run of imperial silk dyes that will supply the settlement's weavers
 * and tailors with pre-dyed thread in the imperial colour palette for the
 * next season, or to purchase the complete mordanting and dyeing methods
 * allowing the settlement's own dyers to prepare the full colour range from
 * local and traded ingredients without specialist assistance. The player has
 * 80 seconds to decide.
 *
 * Choices:
 *   🎨 Commission Imperial Silk Dyes  — pay 25 mana + 20 gold
 *        → +0.22 mana/s for 2.5 min · +22 prestige · +12 morale
 *   📖 Purchase Dyeing Techniques     — pay 20 wood
 *        → +0.18 wood/s for 2 min · +15 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.imperialSilkDyer = {
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

export const COMMISSION_MANA_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_MANA_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST            = 20;
export const PURCHASE_WOOD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSilkDyer() {
  if (!state.imperialSilkDyer) {
    state.imperialSilkDyer = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialSilkDyer;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialSilkDyerTick() {
  const a = state.imperialSilkDyer;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SILK_DYER_CHANGED, { expired: true });
      addMessage('🎨 The imperial silk dyer seals the ceramic dye jars, wraps the copper vats in oiled cloth, and departs toward the next commission in the capital district.', 'info');
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
  emit(Events.IMPERIAL_SILK_DYER_CHANGED, { spawned: true });
  addMessage('🎨 An imperial silk dyer arrives at the settlement carrying sealed ceramic jars of prepared dyestuffs — indigo paste from fermented woad, crimson powder from dried kermes insects, rich ochre from roasted iron clay, and a violet mordant solution — along with copper dye vats, silk colour sample panels, and complete mordanting charts, offering to commission a full run of imperial silk dyes for the settlement\'s weavers, or to purchase the complete dyeing and mordanting methods. Respond within 80 seconds.', 'info');
}

export function getActiveImperialSilkDyer() { return state.imperialSilkDyer?.active ?? null; }
export function getSilkDyerSecsLeft() {
  const a = state.imperialSilkDyer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialSilkDyes() {
  const a = state.imperialSilkDyer;
  if (!a?.active) return { ok: false, reason: 'No silk dyer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The silk dyer has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial silk dyes from the imperial silk dyer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'silkdyerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'silkdyerCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SILK_DYER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The imperial silk dyer sets up the copper dye vats in the courtyard and works through the full colour sequence — filling the largest vat with the woad indigo paste dissolved in heated water and wetted with the alum mordant solution, drawing the silk skeins through in slow passes so the dye penetrates to the core fibres before the threads are rinsed in cold running water and hung to oxidise in the air until the colour deepens from pale green to true indigo blue, then repeating the sequence for the kermes crimson in a separate vat at a lower temperature with a tin mordant that shifts the shade toward the pure imperial red, and finishing with the ochre yellow in the smallest vat as a base layer for the violet threads that will be overdyed with the residual indigo bath — producing a complete set of pre-dyed silk skeins in the five imperial colours that the settlement's weavers and tailors can work with directly without additional dyeing. −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseDyeingTechniques() {
  const a = state.imperialSilkDyer;
  if (!a?.active) return { ok: false, reason: 'No silk dyer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The silk dyer has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased dyeing techniques from the imperial silk dyer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'silkdyerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'silkdyerPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SILK_DYER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The imperial silk dyer shares the complete mordanting and dyeing methods — the woad fermentation sequence that converts the raw leaf pigment from its water-insoluble precursor form into the soluble leuco-indigo that penetrates silk fibres and then re-oxidises to the stable insoluble blue on contact with air, the kermes extraction and standardisation process that produces a consistent crimson concentration from batches of dried insects that vary in pigment content by season and origin, the alum mordanting ratios for each dyestuff that create a permanent ionic bond between dye molecule and silk fibre so the colour survives repeated washing in cold water, the temperature control markers for each dye bath that prevent the silk protein from denaturing and losing lustre, and the overdyeing sequences for producing secondary colours including the violet that requires an alum-mordanted indigo base followed by an unmordanted kermes topcoat — enabling the settlement's own dyers to reproduce the full imperial colour palette from traded raw materials without specialist assistance. −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSilkDyerAway() {
  const a = state.imperialSilkDyer;
  if (!a?.active) return { ok: false, reason: 'No silk dyer present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SILK_DYER_CHANGED, { dismissed: true });
  addMessage('🎨 The imperial silk dyer seals the ceramic dye jars and departs with a courteous bow.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
