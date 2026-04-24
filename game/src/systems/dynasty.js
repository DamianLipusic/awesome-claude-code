/**
 * EmpireOS — Dynastic Succession System (T152).
 *
 * Every 2400 ticks (10 min) the empire's ruler passes power to an heir.
 * The player chooses an heir archetype within 30 s (120 ticks):
 *   Warrior  — +15% combat attack power
 *   Diplomat — +0.5 gold/s
 *   Scholar  — +10% research speed + +0.5 mana/s
 *
 * If no choice is made before the deadline, a Regency period applies −20%
 * all positive rates for 2 min (480 ticks), after which a random heir is
 * auto-selected.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { recalcRates } from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SUCCESSION_INTERVAL = 2400;  // ticks between successions (~10 min)
const CHOICE_WINDOW       = 120;   // ticks to choose heir before auto-select (30 s)
const REGENCY_DURATION    = 480;   // ticks of −20% rate penalty (2 min)

const HEIR_TYPES = ['warrior', 'diplomat', 'scholar'];

export const HEIR_DEFS = {
  warrior: {
    icon: '⚔️',
    name: 'Warrior Heir',
    desc: 'A militant ruler who inspires the army. +15% combat attack power.',
    bonuses: { combat: 0.15 },
  },
  diplomat: {
    icon: '🤝',
    name: 'Diplomat Heir',
    desc: 'A wise ruler who fosters trade and prosperity. +0.5 gold/s.',
    bonuses: { gold: 0.5 },
  },
  scholar: {
    icon: '📚',
    name: 'Scholar Heir',
    desc: 'An intellectual ruler who advances knowledge. +10% research speed, +0.5 mana/s.',
    bonuses: { research: 0.10, mana: 0.5 },
  },
};

export function initDynasty() {
  if (!state.dynasty) {
    state.dynasty = {
      generation:         1,
      currentHeir:        null,
      nextSuccessionTick: SUCCESSION_INTERVAL,
      pendingSuccession:  false,
      successionDeadline: null,
      regencyUntil:       null,
      totalSuccessions:   0,
    };
  }
}

export function dynastyTick() {
  if (!state.dynasty) initDynasty();
  const d = state.dynasty;

  // End regency when time has passed
  if (d.regencyUntil !== null && state.tick >= d.regencyUntil) {
    d.regencyUntil = null;
    recalcRates();
    addMessage('👑 The regency period has ended. Your new ruler consolidates power.', 'info');
    emit(Events.HEIR_CHOSEN, { heirType: d.currentHeir, fromRegency: true });
  }

  // Auto-choose if succession window expired without player input
  if (d.pendingSuccession && d.successionDeadline !== null && state.tick >= d.successionDeadline) {
    _autoChooseHeir();
    return;
  }

  // Fire succession event when interval elapses
  if (!d.pendingSuccession && state.tick >= d.nextSuccessionTick) {
    d.pendingSuccession   = true;
    d.successionDeadline  = state.tick + CHOICE_WINDOW;
    emit(Events.SUCCESSION_EVENT, { generation: d.generation + 1 });
  }
}

function _autoChooseHeir() {
  const d = state.dynasty;
  const random = HEIR_TYPES[Math.floor(Math.random() * HEIR_TYPES.length)];
  d.currentHeir        = random;
  d.pendingSuccession  = false;
  d.successionDeadline = null;
  d.regencyUntil       = state.tick + REGENCY_DURATION;
  d.generation++;
  d.totalSuccessions++;
  d.nextSuccessionTick = state.tick + SUCCESSION_INTERVAL;

  recalcRates();
  const def = HEIR_DEFS[random];
  addMessage(
    `⚠️ No heir was named! The council has chosen a ${def.name} during a regency period. All production −20% for 2 minutes.`,
    'danger',
  );
  emit(Events.HEIR_CHOSEN, { heirType: random, wasAuto: true, generation: d.generation });
}

/**
 * Player selects an heir archetype. Called from the succession modal.
 * @param {'warrior'|'diplomat'|'scholar'} heirType
 */
export function chooseHeir(heirType) {
  if (!state.dynasty) return { ok: false, reason: 'Dynasty system not initialised.' };
  if (!state.dynasty.pendingSuccession) return { ok: false, reason: 'No succession is pending.' };
  if (!HEIR_DEFS[heirType]) return { ok: false, reason: 'Unknown heir type.' };

  const d = state.dynasty;
  d.currentHeir        = heirType;
  d.pendingSuccession  = false;
  d.successionDeadline = null;
  d.generation++;
  d.totalSuccessions++;
  d.nextSuccessionTick = state.tick + SUCCESSION_INTERVAL;

  recalcRates();
  const def = HEIR_DEFS[heirType];
  addMessage(
    `👑 Generation ${d.generation}: ${def.icon} ${def.name} ascends the throne! ${def.desc}`,
    'achievement',
  );
  emit(Events.HEIR_CHOSEN, { heirType, generation: d.generation, wasAuto: false });
  return { ok: true };
}

/** Seconds remaining in the succession choice window (0 if no pending succession). */
export function getSuccessionSecsLeft() {
  if (!state.dynasty?.pendingSuccession || state.dynasty.successionDeadline === null) return 0;
  return Math.max(0, Math.ceil((state.dynasty.successionDeadline - state.tick) / TICKS_PER_SECOND));
}

/** Seconds remaining in the regency penalty period (0 if no active regency). */
export function getRegencySecsLeft() {
  if (!state.dynasty?.regencyUntil) return 0;
  return Math.max(0, Math.ceil((state.dynasty.regencyUntil - state.tick) / TICKS_PER_SECOND));
}
