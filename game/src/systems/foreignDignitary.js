/**
 * EmpireOS — Foreign Dignitary Visit (T258).
 *
 * Every 16–22 minutes (Medieval Age+, 12+ player tiles), a high dignitary
 * from a distant land arrives at the imperial court seeking audience.
 * The player has 85 seconds to decide.
 *
 * Choices:
 *   🎭 Grand Reception  — pay 40 gold → +40 prestige + 0.1 gold/s for 4 min + 15 morale
 *   🤝 Modest Welcome  — free → +20 prestige + 10 morale
 *   🎁 Present Gifts   — pay 30 food + 20 iron → +50 prestige + 20 morale
 *
 * state.foreignDignitary = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalReceptions:  number,
 *   totalWelcomed:    number,
 *   totalGifted:      number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 16 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 6  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 85 * TICKS_PER_SECOND;
const MIN_AGE          = 3;
const MIN_PLAYER_TILES = 12;

export const RECEPTION_GOLD_COST       = 40;
export const RECEPTION_PRESTIGE_REWARD = 40;
export const RECEPTION_GOLD_RATE       = 0.1;
export const RECEPTION_DURATION_TICKS  = 4 * 60 * TICKS_PER_SECOND;
export const RECEPTION_MORALE_REWARD   = 15;

export const WELCOME_PRESTIGE_REWARD   = 20;
export const WELCOME_MORALE_REWARD     = 10;

export const GIFT_FOOD_COST            = 30;
export const GIFT_IRON_COST            = 20;
export const GIFT_PRESTIGE_REWARD      = 50;
export const GIFT_MORALE_REWARD        = 20;

export function initForeignDignitary() {
  if (!state.foreignDignitary) {
    state.foreignDignitary = { active: null, nextSpawnTick: _nextSpawnTick(), totalVisits: 0, totalReceptions: 0, totalWelcomed: 0, totalGifted: 0 };
  }
  if (state.foreignDignitary.nextSpawnTick   === undefined) state.foreignDignitary.nextSpawnTick   = _nextSpawnTick();
  if (state.foreignDignitary.totalVisits     === undefined) state.foreignDignitary.totalVisits     = 0;
  if (state.foreignDignitary.totalReceptions === undefined) state.foreignDignitary.totalReceptions = 0;
  if (state.foreignDignitary.totalWelcomed   === undefined) state.foreignDignitary.totalWelcomed   = 0;
  if (state.foreignDignitary.totalGifted     === undefined) state.foreignDignitary.totalGifted     = 0;
}

export function foreignDignitaryTick() {
  const fd = state.foreignDignitary;
  if (!fd) return;
  if (fd.active) {
    if (state.tick >= fd.active.expiresAt) {
      fd.active        = null; fd.nextSpawnTick = _nextSpawnTick();
      emit(Events.FOREIGN_DIGNITARY_CHANGED, { expired: true });
      addMessage('🚶 The foreign dignitary departs without an audience, visibly displeased by the empire\'s silence.', 'info');
    }
    return;
  }
  if (state.tick < fd.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  fd.active      = { expiresAt: state.tick + WINDOW_TICKS };
  fd.totalVisits = (fd.totalVisits ?? 0) + 1;
  emit(Events.FOREIGN_DIGNITARY_CHANGED, { spawned: true });
  addMessage('🎭 A foreign dignitary arrives at the imperial court seeking an audience! Respond within 85 seconds.', 'info');
}

export function getActiveForeignDignitary() { return state.foreignDignitary?.active ?? null; }
export function getForeignDignitarySecsLeft() {
  const a = state.foreignDignitary?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function hostGrandReception() {
  const fd = state.foreignDignitary;
  if (!fd?.active) return { ok: false, reason: 'No dignitary present.' };
  if (state.tick >= fd.active.expiresAt) return { ok: false, reason: 'The dignitary has departed.' };
  if ((state.resources.gold ?? 0) < RECEPTION_GOLD_COST) return { ok: false, reason: `Need ${RECEPTION_GOLD_COST} gold.` };
  state.resources.gold -= RECEPTION_GOLD_COST;
  awardPrestige(RECEPTION_PRESTIGE_REWARD, 'Grand court reception impresses the foreign dignitary');
  changeMorale(RECEPTION_MORALE_REWARD);
  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dignitaryReception');
    state.randomEvents.activeModifiers.push({ id: 'dignitaryReception', resource: 'gold', rateMult: 1 + (RECEPTION_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))), expiresAt: state.tick + RECEPTION_DURATION_TICKS });
  }
  fd.active          = null; fd.nextSpawnTick = _nextSpawnTick(); fd.totalReceptions = (fd.totalReceptions ?? 0) + 1;
  emit(Events.FOREIGN_DIGNITARY_CHANGED, { reception: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎭 A magnificent reception dazzles the dignitary! +${RECEPTION_PRESTIGE_REWARD} prestige, +${RECEPTION_MORALE_REWARD} morale. Trade delegations follow: +${RECEPTION_GOLD_RATE} gold/s for 4 minutes.`, 'windfall');
  return { ok: true };
}

export function offerModestWelcome() {
  const fd = state.foreignDignitary;
  if (!fd?.active) return { ok: false, reason: 'No dignitary present.' };
  if (state.tick >= fd.active.expiresAt) return { ok: false, reason: 'The dignitary has departed.' };
  awardPrestige(WELCOME_PRESTIGE_REWARD, 'Dignified reception of foreign dignitary at imperial court');
  changeMorale(WELCOME_MORALE_REWARD);
  fd.active        = null; fd.nextSpawnTick = _nextSpawnTick(); fd.totalWelcomed = (fd.totalWelcomed ?? 0) + 1;
  emit(Events.FOREIGN_DIGNITARY_CHANGED, { welcomed: true });
  addMessage(`🤝 The dignitary is received with quiet dignity. +${WELCOME_PRESTIGE_REWARD} prestige, +${WELCOME_MORALE_REWARD} morale. A message of peace is exchanged.`, 'windfall');
  return { ok: true };
}

export function presentDignitaryGifts() {
  const fd = state.foreignDignitary;
  if (!fd?.active) return { ok: false, reason: 'No dignitary present.' };
  if (state.tick >= fd.active.expiresAt) return { ok: false, reason: 'The dignitary has departed.' };
  if ((state.resources.food ?? 0) < GIFT_FOOD_COST) return { ok: false, reason: `Need ${GIFT_FOOD_COST} food.` };
  if ((state.resources.iron ?? 0) < GIFT_IRON_COST) return { ok: false, reason: `Need ${GIFT_IRON_COST} iron.` };
  state.resources.food -= GIFT_FOOD_COST; state.resources.iron -= GIFT_IRON_COST;
  awardPrestige(GIFT_PRESTIGE_REWARD, 'Lavish gifts bestowed upon the foreign dignitary');
  changeMorale(GIFT_MORALE_REWARD);
  fd.active        = null; fd.nextSpawnTick = _nextSpawnTick(); fd.totalGifted = (fd.totalGifted ?? 0) + 1;
  emit(Events.FOREIGN_DIGNITARY_CHANGED, { gifted: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎁 The dignitary departs with imperial treasures! +${GIFT_PRESTIGE_REWARD} prestige, +${GIFT_MORALE_REWARD} morale. Word of the empire's generosity spreads to distant lands.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }