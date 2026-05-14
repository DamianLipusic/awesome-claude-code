/**
 * EmpireOS — Enchanted Forest Spirit (T268).
 *
 * Every 15–20 minutes (Bronze Age+, 8+ player tiles), a luminous forest
 * spirit emerges from the ancient woods bordering the empire.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🌿 Forge Forest Pact    — pay 30 food + 20 mana
 *        → +0.2 food/s for 3 min + 20 prestige + 8 morale
 *   🌙 Request Ancient Wisdom — pay 15 mana
 *        → +0.1 mana/s for 2 min + 12 prestige
 *   🌸 Offer Nature's Tribute  — pay 20 food
 *        → +12 morale + 8 prestige
 *
 * state.forestSpirit = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalPacts:       number,
 *   totalWisdoms:     number,
 *   totalTributes:    number,
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
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 1;
const MIN_PLAYER_TILES = 8;

export const PACT_FOOD_COST        = 30;
export const PACT_MANA_COST        = 20;
export const PACT_FOOD_RATE        = 0.2;
export const PACT_DURATION_TICKS   = 3 * 60 * TICKS_PER_SECOND;
export const PACT_PRESTIGE_REWARD  = 20;
export const PACT_MORALE_REWARD    = 8;

export const WISDOM_MANA_COST       = 15;
export const WISDOM_MANA_RATE       = 0.1;
export const WISDOM_DURATION_TICKS  = 2 * 60 * TICKS_PER_SECOND;
export const WISDOM_PRESTIGE_REWARD = 12;

export const TRIBUTE_FOOD_COST        = 20;
export const TRIBUTE_MORALE_REWARD    = 12;
export const TRIBUTE_PRESTIGE_REWARD  = 8;

export function initForestSpirit() {
  if (!state.forestSpirit) {
    state.forestSpirit = {
      active:        null,
      nextSpawnTick: _nextSpawnTick(),
      totalVisits:   0,
      totalPacts:    0,
      totalWisdoms:  0,
      totalTributes: 0,
    };
  }
  if (state.forestSpirit.nextSpawnTick  === undefined) state.forestSpirit.nextSpawnTick  = _nextSpawnTick();
  if (state.forestSpirit.totalVisits    === undefined) state.forestSpirit.totalVisits    = 0;
  if (state.forestSpirit.totalPacts     === undefined) state.forestSpirit.totalPacts     = 0;
  if (state.forestSpirit.totalWisdoms   === undefined) state.forestSpirit.totalWisdoms   = 0;
  if (state.forestSpirit.totalTributes  === undefined) state.forestSpirit.totalTributes  = 0;
}

export function forestSpiritTick() {
  const fs = state.forestSpirit;
  if (!fs) return;
  if (fs.active) {
    if (state.tick >= fs.active.expiresAt) {
      fs.active = null; fs.nextSpawnTick = _nextSpawnTick();
      emit(Events.FOREST_SPIRIT_CHANGED, { expired: true });
      addMessage('🌿 The forest spirit dissolves back into the ancient woods, its light fading without an answer.', 'info');
    }
    return;
  }
  if (state.tick < fs.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  fs.active      = { expiresAt: state.tick + WINDOW_TICKS };
  fs.totalVisits = (fs.totalVisits ?? 0) + 1;
  emit(Events.FOREST_SPIRIT_CHANGED, { spawned: true });
  addMessage('🌿 A luminous forest spirit has emerged from the ancient woods bordering the empire! Its ethereal glow illuminates the forest edge. Respond within 75 seconds.', 'info');
}

export function getActiveForestSpirit()  { return state.forestSpirit?.active ?? null; }
export function getForestSpiritSecsLeft() {
  const a = state.forestSpirit?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function forgeForestPact() {
  const fs = state.forestSpirit;
  if (!fs?.active) return { ok: false, reason: 'No spirit present.' };
  if (state.tick >= fs.active.expiresAt) return { ok: false, reason: 'The spirit has vanished.' };
  if ((state.resources.food ?? 0) < PACT_FOOD_COST) return { ok: false, reason: `Need ${PACT_FOOD_COST} food.` };
  if ((state.resources.mana ?? 0) < PACT_MANA_COST) return { ok: false, reason: `Need ${PACT_MANA_COST} mana.` };
  state.resources.food -= PACT_FOOD_COST;
  state.resources.mana -= PACT_MANA_COST;
  changeMorale(PACT_MORALE_REWARD);
  awardPrestige(PACT_PRESTIGE_REWARD, 'Forged a Forest Pact with an enchanted spirit');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'spiritPactFood');
    state.randomEvents.activeModifiers.push({
      id: 'spiritPactFood', resource: 'food',
      rateMult: 1 + (PACT_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PACT_DURATION_TICKS,
    });
  }
  fs.active = null; fs.nextSpawnTick = _nextSpawnTick(); fs.totalPacts = (fs.totalPacts ?? 0) + 1;
  emit(Events.FOREST_SPIRIT_CHANGED, { pact: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The spirit weaves ancient magic into the land! +${PACT_PRESTIGE_REWARD} prestige · +${PACT_MORALE_REWARD} morale. Harvest yields surge: +${PACT_FOOD_RATE} food/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

export function requestAncientWisdom() {
  const fs = state.forestSpirit;
  if (!fs?.active) return { ok: false, reason: 'No spirit present.' };
  if (state.tick >= fs.active.expiresAt) return { ok: false, reason: 'The spirit has vanished.' };
  if ((state.resources.mana ?? 0) < WISDOM_MANA_COST) return { ok: false, reason: `Need ${WISDOM_MANA_COST} mana.` };
  state.resources.mana -= WISDOM_MANA_COST;
  awardPrestige(WISDOM_PRESTIGE_REWARD, 'Received ancient wisdom from an enchanted forest spirit');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'spiritWisdomMana');
    state.randomEvents.activeModifiers.push({
      id: 'spiritWisdomMana', resource: 'mana',
      rateMult: 1 + (WISDOM_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 0.1))),
      expiresAt: state.tick + WISDOM_DURATION_TICKS,
    });
  }
  fs.active = null; fs.nextSpawnTick = _nextSpawnTick(); fs.totalWisdoms = (fs.totalWisdoms ?? 0) + 1;
  emit(Events.FOREST_SPIRIT_CHANGED, { wisdom: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌙 The spirit whispers forgotten arcane lore! +${WISDOM_PRESTIGE_REWARD} prestige. Ley lines resonate with forest energy: +${WISDOM_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function offerNaturesTribute() {
  const fs = state.forestSpirit;
  if (!fs?.active) return { ok: false, reason: 'No spirit present.' };
  if (state.tick >= fs.active.expiresAt) return { ok: false, reason: 'The spirit has vanished.' };
  if ((state.resources.food ?? 0) < TRIBUTE_FOOD_COST) return { ok: false, reason: `Need ${TRIBUTE_FOOD_COST} food.` };
  state.resources.food -= TRIBUTE_FOOD_COST;
  changeMorale(TRIBUTE_MORALE_REWARD);
  awardPrestige(TRIBUTE_PRESTIGE_REWARD, 'Offered nature\'s tribute to an enchanted forest spirit');
  fs.active = null; fs.nextSpawnTick = _nextSpawnTick(); fs.totalTributes = (fs.totalTributes ?? 0) + 1;
  emit(Events.FOREST_SPIRIT_CHANGED, { tribute: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌸 The spirit accepts the humble tribute with a gentle shimmer! +${TRIBUTE_MORALE_REWARD} morale · +${TRIBUTE_PRESTIGE_REWARD} prestige. The people are heartened by the empire's reverence for nature.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
