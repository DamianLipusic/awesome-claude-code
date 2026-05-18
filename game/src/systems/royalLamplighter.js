/**
 * EmpireOS — Royal Lamplighter (T321).
 *
 * Every 13–18 minutes (Medieval Age+, 8+ player tiles), a royal lamplighter
 * arrives at the imperial court, offering to illuminate the city streets with
 * elegant lanterns and oil lamps. The player has 80 seconds to decide.
 *
 * Choices:
 *   🏮 Establish Lamp District — pay 25 wood + 20 gold
 *        → +0.22 wood/s for 2.5 min · +22 prestige · +12 morale
 *   💡 Purchase Street Lanterns — pay 25 gold
 *        → +0.18 gold/s for 2 min   · +15 prestige
 *   🚶 Send Away               — dismiss (no reward)
 *
 * state.royalLamplighter = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalEstablishments: number,
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

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 8;

export const ESTABLISH_WOOD_COST           = 25;
export const ESTABLISH_GOLD_COST           = 20;
export const ESTABLISH_WOOD_RATE           = 0.22;
export const ESTABLISH_PRESTIGE_REWARD     = 22;
export const ESTABLISH_MORALE_REWARD       = 12;
export const ESTABLISH_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 25;
export const PURCHASE_GOLD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initRoyalLamplighter() {
  if (!state.royalLamplighter) {
    state.royalLamplighter = {
      active:              null,
      nextSpawnTick:       _nextSpawnTick(),
      totalVisits:         0,
      totalEstablishments: 0,
      totalPurchases:      0,
      totalDismissals:     0,
    };
  }
  const s = state.royalLamplighter;
  if (s.nextSpawnTick        === undefined) s.nextSpawnTick        = _nextSpawnTick();
  if (s.totalVisits          === undefined) s.totalVisits          = 0;
  if (s.totalEstablishments  === undefined) s.totalEstablishments  = 0;
  if (s.totalPurchases       === undefined) s.totalPurchases       = 0;
  if (s.totalDismissals      === undefined) s.totalDismissals      = 0;
}

export function royalLamplighterTick() {
  const a = state.royalLamplighter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.ROYAL_LAMPLIGHTER_CHANGED, { expired: true });
      addMessage('🏮 The royal lamplighter carefully extinguishes their demonstration lanterns, packs up the oil reservoirs, and departs to illuminate other noble districts.', 'info');
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
  emit(Events.ROYAL_LAMPLIGHTER_CHANGED, { spawned: true });
  addMessage('🏮 A royal lamplighter arrives at the palace bearing exquisite oil lanterns, ornate lamp posts, and a proposal to illuminate the imperial city streets with warm golden light. Respond within 80 seconds.', 'info');
}

export function getActiveRoyalLamplighter() { return state.royalLamplighter?.active ?? null; }
export function getRoyalLamplighterSecsLeft() {
  const a = state.royalLamplighter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishLampDistrict() {
  const a = state.royalLamplighter;
  if (!a?.active) return { ok: false, reason: 'No lamplighter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lamplighter has departed.' };
  if ((state.resources.wood ?? 0) < ESTABLISH_WOOD_COST) return { ok: false, reason: `Need ${ESTABLISH_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < ESTABLISH_GOLD_COST) return { ok: false, reason: `Need ${ESTABLISH_GOLD_COST} gold.` };
  state.resources.wood -= ESTABLISH_WOOD_COST;
  state.resources.gold -= ESTABLISH_GOLD_COST;
  changeMorale(ESTABLISH_MORALE_REWARD);
  awardPrestige(ESTABLISH_PRESTIGE_REWARD, 'Established lamp district with the royal lamplighter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'lamplighterEstablish');
    state.randomEvents.activeModifiers.push({
      id: 'lamplighterEstablish', resource: 'wood',
      rateMult: 1 + (ESTABLISH_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + ESTABLISH_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalEstablishments = (a.totalEstablishments ?? 0) + 1;
  emit(Events.ROYAL_LAMPLIGHTER_CHANGED, { established: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏮 The royal lamplighter transforms the city streets with elegant oil lanterns on ornate iron posts. The warm golden glow extends working hours, reinvigorating the empire's lumber trade and civic pride! −${ESTABLISH_WOOD_COST} wood · −${ESTABLISH_GOLD_COST} gold · +${ESTABLISH_PRESTIGE_REWARD} prestige · +${ESTABLISH_MORALE_REWARD} morale. Wood surge: +${ESTABLISH_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseStreetLanterns() {
  const a = state.royalLamplighter;
  if (!a?.active) return { ok: false, reason: 'No lamplighter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lamplighter has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased street lanterns from the royal lamplighter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'lamplighterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'lamplighterPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.ROYAL_LAMPLIGHTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💡 The lamplighter installs handsome street lanterns throughout the market quarters, allowing merchants to trade into the evening hours and drawing visitors from afar! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLamplighterAway() {
  const a = state.royalLamplighter;
  if (!a?.active) return { ok: false, reason: 'No lamplighter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.ROYAL_LAMPLIGHTER_CHANGED, { dismissed: true });
  addMessage('🏮 The royal lamplighter bows respectfully, secures their collection of lanterns and oil canisters, and departs the palace grounds to offer their illuminating services elsewhere.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
