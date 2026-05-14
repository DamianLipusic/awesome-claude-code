/**
 * EmpireOS — Master Forester (T267).
 *
 * Every 12–16 minutes (Bronze Age+, 8+ player tiles), a master forester
 * renowned for sustainable woodland management arrives seeking patronage.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪵 Commission Timber Works  — pay 30 gold
 *        → +0.3 wood/s for 2.5 min + 15 prestige
 *   🌱 Learn Forest Techniques  — pay 20 food
 *        → +0.2 wood/s for 2 min + 10 morale
 *   🤝 Offer Seasonal Lodging   — free
 *        → +8 morale + 5 prestige
 *
 * state.masterForester = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalLearned:       number,
 *   totalHosted:        number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;
const MIN_PLAYER_TILES = 8;

export const COMMISSION_GOLD_COST      = 30;
export const COMMISSION_WOOD_RATE      = 0.3;
export const COMMISSION_DURATION_TICKS = Math.round(2.5 * 60 * TICKS_PER_SECOND);
export const COMMISSION_PRESTIGE_REWARD = 15;

export const LEARN_FOOD_COST        = 20;
export const LEARN_WOOD_RATE        = 0.2;
export const LEARN_DURATION_TICKS   = 2 * 60 * TICKS_PER_SECOND;
export const LEARN_MORALE_REWARD    = 10;

export const LODGE_MORALE_REWARD    = 8;
export const LODGE_PRESTIGE_REWARD  = 5;

export function initMasterForester() {
  if (!state.masterForester) {
    state.masterForester = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalLearned:     0,
      totalHosted:      0,
    };
  }
  if (state.masterForester.nextSpawnTick    === undefined) state.masterForester.nextSpawnTick    = _nextSpawnTick();
  if (state.masterForester.totalVisits      === undefined) state.masterForester.totalVisits      = 0;
  if (state.masterForester.totalCommissions === undefined) state.masterForester.totalCommissions = 0;
  if (state.masterForester.totalLearned     === undefined) state.masterForester.totalLearned     = 0;
  if (state.masterForester.totalHosted      === undefined) state.masterForester.totalHosted      = 0;
}

export function masterForesterTick() {
  const mf = state.masterForester;
  if (!mf) return;
  if (mf.active) {
    if (state.tick >= mf.active.expiresAt) {
      mf.active = null; mf.nextSpawnTick = _nextSpawnTick();
      emit(Events.MASTER_FORESTER_CHANGED, { expired: true });
      addMessage('🪵 The master forester departs without a commission, returning to manage distant woodlands.', 'info');
    }
    return;
  }
  if (state.tick < mf.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  mf.active      = { expiresAt: state.tick + WINDOW_TICKS };
  mf.totalVisits = (mf.totalVisits ?? 0) + 1;
  emit(Events.MASTER_FORESTER_CHANGED, { spawned: true });
  addMessage('🪵 A master forester renowned for sustainable woodland management has arrived seeking imperial patronage! Their expertise could unlock the empire\'s timber potential. Respond within 80 seconds.', 'info');
}

export function getActiveMasterForester()  { return state.masterForester?.active ?? null; }
export function getMasterForesterSecsLeft() {
  const a = state.masterForester?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTimberWorks() {
  const mf = state.masterForester;
  if (!mf?.active) return { ok: false, reason: 'No forester present.' };
  if (state.tick >= mf.active.expiresAt) return { ok: false, reason: 'The forester has departed.' };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.gold -= COMMISSION_GOLD_COST;
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned timber works with a master forester');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'foresterTimber');
    state.randomEvents.activeModifiers.push({
      id: 'foresterTimber', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  mf.active = null; mf.nextSpawnTick = _nextSpawnTick(); mf.totalCommissions = (mf.totalCommissions ?? 0) + 1;
  emit(Events.MASTER_FORESTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪵 The forester establishes expert timber operations across imperial woodlands! +${COMMISSION_PRESTIGE_REWARD} prestige. Lumber production surges: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function learnForestTechniques() {
  const mf = state.masterForester;
  if (!mf?.active) return { ok: false, reason: 'No forester present.' };
  if (state.tick >= mf.active.expiresAt) return { ok: false, reason: 'The forester has departed.' };
  if ((state.resources.food ?? 0) < LEARN_FOOD_COST) return { ok: false, reason: `Need ${LEARN_FOOD_COST} food.` };
  state.resources.food -= LEARN_FOOD_COST;
  changeMorale(LEARN_MORALE_REWARD);
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'foresterLearn');
    state.randomEvents.activeModifiers.push({
      id: 'foresterLearn', resource: 'wood',
      rateMult: 1 + (LEARN_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + LEARN_DURATION_TICKS,
    });
  }
  mf.active = null; mf.nextSpawnTick = _nextSpawnTick(); mf.totalLearned = (mf.totalLearned ?? 0) + 1;
  emit(Events.MASTER_FORESTER_CHANGED, { learned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌱 Imperial woodcutters adopt sustainable harvesting techniques! +${LEARN_MORALE_REWARD} morale. Wood output increases: +${LEARN_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function offerSeasonalLodging() {
  const mf = state.masterForester;
  if (!mf?.active) return { ok: false, reason: 'No forester present.' };
  if (state.tick >= mf.active.expiresAt) return { ok: false, reason: 'The forester has departed.' };
  changeMorale(LODGE_MORALE_REWARD);
  awardPrestige(LODGE_PRESTIGE_REWARD, 'Offered seasonal lodging to a master forester');
  mf.active = null; mf.nextSpawnTick = _nextSpawnTick(); mf.totalHosted = (mf.totalHosted ?? 0) + 1;
  emit(Events.MASTER_FORESTER_CHANGED, { hosted: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🤝 The forester departs with warm words, promising to return in season! +${LODGE_MORALE_REWARD} morale · +${LODGE_PRESTIGE_REWARD} prestige. The people are pleased by the empire's hospitality.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
