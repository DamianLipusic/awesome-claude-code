/**
 * EmpireOS — Research system.
 * Processes the research queue each tick.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { TECHS } from '../data/techs.js';
import { heroSkillBonus } from '../data/hero.js';
import { recalcRates } from './resources.js';
import { addMessage } from '../core/actions.js';
import { log } from '../utils/logger.js';

/** Maximum number of techs that can sit in the research queue at once. */
export const MAX_RESEARCH_QUEUE = 3;

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
  if (state.researchQueue.length >= MAX_RESEARCH_QUEUE) {
    return { ok: false, reason: `Queue full (max ${MAX_RESEARCH_QUEUE} items)` };
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
  let totalTicks = libraryBuilt ? Math.ceil(def.researchTicks * 0.75) : def.researchTicks;

  // T070: Hero veteran_knowledge skill: -20% research time
  if (state.hero?.recruited && state.hero.skills?.length) {
    const researchMult = heroSkillBonus(state.hero.skills, 'researchMult');
    if (researchMult !== 1.0) totalTicks = Math.ceil(totalTicks * researchMult);
  }

  state.researchQueue.push({ techId, remaining: totalTicks, totalTicks });
  addMessage(`Researching ${def.name}…`, 'research');
  emit(Events.TECH_CHANGED, {});
  return { ok: true };
}

/**
 * Cancel a queued research item and refund its resource cost.
 * Works for any item in the queue, including the currently-active one.
 */
export function cancelResearch(techId) {
  const idx = state.researchQueue.findIndex(e => e.techId === techId);
  if (idx < 0) return { ok: false, reason: 'Not in research queue' };

  state.researchQueue.splice(idx, 1);

  // Refund full cost regardless of progress
  const def = TECHS[techId];
  if (def) {
    for (const [res, amt] of Object.entries(def.cost)) {
      state.resources[res] = Math.min(
        state.caps[res] ?? 9999,
        (state.resources[res] ?? 0) + amt,
      );
    }
    addMessage(`Research cancelled: ${def.name}. Cost refunded.`, 'info');
    log('research cancelled:', techId);
  }

  emit(Events.TECH_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}
