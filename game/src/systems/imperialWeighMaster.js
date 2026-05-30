/**
 * EmpireOS — Imperial Weigh Master (T452).
 *
 * Every 15–19 minutes (Medieval Age+, 10+ player tiles), an imperial weigh
 * master arrives at the settlement carrying a set of sealed bronze reference
 * weights — a complete sequence from the standard grain weight through the
 * talent, each piece individually stamped with the imperial seal and inscribed
 * with the calibration date and the name of the chief assay officer who
 * certified it against the master weights held in the imperial treasury at
 * the capital — along with a folding bronze balance beam with agate pivot
 * bearings, a set of iron beam weights for the market scales, an official
 * copy of the imperial weights and measures ordinance setting out the legal
 * penalties for short measurement and the inspection schedule for registered
 * traders, and a wax seal kit for marking certified measuring vessels, offering
 * to commission a full set of imperial standard scales and certified weights
 * for the settlement's market and treasury operations, or to purchase the
 * complete standardisation and calibration methods allowing the settlement's
 * own officials to verify and certify measuring equipment without sending to
 * the capital for an assay inspector. The player has 80 seconds to decide.
 *
 * Choices:
 *   ⚖️  Commission Imperial Scales      — pay 25 iron + 20 gold
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +10 morale
 *   📖 Purchase Standardized Measures  — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.imperialWeighMaster = {
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_IRON_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_MANA_COST            = 20;
export const PURCHASE_MANA_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialWeighMaster() {
  if (!state.imperialWeighMaster) {
    state.imperialWeighMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialWeighMaster;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialWeighMasterTick() {
  const a = state.imperialWeighMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_WEIGH_MASTER_CHANGED, { expired: true });
      addMessage('⚖️ The imperial weigh master carefully packs the bronze reference weights back into the padded leather case and departs for the next settlement on the inspection circuit.', 'info');
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
  emit(Events.IMPERIAL_WEIGH_MASTER_CHANGED, { spawned: true });
  addMessage('⚖️ An imperial weigh master arrives at the settlement carrying sealed bronze reference weights stamped with the imperial seal, a folding balance beam with agate pivot bearings, iron beam weights for the market scales, and the official weights and measures ordinance, offering to commission a full set of imperial standard scales and certified weights for the market and treasury, or to purchase the complete standardisation and calibration methods. Respond within 80 seconds.', 'info');
}

export function getActiveImperialWeighMaster() { return state.imperialWeighMaster?.active ?? null; }
export function getWeighMasterSecsLeft() {
  const a = state.imperialWeighMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialScales() {
  const a = state.imperialWeighMaster;
  if (!a?.active) return { ok: false, reason: 'No weigh master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The weigh master has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial scales from the imperial weigh master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'weighmasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'weighmasterCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_WEIGH_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚖️ The imperial weigh master works methodically through the settlement's market stalls and treasury, calibrating each pan balance against the sealed reference weights and adjusting the beam pivot angles until the empty arms hang level within the tolerance specified in the ordinance, then casting new iron beam weights to match the standard denominations, stamping each with the imperial certification mark and the current year, and finally sealing the market's dry-measure vessels with the official clay seal that identifies them as certified to the imperial grain standard — producing a complete set of certified measuring equipment for the market, treasury, and granary operations and registering the settlement in the imperial assay records as an officially compliant trading post. −${COMMISSION_IRON_COST} iron · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseStandardizedMeasures() {
  const a = state.imperialWeighMaster;
  if (!a?.active) return { ok: false, reason: 'No weigh master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The weigh master has departed.' };
  if ((state.resources.mana ?? 0) < PURCHASE_MANA_COST) return { ok: false, reason: `Need ${PURCHASE_MANA_COST} mana.` };
  state.resources.mana -= PURCHASE_MANA_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased standardized measures from the imperial weigh master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'weighmasterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'weighmasterPurchase', resource: 'mana',
      rateMult: 1 + (PURCHASE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_WEIGH_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The imperial weigh master shares the complete standardisation and calibration methods — the pivot-levelling procedure for beam balances using a plumb bob to establish true vertical before adjusting the beam arm lengths so that the pivot point lies exactly on the centreline of the loaded beam, the weight-casting technique for producing iron denominations accurate to within the half-grain tolerance specified in the ordinance by using bronze pattern moulds calibrated against the sealed reference weights and filing the cast pieces to final weight rather than trying to cast them precisely, the dry-measure sealing method using the specific clay and sand mixture that produces an impression sharp enough to show the full detail of the certification seal but soft enough to be pressed by hand without a screw press, and the annual recalibration schedule and record-keeping system that allows settlement officials to demonstrate ongoing compliance to imperial inspectors without requiring a specialist assay visit. −${PURCHASE_MANA_COST} mana · +${PURCHASE_PRESTIGE_REWARD} prestige. Mana surge: +${PURCHASE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendWeighMasterAway() {
  const a = state.imperialWeighMaster;
  if (!a?.active) return { ok: false, reason: 'No weigh master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_WEIGH_MASTER_CHANGED, { dismissed: true });
  addMessage('⚖️ The imperial weigh master packs the reference weights carefully and departs with a formal bow.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
