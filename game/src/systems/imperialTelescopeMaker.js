/**
 * EmpireOS — Imperial Telescope Maker (T370).
 *
 * Every 15–20 minutes (Medieval Age+, 10+ player tiles), an imperial telescope
 * maker arrives bearing ground lenses, polished brass tubes, and celestial
 * charts, offering to craft a naval telescope for the imperial fleet or sell
 * a fine celestial lens to the court astronomers. The player has 80 seconds to decide.
 *
 * Choices:
 *   🔭 Commission Naval Telescope   — pay 25 iron + 20 mana
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +10 morale
 *   🌌 Purchase Celestial Lens       — pay 25 gold
 *        → +0.18 mana/s for 2 min   · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.imperialTelescopeMaker = {
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
export const COMMISSION_IRON_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 25;
export const PURCHASE_MANA_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialTelescopeMaker() {
  if (!state.imperialTelescopeMaker) {
    state.imperialTelescopeMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialTelescopeMaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialTelescopeMakerTick() {
  const a = state.imperialTelescopeMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_TELESCOPE_MAKER_CHANGED, { expired: true });
      addMessage('🔭 The imperial telescope maker carefully wraps the ground lenses and brass fittings back in velvet cloth, tucks the celestial charts under one arm, and departs for the next observatory commission.', 'info');
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
  emit(Events.IMPERIAL_TELESCOPE_MAKER_CHANGED, { spawned: true });
  addMessage('🔭 A renowned imperial telescope maker arrives at the palace bearing finely ground glass lenses, polished brass tubes, and annotated celestial charts — offering to craft a precision naval telescope for the imperial fleet or sell their finest astronomical lens to the court scholars. Respond within 80 seconds.', 'info');
}

export function getActiveImperialTelescopeMaker() { return state.imperialTelescopeMaker?.active ?? null; }
export function getTelescopeMakerSecsLeft() {
  const a = state.imperialTelescopeMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionNavalTelescope() {
  const a = state.imperialTelescopeMaker;
  if (!a?.active) return { ok: false, reason: 'No telescope maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The telescope maker has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.mana -= COMMISSION_MANA_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned a naval telescope from the imperial telescope maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'telescopeCommission');
    state.randomEvents.activeModifiers.push({
      id: 'telescopeCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_TELESCOPE_MAKER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔭 The telescope maker assembles a gleaming brass naval telescope in the palace workshop — the fleet admirals test the instrument at dawn, spotting distant sails and coastal landmarks with extraordinary clarity. Inspired by the precision engineering, the imperial forges redouble their output! −${COMMISSION_IRON_COST} iron · −${COMMISSION_MANA_COST} mana · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCelestialLens() {
  const a = state.imperialTelescopeMaker;
  if (!a?.active) return { ok: false, reason: 'No telescope maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The telescope maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased a celestial lens from the imperial telescope maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'telescopePurchase');
    state.randomEvents.activeModifiers.push({
      id: 'telescopePurchase', resource: 'mana',
      rateMult: 1 + (PURCHASE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_TELESCOPE_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌌 The court astronomers mount the exquisitely ground celestial lens in the palace observatory tower — the refined optics reveal constellations and planetary alignments invisible to the naked eye, opening new channels of arcane scholarship and celestial divination! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Mana surge: +${PURCHASE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendTelescopeMakerAway() {
  const a = state.imperialTelescopeMaker;
  if (!a?.active) return { ok: false, reason: 'No telescope maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_TELESCOPE_MAKER_CHANGED, { dismissed: true });
  addMessage('🔭 The imperial telescope maker bows respectfully, carefully rewraps the polished lenses and brass tubes in their protective velvet cases, and departs down the palace road — the faint glint of polished glass disappearing into the evening light.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
