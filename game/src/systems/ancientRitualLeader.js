/**
 * EmpireOS — Ancient Ritual Leader (T315).
 *
 * Every 16–20 minutes (Medieval Age+, 12+ player tiles), an ancient ritual
 * leader arrives bearing sacred ceremonial knowledge from the old religions.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🔥 Conduct Imperial Ceremony  — pay 25 mana
 *        → +0.25 mana/s for 2.5 min · +20 prestige · +12 morale
 *   🍖 Donate Sacred Relics       — pay 30 food
 *        → +0.20 food/s for 2 min · +15 prestige · +8 morale
 *   🚶 Decline Invitation         — dismiss (no reward)
 *
 * state.ancientRitualLeader = {
 *   active:               { expiresAt: tick } | null,
 *   nextSpawnTick:        tick,
 *   totalVisits:          number,
 *   totalCeremonies:      number,
 *   totalDonations:       number,
 *   totalDismissals:      number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 16 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 12;

export const CEREMONY_MANA_COST         = 25;
export const CEREMONY_MANA_RATE         = 0.25;
export const CEREMONY_PRESTIGE_REWARD   = 20;
export const CEREMONY_MORALE_REWARD     = 12;
export const CEREMONY_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const DONATION_FOOD_COST         = 30;
export const DONATION_FOOD_RATE         = 0.20;
export const DONATION_PRESTIGE_REWARD   = 15;
export const DONATION_MORALE_REWARD     = 8;
export const DONATION_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initAncientRitualLeader() {
  if (!state.ancientRitualLeader) {
    state.ancientRitualLeader = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCeremonies:  0,
      totalDonations:   0,
      totalDismissals:  0,
    };
  }
  const s = state.ancientRitualLeader;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalCeremonies === undefined) s.totalCeremonies = 0;
  if (s.totalDonations  === undefined) s.totalDonations  = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function ancientRitualLeaderTick() {
  const a = state.ancientRitualLeader;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.ANCIENT_RITUAL_LEADER_CHANGED, { expired: true });
      addMessage('🔥 The ancient ritual leader concludes their ceremonial rites, carefully wraps the sacred implements in consecrated cloth, and departs with solemn reverence to seek another worthy empire.', 'info');
    }
    return;
  }
  if (state.tick < a.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  a.active      = { expiresAt: state.tick + WINDOW_TICKS };
  a.totalVisits = (a.totalVisits ?? 0) + 1;
  emit(Events.ANCIENT_RITUAL_LEADER_CHANGED, { spawned: true });
  addMessage('🔥 An ancient ritual leader arrives at the imperial court, bearing sacred ceremonial vestments and time-worn relics of the old faith. They offer to lead the empire in ancient rites of power and prosperity. Respond within 80 seconds.', 'info');
}

export function getActiveRitualLeader() { return state.ancientRitualLeader?.active ?? null; }
export function getRitualLeaderSecsLeft() {
  const a = state.ancientRitualLeader?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function conductImperialCeremony() {
  const a = state.ancientRitualLeader;
  if (!a?.active) return { ok: false, reason: 'No ritual leader present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The ritual leader has departed.' };
  if ((state.resources.mana ?? 0) < CEREMONY_MANA_COST) return { ok: false, reason: `Need ${CEREMONY_MANA_COST} mana.` };
  state.resources.mana -= CEREMONY_MANA_COST;
  changeMorale(CEREMONY_MORALE_REWARD);
  awardPrestige(CEREMONY_PRESTIGE_REWARD, 'Conducted an imperial ceremony with the ancient ritual leader');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'ritualCeremony');
    state.randomEvents.activeModifiers.push({
      id: 'ritualCeremony', resource: 'mana',
      rateMult: 1 + (CEREMONY_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + CEREMONY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCeremonies = (a.totalCeremonies ?? 0) + 1;
  emit(Events.ANCIENT_RITUAL_LEADER_CHANGED, { ceremony: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔥 The ancient rites fill the imperial throne room with sacred incense and resonant chanting. The empire's scholars and mystics feel a powerful spiritual awakening, opening new channels of arcane understanding! −${CEREMONY_MANA_COST} mana · +${CEREMONY_PRESTIGE_REWARD} prestige · +${CEREMONY_MORALE_REWARD} morale. Arcane surge: +${CEREMONY_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function donateSacredRelics() {
  const a = state.ancientRitualLeader;
  if (!a?.active) return { ok: false, reason: 'No ritual leader present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The ritual leader has departed.' };
  if ((state.resources.food ?? 0) < DONATION_FOOD_COST) return { ok: false, reason: `Need ${DONATION_FOOD_COST} food.` };
  state.resources.food -= DONATION_FOOD_COST;
  changeMorale(DONATION_MORALE_REWARD);
  awardPrestige(DONATION_PRESTIGE_REWARD, 'Donated sacred relics to the ancient ritual leader');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'ritualDonation');
    state.randomEvents.activeModifiers.push({
      id: 'ritualDonation', resource: 'food',
      rateMult: 1 + (DONATION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + DONATION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDonations = (a.totalDonations ?? 0) + 1;
  emit(Events.ANCIENT_RITUAL_LEADER_CHANGED, { donation: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍖 The ritual leader accepts the sacred food offerings with deep gratitude, performing blessings over the imperial granaries and agricultural lands. The empire's farmers report bountiful harvests and increased yields! −${DONATION_FOOD_COST} food · +${DONATION_PRESTIGE_REWARD} prestige · +${DONATION_MORALE_REWARD} morale. Harvest surge: +${DONATION_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function declineRitualInvitation() {
  const a = state.ancientRitualLeader;
  if (!a?.active) return { ok: false, reason: 'No ritual leader present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.ANCIENT_RITUAL_LEADER_CHANGED, { dismissed: true });
  addMessage('🔥 The ancient ritual leader bows respectfully, accepts the empire\'s decision with graceful understanding, and departs to share their sacred knowledge with a more receptive realm.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
