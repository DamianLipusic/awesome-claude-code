/**
 * EmpireOS — Imperial Siege Master (T362).
 *
 * Every 15–19 minutes (Iron Age+, 12+ player tiles), a legendary siege
 * master arrives with blueprints for advanced war engines and fortifications.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ⚔️ Commission War Engines — pay 30 iron + 20 wood
 *        → +0.22 iron/s for 2.5 min · +25 prestige · +10 morale
 *   📜 Purchase Siege Plans   — pay 25 gold
 *        → +0.18 gold/s for 2 min · +18 prestige
 *   👋 Send Away              — dismiss (no reward)
 *
 * state.imperialSiegeMaster = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
 *   totalPurchases:    number,
 *   totalDismissals:   number,
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
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_IRON_COST          = 30;
export const COMMISSION_WOOD_COST          = 20;
export const COMMISSION_IRON_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 25;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 25;
export const PURCHASE_GOLD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 18;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSiegeMaster() {
  if (!state.imperialSiegeMaster) {
    state.imperialSiegeMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialSiegeMaster;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialSiegeMasterTick() {
  const a = state.imperialSiegeMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SIEGE_MASTER_CHANGED, { expired: true });
      addMessage('⚔️ The siege master rolls the great parchment blueprints back into their leather tube, straps on the riding pack, and departs for distant campaigns — the sound of iron-shod boots fades down the road as the opportunity passes.', 'info');
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
  emit(Events.IMPERIAL_SIEGE_MASTER_CHANGED, { spawned: true });
  addMessage('⚔️ A legendary imperial siege master arrives at the garrison, bearing rolled parchment blueprints for devastating war engines, reinforced catapults, and siege tower designs refined over decades of campaigning. They offer to oversee the construction of advanced war machinery or to sell their plans to the imperial archive. Respond within 80 seconds.', 'info');
}

export function getActiveImperialSiegeMaster() { return state.imperialSiegeMaster?.active ?? null; }
export function getSiegeMasterSecsLeft() {
  const a = state.imperialSiegeMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionWarEngines() {
  const a = state.imperialSiegeMaster;
  if (!a?.active) return { ok: false, reason: 'No siege master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The siege master has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.wood -= COMMISSION_WOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned war engines from the imperial siege master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'siegeMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'siegeMasterCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_MASTER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚔️ The siege master establishes a grand war workshop in the garrison courtyard, directing master smiths in forging precision iron components for catapult arms, counterweights, and reinforced siege tower frames — the intensive metalworking demands push the iron foundries to new heights of productivity! −${COMMISSION_IRON_COST} iron · −${COMMISSION_WOOD_COST} wood · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSiegePlans() {
  const a = state.imperialSiegeMaster;
  if (!a?.active) return { ok: false, reason: 'No siege master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The siege master has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased siege plans from the imperial siege master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'siegeMasterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'siegeMasterPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_MASTER_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The siege blueprints are archived in the imperial war library, where military scholars study the advanced engineering principles and sell copies to allied kingdoms — the revenue flows back as a steady income of gold tribute and licensing fees! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSiegeMasterAway() {
  const a = state.imperialSiegeMaster;
  if (!a?.active) return { ok: false, reason: 'No siege master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SIEGE_MASTER_CHANGED, { dismissed: true });
  addMessage('⚔️ The siege master rolls up the blueprints with a practiced hand, nods curtly, and strides back toward the road — armor gleaming in the sunlight as they march off to offer their expertise elsewhere.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
