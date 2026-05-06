/**
 * EmpireOS — T212: Dynamic Enemy Counteroffensive.
 *
 * When the player captures 3+ tiles from the same AI faction within a
 * 2-minute window (480 ticks), that faction launches an 8-minute
 * counteroffensive:
 *   - Expansion rate 3× faster during the window
 *   - Counterattack win chance multiplied by ×1.4 for that faction
 *
 * Only one counteroffensive may be active per faction at a time.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { EMPIRES } from '../data/empires.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

export const CAPTURE_WINDOW         = 2  * 60 * TICKS_PER_SECOND;  // 480 ticks (2 min)
export const CAPTURE_THRESHOLD      = 3;
export const COUNTEROFFENSIVE_TICKS = 8  * 60 * TICKS_PER_SECOND;  // 1920 ticks (8 min)
export const COFF_EXPAND_MULT       = 3;    // 3× faster expansion
export const COFF_ATTACK_MULT       = 1.4;  // +40% counterattack win chance

export function initCounteroffensive() {
  if (!state.counteroffensives) {
    state.counteroffensives = {
      recentCaptures: {},
      active: {},
      totalLaunched: 0,
    };
  }
}

/**
 * Call this from combat.js when the player captures a tile belonging to an
 * AI faction. Checks if a counteroffensive should be triggered.
 */
export function recordFactionCapture(factionId) {
  if (!factionId || !state.counteroffensives) return;
  const co = state.counteroffensives;

  // Initialise capture list for this faction
  if (!co.recentCaptures[factionId]) co.recentCaptures[factionId] = [];

  // Prune entries older than the capture window
  const cutoff = state.tick - CAPTURE_WINDOW;
  co.recentCaptures[factionId] = co.recentCaptures[factionId].filter(e => e.tick > cutoff);

  // Record this capture
  co.recentCaptures[factionId].push({ tick: state.tick });

  // Check threshold — only launch if not already in a counteroffensive
  if (
    co.recentCaptures[factionId].length >= CAPTURE_THRESHOLD &&
    !co.active[factionId]
  ) {
    co.active[factionId] = {
      expiresAt:   state.tick + COUNTEROFFENSIVE_TICKS,
      launchedAt:  state.tick,
    };
    co.recentCaptures[factionId] = []; // reset window
    co.totalLaunched++;

    const def = EMPIRES[factionId];
    const name = def ? `${def.icon} ${def.name}` : factionId;
    addMessage(
      `⚠️ ${name} launches a COUNTEROFFENSIVE! Their forces are pushing back hard for 8 minutes.`,
      'raid',
    );
    emit(Events.COUNTEROFFENSIVE, { factionId, expiresAt: co.active[factionId].expiresAt });
  }
}

/** Returns an array of active counteroffensives: [{factionId, expiresAt, launchedAt}]. */
export function getActiveCounteroffensives() {
  if (!state.counteroffensives) return [];
  return Object.entries(state.counteroffensives.active).map(([factionId, data]) => ({
    factionId,
    ...data,
  }));
}

/**
 * Returns combat multipliers for a specific faction.
 * expandMult: how many extra expansions to fire per interval.
 * attackMult: factor applied to counterattack winChance.
 */
export function getCounteroffensiveMultipliers(factionId) {
  const active = state.counteroffensives?.active?.[factionId];
  if (!active || state.tick >= active.expiresAt) return { expandMult: 1, attackMult: 1 };
  return { expandMult: COFF_EXPAND_MULT, attackMult: COFF_ATTACK_MULT };
}

/** Seconds remaining for a specific faction's counteroffensive (0 if inactive). */
export function getCounteroffensiveSecs(factionId) {
  const active = state.counteroffensives?.active?.[factionId];
  if (!active) return 0;
  return Math.max(0, Math.ceil((active.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/** Registered tick system — prunes expired counteroffensives. */
export function counteroffensiveTick() {
  if (!state.counteroffensives) return;
  const active = state.counteroffensives.active;
  for (const factionId of Object.keys(active)) {
    if (state.tick >= active[factionId].expiresAt) {
      delete active[factionId];
      const def = EMPIRES[factionId];
      const name = def ? `${def.icon} ${def.name}` : factionId;
      addMessage(`✅ ${name} counteroffensive has ended.`, 'info');
      emit(Events.COUNTEROFFENSIVE, { factionId, expired: true });
    }
  }
}
