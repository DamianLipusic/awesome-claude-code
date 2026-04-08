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

export const TICK_MS   = 250;            // wall-clock ms per game tick
export const TICKS_PER_SECOND = 1000 / TICK_MS;  // 4

let intervalId    = null;
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
  intervalId = setInterval(_tick, TICK_MS);
  log('tick loop started');
}

export function stopLoop() {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
  state.running = false;
  log('tick loop stopped');
}

function _tick() {
  state.tick++;
  for (const sys of systems) {
    try { sys(); }
    catch (e) { console.error('[tick system error]', e); }
  }
  emit(Events.TICK, state.tick);
}
