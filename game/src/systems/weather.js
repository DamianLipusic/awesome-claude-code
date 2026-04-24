/**
 * EmpireOS — Weather system (T078).
 *
 * Fires random weather events every 4–6 minutes.  Each event lasts 60–90 s
 * and applies per-resource rate multipliers via recalcRates() in resources.js.
 *
 * Public API:
 *   initWeather()         — called on boot and new game
 *   weatherTick()         — registered as a tick system in main.js
 *   getCurrentWeather()   — returns the active weather object or null
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { WEATHER_TYPES } from '../data/weather.js';
import { changeMorale } from './morale.js';
import { addMessage } from '../core/actions.js';
import { recalcRates } from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Timing constants ───────────────────────────────────────────────────────
const SPAWN_MIN = 240 * TICKS_PER_SECOND;  // 4 minutes
const SPAWN_MAX = 360 * TICKS_PER_SECOND;  // 6 minutes
// No weather for the first 2 minutes of a game (tick < 480)
const GRACE_TICKS = 120 * TICKS_PER_SECOND;

// Weighted random selection across WEATHER_TYPES
const _TOTAL_WEIGHT = WEATHER_TYPES.reduce((s, w) => s + w.weight, 0);

function _pickWeather() {
  let roll = Math.random() * _TOTAL_WEIGHT;
  for (const w of WEATHER_TYPES) {
    roll -= w.weight;
    if (roll <= 0) return w;
  }
  return WEATHER_TYPES[0];
}

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise (or reset) weather state for a new game.
 * Idempotent — skips init if valid state already loaded from a save.
 */
export function initWeather() {
  if (!state.weather) {
    state.weather = {
      active:           null,
      nextWeatherTick:  state.tick + GRACE_TICKS,
    };
  }
}

/**
 * Registered as a tick system.  Expires active weather and spawns new events.
 */
export function weatherTick() {
  if (!state.weather) return;

  // Expire active weather
  if (state.weather.active && state.tick >= state.weather.active.expiresAt) {
    const w = state.weather.active;
    state.weather.active = null;
    addMessage(`🌤️ The ${w.name} has passed.`, 'info');
    recalcRates();
    emit(Events.WEATHER_CHANGED, { type: null });
    return;
  }

  // Spawn new weather when cooldown expires and grace period is over
  if (!state.weather.active &&
      state.tick >= state.weather.nextWeatherTick &&
      state.tick >= GRACE_TICKS) {
    _spawnWeather();
  }
}

const WEATHER_ADAPT_THRESHOLD = 3;  // occurrences before adaptation kicks in

function _spawnWeather() {
  const chosen = _pickWeather();

  state.weather.active = {
    type:      chosen.id,
    icon:      chosen.icon,
    name:      chosen.name,
    desc:      chosen.desc,
    modifiers: chosen.modifiers,
    expiresAt: state.tick + chosen.duration,
  };
  state.weather.nextWeatherTick = _nextSpawnTick();

  // T158: track occurrence count and check for adaptation
  if (!state.weatherMemory) {
    state.weatherMemory = { counts: {}, adaptations: {} };
  }
  state.weatherMemory.counts[chosen.id] = (state.weatherMemory.counts[chosen.id] ?? 0) + 1;
  if (
    !state.weatherMemory.adaptations[chosen.id] &&
    state.weatherMemory.counts[chosen.id] >= WEATHER_ADAPT_THRESHOLD
  ) {
    state.weatherMemory.adaptations[chosen.id] = true;
    emit(Events.WEATHER_ADAPTED, { type: chosen.id, icon: chosen.icon, name: chosen.name });
    addMessage(`🛡️ Climate Adaptation: your empire has adapted to ${chosen.name}! Penalties halved.`, 'windfall');
  }

  if (chosen.moraleDelta) changeMorale(chosen.moraleDelta);

  addMessage(`${chosen.icon} ${chosen.name}: ${chosen.desc}`, chosen.logType);
  recalcRates();
  emit(Events.WEATHER_CHANGED, { type: chosen.id });
}

/**
 * Returns the currently-active weather object, or null when skies are clear.
 */
export function getCurrentWeather() {
  return state.weather?.active ?? null;
}

/**
 * Returns seconds remaining for the active weather event, or 0 if none.
 */
export function getWeatherSecsLeft() {
  const w = state.weather?.active;
  if (!w) return 0;
  return Math.max(0, Math.ceil((w.expiresAt - state.tick) / TICKS_PER_SECOND));
}
