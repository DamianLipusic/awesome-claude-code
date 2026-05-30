/**
 * EmpireOS — Imperial Carpet Maker (T458).
 *
 * Every 15–20 minutes (Medieval Age+, 10+ player tiles), an imperial carpet
 * maker arrives at the settlement with a display of hand-knotted carpet samples —
 * each sample mounted on a rigid backing board showing a section of the repeating
 * pattern in full colour, with the back of the sample exposed to reveal the knot
 * structure: the individual woollen tufts tied one by one around pairs of warp
 * threads using the symmetrical Ghiordes knot, then packed down firmly with a
 * heavy iron comb before the next row of wefts is inserted to lock the knots in
 * position, producing a pile surface where every square decimetre contains several
 * hundred individual knots — offering to accept a commission for a set of imperial
 * carpets woven to the settlement's required dimensions and heraldic colours, paid
 * for partly in mana from the arcane knowledge embedded in the design symbols, or
 * to provide instruction in the knotting and dyeing techniques that would allow
 * the settlement's own craftspeople to establish a carpet-making workshop capable
 * of producing high-value goods for export. The player has 80 seconds to decide.
 *
 * Choices:
 *   🎨 Commission Imperial Carpets     — pay 25 mana + 20 gold
 *        → +0.22 mana/s for 2.5 min · +22 prestige · +12 morale
 *   📚 Purchase Knotting Techniques    — pay 20 food
 *        → +0.18 food/s for 2 min · +15 prestige
 *   🚶 Send Away                       — dismiss (no reward)
 *
 * state.imperialCarpetMaker = {
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

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST            = 25;
export const COMMISSION_GOLD_COST            = 20;
export const COMMISSION_MANA_RATE            = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 22;
export const COMMISSION_MORALE_REWARD        = 12;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST              = 20;
export const PURCHASE_FOOD_RATE              = 0.18;
export const PURCHASE_PRESTIGE_REWARD        = 15;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialCarpetMaker() {
  if (!state.imperialCarpetMaker) {
    state.imperialCarpetMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialCarpetMaker;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialCarpetMakerTick() {
  const a = state.imperialCarpetMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_CARPET_MAKER_CHANGED, { expired: true });
      addMessage('🎨 The imperial carpet maker carefully rolls up the pattern sample boards, wraps the finest carpet samples in heavy linen, and departs to the next client settlement carrying the full weight of the commission portfolio.', 'info');
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
  emit(Events.IMPERIAL_CARPET_MAKER_CHANGED, { spawned: true });
  addMessage('🎨 An imperial carpet maker arrives at the settlement with mounted samples of hand-knotted carpets — each sample board showing a section of repeating pattern in full colour, with the back exposed to reveal the Ghiordes knot structure, individual woollen tufts tied around warp thread pairs and packed with an iron comb — offering to commission a set of imperial carpets woven to required dimensions and heraldic colours, or to provide full knotting and dyeing technique instruction to establish a local carpet workshop. Respond within 80 seconds.', 'info');
}

export function getActiveImperialCarpetMaker() { return state.imperialCarpetMaker?.active ?? null; }
export function getCarpetMakerSecsLeft() {
  const a = state.imperialCarpetMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialCarpets() {
  const a = state.imperialCarpetMaker;
  if (!a?.active) return { ok: false, reason: 'No carpet maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The carpet maker has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial carpets from the carpet maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'carpetmakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'carpetmakerCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_CARPET_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The carpet maker examines the settlement's heraldic devices with evident professional interest — measuring the proportions of the principal charge and the field divisions using a calibrated folding rule, making detailed colour notes with ground mineral pigments mixed to match each tincture exactly, and sketching the full cartoon for the central medallion that will anchor the repeating border pattern — then confirms the commission specifications: the main hall carpet to be woven in a seven-colour palette on a hand-spun wool pile at four hundred and fifty knots per decimetre, with the settlement's primary symbol centred in each panel, framed by a double guard border in the contrasting field colour, the whole composition calculated so the pattern repeat falls correctly at each room dimension. The arcane symbols woven into the border acknowledge the settlement's accumulated wisdom in the craft. −${COMMISSION_MANA_COST} mana −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseKnottingTechniques() {
  const a = state.imperialCarpetMaker;
  if (!a?.active) return { ok: false, reason: 'No carpet maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The carpet maker has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased knotting techniques from the imperial carpet maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'carpetmakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'carpetmakerPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_CARPET_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📚 The carpet maker spreads out a comprehensive technical manual across the counting table — organised by the stages of carpet production from wool selection and preparation through spinning and dyeing to warping the loom, inserting the warp chain, setting the tension correctly, and then the knotting sequence itself: the left hand holding a bundle of cut woollen tufts at the correct length while the right hand passes each tuft under and around the appropriate pair of warp threads and pulls it tight to form the symmetrical Ghiordes knot that gives the pile its density and resistance to wear, row by row and pattern unit by pattern unit, with the cartoon diagram pinned at eye level as a guide — along with the mordant recipes and plant dye combinations that produce the most stable colours, and the finishing processes of washing, stretching, and trimming the pile to an even height that give a finished carpet its characteristic lustre. −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCarpetMakerAway() {
  const a = state.imperialCarpetMaker;
  if (!a?.active) return { ok: false, reason: 'No carpet maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_CARPET_MAKER_CHANGED, { dismissed: true });
  addMessage('🎨 The imperial carpet maker rolls up the sample boards and departs to the next settlement with the commission portfolio.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
