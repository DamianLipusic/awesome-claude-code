/**
 * EmpireOS — Roaming Botanist (T298).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a learned botanist
 * arrives with rare seeds, pressed herbaria, and the accumulated plant wisdom
 * of distant kingdoms. The player has 80 seconds to decide.
 *
 * Choices:
 *   🌿 Establish Royal Garden — pay 20 food + 15 mana
 *        → +0.2 food/s for 2.5 min · +18 prestige · +8 morale
 *   🌺 Purchase Plant Lore   — pay 18 gold
 *        → +0.12 mana/s for 2 min · +12 prestige
 *   👋 Send Away             — dismiss (no reward)
 *
 * state.roamingBotanist = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalGardens:        number,
 *   totalLore:           number,
 *   totalDismissals:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const GARDEN_FOOD_COST       = 20;
export const GARDEN_MANA_COST       = 15;
export const GARDEN_FOOD_RATE       = 0.2;
export const GARDEN_PRESTIGE_REWARD = 18;
export const GARDEN_MORALE_REWARD   = 8;
export const GARDEN_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const LORE_GOLD_COST         = 18;
export const LORE_MANA_RATE         = 0.12;
export const LORE_PRESTIGE_REWARD   = 12;
export const LORE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initRoamingBotanist() {
  if (!state.roamingBotanist) {
    state.roamingBotanist = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalGardens:    0,
      totalLore:       0,
      totalDismissals: 0,
    };
  }
  const s = state.roamingBotanist;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalGardens    === undefined) s.totalGardens    = 0;
  if (s.totalLore       === undefined) s.totalLore       = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function roamingBotanistTick() {
  const a = state.roamingBotanist;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.ROAMING_BOTANIST_CHANGED, { expired: true });
      addMessage('🌿 The roaming botanist carefully packs their pressed specimens and rare seed pouches into leather satchels, bows politely, and sets off down the imperial road toward the next discovery.', 'info');
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
  emit(Events.ROAMING_BOTANIST_CHANGED, { spawned: true });
  addMessage('🌿 A learned roaming botanist arrives at the imperial court, their satchels brimming with rare seeds, pressed herbaria, and volumes of plant wisdom accumulated across a lifetime of exploration. Respond within 80 seconds.', 'info');
}

export function getActiveBotanist() { return state.roamingBotanist?.active ?? null; }
export function getBotanistSecsLeft() {
  const a = state.roamingBotanist?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishRoyalGarden() {
  const a = state.roamingBotanist;
  if (!a?.active) return { ok: false, reason: 'No botanist present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The botanist has departed.' };
  if ((state.resources.food ?? 0) < GARDEN_FOOD_COST) return { ok: false, reason: `Need ${GARDEN_FOOD_COST} food.` };
  if ((state.resources.mana ?? 0) < GARDEN_MANA_COST) return { ok: false, reason: `Need ${GARDEN_MANA_COST} mana.` };
  state.resources.food -= GARDEN_FOOD_COST;
  state.resources.mana -= GARDEN_MANA_COST;
  changeMorale(GARDEN_MORALE_REWARD);
  awardPrestige(GARDEN_PRESTIGE_REWARD, 'Established a royal botanical garden');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'botanistGarden');
    state.randomEvents.activeModifiers.push({
      id: 'botanistGarden', resource: 'food',
      rateMult: 1 + (GARDEN_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + GARDEN_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalGardens = (a.totalGardens ?? 0) + 1;
  emit(Events.ROAMING_BOTANIST_CHANGED, { garden: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The botanist transforms an imperial courtyard into a magnificent garden of exotic medicinal herbs and productive food plants, boosting agricultural yields across the realm! −${GARDEN_FOOD_COST} food · −${GARDEN_MANA_COST} mana · +${GARDEN_PRESTIGE_REWARD} prestige · +${GARDEN_MORALE_REWARD} morale. Harvest surge: +${GARDEN_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchasePlantLore() {
  const a = state.roamingBotanist;
  if (!a?.active) return { ok: false, reason: 'No botanist present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The botanist has departed.' };
  if ((state.resources.gold ?? 0) < LORE_GOLD_COST) return { ok: false, reason: `Need ${LORE_GOLD_COST} gold.` };
  state.resources.gold -= LORE_GOLD_COST;
  awardPrestige(LORE_PRESTIGE_REWARD, 'Purchased plant lore from a roaming botanist');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'botanistLore');
    state.randomEvents.activeModifiers.push({
      id: 'botanistLore', resource: 'mana',
      rateMult: 1 + (LORE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + LORE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalLore = (a.totalLore ?? 0) + 1;
  emit(Events.ROAMING_BOTANIST_CHANGED, { lore: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌺 The botanist's ancient herbarium reveals alchemical plant properties that inspire the imperial scholars and mages, unlocking potent new techniques for extracting magical essences from local flora! −${LORE_GOLD_COST} gold · +${LORE_PRESTIGE_REWARD} prestige. Arcane surge: +${LORE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBotanistAway() {
  const a = state.roamingBotanist;
  if (!a?.active) return { ok: false, reason: 'No botanist present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.ROAMING_BOTANIST_CHANGED, { dismissed: true });
  addMessage('🌿 The roaming botanist nods with patient understanding, repacks their treasured specimens and rare seeds, and continues their endless journey of botanical discovery across distant lands.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
