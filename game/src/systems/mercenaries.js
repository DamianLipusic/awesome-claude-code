/**
 * EmpireOS — Mercenary Contracts system (T075).
 *
 * Every 5–8 minutes a mercenary offer appears in the Military panel.
 * The offer lasts 60 seconds; if not hired it expires and the mercenary
 * moves on.  Hiring is instant (no training queue) and costs 2.5× the
 * unit's base gold cost.  Mercenaries join the regular army and have no
 * upkeep (they fight for glory, not food).
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { UNITS } from '../data/units.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { recalcRates } from './resources.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN_TICKS    = 5 * 60 * TICKS_PER_SECOND;   // 5 min  = 1200 ticks
const SPAWN_MAX_TICKS    = 8 * 60 * TICKS_PER_SECOND;   // 8 min  = 1920 ticks
const OFFER_DURATION     = 60 * TICKS_PER_SECOND;       // 60 s   =  240 ticks
const COST_MULTIPLIER    = 2.5;
const MIN_COST           = 120;

// Unit IDs ordered from least to most powerful
const UNIT_ORDER = ['soldier', 'archer', 'knight', 'mage'];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Pick a unit to offer.  Skips units whose tech/building/age requirements
 * the player hasn't met yet.
 */
function _pickUnit() {
  const eligible = UNIT_ORDER.filter(uid => {
    const def = UNITS[uid];
    if (!def) return false;
    for (const req of (def.requires ?? [])) {
      if (req.type === 'age'      && (state.age ?? 0) < (req.minAge ?? 0)) return false;
      if (req.type === 'tech'     && !state.techs?.[req.id])               return false;
      if (req.type === 'building' && !(state.buildings?.[req.id] ?? 0))   return false;
    }
    return true;
  });
  if (eligible.length === 0) return 'soldier';
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/** Gold cost to hire the mercenary: 2.5× the unit's base gold cost. */
function _mercCost(unitId) {
  const def = UNITS[unitId];
  if (!def) return MIN_COST;
  // Use the unit's gold cost as the base; fall back to a fraction of total cost
  const baseGold = def.cost.gold ?? Math.round(
    Object.values(def.cost).reduce((a, b) => a + b, 0) * 0.6,
  );
  return Math.max(MIN_COST, Math.round(baseGold * COST_MULTIPLIER));
}

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN_TICKS +
    Math.floor(Math.random() * (SPAWN_MAX_TICKS - SPAWN_MIN_TICKS));
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Called once during boot and after New Game.
 * Leaves existing save data intact; seeds fresh state otherwise.
 */
export function initMercenaries() {
  if (!state.mercenaries) {
    state.mercenaries = {
      current:       null,
      nextOfferTick: _nextSpawnTick(),
      totalHired:    0,
    };
  } else {
    // Migration guard for older saves
    if (state.mercenaries.totalHired === undefined) state.mercenaries.totalHired = 0;
  }
}

/**
 * Registered as a tick system.  Expires stale offers and spawns new ones.
 */
export function mercenaryTick() {
  const m = state.mercenaries;
  if (!m) return;

  // Expire current offer if the window has passed
  if (m.current && state.tick >= m.current.expiresAt) {
    const def = UNITS[m.current.unitId];
    addMessage(
      `⏰ The mercenary ${def?.name ?? m.current.unitId} moved on — offer expired.`,
      'info',
    );
    m.current       = null;
    m.nextOfferTick = _nextSpawnTick();
    emit(Events.MERCENARY_CHANGED, {});
  }

  // Spawn a new offer when the cooldown has elapsed
  if (!m.current && state.tick >= m.nextOfferTick) {
    const unitId = _pickUnit();
    const cost   = _mercCost(unitId);
    const def    = UNITS[unitId];
    m.current = { unitId, cost, expiresAt: state.tick + OFFER_DURATION };
    addMessage(
      `⚔️ Mercenary ${def?.icon ?? ''} ${def?.name ?? unitId} available for hire! ` +
      `(${cost} 💰, 60 s window)`,
      'windfall',
    );
    emit(Events.MERCENARY_CHANGED, {});
  }
}

/**
 * Hire the current mercenary offer.
 * Instant recruitment — unit joins the army immediately with no training time.
 * No upkeep is charged (they fight for a one-time fee).
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
export function hireMercenary() {
  const m = state.mercenaries;
  if (!m?.current) return { ok: false, reason: 'No mercenary currently available.' };
  const { unitId, cost } = m.current;
  if ((state.resources.gold ?? 0) < cost) {
    return { ok: false, reason: `Need ${cost} gold to hire this mercenary.` };
  }

  // Deduct gold and add the unit instantly
  state.resources.gold         -= cost;
  state.units[unitId]           = (state.units[unitId] ?? 0) + 1;
  m.current                     = null;
  m.nextOfferTick               = _nextSpawnTick();
  m.totalHired                  = (m.totalHired ?? 0) + 1;

  // Upkeep recalc (new unit may consume food/mana)
  recalcRates();

  const def = UNITS[unitId];
  addMessage(
    `⚔️ Hired mercenary ${def?.icon ?? ''} ${def?.name ?? unitId}! They march under your banner.`,
    'quest',
  );
  emit(Events.UNIT_CHANGED,      {});
  emit(Events.RESOURCE_CHANGED,  {});
  emit(Events.MERCENARY_CHANGED, {});
  return { ok: true };
}

/**
 * Returns the seconds remaining on the current offer, or null if none.
 */
export function mercenarySecsLeft() {
  const m = state.mercenaries;
  if (!m?.current) return null;
  return Math.max(0, Math.ceil((m.current.expiresAt - state.tick) / TICKS_PER_SECOND));
}
