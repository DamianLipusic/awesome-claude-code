/**
 * EmpireOS — Research Inspiration Events (T116).
 *
 * Random "flash of inspiration" events fire every 3–5 minutes when research
 * is actively in progress. The player can Accept (apply effect) or Dismiss.
 * Three types: Breakthrough (-25% remaining time), Mana Surge (+40 mana),
 * Workshop Boost (-20% time on next research queued).
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN    = 3 * 60 * TICKS_PER_SECOND;  // 720 ticks (3 min)
const SPAWN_MAX    = 5 * 60 * TICKS_PER_SECOND;  // 1200 ticks (5 min)
const EXPIRE_TICKS = 90 * TICKS_PER_SECOND;      // 360 ticks (90 s)

export const INSPIRATION_TYPES = [
  {
    id:         'breakthrough',
    icon:       '💡',
    name:       'Breakthrough!',
    desc:       'A researcher cracks a key problem, cutting remaining research time by 25%.',
    effectDesc: '−25% remaining time on current research',
  },
  {
    id:         'mana_surge',
    icon:       '🌀',
    name:       'Mana Surge',
    desc:       'Arcane energies infuse the scholars, granting a rush of mana.',
    effectDesc: '+40 mana',
  },
  {
    id:         'workshop_boost',
    icon:       '⚗️',
    name:       'Workshop Discovery',
    desc:       'A clever shortcut is found in the workshops. Your next research takes less time.',
    effectDesc: '−20% time for the next research queued',
  },
];

/** Initialise (or migrate) research inspiration state. Called on boot and new game. */
export function initInspiration() {
  if (!state.researchInspiration) {
    state.researchInspiration = {
      pending:          null,
      workshopDiscount: false,
      nextCheckTick:    state.tick + _nextInterval(),
    };
  } else {
    // Migration guard for saves without this field
    if (state.researchInspiration.nextCheckTick === undefined) {
      state.researchInspiration.nextCheckTick = state.tick + _nextInterval();
    }
  }
}

/** Registered as a tick system. Spawns and expires inspiration events. */
export function inspirationTick() {
  if (!state.researchInspiration) return;
  const insp = state.researchInspiration;

  // Expire a pending event the player ignored
  if (insp.pending && state.tick >= insp.pending.expiresAt) {
    insp.pending = null;
    insp.nextCheckTick = state.tick + _nextInterval();
    emit(Events.RESEARCH_INSPIRATION, { type: 'expired' });
    return;
  }

  // Only spawn when research is active and no pending event
  if (insp.pending) return;
  if (state.researchQueue.length === 0) return;
  if (state.tick < insp.nextCheckTick) return;

  const def = INSPIRATION_TYPES[Math.floor(Math.random() * INSPIRATION_TYPES.length)];
  insp.pending = { typeId: def.id, expiresAt: state.tick + EXPIRE_TICKS };
  addMessage(`${def.icon} ${def.name} — ${def.effectDesc}`, 'research');
  emit(Events.RESEARCH_INSPIRATION, { type: 'spawned', typeId: def.id });
}

/** Accept the current pending inspiration and apply its effect. */
export function acceptInspiration() {
  const insp = state.researchInspiration;
  if (!insp?.pending) return { ok: false, reason: 'No pending inspiration.' };

  const { typeId } = insp.pending;
  insp.pending = null;
  insp.nextCheckTick = state.tick + _nextInterval();

  switch (typeId) {
    case 'breakthrough':
      if (state.researchQueue.length > 0) {
        const entry  = state.researchQueue[0];
        const cut    = Math.floor(entry.remaining * 0.25);
        entry.remaining = Math.max(1, entry.remaining - cut);
        addMessage(`💡 Breakthrough! Research accelerated (−${Math.ceil(cut / TICKS_PER_SECOND)}s).`, 'tech');
      }
      break;
    case 'mana_surge':
      state.resources.mana = Math.min(
        state.caps.mana ?? 500,
        (state.resources.mana ?? 0) + 40,
      );
      addMessage('🌀 Mana Surge! +40 mana gathered.', 'windfall');
      emit(Events.RESOURCE_CHANGED, {});
      break;
    case 'workshop_boost':
      insp.workshopDiscount = true;
      addMessage('⚗️ Workshop Discovery! Next research will take 20% less time.', 'tech');
      break;
  }

  emit(Events.RESEARCH_INSPIRATION, { type: 'accepted', typeId });
  emit(Events.TECH_CHANGED, {});
  return { ok: true };
}

/** Dismiss the pending inspiration without effect. */
export function dismissInspiration() {
  const insp = state.researchInspiration;
  if (!insp?.pending) return { ok: false, reason: 'No pending inspiration.' };
  insp.pending = null;
  insp.nextCheckTick = state.tick + _nextInterval();
  emit(Events.RESEARCH_INSPIRATION, { type: 'dismissed' });
  return { ok: true };
}

/** Seconds remaining before the pending event auto-expires. */
export function getInspirationSecsLeft() {
  const insp = state.researchInspiration;
  if (!insp?.pending) return 0;
  return Math.max(0, Math.ceil((insp.pending.expiresAt - state.tick) / TICKS_PER_SECOND));
}

function _nextInterval() {
  return SPAWN_MIN + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));
}
