/**
 * EmpireOS — Celestial Events system (T153).
 *
 * Every ~15 minutes a random astronomical event fires after a 30-second warning.
 * Effects are applied passively via state.celestial.active.type checks in
 * resources.js, combat.js, research.js, and spells.js — no imports needed there.
 *
 * Events: CELESTIAL_WARNING → CELESTIAL_ACTIVE → CELESTIAL_CLEARED
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { changeMorale } from './morale.js';
import { recalcRates } from './resources.js';
import { CELESTIAL_EVENTS, CELESTIAL_ORDER } from '../data/celestialEvents.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const CELESTIAL_INTERVAL = 3600; // ticks between events (~15 min at 4 tps)
const WARNING_LEAD       = 120;  // ticks of warning before event fires (30 s)

export function initCelestial() {
  if (!state.celestial) {
    state.celestial = {
      nextEventTick: CELESTIAL_INTERVAL,
      pending:       null,  // { type, fireAt }
      active:        null,  // { type, expiresAt }
      history:       [],    // [{ type, tick }]
    };
  }
}

export function celestialTick() {
  if (!state.celestial) initCelestial();
  const c = state.celestial;

  // Clear expired active event
  if (c.active && state.tick >= c.active.expiresAt) {
    const def  = CELESTIAL_EVENTS[c.active.type];
    c.active   = null;
    recalcRates();
    emit(Events.CELESTIAL_CLEARED, { type: def.id });
    addMessage(def.endMsg, 'info');
  }

  // Activate pending event when the warning window expires
  if (c.pending && state.tick >= c.pending.fireAt) {
    _activate(c.pending.type);
    c.pending = null;
    return;
  }

  // Schedule next warning when the interval arrives (no event currently pending/active)
  if (!c.pending && !c.active && state.tick >= c.nextEventTick) {
    const lastType   = c.history.length > 0 ? c.history[c.history.length - 1].type : null;
    const candidates = CELESTIAL_ORDER.filter(t => t !== lastType);
    const type       = candidates[Math.floor(Math.random() * candidates.length)];

    c.pending       = { type, fireAt: state.tick + WARNING_LEAD };
    c.nextEventTick = state.tick + CELESTIAL_INTERVAL;

    const def = CELESTIAL_EVENTS[type];
    emit(Events.CELESTIAL_WARNING, { type, secsLeft: WARNING_LEAD / TICKS_PER_SECOND });
    addMessage(def.warningMsg, 'quest');
  }
}

function _activate(type) {
  const c   = state.celestial;
  const def = CELESTIAL_EVENTS[type];

  c.active = { type, expiresAt: state.tick + def.duration };
  c.history.push({ type, tick: state.tick });
  if (c.history.length > 10) c.history.shift();

  // Instant on-start effects
  const fx = def.effects;
  if (fx.lootBonus) {
    for (const [res, amt] of Object.entries(fx.lootBonus)) {
      const cap = state.caps[res] ?? 500;
      state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
    }
    emit(Events.RESOURCE_CHANGED, {});
  }
  if (fx.moraleBonus) {
    changeMorale(fx.moraleBonus);
  }

  recalcRates();
  emit(Events.CELESTIAL_ACTIVE, { type, expiresAt: c.active.expiresAt });
  addMessage(def.activeMsg, 'windfall');
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/** Returns the active celestial event definition, or null if none is active. */
export function getActiveCelestial() {
  if (!state.celestial?.active) return null;
  return CELESTIAL_EVENTS[state.celestial.active.type] ?? null;
}

/** Returns seconds remaining in the active celestial event (0 if none). */
export function getCelestialSecsLeft() {
  if (!state.celestial?.active) return 0;
  return Math.max(0, Math.ceil((state.celestial.active.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/** Returns the pending warning info { def, secsLeft } or null if no warning is pending. */
export function getPendingCelestial() {
  if (!state.celestial?.pending) return null;
  const def     = CELESTIAL_EVENTS[state.celestial.pending.type];
  const secsLeft = Math.max(0, Math.ceil((state.celestial.pending.fireAt - state.tick) / TICKS_PER_SECOND));
  return { def, secsLeft };
}
