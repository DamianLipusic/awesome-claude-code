/**
 * EmpireOS — Wandering Silversmith (T305).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a master silversmith
 * arrives with finely-crafted tools and silvered techniques honed across
 * many forges. The player has 80 seconds to decide.
 *
 * Choices:
 *   🥈 Commission Silver Artifacts — pay 20 iron + 15 stone
 *        → +0.18 iron/s for 2.5 min · +22 prestige · +10 morale
 *   💎 Purchase Silver Jewelry     — pay 25 gold
 *        → +0.15 gold/s for 2 min · +18 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.wanderingSilversmith = {
 *   active:                { expiresAt: tick } | null,
 *   nextSpawnTick:         tick,
 *   totalVisits:           number,
 *   totalArtifacts:        number,
 *   totalJewelry:          number,
 *   totalDismissals:       number,
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
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const ARTIFACTS_IRON_COST        = 20;
export const ARTIFACTS_STONE_COST       = 15;
export const ARTIFACTS_IRON_RATE        = 0.18;
export const ARTIFACTS_PRESTIGE_REWARD  = 22;
export const ARTIFACTS_MORALE_REWARD    = 10;
export const ARTIFACTS_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const JEWELRY_GOLD_COST          = 25;
export const JEWELRY_GOLD_RATE          = 0.15;
export const JEWELRY_PRESTIGE_REWARD    = 18;
export const JEWELRY_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingSilversmith() {
  if (!state.wanderingSilversmith) {
    state.wanderingSilversmith = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalArtifacts:  0,
      totalJewelry:    0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingSilversmith;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalArtifacts   === undefined) s.totalArtifacts   = 0;
  if (s.totalJewelry     === undefined) s.totalJewelry     = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingSilversmithTick() {
  const a = state.wanderingSilversmith;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SILVERSMITH_CHANGED, { expired: true });
      addMessage('🥈 The wandering silversmith carefully wraps their polished tools and gleaming sample pieces, bows respectfully, and departs to seek other imperial patrons.', 'info');
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
  emit(Events.WANDERING_SILVERSMITH_CHANGED, { spawned: true });
  addMessage('🥈 A renowned wandering silversmith arrives at the imperial gates, their travelling chest gleaming with masterwork silver pieces and refined forging tools acquired across many kingdoms. Respond within 80 seconds.', 'info');
}

export function getActiveSilversmith() { return state.wanderingSilversmith?.active ?? null; }
export function getSilversmithSecsLeft() {
  const a = state.wanderingSilversmith?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionSilverArtifacts() {
  const a = state.wanderingSilversmith;
  if (!a?.active) return { ok: false, reason: 'No silversmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The silversmith has departed.' };
  if ((state.resources.iron  ?? 0) < ARTIFACTS_IRON_COST)  return { ok: false, reason: `Need ${ARTIFACTS_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < ARTIFACTS_STONE_COST) return { ok: false, reason: `Need ${ARTIFACTS_STONE_COST} stone.` };
  state.resources.iron  -= ARTIFACTS_IRON_COST;
  state.resources.stone -= ARTIFACTS_STONE_COST;
  changeMorale(ARTIFACTS_MORALE_REWARD);
  awardPrestige(ARTIFACTS_PRESTIGE_REWARD, 'Commissioned silver artifacts from the wandering silversmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'silvArtifacts');
    state.randomEvents.activeModifiers.push({
      id: 'silvArtifacts', resource: 'iron',
      rateMult: 1 + (ARTIFACTS_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + ARTIFACTS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalArtifacts = (a.totalArtifacts ?? 0) + 1;
  emit(Events.WANDERING_SILVERSMITH_CHANGED, { artifacts: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🥈 The silversmith sets up their portable forge and crafts magnificent silver-edged tools and ceremonial pieces for the empire's smithies, inspiring a surge of skilled metalwork! −${ARTIFACTS_IRON_COST} iron · −${ARTIFACTS_STONE_COST} stone · +${ARTIFACTS_PRESTIGE_REWARD} prestige · +${ARTIFACTS_MORALE_REWARD} morale. Iron surge: +${ARTIFACTS_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSilverJewelry() {
  const a = state.wanderingSilversmith;
  if (!a?.active) return { ok: false, reason: 'No silversmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The silversmith has departed.' };
  if ((state.resources.gold ?? 0) < JEWELRY_GOLD_COST) return { ok: false, reason: `Need ${JEWELRY_GOLD_COST} gold.` };
  state.resources.gold -= JEWELRY_GOLD_COST;
  awardPrestige(JEWELRY_PRESTIGE_REWARD, 'Purchased silver jewelry from the wandering silversmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'silvJewelry');
    state.randomEvents.activeModifiers.push({
      id: 'silvJewelry', resource: 'gold',
      rateMult: 1 + (JEWELRY_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + JEWELRY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalJewelry = (a.totalJewelry ?? 0) + 1;
  emit(Events.WANDERING_SILVERSMITH_CHANGED, { jewelry: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💎 The silversmith's exquisite silver jewels and ornaments are distributed as gifts to noble families and merchant guilds, stimulating trade and drawing wealthy patrons to the empire's markets! −${JEWELRY_GOLD_COST} gold · +${JEWELRY_PRESTIGE_REWARD} prestige. Trade surge: +${JEWELRY_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSilversmithAway() {
  const a = state.wanderingSilversmith;
  if (!a?.active) return { ok: false, reason: 'No silversmith present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SILVERSMITH_CHANGED, { dismissed: true });
  addMessage('🥈 The wandering silversmith nods politely, secures their masterwork samples in a leather-bound case, and departs the imperial court in search of more appreciative craftsmen patrons.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
