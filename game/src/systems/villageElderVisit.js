/**
 * EmpireOS — Village Elder Visit (T278).
 *
 * Every 11–15 minutes (Stone Age+, 6+ player tiles), a village elder bearing
 * ancient tribal wisdom arrives to counsel the empire. The player has 80
 * seconds to decide.
 *
 * Choices:
 *   🧙 Seek Ancient Wisdom   — free
 *        → +8 morale · +6 prestige · +0.08 mana/s for 2 min
 *   🍖 Offer Generous Hospitality — pay 25 food
 *        → +20 morale · +15 prestige
 *   👋 Send Them Off         — dismiss (no reward)
 *
 * state.villageElderVisit = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalWisdom:      number,
 *   totalHospitality: number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 11 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const WISDOM_MORALE_REWARD   = 8;
export const WISDOM_PRESTIGE_REWARD = 6;
export const WISDOM_MANA_RATE       = 0.08;
export const WISDOM_DURATION_TICKS  = Math.round(2 * 60 * TICKS_PER_SECOND);

export const HOSPITALITY_FOOD_COST       = 25;
export const HOSPITALITY_MORALE_REWARD   = 20;
export const HOSPITALITY_PRESTIGE_REWARD = 15;

export function initVillageElderVisit() {
  if (!state.villageElderVisit) {
    state.villageElderVisit = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalWisdom:      0,
      totalHospitality: 0,
      totalDismissals:  0,
    };
  }
  if (state.villageElderVisit.nextSpawnTick      === undefined) state.villageElderVisit.nextSpawnTick      = _nextSpawnTick();
  if (state.villageElderVisit.totalVisits        === undefined) state.villageElderVisit.totalVisits        = 0;
  if (state.villageElderVisit.totalWisdom        === undefined) state.villageElderVisit.totalWisdom        = 0;
  if (state.villageElderVisit.totalHospitality   === undefined) state.villageElderVisit.totalHospitality   = 0;
  if (state.villageElderVisit.totalDismissals    === undefined) state.villageElderVisit.totalDismissals    = 0;
}

export function villageElderVisitTick() {
  const ve = state.villageElderVisit;
  if (!ve) return;
  if (ve.active) {
    if (state.tick >= ve.active.expiresAt) {
      ve.active = null; ve.nextSpawnTick = _nextSpawnTick();
      emit(Events.VILLAGE_ELDER_VISIT_CHANGED, { expired: true });
      addMessage('🧙 The village elder bows graciously and returns to their community.', 'info');
    }
    return;
  }
  if (state.tick < ve.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  ve.active      = { expiresAt: state.tick + WINDOW_TICKS };
  ve.totalVisits = (ve.totalVisits ?? 0) + 1;
  emit(Events.VILLAGE_ELDER_VISIT_CHANGED, { spawned: true });
  addMessage('🧙 A venerable village elder carrying the accumulated wisdom of generations has arrived at your gates, seeking an audience with the empire\'s ruler. Respond within 80 seconds.', 'info');
}

export function getActiveVillageElderVisit() { return state.villageElderVisit?.active ?? null; }
export function getElderSecsLeft() {
  const a = state.villageElderVisit?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function seekElderWisdom() {
  const ve = state.villageElderVisit;
  if (!ve?.active) return { ok: false, reason: 'No elder present.' };
  if (state.tick >= ve.active.expiresAt) return { ok: false, reason: 'The elder has departed.' };
  changeMorale(WISDOM_MORALE_REWARD);
  awardPrestige(WISDOM_PRESTIGE_REWARD, 'Sought ancient wisdom from a village elder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'elderWisdom');
    state.randomEvents.activeModifiers.push({
      id: 'elderWisdom', resource: 'mana',
      rateMult: 1 + (WISDOM_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + WISDOM_DURATION_TICKS,
    });
  }
  ve.active = null; ve.nextSpawnTick = _nextSpawnTick(); ve.totalWisdom = (ve.totalWisdom ?? 0) + 1;
  emit(Events.VILLAGE_ELDER_VISIT_CHANGED, { wisdom: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧙 Ancient knowledge flows into the imperial court! +${WISDOM_MORALE_REWARD} morale · +${WISDOM_PRESTIGE_REWARD} prestige. Ancestral insight guides your scholars: +${WISDOM_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function offerElderHospitality() {
  const ve = state.villageElderVisit;
  if (!ve?.active) return { ok: false, reason: 'No elder present.' };
  if (state.tick >= ve.active.expiresAt) return { ok: false, reason: 'The elder has departed.' };
  if ((state.resources.food ?? 0) < HOSPITALITY_FOOD_COST) return { ok: false, reason: `Need ${HOSPITALITY_FOOD_COST} food.` };
  state.resources.food -= HOSPITALITY_FOOD_COST;
  changeMorale(HOSPITALITY_MORALE_REWARD);
  awardPrestige(HOSPITALITY_PRESTIGE_REWARD, 'Offered generous hospitality to a village elder');
  ve.active = null; ve.nextSpawnTick = _nextSpawnTick(); ve.totalHospitality = (ve.totalHospitality ?? 0) + 1;
  emit(Events.VILLAGE_ELDER_VISIT_CHANGED, { hospitality: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍖 A lavish feast and royal quarters honor the elder's visit! −${HOSPITALITY_FOOD_COST} food · +${HOSPITALITY_MORALE_REWARD} morale · +${HOSPITALITY_PRESTIGE_REWARD} prestige. Word of imperial generosity spreads through the villages.`, 'windfall');
  return { ok: true };
}

export function sendElderAway() {
  const ve = state.villageElderVisit;
  if (!ve?.active) return { ok: false, reason: 'No elder present.' };
  ve.active = null; ve.nextSpawnTick = _nextSpawnTick(); ve.totalDismissals = (ve.totalDismissals ?? 0) + 1;
  emit(Events.VILLAGE_ELDER_VISIT_CHANGED, { dismissed: true });
  addMessage('🧙 The village elder is politely thanked and shown the road home.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
