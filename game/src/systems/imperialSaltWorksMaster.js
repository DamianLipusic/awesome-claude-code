/**
 * EmpireOS — Imperial Salt Works Master (T454).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), an imperial salt works
 * master arrives at the settlement carrying sealed glazed amphorae of
 * sun-evaporated sea salt and rock salt — the sea salt harvested by directing
 * a shallow coastal inlet through a sluice gate into a series of graduated
 * evaporation pans built from rammed chalk and sea-polished flint, each pan
 * shallower than the last so that the brine concentration increases through
 * successive solar evaporation until the salt crystallises in the final pan
 * and is raked by iron-tipped wooden rakes into mounds on the pan floor for
 * collection and stacking in conical salt storage heaps covered with woven
 * rush mats to shed rain while allowing the damp salt to drain and dry to the
 * pure white powder prized in markets throughout the empire for its clean
 * flavour and exceptional preservation properties — offering to commission a
 * full salt evaporation works built alongside the nearest water source using
 * local food and construction materials to produce a reliable supply of
 * preservation salt for the settlement's food stores and market, or to
 * share the complete evaporation pan design and harvest sequence for
 * independent salt production from local brine springs and coastal inlets.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🧂 Commission Salt Evaporation Works  — pay 25 food + 20 gold
 *        → +0.22 food/s for 2.5 min · +20 prestige · +12 morale
 *   📖 Purchase Salt Harvesting Lore      — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.imperialSaltWorksMaster = {
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

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_FOOD_COST        = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_FOOD_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 20;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST         = 20;
export const PURCHASE_STONE_RATE         = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSaltWorksMaster() {
  if (!state.imperialSaltWorksMaster) {
    state.imperialSaltWorksMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialSaltWorksMaster;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialSaltWorksMasterTick() {
  const a = state.imperialSaltWorksMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SALT_WORKS_MASTER_CHANGED, { expired: true });
      addMessage('🧂 The imperial salt works master reseals the glazed amphorae and departs along the road before the commission window closes.', 'info');
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
  emit(Events.IMPERIAL_SALT_WORKS_MASTER_CHANGED, { spawned: true });
  addMessage('🧂 An imperial salt works master arrives carrying sealed glazed amphorae of sun-evaporated sea salt and rock salt harvested from graduated evaporation pans — offering to commission a full salt evaporation works built alongside the nearest water source to produce a reliable supply of preservation salt for the settlement\'s food stores and market, or to share the complete evaporation pan design and harvest sequence for independent salt production from local brine sources. Respond within 80 seconds.', 'info');
}

export function getActiveImperialSaltWorksMaster() { return state.imperialSaltWorksMaster?.active ?? null; }
export function getSaltWorksMasterSecsLeft() {
  const a = state.imperialSaltWorksMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionSaltEvaporationWorks() {
  const a = state.imperialSaltWorksMaster;
  if (!a?.active) return { ok: false, reason: 'No salt works master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The salt works master has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned salt evaporation works from the imperial salt works master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'saltWorksMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'saltWorksMasterCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SALT_WORKS_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧂 The salt works master surveys the nearest water source and lays out the evaporation pan series — digging the intake sluice channel with an iron-shod wooden spade, raming the pan bunds from puddled chalk and gravel to the precise height that holds the flooded brine level while allowing overflow between successive pans, setting the sluice gate planks to control the flow rate that fills each pan to the shallow depth required for rapid solar evaporation, and raking the crystallised salt into mounds covered with rush mats to drain and dry to the pure white powder that preserves the settlement's food stores through every season and commands the highest prices in the market! −${COMMISSION_FOOD_COST} food · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSaltHarvestingLore() {
  const a = state.imperialSaltWorksMaster;
  if (!a?.active) return { ok: false, reason: 'No salt works master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The salt works master has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased salt harvesting lore from the imperial salt works master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'saltWorksMasterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'saltWorksMasterPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SALT_WORKS_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The salt works master shares the complete salt harvesting sequence — the brine salinity test using a floating clay ball of calibrated weight that sinks to the correct depth only when the brine concentration is ready for the final evaporation pan, the pan floor material that prevents salt contamination with clay particles, the sluice gate timing that maintains the correct brine depth through tidal variation and rainfall events, the raking technique that collects the crystallised salt without dragging the pan floor material into the harvest, and the rush mat stacking method that sheds rain while allowing the moist salt crystals to drain and dry to the consistent pure white powder required by the market — knowledge that allows the settlement's own workers to build and operate salt evaporation pans from the stone and materials available at every brine spring and coastal inlet in the region. −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSaltWorksMasterAway() {
  const a = state.imperialSaltWorksMaster;
  if (!a?.active) return { ok: false, reason: 'No salt works master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SALT_WORKS_MASTER_CHANGED, { dismissed: true });
  addMessage('🧂 The imperial salt works master reseals the glazed amphorae and departs along the road with a formal bow.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
