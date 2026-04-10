/**
 * EmpireOS — Research system.
 * Processes the research queue each tick.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { TECHS } from '../data/techs.js';
import { recalcRates } from './resources.js';
import { addMessage } from '../core/actions.js';
import { log } from '../utils/logger.js';

export function researchTick() {
  if (state.researchQueue.length === 0) return;

  const entry = state.researchQueue[0];
  entry.remaining--;

  if (entry.remaining <= 0) {
    state.researchQueue.shift();
    state.techs[entry.techId] = true;
    recalcRates();
    const name = TECHS[entry.techId]?.name ?? entry.techId;
    addMessage(`Research complete: ${name}!`, 'tech');
    emit(Events.TECH_CHANGED, { techId: entry.techId });
    log('tech researched:', entry.techId);
  }
}

/**
 * Start researching a tech.
 * Validates prerequisites and deducts cost.
 */
export function startResearch(techId) {
  const def = TECHS[techId];
  if (!def) return { ok: false, reason: `Unknown tech: ${techId}` };
  if (state.techs[techId]) return { ok: false, reason: 'Already researched' };
  if (state.researchQueue.some(e => e.techId === techId)) {
    return { ok: false, reason: 'Already in queue' };
  }

  // Check prerequisites
  for (const req of def.requires ?? []) {
    if (!state.techs[req]) {
      const reqName = TECHS[req]?.name ?? req;
      return { ok: false, reason: `Requires: ${reqName}` };
    }
  }

  // Check resources
  for (const [res, amt] of Object.entries(def.cost)) {
    if ((state.resources[res] ?? 0) < amt) {
      return { ok: false, reason: 'Insufficient resources' };
    }
  }

  // Deduct cost
  for (const [res, amt] of Object.entries(def.cost)) {
    state.resources[res] -= amt;
  }

  // Great Library wonder: -25% research time
  const libraryBuilt = (state.buildings?.greatLibrary ?? 0) >= 1;
  const totalTicks = libraryBuilt ? Math.ceil(def.researchTicks * 0.75) : def.researchTicks;

  state.researchQueue.push({ techId, remaining: totalTicks, totalTicks });
  addMessage(`Researching ${def.name}…`, 'research');
  emit(Events.TECH_CHANGED, {});
  return { ok: true };
}
