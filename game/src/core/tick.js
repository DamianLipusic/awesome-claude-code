/**
 * EmpireOS — Game loop (tick engine).
 *
 * Fires every TICK_MS milliseconds.
 * Each tick:
 *   1. Increments state.tick
 *   2. Runs all registered tick systems in order
 *   3. Emits Events.TICK so UI can re-render
 */

import { state } from './state.js';
import { emit, Events } from './events.js';
import { log } from '../utils/logger.js';

export const TICK_MS   = 250;            // base wall-clock ms per game tick (at 1× speed)
export const TICKS_PER_SECOND = 1000 / TICK_MS;  // 4

let intervalId    = null;
let _speedMult    = 1;                   // current speed multiplier
const systems     = [];

/**
 * Register a tick system function.
 * Systems are called in registration order each tick.
 */
export function registerSystem(fn) {
  systems.push(fn);
}

export function startLoop() {
  if (intervalId !== null) return;
  state.running = true;
  intervalId = setInterval(_tick, TICK_MS / _speedMult);
  log('tick loop started');
}

export function stopLoop() {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
  state.running = false;
  log('tick loop stopped');
}

/**
 * Change the game speed multiplier (0.5 / 1 / 2 / 4).
 * Restarts the interval immediately if the loop is running.
 */
export function setTickSpeed(mult) {
  _speedMult = mult;
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = setInterval(_tick, TICK_MS / _speedMult);
    log('tick speed set to', mult);
  }
}

/** Returns the current speed multiplier. */
export function getTickSpeed() { return _speedMult; }

function _tick() {
  state.tick++;
  for (const sys of systems) {
    try { sys(); }
    catch (e) { console.error('[tick system error]', e); }
  }
  emit(Events.TICK, state.tick);
}
