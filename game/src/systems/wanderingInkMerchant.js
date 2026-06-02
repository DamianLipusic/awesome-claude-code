/**
 * EmpireOS — Wandering Ink Merchant (T481).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering ink merchant
 * arrives at the settlement carrying a set of stone-stoppered clay flasks sealed
 * with beeswax along their rims — each flask labelled with a wax seal impression
 * identifying the pigment source: oak-gall ink ground with iron vitriol and gum
 * arabic, lampblack suspension carried in a linseed oil base, and a red ochre
 * slurry prepared with fish glue for use on smooth plaster surfaces — along with
 * a bundle of sharpened reed pens and a sheet of scraped vellum showing the ink
 * shades in dried test strokes beside notes on the drying time and water resistance
 * of each formula — offering to supply a commission of finished ink to the
 * settlement's scribes and record-keepers, or to teach the ink-making craft so
 * the settlement can prepare its own supply from locally gathered materials.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🖋️ Commission Ink Supply           — pay 20 stone + 15 food
 *        → +0.20 stone/s for 2.5 min · +15 prestige · +8 morale
 *   📜 Purchase Ink-Making Craft        — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                         — dismiss (no reward)
 *
 * state.wanderingInkMerchant = {
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

export const COMMISSION_STONE_COST           = 20;
export const COMMISSION_FOOD_COST            = 15;
export const COMMISSION_STONE_RATE           = 0.20;
export const COMMISSION_PRESTIGE_REWARD      = 15;
export const COMMISSION_MORALE_REWARD        = 8;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST              = 18;
export const PURCHASE_GOLD_RATE              = 0.15;
export const PURCHASE_PRESTIGE_REWARD        = 10;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingInkMerchant() {
  if (!state.wanderingInkMerchant) {
    state.wanderingInkMerchant = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingInkMerchant;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingInkMerchantTick() {
  const a = state.wanderingInkMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_INK_MERCHANT_CHANGED, { expired: true });
      addMessage('🖋️ The wandering ink merchant stoppers the sample flasks, wraps the reed pens in oiled cloth, and continues along the road to the next settlement.', 'info');
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
  emit(Events.WANDERING_INK_MERCHANT_CHANGED, { spawned: true });
  addMessage('🖋️ A wandering ink merchant arrives carrying a set of stone-stoppered clay flasks sealed with beeswax — oak-gall ink, lampblack suspension in linseed oil, and red ochre slurry for plaster surfaces — along with sharpened reed pens and a vellum sheet showing dried test strokes with notes on drying time and water resistance. The merchant offers to supply a commission of finished ink for the settlement\'s scribes, or to teach the ink-making craft so the settlement can prepare its own supply from local materials. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingInkMerchant() { return state.wanderingInkMerchant?.active ?? null; }
export function getInkMerchantSecsLeft() {
  const a = state.wanderingInkMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionInkSupply() {
  const a = state.wanderingInkMerchant;
  if (!a?.active) return { ok: false, reason: 'No ink merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The ink merchant has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.food  -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned ink supply from the wandering ink merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'inkMerchantCommission');
    state.randomEvents.activeModifiers.push({
      id: 'inkMerchantCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_INK_MERCHANT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🖋️ The ink merchant sets the clay flasks in a row on the scribes' workbench and begins the commission in preparation order: the oak-gall ink first, because it requires the longest settling time after the ground oak-gall powder is dissolved in the iron vitriol solution and the gum arabic is stirred in to achieve a working viscosity that flows smoothly from a reed pen tip without pooling at the join between the reed and the pen holder. The merchant tests each batch against the vellum sheet, drawing a series of parallel strokes from the pen tip across the surface and examining the resulting lines for evenness of width and consistency of coverage from the first stroke to the last — adjusting the gum arabic proportion by small additions until the ink flows without drag and dries to a dark, dense line without feathering at the edges. The lampblack suspension goes into the second flask once the first batch is settled, the merchant grinding the lampblack against a flat stone before suspending it in the linseed oil base at a ratio that produces an ink dense enough for inscription on clay tablets but fluid enough to transfer completely from a brush rather than clogging in the bristle base. The settlement's scribes receive the completed commission along with notes on the ink proportions so the formula can be reproduced when the current supply runs low. −${COMMISSION_STONE_COST} stone −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseInkMakingCraft() {
  const a = state.wanderingInkMerchant;
  if (!a?.active) return { ok: false, reason: 'No ink merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The ink merchant has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased ink-making craft from the wandering ink merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'inkMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'inkMerchantPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_INK_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The ink merchant produces a compact manual covering the complete practice of ink preparation from locally available materials: an opening section on material identification describes the oak-gall growths that yield the highest tannin content — those formed on the underside of leaf clusters rather than on branch tissue, harvested in early autumn before the gall fly exits — and the iron-rich spring water sources that can substitute for prepared iron vitriol when the mineral compound is not available from trade. A middle section on formula preparation gives the proportions and mixing sequence for the three principal ink types: the oak-gall iron ink for permanent record-keeping on vellum and parchment, the lampblack suspension for clay tablet inscription and rough-surface marking, and the mineral ochre paste for decorated initials and surface painting on plastered walls. A final practical section describes the tests that confirm a finished ink is ready for use: the flow test on a scrap vellum strip that reveals any gumminess or drag in the formula before the ink reaches the finished document, and the water-resistance test after drying that indicates whether the gum proportion is sufficient to bind the pigment permanently to the writing surface. The settlement's scribes work through the preparation of a small test batch from each formula, adjusting proportions against the sample standards before committing the results to the settlement's ink stores. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendInkMerchantAway() {
  const a = state.wanderingInkMerchant;
  if (!a?.active) return { ok: false, reason: 'No ink merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_INK_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🖋️ The wandering ink merchant stoppers the sample flasks, wraps the reed pens in oiled cloth, and continues along the road to the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
