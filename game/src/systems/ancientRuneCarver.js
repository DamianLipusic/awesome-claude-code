/**
 * EmpireOS — Ancient Rune Carver (T326).
 *
 * Every 15–20 minutes (Iron Age+, 10+ player tiles), a mysterious ancient
 * rune carver arrives bearing knowledge of forgotten inscriptions that can
 * strengthen the empire's stones and empower its mages. The player has
 * 80 seconds to decide.
 *
 * Choices:
 *   🪨 Commission Runic Inscriptions — pay 25 stone + 20 mana
 *        → +0.2 stone/s for 2.5 min · +25 prestige · +8 morale
 *   📜 Learn Rune Lore               — pay 20 mana
 *        → +0.18 mana/s for 2 min   · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.ancientRuneCarver = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
 *   totalStudies:        number,
 *   totalDismissals:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const INSCRIPTIONS_STONE_COST        = 25;
export const INSCRIPTIONS_MANA_COST         = 20;
export const INSCRIPTIONS_STONE_RATE        = 0.2;
export const INSCRIPTIONS_PRESTIGE_REWARD   = 25;
export const INSCRIPTIONS_MORALE_REWARD     = 8;
export const INSCRIPTIONS_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const LORE_MANA_COST                 = 20;
export const LORE_MANA_RATE                 = 0.18;
export const LORE_PRESTIGE_REWARD           = 15;
export const LORE_DURATION_TICKS            = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initAncientRuneCarver() {
  if (!state.ancientRuneCarver) {
    state.ancientRuneCarver = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudies:     0,
      totalDismissals:  0,
    };
  }
  const s = state.ancientRuneCarver;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalStudies     === undefined) s.totalStudies     = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function ancientRuneCarverTick() {
  const a = state.ancientRuneCarver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.ANCIENT_RUNE_CARVER_CHANGED, { expired: true });
      addMessage('🪨 The ancient rune carver wraps their carved stone tablets in cloth and departs, taking their forgotten knowledge with them.', 'info');
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
  emit(Events.ANCIENT_RUNE_CARVER_CHANGED, { spawned: true });
  addMessage('🪨 A mysterious ancient rune carver arrives bearing worn stone tablets etched with forgotten inscriptions. They offer to carve powerful runes into the empire\'s stoneworks or share their arcane knowledge. Respond within 80 seconds.', 'info');
}

export function getActiveAncientRuneCarver() { return state.ancientRuneCarver?.active ?? null; }
export function getAncientRuneCarverSecsLeft() {
  const a = state.ancientRuneCarver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRunicInscriptions() {
  const a = state.ancientRuneCarver;
  if (!a?.active) return { ok: false, reason: 'No rune carver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The rune carver has departed.' };
  if ((state.resources.stone ?? 0) < INSCRIPTIONS_STONE_COST) return { ok: false, reason: `Need ${INSCRIPTIONS_STONE_COST} stone.` };
  if ((state.resources.mana  ?? 0) < INSCRIPTIONS_MANA_COST)  return { ok: false, reason: `Need ${INSCRIPTIONS_MANA_COST} mana.` };
  state.resources.stone -= INSCRIPTIONS_STONE_COST;
  state.resources.mana  -= INSCRIPTIONS_MANA_COST;
  changeMorale(INSCRIPTIONS_MORALE_REWARD);
  awardPrestige(INSCRIPTIONS_PRESTIGE_REWARD, 'Commissioned runic inscriptions throughout the empire\'s stoneworks');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'runeInscriptions');
    state.randomEvents.activeModifiers.push({
      id: 'runeInscriptions', resource: 'stone',
      rateMult: 1 + (INSCRIPTIONS_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + INSCRIPTIONS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.ANCIENT_RUNE_CARVER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪨 The rune carver inscribes powerful ancient symbols throughout the empire\'s quarries and fortifications. The glowing runes guide miners to rich stone veins and strengthen castle walls with mystical resonance! −${INSCRIPTIONS_STONE_COST} stone · −${INSCRIPTIONS_MANA_COST} mana · +${INSCRIPTIONS_PRESTIGE_REWARD} prestige · +${INSCRIPTIONS_MORALE_REWARD} morale. Stone surge: +${INSCRIPTIONS_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function learnRuneLore() {
  const a = state.ancientRuneCarver;
  if (!a?.active) return { ok: false, reason: 'No rune carver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The rune carver has departed.' };
  if ((state.resources.mana ?? 0) < LORE_MANA_COST) return { ok: false, reason: `Need ${LORE_MANA_COST} mana.` };
  state.resources.mana -= LORE_MANA_COST;
  awardPrestige(LORE_PRESTIGE_REWARD, 'Learned ancient rune lore from the rune carver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'runeLore');
    state.randomEvents.activeModifiers.push({
      id: 'runeLore', resource: 'mana',
      rateMult: 1 + (LORE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + LORE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudies = (a.totalStudies ?? 0) + 1;
  emit(Events.ANCIENT_RUNE_CARVER_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The rune carver shares their deep understanding of arcane inscriptions. Imperial mages copy the ancient symbols into new spellbooks, amplifying their ability to channel and accumulate magical energy! −${LORE_MANA_COST} mana · +${LORE_PRESTIGE_REWARD} prestige. Mana surge: +${LORE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendRuneCarverAway() {
  const a = state.ancientRuneCarver;
  if (!a?.active) return { ok: false, reason: 'No rune carver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.ANCIENT_RUNE_CARVER_CHANGED, { dismissed: true });
  addMessage('🪨 The ancient rune carver bows silently, wraps their stone tablets, and disappears down the road with their forgotten knowledge.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
