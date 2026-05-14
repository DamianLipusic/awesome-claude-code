/**
 * EmpireOS — Traveling Monk (T271).
 *
 * Every 12–17 minutes (Stone Age+, 6+ player tiles), a wandering monk arrives
 * seeking shelter and offering spiritual counsel. The player has 80 seconds.
 *
 * Choices:
 *   🙏 Seek Spiritual Guidance  — free
 *        → +10 prestige + 8 morale + 0.1 mana/s for 2 min
 *   💰 Make Generous Donation   — pay 30 gold
 *        → +30 prestige + 15 morale
 *   👋 Send on Their Way        — dismiss (no reward)
 *
 * state.travelingMonk = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalVisits:     number,
 *   totalGuidance:   number,
 *   totalDonations:  number,
 *   totalDismissals: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const GUIDANCE_PRESTIGE_REWARD  = 10;
export const GUIDANCE_MORALE_REWARD    = 8;
export const GUIDANCE_MANA_RATE        = 0.1;
export const GUIDANCE_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export const DONATION_GOLD_COST        = 30;
export const DONATION_PRESTIGE_REWARD  = 30;
export const DONATION_MORALE_REWARD    = 15;

export function initTravelingMonk() {
  if (!state.travelingMonk) {
    state.travelingMonk = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalGuidance:   0,
      totalDonations:  0,
      totalDismissals: 0,
    };
  }
  if (state.travelingMonk.nextSpawnTick   === undefined) state.travelingMonk.nextSpawnTick   = _nextSpawnTick();
  if (state.travelingMonk.totalVisits     === undefined) state.travelingMonk.totalVisits     = 0;
  if (state.travelingMonk.totalGuidance   === undefined) state.travelingMonk.totalGuidance   = 0;
  if (state.travelingMonk.totalDonations  === undefined) state.travelingMonk.totalDonations  = 0;
  if (state.travelingMonk.totalDismissals === undefined) state.travelingMonk.totalDismissals = 0;
}

export function travelingMonkTick() {
  const tm = state.travelingMonk;
  if (!tm) return;
  if (tm.active) {
    if (state.tick >= tm.active.expiresAt) {
      tm.active = null; tm.nextSpawnTick = _nextSpawnTick();
      emit(Events.TRAVELING_MONK_CHANGED, { expired: true });
      addMessage('🙏 The traveling monk bows and continues their pilgrimage without receiving a response.', 'info');
    }
    return;
  }
  if (state.tick < tm.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  tm.active      = { expiresAt: state.tick + WINDOW_TICKS };
  tm.totalVisits = (tm.totalVisits ?? 0) + 1;
  emit(Events.TRAVELING_MONK_CHANGED, { spawned: true });
  addMessage('🙏 A traveling monk has arrived at the imperial gates seeking shelter and offering spiritual counsel to the ruler. Respond within 80 seconds.', 'info');
}

export function getActiveTravelingMonk()  { return state.travelingMonk?.active ?? null; }
export function getMonkSecsLeft() {
  const a = state.travelingMonk?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function seekSpiritualGuidance() {
  const tm = state.travelingMonk;
  if (!tm?.active) return { ok: false, reason: 'No monk present.' };
  if (state.tick >= tm.active.expiresAt) return { ok: false, reason: 'The monk has departed.' };
  changeMorale(GUIDANCE_MORALE_REWARD);
  awardPrestige(GUIDANCE_PRESTIGE_REWARD, 'Received spiritual guidance from a traveling monk');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'monkGuidance');
    state.randomEvents.activeModifiers.push({
      id: 'monkGuidance', resource: 'mana',
      rateMult: 1 + (GUIDANCE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 0.5))),
      expiresAt: state.tick + GUIDANCE_DURATION_TICKS,
    });
  }
  tm.active = null; tm.nextSpawnTick = _nextSpawnTick(); tm.totalGuidance = (tm.totalGuidance ?? 0) + 1;
  emit(Events.TRAVELING_MONK_CHANGED, { guidance: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🙏 The monk shares ancient wisdom with the ruler, filling the court with spiritual calm! +${GUIDANCE_MORALE_REWARD} morale · +${GUIDANCE_PRESTIGE_REWARD} prestige. Mana flows freely: +${GUIDANCE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function makeGenerousDonation() {
  const tm = state.travelingMonk;
  if (!tm?.active) return { ok: false, reason: 'No monk present.' };
  if (state.tick >= tm.active.expiresAt) return { ok: false, reason: 'The monk has departed.' };
  if ((state.resources.gold ?? 0) < DONATION_GOLD_COST) return { ok: false, reason: `Need ${DONATION_GOLD_COST} gold.` };
  state.resources.gold -= DONATION_GOLD_COST;
  changeMorale(DONATION_MORALE_REWARD);
  awardPrestige(DONATION_PRESTIGE_REWARD, 'Made a generous donation to a traveling monk');
  tm.active = null; tm.nextSpawnTick = _nextSpawnTick(); tm.totalDonations = (tm.totalDonations ?? 0) + 1;
  emit(Events.TRAVELING_MONK_CHANGED, { donated: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💰 The empire's generosity humbles the monk, who blesses the realm before continuing their journey! +${DONATION_MORALE_REWARD} morale · +${DONATION_PRESTIGE_REWARD} prestige. Word spreads of imperial virtue.`, 'windfall');
  return { ok: true };
}

export function sendMonkAway() {
  const tm = state.travelingMonk;
  if (!tm?.active) return { ok: false, reason: 'No monk present.' };
  tm.active = null; tm.nextSpawnTick = _nextSpawnTick(); tm.totalDismissals = (tm.totalDismissals ?? 0) + 1;
  emit(Events.TRAVELING_MONK_CHANGED, { dismissed: true });
  addMessage('🙏 The traveling monk bows respectfully and continues their journey along the pilgrim road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
