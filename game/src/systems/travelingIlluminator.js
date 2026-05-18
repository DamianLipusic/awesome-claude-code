/**
 * EmpireOS — Traveling Illuminator (T314).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), a traveling illuminator
 * arrives with gilded manuscripts and exquisite calligraphy from distant monasteries.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📜 Commission Illuminated Codex  — pay 30 mana + 20 gold
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +8 morale
 *   ✍️  Purchase Gilded Scripts       — pay 25 gold
 *        → +0.18 gold/s for 2 min · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.travelingIlluminator = {
 *   active:               { expiresAt: tick } | null,
 *   nextSpawnTick:        tick,
 *   totalVisits:          number,
 *   totalCommissions:     number,
 *   totalPurchases:       number,
 *   totalDismissals:      number,
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

export const CODEX_MANA_COST           = 30;
export const CODEX_GOLD_COST           = 20;
export const CODEX_MANA_RATE           = 0.25;
export const CODEX_PRESTIGE_REWARD     = 22;
export const CODEX_MORALE_REWARD       = 8;
export const CODEX_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const SCRIPTS_GOLD_COST         = 25;
export const SCRIPTS_GOLD_RATE         = 0.18;
export const SCRIPTS_PRESTIGE_REWARD   = 15;
export const SCRIPTS_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initTravelingIlluminator() {
  if (!state.travelingIlluminator) {
    state.travelingIlluminator = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.travelingIlluminator;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function travelingIlluminatorTick() {
  const a = state.travelingIlluminator;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.TRAVELING_ILLUMINATOR_CHANGED, { expired: true });
      addMessage('📜 The traveling illuminator carefully gathers their gilded pens and vellum pages, places the completed illustrations safely between boards of polished cedar, and departs with a scholar\'s quiet dignity.', 'info');
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
  emit(Events.TRAVELING_ILLUMINATOR_CHANGED, { spawned: true });
  addMessage('📜 A traveling illuminator arrives at the imperial court, their satchel brimming with exquisitely gilded manuscripts and devotional codices adorned with gold leaf and lapis lazuli pigments. They offer to create illuminated records that would elevate the empire\'s scholarly prestige. Respond within 80 seconds.', 'info');
}

export function getActiveIlluminator() { return state.travelingIlluminator?.active ?? null; }
export function getIlluminatorSecsLeft() {
  const a = state.travelingIlluminator?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionIlluminatedCodex() {
  const a = state.travelingIlluminator;
  if (!a?.active) return { ok: false, reason: 'No illuminator present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The illuminator has departed.' };
  if ((state.resources.mana ?? 0) < CODEX_MANA_COST) return { ok: false, reason: `Need ${CODEX_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < CODEX_GOLD_COST) return { ok: false, reason: `Need ${CODEX_GOLD_COST} gold.` };
  state.resources.mana -= CODEX_MANA_COST;
  state.resources.gold -= CODEX_GOLD_COST;
  changeMorale(CODEX_MORALE_REWARD);
  awardPrestige(CODEX_PRESTIGE_REWARD, 'Commissioned an illuminated codex from the traveling illuminator');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'illuminatorCodex');
    state.randomEvents.activeModifiers.push({
      id: 'illuminatorCodex', resource: 'mana',
      rateMult: 1 + (CODEX_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + CODEX_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.TRAVELING_ILLUMINATOR_CHANGED, { codex: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The illuminator sets to work in the imperial scriptorium, applying brilliant gold leaf and luminescent pigments to a magnificent codex recording the empire's greatest mystical achievements. The sacred illustrations inspire the empire's arcane scholars to new heights of discovery! −${CODEX_MANA_COST} mana · −${CODEX_GOLD_COST} gold · +${CODEX_PRESTIGE_REWARD} prestige · +${CODEX_MORALE_REWARD} morale. Arcane surge: +${CODEX_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseGildedScripts() {
  const a = state.travelingIlluminator;
  if (!a?.active) return { ok: false, reason: 'No illuminator present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The illuminator has departed.' };
  if ((state.resources.gold ?? 0) < SCRIPTS_GOLD_COST) return { ok: false, reason: `Need ${SCRIPTS_GOLD_COST} gold.` };
  state.resources.gold -= SCRIPTS_GOLD_COST;
  awardPrestige(SCRIPTS_PRESTIGE_REWARD, 'Purchased gilded scripts from the traveling illuminator');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'illuminatorScripts');
    state.randomEvents.activeModifiers.push({
      id: 'illuminatorScripts', resource: 'gold',
      rateMult: 1 + (SCRIPTS_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + SCRIPTS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.TRAVELING_ILLUMINATOR_CHANGED, { scripts: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`✍️ The gilded scripts depicting prosperous trade caravans and overflowing market stalls are displayed prominently throughout the imperial merchant quarters. Inspired merchants and traders increase their commercial activities, flooding the imperial coffers! −${SCRIPTS_GOLD_COST} gold · +${SCRIPTS_PRESTIGE_REWARD} prestige. Commerce surge: +${SCRIPTS_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendIlluminatorAway() {
  const a = state.travelingIlluminator;
  if (!a?.active) return { ok: false, reason: 'No illuminator present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.TRAVELING_ILLUMINATOR_CHANGED, { dismissed: true });
  addMessage('📜 The traveling illuminator accepts the dismissal graciously, rolls the vellum pages back into protective tubes, and departs for a more appreciative court with quiet dignity.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
