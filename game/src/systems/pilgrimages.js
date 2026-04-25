/**
 * EmpireOS — Pilgrimage System (T162).
 *
 * Every ~10 minutes (Bronze Age+), pilgrims arrive seeking one of three
 * prestige buildings (colosseum / greatLibrary / grandCathedral).
 * Hosting costs 30 food + 20 gold; awards prestige + morale + a 3-min bonus.
 * Pilgrim groups expire after 3 minutes if not hosted.
 *
 * Three pilgrim types:
 *   artists   → colosseum      → +30 prestige, +5 morale, +0.5 gold/s for 3 min
 *   scholars  → greatLibrary   → +40 prestige, +0 morale, +15% research speed for 4 min
 *   pilgrims  → grandCathedral → +20 prestige, +8 morale, +0.3 mana/s for 3 min
 *
 * state.pilgrimages = {
 *   pending: { type, buildingId, icon, name, desc, expiresAt } | null,
 *   nextPilgrimageTick: tick,
 *   activeBonus: { type, icon, expiresAt } | null,
 *   totalHosted: number,
 * }
 */

import { state }          from '../core/state.js';
import { emit, Events }   from '../core/events.js';
import { addMessage }     from '../core/actions.js';
import { changeMorale }   from './morale.js';
import { awardPrestige }  from './prestige.js';
import { recalcRates }    from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN   = 8  * 60 * TICKS_PER_SECOND;  // 8 min
const SPAWN_MAX   = 12 * 60 * TICKS_PER_SECOND;  // 12 min
const EXPIRE_DURATION = 3 * 60 * TICKS_PER_SECOND; // 3 min window to host
const HOST_GOLD_COST = 20;
const HOST_FOOD_COST = 30;

const PILGRIM_TYPES = [
  {
    type:       'artists',
    buildingId: 'colosseum',
    icon:       '🎭',
    name:       'Travelling Artists',
    desc:       'Performers seek your Colosseum for a grand showcase.',
    prestige:   30,
    morale:     5,
    bonusDuration: 3 * 60 * TICKS_PER_SECOND,
    bonusDesc:  '+0.5 gold/s for 3 min',
  },
  {
    type:       'scholars',
    buildingId: 'greatLibrary',
    icon:       '📚',
    name:       'Wandering Scholars',
    desc:       'Learned sages wish to study in your Great Library.',
    prestige:   40,
    morale:     0,
    bonusDuration: 4 * 60 * TICKS_PER_SECOND,
    bonusDesc:  '+15% research speed for 4 min',
  },
  {
    type:       'pilgrims',
    buildingId: 'grandCathedral',
    icon:       '⛪',
    name:       'Religious Pilgrims',
    desc:       'Devout faithful journey to your Grand Cathedral.',
    prestige:   20,
    morale:     8,
    bonusDuration: 3 * 60 * TICKS_PER_SECOND,
    bonusDesc:  '+0.3 mana/s for 3 min',
  },
];

// ── Public API ──────────────────────────────────────────────────────────────

export function initPilgrimages() {
  if (!state.pilgrimages) {
    state.pilgrimages = {
      pending:            null,
      nextPilgrimageTick: _nextSpawnTick(),
      activeBonus:        null,
      totalHosted:        0,
    };
  }
  // Migration guards
  if (state.pilgrimages.totalHosted  === undefined) state.pilgrimages.totalHosted  = 0;
  if (state.pilgrimages.activeBonus  === undefined) state.pilgrimages.activeBonus  = null;
}

export function pilgrimageTick() {
  if (!state.pilgrimages) return;
  const pg = state.pilgrimages;

  // Expire active bonus
  if (pg.activeBonus && state.tick >= pg.activeBonus.expiresAt) {
    pg.activeBonus = null;
    recalcRates();
    emit(Events.PILGRIMAGE_HOSTED, { expired: true });
  }

  // Expire pending pilgrim visit
  if (pg.pending && state.tick >= pg.pending.expiresAt) {
    addMessage(`${pg.pending.icon} The ${pg.pending.name} departed without a welcome.`, 'info');
    pg.pending = null;
    pg.nextPilgrimageTick = _nextSpawnTick();
    emit(Events.PILGRIMAGE_ARRIVED, { expired: true });
  }

  // Spawn new pilgrims if time and no current pending
  if (!pg.pending && state.tick >= pg.nextPilgrimageTick) {
    if ((state.age ?? 0) >= 1) _spawnPilgrims();
  }
}

/**
 * Host the pending pilgrim group.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function hostPilgrimage() {
  const pg = state.pilgrimages;
  if (!pg?.pending) return { ok: false, reason: 'No pilgrims currently visiting.' };

  const pend = pg.pending;
  if ((state.buildings?.[pend.buildingId] ?? 0) < 1)
    return { ok: false, reason: `Requires a ${pend.buildingId}.` };
  if ((state.resources?.gold ?? 0) < HOST_GOLD_COST)
    return { ok: false, reason: `Need ${HOST_GOLD_COST} gold.` };
  if ((state.resources?.food ?? 0) < HOST_FOOD_COST)
    return { ok: false, reason: `Need ${HOST_FOOD_COST} food.` };

  // Deduct costs
  state.resources.gold -= HOST_GOLD_COST;
  state.resources.food -= HOST_FOOD_COST;
  emit(Events.RESOURCE_CHANGED, {});

  // Find pilgrim def
  const def = PILGRIM_TYPES.find(p => p.type === pend.type);

  // Award prestige and morale
  if (def.prestige > 0) awardPrestige(def.prestige, `${pend.icon} ${pend.name} hosted`);
  if (def.morale  > 0) changeMorale(def.morale);

  // Set active bonus
  pg.activeBonus = {
    type:      def.type,
    icon:      def.icon,
    expiresAt: state.tick + def.bonusDuration,
  };
  pg.totalHosted     += 1;
  pg.pending          = null;
  pg.nextPilgrimageTick = _nextSpawnTick();

  recalcRates();
  addMessage(
    `${def.icon} ${def.name} welcomed! +${def.prestige} prestige${def.morale > 0 ? `, +${def.morale} morale` : ''}. ${def.bonusDesc}.`,
    'windfall'
  );
  emit(Events.PILGRIMAGE_HOSTED, { type: def.type });
  return { ok: true };
}

// ── Internal helpers ────────────────────────────────────────────────────────

function _spawnPilgrims() {
  // Only spawn a type whose building the player has — otherwise defer
  const eligible = PILGRIM_TYPES.filter(p => (state.buildings?.[p.buildingId] ?? 0) >= 1);
  if (eligible.length === 0) {
    state.pilgrimages.nextPilgrimageTick = _nextSpawnTick();
    return;
  }
  const def = eligible[Math.floor(Math.random() * eligible.length)];
  state.pilgrimages.pending = {
    type:       def.type,
    buildingId: def.buildingId,
    icon:       def.icon,
    name:       def.name,
    desc:       def.desc,
    expiresAt:  state.tick + EXPIRE_DURATION,
  };
  addMessage(`${def.icon} ${def.name} have arrived! Host them for prestige and bonuses.`, 'info');
  emit(Events.PILGRIMAGE_ARRIVED, { type: def.type });
}

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));
}
