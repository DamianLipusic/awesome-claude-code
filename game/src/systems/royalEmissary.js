/**
 * EmpireOS — Royal Emissary (T274).
 *
 * Every 13–18 minutes (Bronze Age+, 8+ player tiles), a royal emissary from a
 * distant realm arrives bearing gifts and diplomatic overtures. The player has
 * 80 seconds to decide.
 *
 * Choices:
 *   🤝 Receive Delegation        — free
 *        → +15 prestige + 10 morale + 0.1 gold/s for 2 min
 *   📋 Exchange Treaties         — pay 30 gold
 *        → +25 prestige + 15 morale + 0.12 iron/s for 2.5 min
 *   👋 Politely Decline          — dismiss (no reward)
 *
 * state.royalEmissary = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalReceptions:  number,
 *   totalExchanges:   number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const RECEIVE_PRESTIGE_REWARD   = 15;
export const RECEIVE_MORALE_REWARD     = 10;
export const RECEIVE_GOLD_RATE         = 0.10;
export const RECEIVE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_GOLD_COST        = 30;
export const EXCHANGE_PRESTIGE_REWARD  = 25;
export const EXCHANGE_MORALE_REWARD    = 15;
export const EXCHANGE_IRON_RATE        = 0.12;
export const EXCHANGE_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export function initRoyalEmissary() {
  if (!state.royalEmissary) {
    state.royalEmissary = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalReceptions: 0,
      totalExchanges:  0,
      totalDismissals: 0,
    };
  }
  if (state.royalEmissary.nextSpawnTick   === undefined) state.royalEmissary.nextSpawnTick   = _nextSpawnTick();
  if (state.royalEmissary.totalVisits     === undefined) state.royalEmissary.totalVisits     = 0;
  if (state.royalEmissary.totalReceptions === undefined) state.royalEmissary.totalReceptions = 0;
  if (state.royalEmissary.totalExchanges  === undefined) state.royalEmissary.totalExchanges  = 0;
  if (state.royalEmissary.totalDismissals === undefined) state.royalEmissary.totalDismissals = 0;
}

export function royalEmissaryTick() {
  const re = state.royalEmissary;
  if (!re) return;
  if (re.active) {
    if (state.tick >= re.active.expiresAt) {
      re.active = null; re.nextSpawnTick = _nextSpawnTick();
      emit(Events.ROYAL_EMISSARY_CHANGED, { expired: true });
      addMessage('🤝 The royal emissary departs without an audience, their diplomatic mission incomplete.', 'info');
    }
    return;
  }
  if (state.tick < re.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  re.active      = { expiresAt: state.tick + WINDOW_TICKS };
  re.totalVisits = (re.totalVisits ?? 0) + 1;
  emit(Events.ROYAL_EMISSARY_CHANGED, { spawned: true });
  addMessage('🤝 A royal emissary bearing the seal of a distant realm has arrived at your capital gates! They carry letters of goodwill and speak of treaties. Respond within 80 seconds.', 'info');
}

export function getActiveRoyalEmissary() { return state.royalEmissary?.active ?? null; }
export function getEmissarySecsLeft() {
  const a = state.royalEmissary?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function receiveEmissaryDelegation() {
  const re = state.royalEmissary;
  if (!re?.active) return { ok: false, reason: 'No emissary present.' };
  if (state.tick >= re.active.expiresAt) return { ok: false, reason: 'The emissary has departed.' };
  changeMorale(RECEIVE_MORALE_REWARD);
  awardPrestige(RECEIVE_PRESTIGE_REWARD, 'Received a royal delegation with full honours');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'emissaryReception');
    state.randomEvents.activeModifiers.push({
      id: 'emissaryReception', resource: 'gold',
      rateMult: 1 + (RECEIVE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + RECEIVE_DURATION_TICKS,
    });
  }
  re.active = null; re.nextSpawnTick = _nextSpawnTick(); re.totalReceptions = (re.totalReceptions ?? 0) + 1;
  emit(Events.ROYAL_EMISSARY_CHANGED, { received: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🤝 The imperial court receives the delegation with great ceremony! Goodwill flows between realms. +${RECEIVE_PRESTIGE_REWARD} prestige · +${RECEIVE_MORALE_REWARD} morale. Trade flourishes: +${RECEIVE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeEmissaryTreaties() {
  const re = state.royalEmissary;
  if (!re?.active) return { ok: false, reason: 'No emissary present.' };
  if (state.tick >= re.active.expiresAt) return { ok: false, reason: 'The emissary has departed.' };
  if ((state.resources.gold ?? 0) < EXCHANGE_GOLD_COST) return { ok: false, reason: `Need ${EXCHANGE_GOLD_COST} gold.` };
  state.resources.gold -= EXCHANGE_GOLD_COST;
  changeMorale(EXCHANGE_MORALE_REWARD);
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged formal treaties with a royal emissary');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'emissaryTreaty');
    state.randomEvents.activeModifiers.push({
      id: 'emissaryTreaty', resource: 'iron',
      rateMult: 1 + (EXCHANGE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  re.active = null; re.nextSpawnTick = _nextSpawnTick(); re.totalExchanges = (re.totalExchanges ?? 0) + 1;
  emit(Events.ROYAL_EMISSARY_CHANGED, { exchanged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📋 Treaties are sealed with wax and ceremony! Strategic alliances open new supply chains. +${EXCHANGE_PRESTIGE_REWARD} prestige · +${EXCHANGE_MORALE_REWARD} morale. Iron imports surge: +${EXCHANGE_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function declineRoyalEmissary() {
  const re = state.royalEmissary;
  if (!re?.active) return { ok: false, reason: 'No emissary present.' };
  re.active = null; re.nextSpawnTick = _nextSpawnTick(); re.totalDismissals = (re.totalDismissals ?? 0) + 1;
  emit(Events.ROYAL_EMISSARY_CHANGED, { dismissed: true });
  addMessage('🤝 The royal emissary is politely declined and departs with diplomatic grace.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
