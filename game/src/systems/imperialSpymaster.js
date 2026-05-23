/**
 * EmpireOS — Imperial Spymaster (T374).
 *
 * Every 15–20 minutes (Iron Age+, 12+ player tiles), a cloaked imperial
 * spymaster arrives at court through the servants' entrance bearing encoded
 * intelligence dossiers, wax-sealed cipher tablets, and maps of rival
 * faction movements — offering to establish a hidden intelligence network
 * for the empire or sell advanced cipher codes to the palace scribes.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🕵️ Commission Intelligence Network — pay 30 iron + 20 gold
 *        → +0.22 iron/s for 2.5 min · +25 prestige · +10 morale
 *   📜 Purchase Cipher Codes — pay 25 mana
 *        → +0.20 mana/s for 2 min · +18 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.imperialSpymaster = {
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
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_IRON_COST           = 30;
export const COMMISSION_GOLD_COST           = 20;
export const COMMISSION_IRON_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD     = 25;
export const COMMISSION_MORALE_REWARD       = 10;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_MANA_COST             = 25;
export const PURCHASE_MANA_RATE             = 0.20;
export const PURCHASE_PRESTIGE_REWARD       = 18;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSpymaster() {
  if (!state.imperialSpymaster) {
    state.imperialSpymaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialSpymaster;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialSpymasterTick() {
  const a = state.imperialSpymaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SPYMASTER_CHANGED, { expired: true });
      addMessage('🕵️ The imperial spymaster pulls the hood back over their face, tucks the cipher tablets beneath the cloak, and slips back through the servants\' entrance — vanishing into the evening shadows without a trace.', 'info');
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
  emit(Events.IMPERIAL_SPYMASTER_CHANGED, { spawned: true });
  addMessage('🕵️ A cloaked imperial spymaster slips through the servants\' entrance bearing encoded intelligence dossiers, wax-sealed cipher tablets, and detailed maps of rival faction troop movements — offering to establish a hidden intelligence network across the empire or sell advanced cipher codes to the palace scribes. Respond within 80 seconds.', 'info');
}

export function getActiveImperialSpymaster() { return state.imperialSpymaster?.active ?? null; }
export function getSpymasterSecsLeft() {
  const a = state.imperialSpymaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionIntelligenceNetwork() {
  const a = state.imperialSpymaster;
  if (!a?.active) return { ok: false, reason: 'No spymaster present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The spymaster has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned an intelligence network from the imperial spymaster');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'spymasterNetwork');
    state.randomEvents.activeModifiers.push({
      id: 'spymasterNetwork', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SPYMASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🕵️ The spymaster's network of hidden agents fans out through every rival court, smithy, and trade hall — advance intelligence on enemy supply chains lets the imperial armourers pre-position ore shipments with uncanny precision, slashing transport losses and driving furnace output to record levels! −${COMMISSION_IRON_COST} iron · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCipherCodes() {
  const a = state.imperialSpymaster;
  if (!a?.active) return { ok: false, reason: 'No spymaster present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The spymaster has departed.' };
  if ((state.resources.mana ?? 0) < PURCHASE_MANA_COST) return { ok: false, reason: `Need ${PURCHASE_MANA_COST} mana.` };
  state.resources.mana -= PURCHASE_MANA_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased cipher codes from the imperial spymaster');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'spymasterCipher');
    state.randomEvents.activeModifiers.push({
      id: 'spymasterCipher', resource: 'mana',
      rateMult: 1 + (PURCHASE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SPYMASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The spymaster hands over a stack of wax tablets bearing intricate substitution ciphers and polyalphabetic frequency tables — the palace mages immediately recognise the arcane resonance patterns encoded within and begin applying the cipher logic to their channelling arrays, significantly increasing magical throughput! −${PURCHASE_MANA_COST} mana · +${PURCHASE_PRESTIGE_REWARD} prestige. Mana surge: +${PURCHASE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSpymasterAway() {
  const a = state.imperialSpymaster;
  if (!a?.active) return { ok: false, reason: 'No spymaster present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SPYMASTER_CHANGED, { dismissed: true });
  addMessage('🕵️ The imperial spymaster pulls the hood low, tucks the dossiers back beneath the cloak, and slips out through the servants\' entrance — the soft scuff of sandals on cobblestone the only trace of the visit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
