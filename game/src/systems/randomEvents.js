/**
 * EmpireOS — Random event system.
 *
 * Fires raids, windfalls, and disasters at random intervals (120–240 s).
 * Disaster events push temporary rate modifiers into
 * state.randomEvents.activeModifiers; resources.js reads these in recalcRates().
 */

import { state } from '../core/state.js';
import { addMessage } from '../core/actions.js';
import { recalcRates } from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const MIN_INTERVAL      = 120 * TICKS_PER_SECOND;   // 480 ticks  (~120 s)
const MAX_INTERVAL      = 240 * TICKS_PER_SECOND;   // 960 ticks  (~240 s)
const DISASTER_DURATION = 60  * TICKS_PER_SECOND;   // 240 ticks  (~60 s)

/**
 * Multiplier applied to raid/windfall resource amounts based on difficulty.
 * Easy  → 0.6 (events are milder)
 * Hard  → 1.5 (events are harsher)
 */
function _difficultyRaidMult() {
  const d = state.difficulty ?? 'normal';
  return d === 'easy' ? 0.6 : d === 'hard' ? 1.5 : 1.0;
}

/**
 * Duration (in ticks) for disaster rate-modifier events, scaled by difficulty.
 * Easy  → 40 s, Normal → 60 s, Hard → 90 s
 */
function _disasterDuration() {
  const d = state.difficulty ?? 'normal';
  return d === 'easy' ? 40 * TICKS_PER_SECOND
       : d === 'hard' ? 90 * TICKS_PER_SECOND
       : DISASTER_DURATION;
}

// ---------------------------------------------------------------------------
// Event pool
// ---------------------------------------------------------------------------

const EVENTS = [

  // ── Raids ─────────────────────────────────────────────────────────────────

  {
    id: 'bandit_raid',
    type: 'raid',
    weight: 10,
    apply(st) {
      const m    = _difficultyRaidMult();
      const gold = Math.floor(Math.max(5,  st.resources.gold * 0.12 * m));
      const food = Math.floor(Math.max(2,  st.resources.food * 0.08 * m));
      st.resources.gold = Math.max(0, st.resources.gold - gold);
      st.resources.food = Math.max(0, st.resources.food - food);
      addMessage(`⚔️ Bandit raid! Lost ${gold} gold and ${food} food.`, 'raid');
    },
  },

  {
    id: 'goblin_attack',
    type: 'raid',
    weight: 8,
    apply(st) {
      const m     = _difficultyRaidMult();
      const wood  = Math.floor(Math.max(3,  st.resources.wood  * 0.15 * m));
      const stone = Math.floor(Math.max(0,  st.resources.stone * 0.10 * m));
      st.resources.wood  = Math.max(0, st.resources.wood  - wood);
      st.resources.stone = Math.max(0, st.resources.stone - stone);

      // 40% chance to also lose a unit
      const unitIds = Object.keys(st.units).filter(id => (st.units[id] ?? 0) > 0);
      if (unitIds.length > 0 && Math.random() < 0.4) {
        const id = unitIds[Math.floor(Math.random() * unitIds.length)];
        st.units[id]--;
        if (st.units[id] <= 0) delete st.units[id];
        recalcRates();
        addMessage(
          `👺 Goblin attack! Lost ${wood} wood, ${stone} stone, and one unit was slain.`,
          'raid',
        );
      } else {
        addMessage(`👺 Goblin attack! Lost ${wood} wood and ${stone} stone.`, 'raid');
      }
    },
  },

  {
    id: 'pirates',
    type: 'raid',
    weight: 6,
    apply(st) {
      const m    = _difficultyRaidMult();
      const gold = Math.floor(Math.max(10, st.resources.gold * 0.20 * m));
      st.resources.gold = Math.max(0, st.resources.gold - gold);
      addMessage(`🏴‍☠️ Pirates raided your trade routes! Lost ${gold} gold.`, 'raid');
    },
  },

  // ── Windfalls ─────────────────────────────────────────────────────────────

  {
    id: 'merchant_caravan',
    type: 'windfall',
    weight: 12,
    apply(st) {
      const gold = 50 + Math.floor(st.tick / 100);
      st.resources.gold = Math.min(st.caps.gold, st.resources.gold + gold);
      addMessage(`🛒 A merchant caravan arrived! Gained ${gold} gold.`, 'windfall');
    },
  },

  {
    id: 'bountiful_harvest',
    type: 'windfall',
    weight: 12,
    apply(st) {
      const food = 80 + Math.floor(st.tick / 80);
      const wood = 40 + Math.floor(st.tick / 120);
      st.resources.food = Math.min(st.caps.food, st.resources.food + food);
      st.resources.wood = Math.min(st.caps.wood, st.resources.wood + wood);
      addMessage(
        `🌾 Bountiful harvest! Gained ${food} food and ${wood} wood.`,
        'windfall',
      );
    },
  },

  {
    id: 'ore_vein',
    type: 'windfall',
    weight: 8,
    apply(st) {
      const stone = 60 + Math.floor(st.tick / 100);
      const iron  = 30 + Math.floor(st.tick / 150);
      st.resources.stone = Math.min(st.caps.stone, st.resources.stone + stone);
      st.resources.iron  = Math.min(st.caps.iron,  st.resources.iron  + iron);
      addMessage(
        `⛏️ Miners discovered a rich vein! Gained ${stone} stone and ${iron} iron.`,
        'windfall',
      );
    },
  },

  {
    id: 'mana_surge',
    type: 'windfall',
    weight: 6,
    apply(st) {
      const mana = 40 + Math.floor(st.tick / 100);
      st.resources.mana = Math.min(st.caps.mana, st.resources.mana + mana);
      addMessage(`✨ Ley lines surged with power! Gained ${mana} mana.`, 'windfall');
    },
  },

  // ── Disasters ─────────────────────────────────────────────────────────────

  {
    id: 'drought',
    type: 'disaster',
    weight: 7,
    apply(st) {
      const dur = _disasterDuration();
      const secs = Math.round(dur / TICKS_PER_SECOND);
      st.randomEvents.activeModifiers.push({
        id: 'drought',
        resource: 'food',
        rateMult: 0.5,
        expiresAt: st.tick + dur,
      });
      recalcRates();
      addMessage(`☀️ Drought! Food production halved for ${secs} seconds.`, 'disaster');
    },
  },

  {
    id: 'mine_collapse',
    type: 'disaster',
    weight: 5,
    apply(st) {
      const dur = _disasterDuration();
      const secs = Math.round(dur / TICKS_PER_SECOND);
      st.randomEvents.activeModifiers.push(
        { id: 'mc_stone', resource: 'stone', rateMult: 0, expiresAt: st.tick + dur },
        { id: 'mc_iron',  resource: 'iron',  rateMult: 0, expiresAt: st.tick + dur },
      );
      recalcRates();
      addMessage(
        `🪨 Mine collapse! Stone and iron production halted for ${secs} seconds.`,
        'disaster',
      );
    },
  },

  {
    id: 'plague',
    type: 'disaster',
    weight: 6,
    apply(st) {
      const m        = _difficultyRaidMult();
      const dur      = _disasterDuration();
      const secs     = Math.round(dur / TICKS_PER_SECOND);
      const foodLost = Math.floor(Math.max(5, st.resources.food * 0.20 * m));
      st.resources.food = Math.max(0, st.resources.food - foodLost);
      st.randomEvents.activeModifiers.push({
        id: 'plague',
        resource: 'food',
        rateMult: 0.6,
        expiresAt: st.tick + dur,
      });
      recalcRates();
      addMessage(
        `🦠 Plague outbreak! Lost ${foodLost} food and food rate reduced for ${secs} seconds.`,
        'disaster',
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _pickEvent() {
  const total = EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const ev of EVENTS) {
    r -= ev.weight;
    if (r <= 0) return ev;
  }
  return EVENTS[EVENTS.length - 1];
}

function _nextInterval() {
  return state.tick + MIN_INTERVAL + Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Called once during boot. Initialises state.randomEvents if not present
 * (new game) or leaves the loaded save values intact.
 */
export function initRandomEvents() {
  if (!state.randomEvents) {
    state.randomEvents = {
      nextEventTick:   _nextInterval(),
      activeModifiers: [],
    };
  }
}

/**
 * Registered as a tick system. Expires modifiers and fires events on schedule.
 */
export function randomEventTick() {
  const re = state.randomEvents;
  if (!re) return;

  // Expire outdated modifiers; recalc rates if anything expired
  const before = re.activeModifiers.length;
  re.activeModifiers = re.activeModifiers.filter(m => m.expiresAt > state.tick);
  if (re.activeModifiers.length !== before) recalcRates();

  // Check if it's time to fire a new event
  if (state.tick < re.nextEventTick) return;

  const ev = _pickEvent();
  try {
    ev.apply(state);
  } catch (e) {
    console.error('[randomEventTick]', e);
  }

  re.nextEventTick = _nextInterval();
}
