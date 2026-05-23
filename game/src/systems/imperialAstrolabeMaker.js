/**
 * EmpireOS — Imperial Astrolabe Maker (T376).
 *
 * Every 15–20 minutes (Medieval Age+, 10+ player tiles), a master astrolabe
 * maker arrives at court bearing intricately engraved brass astrolabes,
 * celestial sphere models, and star charts of the observable heavens
 * — offering to craft a bespoke navigation astrolabe for the imperial navy
 * or sell a complete set of celestial charts for the palace astronomers.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🌐 Commission Navigation Astrolabe — pay 25 iron + 20 mana
 *        → +0.22 mana/s for 2.5 min · +22 prestige · +10 morale
 *   🗺️ Purchase Celestial Charts — pay 22 gold
 *        → +0.18 gold/s for 2 min · +15 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.imperialAstrolabeMaker = {
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

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST          = 25;
export const COMMISSION_MANA_COST          = 20;
export const COMMISSION_MANA_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 22;
export const PURCHASE_GOLD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialAstrolabeMaker() {
  if (!state.imperialAstrolabeMaker) {
    state.imperialAstrolabeMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialAstrolabeMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialAstrolabeMakerTick() {
  const a = state.imperialAstrolabeMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_ASTROLABE_MAKER_CHANGED, { expired: true });
      addMessage('🌐 The imperial astrolabe maker carefully rolls the celestial charts back into their protective cases, wraps the brass instruments in velvet, and departs toward the next scholarly court — the faint gleam of polished brass disappearing over the horizon.', 'info');
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
  emit(Events.IMPERIAL_ASTROLABE_MAKER_CHANGED, { spawned: true });
  addMessage('🌐 An imperial astrolabe maker arrives at the palace bearing intricately engraved brass astrolabes, celestial sphere models, and hand-drawn star charts of the observable heavens — offering to craft a bespoke navigation astrolabe for the imperial navy or sell a complete celestial chart collection for the palace astronomers. Respond within 80 seconds.', 'info');
}

export function getActiveImperialAstrolabeMaker() { return state.imperialAstrolabeMaker?.active ?? null; }
export function getAstrolabeMakerSecsLeft() {
  const a = state.imperialAstrolabeMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionNavigationAstrolabe() {
  const a = state.imperialAstrolabeMaker;
  if (!a?.active) return { ok: false, reason: 'No astrolabe maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The astrolabe maker has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.mana -= COMMISSION_MANA_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned a navigation astrolabe from the imperial astrolabe maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'astrolabeMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'astrolabeMakerCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_ASTROLABE_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌐 The astrolabe maker forges an exquisite brass navigation astrolabe using the finest iron from the imperial foundries — the palace mages study its celestial alignment algorithms and incorporate the mathematical resonance patterns into their channelling arrays, greatly amplifying magical energy throughput across the arcane towers! −${COMMISSION_IRON_COST} iron · −${COMMISSION_MANA_COST} mana · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCelestialCharts() {
  const a = state.imperialAstrolabeMaker;
  if (!a?.active) return { ok: false, reason: 'No astrolabe maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The astrolabe maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased celestial charts from the imperial astrolabe maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'astrolabeMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'astrolabeMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_ASTROLABE_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ The astrolabe maker hands over beautifully detailed celestial charts showing trade wind patterns, seasonal star positions, and lunar tide calendars — the imperial merchant fleet immediately uses these to optimise shipping routes, cutting travel times and significantly increasing the volume and value of goods moving through imperial ports! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendAstrolabeMakerAway() {
  const a = state.imperialAstrolabeMaker;
  if (!a?.active) return { ok: false, reason: 'No astrolabe maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_ASTROLABE_MAKER_CHANGED, { dismissed: true });
  addMessage('🌐 The imperial astrolabe maker bows courteously, tucks the brass instruments under one arm, and departs through the palace gates — the faint gleam of polished metal disappearing around the corner.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
