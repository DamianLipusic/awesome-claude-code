/**
 * EmpireOS — Wandering Scribe (T279).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), a wandering
 * scribe bearing rare manuscripts and historical chronicles arrives,
 * offering their scholarly services. The player has 80 seconds to decide.
 *
 * Choices:
 *   🖋️ Commission Imperial Codex  — pay 35 mana
 *        → +0.15 mana/s for 3 min · +22 prestige · +8 morale
 *   📜 Purchase Rare Manuscripts  — pay 30 gold
 *        → +0.12 gold/s for 2.5 min · +18 prestige
 *   👋 Send Away                  — dismiss (no reward)
 *
 * state.wanderingScribe = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCodex:       number,
 *   totalManuscripts: number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const CODEX_MANA_COST        = 35;
export const CODEX_MANA_RATE        = 0.15;
export const CODEX_PRESTIGE_REWARD  = 22;
export const CODEX_MORALE_REWARD    = 8;
export const CODEX_DURATION_TICKS   = Math.round(3 * 60 * TICKS_PER_SECOND);

export const MANUSCRIPTS_GOLD_COST       = 30;
export const MANUSCRIPTS_GOLD_RATE       = 0.12;
export const MANUSCRIPTS_PRESTIGE_REWARD = 18;
export const MANUSCRIPTS_DURATION_TICKS  = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export function initWanderingScribe() {
  if (!state.wanderingScribe) {
    state.wanderingScribe = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCodex:       0,
      totalManuscripts: 0,
      totalDismissals:  0,
    };
  }
  if (state.wanderingScribe.nextSpawnTick    === undefined) state.wanderingScribe.nextSpawnTick    = _nextSpawnTick();
  if (state.wanderingScribe.totalVisits      === undefined) state.wanderingScribe.totalVisits      = 0;
  if (state.wanderingScribe.totalCodex       === undefined) state.wanderingScribe.totalCodex       = 0;
  if (state.wanderingScribe.totalManuscripts === undefined) state.wanderingScribe.totalManuscripts = 0;
  if (state.wanderingScribe.totalDismissals  === undefined) state.wanderingScribe.totalDismissals  = 0;
}

export function wanderingScribeTick() {
  const ws = state.wanderingScribe;
  if (!ws) return;
  if (ws.active) {
    if (state.tick >= ws.active.expiresAt) {
      ws.active = null; ws.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_SCRIBE_CHANGED, { expired: true });
      addMessage('🖋️ The wandering scribe carefully rolls their manuscripts and departs on their scholarly journey.', 'info');
    }
    return;
  }
  if (state.tick < ws.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  ws.active      = { expiresAt: state.tick + WINDOW_TICKS };
  ws.totalVisits = (ws.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_SCRIBE_CHANGED, { spawned: true });
  addMessage('🖋️ A wandering scribe bearing rare manuscripts and illuminated chronicles has arrived, their knowledge of historical records unmatched in the known world. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingScribe() { return state.wanderingScribe?.active ?? null; }
export function getScribeSecsLeft() {
  const a = state.wanderingScribe?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialCodex() {
  const ws = state.wanderingScribe;
  if (!ws?.active) return { ok: false, reason: 'No scribe present.' };
  if (state.tick >= ws.active.expiresAt) return { ok: false, reason: 'The scribe has departed.' };
  if ((state.resources.mana ?? 0) < CODEX_MANA_COST) return { ok: false, reason: `Need ${CODEX_MANA_COST} mana.` };
  state.resources.mana -= CODEX_MANA_COST;
  changeMorale(CODEX_MORALE_REWARD);
  awardPrestige(CODEX_PRESTIGE_REWARD, 'Commissioned an imperial codex from a wandering scribe');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'scribeCodex');
    state.randomEvents.activeModifiers.push({
      id: 'scribeCodex', resource: 'mana',
      rateMult: 1 + (CODEX_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + CODEX_DURATION_TICKS,
    });
  }
  ws.active = null; ws.nextSpawnTick = _nextSpawnTick(); ws.totalCodex = (ws.totalCodex ?? 0) + 1;
  emit(Events.WANDERING_SCRIBE_CHANGED, { codex: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🖋️ Illuminated chronicles of imperial history now grace the royal library! −${CODEX_MANA_COST} mana · +${CODEX_PRESTIGE_REWARD} prestige · +${CODEX_MORALE_REWARD} morale. Scholarly inspiration flows: +${CODEX_MANA_RATE} mana/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseRareManuscripts() {
  const ws = state.wanderingScribe;
  if (!ws?.active) return { ok: false, reason: 'No scribe present.' };
  if (state.tick >= ws.active.expiresAt) return { ok: false, reason: 'The scribe has departed.' };
  if ((state.resources.gold ?? 0) < MANUSCRIPTS_GOLD_COST) return { ok: false, reason: `Need ${MANUSCRIPTS_GOLD_COST} gold.` };
  state.resources.gold -= MANUSCRIPTS_GOLD_COST;
  awardPrestige(MANUSCRIPTS_PRESTIGE_REWARD, 'Purchased rare manuscripts from a wandering scribe');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'scribeManuscripts');
    state.randomEvents.activeModifiers.push({
      id: 'scribeManuscripts', resource: 'gold',
      rateMult: 1 + (MANUSCRIPTS_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + MANUSCRIPTS_DURATION_TICKS,
    });
  }
  ws.active = null; ws.nextSpawnTick = _nextSpawnTick(); ws.totalManuscripts = (ws.totalManuscripts ?? 0) + 1;
  emit(Events.WANDERING_SCRIBE_CHANGED, { manuscripts: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 Rare manuscripts containing ancient trade secrets now enrich the imperial treasury! −${MANUSCRIPTS_GOLD_COST} gold · +${MANUSCRIPTS_PRESTIGE_REWARD} prestige. Commercial knowledge unlocked: +${MANUSCRIPTS_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function sendScribeAway() {
  const ws = state.wanderingScribe;
  if (!ws?.active) return { ok: false, reason: 'No scribe present.' };
  ws.active = null; ws.nextSpawnTick = _nextSpawnTick(); ws.totalDismissals = (ws.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_SCRIBE_CHANGED, { dismissed: true });
  addMessage('🖋️ The wandering scribe is thanked and continues their journey to the next great library.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
