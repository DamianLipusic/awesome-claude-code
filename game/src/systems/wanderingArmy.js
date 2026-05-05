/**
 * EmpireOS — T200: Wandering Army System.
 *
 * Every 8-12 minutes (Bronze Age+), a wandering mercenary band appears and
 * offers their services. The player has 90 seconds to decide:
 *
 *   Hire       — pay gold + food to recruit units at standard rate.
 *   Negotiate  — pay +40 extra gold for 50% more units (rounded up).
 *   Dismiss    — no cost, no gain; band moves on.
 *
 * Army composition varies by current age and has 4 bands:
 *   Iron Wanderers (soldiers), Forest Raiders (archers),
 *   Steel Mercenaries (knights, Iron Age+), Mage Band (mages, Medieval+).
 *
 * state.wanderingArmy = {
 *   current: {
 *     unitId, count, goldCost, foodCost, expiresAt,
 *     icon, name, negotiateCost, negotiateCount
 *   } | null,
 *   nextSpawnTick: number,
 *   totalHired:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const MIN_AGE           = 1; // Bronze Age
const OFFER_TICKS       = 90 * TICKS_PER_SECOND;   // 360 ticks = 90 s
const SPAWN_MIN_TICKS   = 8  * 60 * TICKS_PER_SECOND;  // 1920 ticks = 8 min
const SPAWN_MAX_TICKS   = 12 * 60 * TICKS_PER_SECOND;  // 2880 ticks = 12 min
const NEGOTIATE_EXTRA   = 40;   // extra gold for negotiate
const NEGOTIATE_BONUS   = 0.50; // +50% units

// ── Army pool ──────────────────────────────────────────────────────────────

const ARMY_POOL = [
  {
    id:       'iron_wanderers',
    unitId:   'soldier',
    icon:     '⚔️',
    name:     'Iron Wanderers',
    minAge:   1,
    count:    8,
    goldCost: 60,
    foodCost: 30,
  },
  {
    id:       'forest_raiders',
    unitId:   'archer',
    icon:     '🏹',
    name:     'Forest Raiders',
    minAge:   1,
    count:    7,
    goldCost: 55,
    foodCost: 25,
  },
  {
    id:       'steel_mercenaries',
    unitId:   'knight',
    icon:     '🛡️',
    name:     'Steel Mercenaries',
    minAge:   2, // Iron Age
    count:    5,
    goldCost: 90,
    foodCost: 40,
  },
  {
    id:       'mage_band',
    unitId:   'mage',
    icon:     '🔮',
    name:     'Arcane Mage Band',
    minAge:   3, // Medieval
    count:    4,
    goldCost: 110,
    foodCost: 20,
  },
];

// ── Init ───────────────────────────────────────────────────────────────────

export function initWanderingArmy() {
  if (!state.wanderingArmy) {
    state.wanderingArmy = {
      current:       null,
      nextSpawnTick: SPAWN_MIN_TICKS + Math.floor(Math.random() * (SPAWN_MAX_TICKS - SPAWN_MIN_TICKS)),
      totalHired:    0,
    };
  } else {
    if (state.wanderingArmy.totalHired === undefined) state.wanderingArmy.totalHired = 0;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns current offer data, or null. */
export function getWanderingArmyOffer() {
  return state.wanderingArmy?.current ?? null;
}

/** Seconds left on the active offer (0 if none). */
export function getWanderingArmySecsLeft() {
  const cur = state.wanderingArmy?.current;
  if (!cur) return 0;
  return Math.max(0, Math.ceil((cur.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Hire the wandering army at the standard rate.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function hireWanderingArmy() {
  return _doHire(false);
}

/**
 * Negotiate with the wandering army — pay +40g for +50% units.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function negotiateWanderingArmy() {
  return _doHire(true);
}

/**
 * Dismiss the wandering army offer.
 * @returns {{ ok: boolean }}
 */
export function dismissWanderingArmy() {
  if (!state.wanderingArmy?.current) return { ok: false };
  const name = state.wanderingArmy.current.name;
  _clearCurrent();
  addMessage(`⚔️ ${name} moved on — offer dismissed.`, 'info');
  emit(Events.WANDERING_ARMY_CHANGED, { type: 'dismissed' });
  return { ok: true };
}

// ── Tick ───────────────────────────────────────────────────────────────────

export function wanderingArmyTick() {
  if (!state.wanderingArmy) initWanderingArmy();
  if ((state.age ?? 0) < MIN_AGE) return;

  const wa = state.wanderingArmy;

  // Expire active offer
  if (wa.current && state.tick >= wa.current.expiresAt) {
    const name = wa.current.name;
    _clearCurrent();
    addMessage(`⚔️ ${name} grew impatient and marched away.`, 'info');
    emit(Events.WANDERING_ARMY_CHANGED, { type: 'expired' });
    return;
  }

  // Spawn new offer
  if (!wa.current && state.tick >= wa.nextSpawnTick) {
    _spawnArmy();
  }
}

// ── Internal ───────────────────────────────────────────────────────────────

function _spawnArmy() {
  const age      = state.age ?? 0;
  const eligible = ARMY_POOL.filter(a => a.minAge <= age);
  if (eligible.length === 0) return;

  const def = eligible[Math.floor(Math.random() * eligible.length)];
  const negotiateCount = Math.ceil(def.count * (1 + NEGOTIATE_BONUS));
  const negotiateCost  = def.goldCost + NEGOTIATE_EXTRA;

  state.wanderingArmy.current = {
    armyId:          def.id,
    unitId:          def.unitId,
    icon:            def.icon,
    name:            def.name,
    count:           def.count,
    goldCost:        def.goldCost,
    foodCost:        def.foodCost,
    negotiateCost,
    negotiateCount,
    expiresAt:       state.tick + OFFER_TICKS,
  };

  emit(Events.WANDERING_ARMY_CHANGED, { type: 'spawned', armyId: def.id });
  addMessage(
    `⚔️ ${def.icon} ${def.name} offers their services — ${def.count} ${def.unitId}s for ${def.goldCost}g+${def.foodCost} food. (90s to decide)`,
    'quest',
  );
}

function _doHire(negotiate) {
  const wa = state.wanderingArmy;
  if (!wa?.current) return { ok: false, reason: 'No wandering army offer available.' };

  const cur       = wa.current;
  const goldCost  = negotiate ? cur.negotiateCost  : cur.goldCost;
  const foodCost  = cur.foodCost;
  const unitCount = negotiate ? cur.negotiateCount : cur.count;

  if ((state.resources.gold ?? 0) < goldCost)
    return { ok: false, reason: `Need ${goldCost} gold to hire.` };
  if ((state.resources.food ?? 0) < foodCost)
    return { ok: false, reason: `Need ${foodCost} food to hire.` };

  state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - goldCost);
  state.resources.food = Math.max(0, (state.resources.food ?? 0) - foodCost);

  if (!state.units) state.units = {};
  state.units[cur.unitId] = (state.units[cur.unitId] ?? 0) + unitCount;

  wa.totalHired += unitCount;

  const name       = cur.name;
  const unitId     = cur.unitId;
  const modeLabel  = negotiate ? ' (negotiated)' : '';

  _clearCurrent();

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.UNIT_CHANGED, {});
  emit(Events.WANDERING_ARMY_CHANGED, { type: 'hired', unitId, count: unitCount });
  addMessage(
    `⚔️ ${name} enlisted${modeLabel}! +${unitCount} ${unitId}s (−${goldCost}g, −${foodCost} food).`,
    'windfall',
  );
  return { ok: true, count: unitCount };
}

function _clearCurrent() {
  const wa = state.wanderingArmy;
  if (!wa) return;
  wa.current = null;
  wa.nextSpawnTick = state.tick + SPAWN_MIN_TICKS + Math.floor(Math.random() * (SPAWN_MAX_TICKS - SPAWN_MIN_TICKS));
}
