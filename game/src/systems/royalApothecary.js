/**
 * EmpireOS — Royal Apothecary (T318).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), a renowned apothecary
 * arrives at the imperial court, offering rare remedies and exotic alchemical
 * preparations. The player has 80 seconds to decide.
 *
 * Choices:
 *   ⚗️ Commission Imperial Remedies — pay 30 mana + 15 gold
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +12 morale
 *   🌿 Purchase Exotic Potions      — pay 25 food
 *        → +0.20 food/s for 2 min   · +15 prestige · +8 morale
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.royalApothecary = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalRemedies:      number,
 *   totalPotions:       number,
 *   totalDismissals:    number,
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

export const REMEDIES_MANA_COST            = 30;
export const REMEDIES_GOLD_COST            = 15;
export const REMEDIES_MANA_RATE            = 0.25;
export const REMEDIES_PRESTIGE_REWARD      = 22;
export const REMEDIES_MORALE_REWARD        = 12;
export const REMEDIES_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const POTIONS_FOOD_COST             = 25;
export const POTIONS_FOOD_RATE             = 0.20;
export const POTIONS_PRESTIGE_REWARD       = 15;
export const POTIONS_MORALE_REWARD         = 8;
export const POTIONS_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initRoyalApothecary() {
  if (!state.royalApothecary) {
    state.royalApothecary = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalRemedies:    0,
      totalPotions:     0,
      totalDismissals:  0,
    };
  }
  const s = state.royalApothecary;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalRemedies   === undefined) s.totalRemedies   = 0;
  if (s.totalPotions    === undefined) s.totalPotions    = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function royalApothecaryTick() {
  const a = state.royalApothecary;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.ROYAL_APOTHECARY_CHANGED, { expired: true });
      addMessage('⚗️ The royal apothecary carefully seals their vials and bottles, packs their leather satchel of arcane preparations, and departs to serve other noble courts across the realm.', 'info');
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
  emit(Events.ROYAL_APOTHECARY_CHANGED, { spawned: true });
  addMessage('⚗️ A renowned royal apothecary arrives at the imperial court, bearing a case of rare alchemical preparations, exotic remedies, and mystical potions gathered from distant lands. They offer their finest creations to the empire. Respond within 80 seconds.', 'info');
}

export function getActiveRoyalApothecary() { return state.royalApothecary?.active ?? null; }
export function getRoyalApothecarySecsLeft() {
  const a = state.royalApothecary?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialRemedies() {
  const a = state.royalApothecary;
  if (!a?.active) return { ok: false, reason: 'No apothecary present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The apothecary has departed.' };
  if ((state.resources.mana ?? 0) < REMEDIES_MANA_COST) return { ok: false, reason: `Need ${REMEDIES_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < REMEDIES_GOLD_COST) return { ok: false, reason: `Need ${REMEDIES_GOLD_COST} gold.` };
  state.resources.mana -= REMEDIES_MANA_COST;
  state.resources.gold -= REMEDIES_GOLD_COST;
  changeMorale(REMEDIES_MORALE_REWARD);
  awardPrestige(REMEDIES_PRESTIGE_REWARD, 'Commissioned imperial remedies from the royal apothecary');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'apothecaryRemedies');
    state.randomEvents.activeModifiers.push({
      id: 'apothecaryRemedies', resource: 'mana',
      rateMult: 1 + (REMEDIES_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + REMEDIES_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalRemedies = (a.totalRemedies ?? 0) + 1;
  emit(Events.ROYAL_APOTHECARY_CHANGED, { remedies: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚗️ The apothecary prepares a masterful collection of imperial remedies, tonics, and elixirs for the court. The mystical preparations invigorate the realm's arcane practitioners and scholars! −${REMEDIES_MANA_COST} mana · −${REMEDIES_GOLD_COST} gold · +${REMEDIES_PRESTIGE_REWARD} prestige · +${REMEDIES_MORALE_REWARD} morale. Mana surge: +${REMEDIES_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseExoticPotions() {
  const a = state.royalApothecary;
  if (!a?.active) return { ok: false, reason: 'No apothecary present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The apothecary has departed.' };
  if ((state.resources.food ?? 0) < POTIONS_FOOD_COST) return { ok: false, reason: `Need ${POTIONS_FOOD_COST} food.` };
  state.resources.food -= POTIONS_FOOD_COST;
  changeMorale(POTIONS_MORALE_REWARD);
  awardPrestige(POTIONS_PRESTIGE_REWARD, 'Purchased exotic potions from the royal apothecary');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'apothecaryPotions');
    state.randomEvents.activeModifiers.push({
      id: 'apothecaryPotions', resource: 'food',
      rateMult: 1 + (POTIONS_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + POTIONS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPotions = (a.totalPotions ?? 0) + 1;
  emit(Events.ROYAL_APOTHECARY_CHANGED, { potions: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The apothecary produces a collection of exotic nutritional potions and health tonics brewed from rare herbs and plant extracts. Distributed to the farming communities, crop yields and food production rise noticeably! −${POTIONS_FOOD_COST} food · +${POTIONS_PRESTIGE_REWARD} prestige · +${POTIONS_MORALE_REWARD} morale. Food surge: +${POTIONS_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendApothecaryAway() {
  const a = state.royalApothecary;
  if (!a?.active) return { ok: false, reason: 'No apothecary present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.ROYAL_APOTHECARY_CHANGED, { dismissed: true });
  addMessage('⚗️ The royal apothecary bows graciously, collects their precious preparations, and departs from the imperial court to offer their wares elsewhere across the kingdom.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
