/**
 * EmpireOS — Imperial Dye Master (T312).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a renowned dye master
 * arrives bearing exotic pigments and textile knowledge from distant lands.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🎨 Establish Royal Dye Works    — pay 25 wood + 15 food
 *        → +0.25 wood/s for 2.5 min · +20 prestige · +8 morale
 *   🌿 Purchase Rare Dye Formulas   — pay 22 gold
 *        → +0.18 food/s for 2 min · +12 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.imperialDyeMaster = {
 *   active:               { expiresAt: tick } | null,
 *   nextSpawnTick:        tick,
 *   totalVisits:          number,
 *   totalEstablishments:  number,
 *   totalPurchases:       number,
 *   totalDismissals:      number,
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

export const DYE_WORKS_WOOD_COST       = 25;
export const DYE_WORKS_FOOD_COST       = 15;
export const DYE_WORKS_WOOD_RATE       = 0.25;
export const DYE_WORKS_PRESTIGE_REWARD = 20;
export const DYE_WORKS_MORALE_REWARD   = 8;
export const DYE_WORKS_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const FORMULAS_GOLD_COST        = 22;
export const FORMULAS_FOOD_RATE        = 0.18;
export const FORMULAS_PRESTIGE_REWARD  = 12;
export const FORMULAS_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialDyeMaster() {
  if (!state.imperialDyeMaster) {
    state.imperialDyeMaster = {
      active:              null,
      nextSpawnTick:       _nextSpawnTick(),
      totalVisits:         0,
      totalEstablishments: 0,
      totalPurchases:      0,
      totalDismissals:     0,
    };
  }
  const s = state.imperialDyeMaster;
  if (s.nextSpawnTick        === undefined) s.nextSpawnTick        = _nextSpawnTick();
  if (s.totalVisits          === undefined) s.totalVisits          = 0;
  if (s.totalEstablishments  === undefined) s.totalEstablishments  = 0;
  if (s.totalPurchases       === undefined) s.totalPurchases       = 0;
  if (s.totalDismissals      === undefined) s.totalDismissals      = 0;
}

export function imperialDyeMasterTick() {
  const a = state.imperialDyeMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_DYE_MASTER_CHANGED, { expired: true });
      addMessage('🎨 The imperial dye master seals their vials of precious pigments, rolls up their colour sample cloths, and departs for the next empire on their long trading circuit.', 'info');
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
  emit(Events.IMPERIAL_DYE_MASTER_CHANGED, { spawned: true });
  addMessage('🎨 A renowned imperial dye master arrives at your court, their robes stained with the brilliant hues of a thousand pigments. They carry samples of rare indigo, crimson madder, and royal purple extracted from distant sea molluscs. Their knowledge of mordants and fixatives could transform your textile industry. Respond within 80 seconds.', 'info');
}

export function getActiveDyeMaster() { return state.imperialDyeMaster?.active ?? null; }
export function getDyeMasterSecsLeft() {
  const a = state.imperialDyeMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishRoyalDyeWorks() {
  const a = state.imperialDyeMaster;
  if (!a?.active) return { ok: false, reason: 'No dye master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The dye master has departed.' };
  if ((state.resources.wood ?? 0) < DYE_WORKS_WOOD_COST) return { ok: false, reason: `Need ${DYE_WORKS_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < DYE_WORKS_FOOD_COST) return { ok: false, reason: `Need ${DYE_WORKS_FOOD_COST} food.` };
  state.resources.wood -= DYE_WORKS_WOOD_COST;
  state.resources.food -= DYE_WORKS_FOOD_COST;
  changeMorale(DYE_WORKS_MORALE_REWARD);
  awardPrestige(DYE_WORKS_PRESTIGE_REWARD, 'Established royal dye works with an imperial dye master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dyeMasterWorks');
    state.randomEvents.activeModifiers.push({
      id: 'dyeMasterWorks', resource: 'wood',
      rateMult: 1 + (DYE_WORKS_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + DYE_WORKS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalEstablishments = (a.totalEstablishments ?? 0) + 1;
  emit(Events.IMPERIAL_DYE_MASTER_CHANGED, { dyeWorks: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The dye master establishes a royal dye works in the textile quarter, transforming raw woad and weld plants harvested from the surrounding forests into brilliant coloured cloth. The demand for their vividly dyed fabrics creates a thriving cottage industry, drawing more workers to the forests and dramatically boosting timber and plant harvesting operations! −${DYE_WORKS_WOOD_COST} wood · −${DYE_WORKS_FOOD_COST} food · +${DYE_WORKS_PRESTIGE_REWARD} prestige · +${DYE_WORKS_MORALE_REWARD} morale. Harvesting surge: +${DYE_WORKS_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRareDyeFormulas() {
  const a = state.imperialDyeMaster;
  if (!a?.active) return { ok: false, reason: 'No dye master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The dye master has departed.' };
  if ((state.resources.gold ?? 0) < FORMULAS_GOLD_COST) return { ok: false, reason: `Need ${FORMULAS_GOLD_COST} gold.` };
  state.resources.gold -= FORMULAS_GOLD_COST;
  awardPrestige(FORMULAS_PRESTIGE_REWARD, 'Purchased rare dye formulas from an imperial dye master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dyeMasterFormulas');
    state.randomEvents.activeModifiers.push({
      id: 'dyeMasterFormulas', resource: 'food',
      rateMult: 1 + (FORMULAS_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + FORMULAS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_DYE_MASTER_CHANGED, { formulas: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The dye master shares their secret formulas for extracting dyes from plants, berries, and roots found throughout your territory. This knowledge of natural mordants and plant compounds inspires your farmers to cultivate dye plants alongside food crops, with the dual-use gardens producing a surprising surplus of edible berries and root vegetables! −${FORMULAS_GOLD_COST} gold · +${FORMULAS_PRESTIGE_REWARD} prestige. Garden surge: +${FORMULAS_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendDyeMasterAway() {
  const a = state.imperialDyeMaster;
  if (!a?.active) return { ok: false, reason: 'No dye master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_DYE_MASTER_CHANGED, { dismissed: true });
  addMessage('🎨 The imperial dye master accepts the decision graciously, carefully wraps their sample cloths and pigment vials, and departs to seek another patron for their rare craft.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
