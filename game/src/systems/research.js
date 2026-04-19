/**
 * EmpireOS — Research system.
 * Processes the research queue each tick.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { TECHS, MASTERY_GROUPS, SYNERGIES } from '../data/techs.js';
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
    _checkMasteries(entry.techId);
    _checkSynergies(entry.techId);
    log('tech researched:', entry.techId);
  }
}

/**
 * Check if any mastery group was completed by the newly-researched tech.
 * Emits MASTERY_UNLOCKED when a group is newly completed.
 */
function _checkMasteries(techId) {
  if (!state.masteries) state.masteries = {};
  for (const group of MASTERY_GROUPS) {
    if (state.masteries[group.id]) continue;           // already unlocked
    if (!group.techs.includes(techId)) continue;       // new tech not in this group
    if (!group.techs.every(t => state.techs[t])) continue; // group not yet complete
    state.masteries[group.id] = state.tick;
    recalcRates();
    addMessage(`🎓 ${group.name} achieved! ${group.bonusLabel}`, 'tech');
    emit(Events.MASTERY_UNLOCKED, { id: group.id });
  }
}

/**
 * Check if any tech synergy was completed by the newly-researched tech.
 * Emits SYNERGY_UNLOCKED and logs a message when a synergy pair is newly complete.
 */
function _checkSynergies(techId) {
  for (const [id, syn] of Object.entries(SYNERGIES)) {
    if (!syn.techs.includes(techId)) continue;       // new tech not in this synergy
    if (!syn.techs.every(t => state.techs[t])) continue; // pair not yet complete
    addMessage(`✨ Synergy unlocked: ${syn.icon} ${syn.name}! ${syn.effectDesc}`, 'tech');
    emit(Events.SYNERGY_UNLOCKED, { id });
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

  // T091: Mage Council alliance bonus — +30% research speed (70% of base time)
  if (state.diplomacy?.empires.some(e => e.id === 'mageCouncil' && e.relations === 'allied')) {
    totalTicks = Math.ceil(totalTicks * 0.70);
  }

  // T096: Citizen scholars reduce research time by 5% per assigned slot (capped at 50%)
  const scholarSlots = state.citizenRoles?.scholars ?? 0;
  if (scholarSlots > 0) {
    const scholarMult = Math.max(0.50, 1 - scholarSlots * 0.05);
    totalTicks = Math.ceil(totalTicks * scholarMult);
  }

  // T100: Grand Academy capital plan — -25% research time
  if (state.capitalPlan === 'academy') {
    totalTicks = Math.ceil(totalTicks * 0.75);
  }

  // T116: Workshop Boost inspiration discount — -20% time, consumed on use
  if (state.researchInspiration?.workshopDiscount) {
    totalTicks = Math.ceil(totalTicks * 0.80);
    state.researchInspiration.workshopDiscount = false;
    addMessage('⚗️ Workshop Discount applied! (−20% research time)', 'tech');
  }

  // T119: war_scholar commander trait — −20% research time
  if (state.hero?.recruited && state.hero.trait === 'war_scholar' && !state.hero.pendingTrait) {
    totalTicks = Math.ceil(totalTicks * 0.80);
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
