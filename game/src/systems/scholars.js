/**
 * EmpireOS — Wandering Scholar Events (T134).
 *
 * Every 5–8 minutes, a wandering scholar visits and offers one of 5 teachings.
 * A green banner appears for 60 seconds; player clicks Accept or Dismiss.
 *
 * Teachings:
 *   arcane_revelation  — +150 mana instantly
 *   agricultural_wisdom — +100% food & wood rates for 90s (via resources.js)
 *   military_doctrine  — next 3 units trained at 50% cost (consumed in actions.js)
 *   trade_secrets      — next 3 market sells at +50% gold (consumed in market.js)
 *   engineering_plans  — buildings cost 40% less for 90s (consumed in actions.js)
 *
 * State shape:
 *   state.scholar = {
 *     active:        { teachingId, icon, name, desc, expiresAt } | null,
 *     nextScholarTick: number,
 *     totalAccepted: number,
 *     activeEffect:  { type, expiresAt?, chargesLeft? } | null,
 *   }
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';
import { recalcRates }  from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN_TICKS = 5 * 60 * TICKS_PER_SECOND;   // 5 min
const SPAWN_MAX_TICKS = 8 * 60 * TICKS_PER_SECOND;   // 8 min
const VISIT_DURATION  = 60 * TICKS_PER_SECOND;        // 60 s visit window

const TEACHINGS = [
  {
    id:   'arcane_revelation',
    icon: '🔮',
    name: 'Arcane Revelation',
    desc: 'Grants +150 mana instantly.',
  },
  {
    id:   'agricultural_wisdom',
    icon: '🌾',
    name: 'Agricultural Wisdom',
    desc: '+100% food and wood production for 90 seconds.',
  },
  {
    id:   'military_doctrine',
    icon: '⚔️',
    name: 'Military Doctrine',
    desc: 'Next 3 units trained at 50% resource cost.',
  },
  {
    id:   'trade_secrets',
    icon: '💰',
    name: 'Trade Secrets',
    desc: 'Next 3 market sells grant +50% gold.',
  },
  {
    id:   'engineering_plans',
    icon: '🏗️',
    name: 'Engineering Plans',
    desc: 'Buildings cost 40% less for 90 seconds.',
  },
];

// ── Public API ─────────────────────────────────────────────────────────────

export function initScholars() {
  if (state.scholar) return;
  state.scholar = {
    active:          null,
    nextScholarTick: state.tick + _nextInterval(),
    totalAccepted:   0,
    activeEffect:    null,
  };
}

export function scholarTick() {
  if (!state.scholar) return;

  // Expire timed active effects
  const eff = state.scholar.activeEffect;
  if (eff?.expiresAt && state.tick >= eff.expiresAt) {
    state.scholar.activeEffect = null;
    recalcRates();
    emit(Events.RESOURCE_CHANGED, {});
  }

  // Expire active visit if timeout reached
  if (state.scholar.active && state.tick >= state.scholar.active.expiresAt) {
    state.scholar.active = null;
    emit(Events.SCHOLAR_CHANGED, { phase: 'expired' });
  }

  // Spawn a new scholar when timer fires (only if no visit is active)
  if (!state.scholar.active && state.tick >= state.scholar.nextScholarTick) {
    _spawnScholar();
  }
}

export function acceptTeaching() {
  const visit = state.scholar?.active;
  if (!visit) return;

  const def = TEACHINGS.find(t => t.id === visit.teachingId);
  if (!def) return;

  state.scholar.active       = null;
  state.scholar.totalAccepted = (state.scholar.totalAccepted ?? 0) + 1;
  state.scholar.nextScholarTick = state.tick + _nextInterval();

  _applyTeaching(def);
  emit(Events.SCHOLAR_CHANGED, { phase: 'accepted', teachingId: def.id });
}

export function dismissScholar() {
  if (!state.scholar?.active) return;
  state.scholar.active          = null;
  state.scholar.nextScholarTick = state.tick + _nextInterval();
  emit(Events.SCHOLAR_CHANGED, { phase: 'dismissed' });
  addMessage('📚 The wandering scholar departs.', 'info');
}

// ── Internal ───────────────────────────────────────────────────────────────

function _nextInterval() {
  return SPAWN_MIN_TICKS + Math.floor(Math.random() * (SPAWN_MAX_TICKS - SPAWN_MIN_TICKS));
}

function _spawnScholar() {
  const def = TEACHINGS[Math.floor(Math.random() * TEACHINGS.length)];
  state.scholar.active = {
    teachingId: def.id,
    icon:       def.icon,
    name:       def.name,
    desc:       def.desc,
    expiresAt:  state.tick + VISIT_DURATION,
  };
  addMessage(`📚 A wandering scholar offers: ${def.icon} ${def.name}. Accept within 60s!`, 'windfall');
  emit(Events.SCHOLAR_CHANGED, { phase: 'arrived', teachingId: def.id });
}

function _applyTeaching(def) {
  switch (def.id) {
    case 'arcane_revelation': {
      const gain = Math.min(150, (state.caps.mana ?? 500) - (state.resources.mana ?? 0));
      state.resources.mana = (state.resources.mana ?? 0) + gain;
      addMessage(`🔮 Arcane Revelation: +${gain} mana granted!`, 'windfall');
      emit(Events.RESOURCE_CHANGED, {});
      break;
    }
    case 'agricultural_wisdom': {
      state.scholar.activeEffect = { type: 'agricultural_wisdom', expiresAt: state.tick + 90 * TICKS_PER_SECOND };
      recalcRates();
      addMessage('🌾 Agricultural Wisdom: +100% food & wood for 90s!', 'windfall');
      emit(Events.RESOURCE_CHANGED, {});
      break;
    }
    case 'military_doctrine': {
      state.scholar.activeEffect = { type: 'military_doctrine', chargesLeft: 3 };
      addMessage('⚔️ Military Doctrine: next 3 units train at 50% cost!', 'windfall');
      break;
    }
    case 'trade_secrets': {
      state.scholar.activeEffect = { type: 'trade_secrets', chargesLeft: 3 };
      addMessage('💰 Trade Secrets: next 3 market sells give +50% gold!', 'windfall');
      break;
    }
    case 'engineering_plans': {
      state.scholar.activeEffect = { type: 'engineering_plans', expiresAt: state.tick + 90 * TICKS_PER_SECOND };
      addMessage('🏗️ Engineering Plans: buildings cost 40% less for 90s!', 'windfall');
      break;
    }
  }
}
