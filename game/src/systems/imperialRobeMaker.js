/**
 * EmpireOS — Imperial Robe Maker (T422).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), an imperial robe
 * maker arrives at the palace carrying bolts of richly dyed woollen cloth,
 * lengths of imported silk brocade trimmed with fur from the northern trade
 * routes, embroidered ceremonial mantles stitched with gold and silver
 * thread, fitted court robes lined with fine linen, and pattern cards showing
 * the precise measurements and cutting lines for every rank from palace
 * scholar to imperial chancellor — offering to commission a full collection
 * of ceremonial robes for the court and palace staff, or to purchase a bolt
 * of fine fabric that raises the morale of palace workers and courtiers.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🎭 Commission Imperial Robes  — pay 25 mana + 20 gold
 *        → +0.22 mana/s for 2.5 min · +20 prestige · +10 morale
 *   🧵 Purchase Fine Fabrics      — pay 20 food
 *        → +0.18 food/s for 2 min · +15 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.imperialRobeMaker = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_MANA_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 20;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST            = 20;
export const PURCHASE_FOOD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialRobeMaker() {
  if (!state.imperialRobeMaker) {
    state.imperialRobeMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialRobeMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialRobeMakerTick() {
  const a = state.imperialRobeMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_ROBE_MAKER_CHANGED, { expired: true });
      addMessage('🎭 The imperial robe maker re-folds the silk brocade bolts, rolls the embroidered mantles into their linen travel cases, and departs the palace tailoring chamber — the faint rustle of fine fabric and scent of beeswax thread dressing fading as the cart rolls through the palace gate.', 'info');
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
  emit(Events.IMPERIAL_ROBE_MAKER_CHANGED, { spawned: true });
  addMessage('🎭 An imperial robe maker arrives at the palace carrying bolts of richly dyed woollen cloth, lengths of imported silk brocade trimmed with northern fur, embroidered ceremonial mantles stitched with gold and silver thread, and fitted court robes lined with fine linen — offering to commission a full ceremonial collection for the palace court and scholarly staff, or to sell a bolt of fine fabric that lifts the spirit of every courtier and palace worker. Respond within 80 seconds.', 'info');
}

export function getActiveImperialRobeMaker() { return state.imperialRobeMaker?.active ?? null; }
export function getRobeMakerSecsLeft() {
  const a = state.imperialRobeMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialRobes() {
  const a = state.imperialRobeMaker;
  if (!a?.active) return { ok: false, reason: 'No robe maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The robe maker has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial robes from the imperial robe maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'robemakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'robemakerCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_ROBE_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎭 The robe maker unrolls the silk brocade, measures and cuts each ceremonial mantle to the precise rank-appropriate pattern, stitches gold and silver thread along every hem and cuff in the imperial heraldic motif, lines each fitted court robe with smooth linen, and delivers the complete collection to the palace chancellor, the chief scholar, the court herald, and each senior palace official — the splendid regalia raising the prestige of every public ceremony and inspiring the scholarly output of palace researchers who now conduct their studies in properly dignified court attire! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseFineFabrics() {
  const a = state.imperialRobeMaker;
  if (!a?.active) return { ok: false, reason: 'No robe maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The robe maker has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased fine fabrics from the imperial robe maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'robemakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'robemakerPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_ROBE_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧵 The robe maker cuts a length of richly dyed woollen cloth from the main bolt — deep crimson with a narrow gold selvedge — and distributes it among the palace weavers, market stall keepers, and senior craftsmen who sew new working tunics, festival garments, and presentation cloaks from the premium cloth, the improved daily dress lifting the collective dignity and workplace pride of every craftsman and trader who wears a garment cut from the imperial bolt! −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendRobeMakerAway() {
  const a = state.imperialRobeMaker;
  if (!a?.active) return { ok: false, reason: 'No robe maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_ROBE_MAKER_CHANGED, { dismissed: true });
  addMessage('🎭 The imperial robe maker re-folds the silk brocade bolts, rolls the ceremonial mantles back into their travel cases, and departs the palace — bowing politely before the tailoring cart rolls away through the gatehouse arch.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
