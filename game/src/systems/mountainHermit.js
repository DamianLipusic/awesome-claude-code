/**
 * EmpireOS — Mountain Hermit (T253).
 *
 * Every 15–19 minutes (Iron Age+, 12+ player tiles), an ancient hermit
 * descends from the mountain peaks to share wisdom with the empire.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🧘 Seek Counsel  — free → +10 prestige, +0.1 mana/s for 2 min
 *   💰 Offer Tribute — pay 25 gold → +25 prestige, +12 morale
 *   🚶 Leave in Peace — no cost
 *
 * state.mountainHermit = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalVisits:     number,
 *   totalCounseled:  number,
 *   totalTributed:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 4  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;
const MIN_PLAYER_TILES = 12;

export const COUNSEL_PRESTIGE_REWARD  = 10;
export const COUNSEL_MANA_RATE        = 0.1;
export const COUNSEL_DURATION_TICKS   = 2 * 60 * TICKS_PER_SECOND;

export const TRIBUTE_GOLD_COST        = 25;
export const TRIBUTE_PRESTIGE_REWARD  = 25;
export const TRIBUTE_MORALE_REWARD    = 12;

export function initMountainHermit() {
  if (!state.mountainHermit) {
    state.mountainHermit = { active: null, nextSpawnTick: _nextSpawnTick(), totalVisits: 0, totalCounseled: 0, totalTributed: 0 };
  }
  if (state.mountainHermit.nextSpawnTick  === undefined) state.mountainHermit.nextSpawnTick  = _nextSpawnTick();
  if (state.mountainHermit.totalVisits    === undefined) state.mountainHermit.totalVisits    = 0;
  if (state.mountainHermit.totalCounseled === undefined) state.mountainHermit.totalCounseled = 0;
  if (state.mountainHermit.totalTributed  === undefined) state.mountainHermit.totalTributed  = 0;
}

export function mountainHermitTick() {
  const h = state.mountainHermit;
  if (!h) return;
  if (h.active) {
    if (state.tick >= h.active.expiresAt) {
      h.active        = null; h.nextSpawnTick = _nextSpawnTick();
      emit(Events.MOUNTAIN_HERMIT_CHANGED, { expired: true });
      addMessage('🧘 The mountain hermit has returned to solitude without a response.', 'info');
    }
    return;
  }
  if (state.tick < h.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  h.active      = { expiresAt: state.tick + WINDOW_TICKS };
  h.totalVisits = (h.totalVisits ?? 0) + 1;
  emit(Events.MOUNTAIN_HERMIT_CHANGED, { spawned: true });
  addMessage('🧘 An ancient mountain hermit descends to share wisdom with the empire. The sages urge you to receive their counsel. Respond within 75 seconds.', 'info');
}

export function getActiveMountainHermit() { return state.mountainHermit?.active ?? null; }
export function getMountainHermitSecsLeft() {
  const a = state.mountainHermit?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function seekHermitCounsel() {
  const h = state.mountainHermit;
  if (!h?.active) return { ok: false, reason: 'No hermit present.' };
  if (state.tick >= h.active.expiresAt) return { ok: false, reason: 'The hermit has departed.' };
  awardPrestige(COUNSEL_PRESTIGE_REWARD, 'Hermit counsel elevated imperial wisdom');
  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'hermitCounsel');
    state.randomEvents.activeModifiers.push({ id: 'hermitCounsel', resource: 'mana', rateMult: 1 + (COUNSEL_MANA_RATE / Math.max(0.001, (state.rates?.mana ?? 1))), expiresAt: state.tick + COUNSEL_DURATION_TICKS });
  }
  h.active         = null; h.nextSpawnTick  = _nextSpawnTick(); h.totalCounseled = (h.totalCounseled ?? 0) + 1;
  emit(Events.MOUNTAIN_HERMIT_CHANGED, { counseled: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧘 The hermit imparts ancient wisdom! +${COUNSEL_PRESTIGE_REWARD} prestige, +${COUNSEL_MANA_RATE} mana/s for 2 minutes as arcane insight flows through the empire.`, 'windfall');
  return { ok: true };
}

export function offerHermitTribute() {
  const h = state.mountainHermit;
  if (!h?.active) return { ok: false, reason: 'No hermit present.' };
  if (state.tick >= h.active.expiresAt) return { ok: false, reason: 'The hermit has departed.' };
  if ((state.resources.gold ?? 0) < TRIBUTE_GOLD_COST) return { ok: false, reason: `Need ${TRIBUTE_GOLD_COST} gold.` };
  state.resources.gold -= TRIBUTE_GOLD_COST;
  awardPrestige(TRIBUTE_PRESTIGE_REWARD, 'Generous tribute to the mountain hermit earned deep respect');
  changeMorale(TRIBUTE_MORALE_REWARD);
  h.active        = null; h.nextSpawnTick = _nextSpawnTick(); h.totalTributed = (h.totalTributed ?? 0) + 1;
  emit(Events.MOUNTAIN_HERMIT_CHANGED, { tributed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💰 The hermit blesses the empire for your generosity! +${TRIBUTE_PRESTIGE_REWARD} prestige, +${TRIBUTE_MORALE_REWARD} morale as the people are inspired.`, 'windfall');
  return { ok: true };
}

export function leaveHermitInPeace() {
  const h = state.mountainHermit;
  if (!h?.active) return { ok: false, reason: 'No hermit present.' };
  h.active        = null; h.nextSpawnTick = _nextSpawnTick();
  emit(Events.MOUNTAIN_HERMIT_CHANGED, { dismissed: true });
  addMessage('🚶 The mountain hermit returns to solitude, their wisdom unshared.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }