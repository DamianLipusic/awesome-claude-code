/**
 * EmpireOS — Action functions.
 * All state mutations happen here (no direct state writes from UI).
 */

import { state } from './state.js';
import { emit, Events } from './events.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { recalcRates } from '../systems/resources.js';
import { log } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function addMessage(text, type = 'info') {
  state.messages.unshift({ text, type, tick: state.tick });
  if (state.messages.length > 50) state.messages.pop();
  emit(Events.MESSAGE, { text, type });
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

/**
 * Build (or increment) a building by id.
 * Deducts costs from resources and recalculates rates.
 */
export function buildBuilding(id) {
  const def = BUILDINGS[id];
  if (!def) return { ok: false, reason: `Unknown building: ${id}` };

  const count = state.buildings[id] ?? 0;
  const cost  = scaledCost(def.baseCost, count);

  if (!canAfford(cost)) {
    return { ok: false, reason: 'Insufficient resources' };
  }

  deductCost(cost);
  state.buildings[id] = count + 1;
  recalcRates();

  emit(Events.BUILDING_CHANGED, { id, count: state.buildings[id] });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`Built ${def.name}.`, 'build');
  return { ok: true };
}

/**
 * Demolish one instance of a building.
 */
export function demolishBuilding(id) {
  const count = state.buildings[id] ?? 0;
  if (count <= 0) return { ok: false, reason: 'No buildings to demolish' };

  state.buildings[id] = count - 1;
  if (state.buildings[id] === 0) delete state.buildings[id];
  recalcRates();

  emit(Events.BUILDING_CHANGED, { id });
  addMessage(`Demolished a ${BUILDINGS[id]?.name ?? id}.`, 'demolish');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/**
 * Enqueue training of a unit.
 * Deducts cost immediately; unit count increases when training completes.
 */
export function trainUnit(id) {
  const def = UNITS[id];
  if (!def) return { ok: false, reason: `Unknown unit: ${id}` };

  if (!canAfford(def.cost)) {
    return { ok: false, reason: 'Insufficient resources' };
  }

  deductCost(def.cost);
  // Warcraft tech: -25% training time
  const totalTicks = state.techs.warcraft
    ? Math.ceil(def.trainTicks * 0.75)
    : def.trainTicks;
  state.trainingQueue.push({ unitId: id, remaining: totalTicks, totalTicks });

  emit(Events.UNIT_CHANGED, {});
  addMessage(`Training ${def.name}…`, 'train');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function scaledCost(base, existing) {
  // Each additional building costs 15% more
  const factor = Math.pow(1.15, existing);
  const scaled = {};
  for (const [res, amt] of Object.entries(base)) {
    scaled[res] = Math.ceil(amt * factor);
  }
  return scaled;
}

function canAfford(cost) {
  for (const [res, amt] of Object.entries(cost)) {
    if ((state.resources[res] ?? 0) < amt) return false;
  }
  return true;
}

function deductCost(cost) {
  for (const [res, amt] of Object.entries(cost)) {
    state.resources[res] = (state.resources[res] ?? 0) - amt;
  }
}

log('actions module loaded');
