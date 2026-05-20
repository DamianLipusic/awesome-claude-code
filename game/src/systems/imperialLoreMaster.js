/**
 * EmpireOS — Imperial Lore Master (T348).
 *
 * Every 16–20 minutes (Medieval Age+, 12+ player tiles), a revered imperial
 * lore master arrives bearing a vast collection of ancient codices, forbidden
 * knowledge scrolls, and mystical lore gathered from across the known world.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📚 Commission Imperial Codex Collection  — pay 35 mana + 20 gold
 *        → +0.28 mana/s for 2.5 min · +25 prestige · +10 morale
 *   🗝️  Purchase Ancient Lore Scrolls         — pay 25 gold
 *        → +0.18 gold/s for 2 min   · +18 prestige
 *   👋 Send Away                              — dismiss (no reward)
 *
 * state.imperialLoreMaster = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalVisits:     number,
 *   totalCodex:      number,
 *   totalScrolls:    number,
 *   totalDismissals: number,
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

export const CODEX_MANA_COST           = 35;
export const CODEX_GOLD_COST           = 20;
export const CODEX_MANA_RATE           = 0.28;
export const CODEX_PRESTIGE_REWARD     = 25;
export const CODEX_MORALE_REWARD       = 10;
export const CODEX_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const SCROLLS_GOLD_COST         = 25;
export const SCROLLS_GOLD_RATE         = 0.18;
export const SCROLLS_PRESTIGE_REWARD   = 18;
export const SCROLLS_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialLoreMaster() {
  if (!state.imperialLoreMaster) {
    state.imperialLoreMaster = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalCodex:      0,
      totalScrolls:    0,
      totalDismissals: 0,
    };
  }
  const s = state.imperialLoreMaster;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalCodex      === undefined) s.totalCodex      = 0;
  if (s.totalScrolls    === undefined) s.totalScrolls    = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function imperialLoreMasterTick() {
  const a = state.imperialLoreMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_LORE_MASTER_CHANGED, { expired: true });
      addMessage('📚 The imperial lore master carefully re-seals the ancient codices in wax-lined cedar boxes, secures the forbidden knowledge scrolls within iron-clasped chests, and departs for another imperial seat of learning.', 'info');
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
  emit(Events.IMPERIAL_LORE_MASTER_CHANGED, { spawned: true });
  addMessage('📚 A revered imperial lore master arrives at the imperial court bearing a magnificent collection of ancient codices, forbidden knowledge scrolls, and mystical lore gathered from the farthest corners of the known world. They offer to commission a grand collection of imperial codices to enhance magical research, or sell rare scrolls containing ancient trade secrets. Respond within 80 seconds.', 'info');
}

export function getActiveImperialLoreMaster() { return state.imperialLoreMaster?.active ?? null; }
export function getLoreMasterSecsLeft() {
  const a = state.imperialLoreMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialCodexCollection() {
  const a = state.imperialLoreMaster;
  if (!a?.active) return { ok: false, reason: 'No lore master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lore master has departed.' };
  if ((state.resources.mana ?? 0) < CODEX_MANA_COST) return { ok: false, reason: `Need ${CODEX_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < CODEX_GOLD_COST) return { ok: false, reason: `Need ${CODEX_GOLD_COST} gold.` };
  state.resources.mana -= CODEX_MANA_COST;
  state.resources.gold -= CODEX_GOLD_COST;
  changeMorale(CODEX_MORALE_REWARD);
  awardPrestige(CODEX_PRESTIGE_REWARD, 'Commissioned an imperial codex collection from the lore master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'loreMasterCodex');
    state.randomEvents.activeModifiers.push({
      id: 'loreMasterCodex', resource: 'mana',
      rateMult: 1 + (CODEX_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + CODEX_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCodex = (a.totalCodex ?? 0) + 1;
  emit(Events.IMPERIAL_LORE_MASTER_CHANGED, { codex: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📚 The imperial lore master establishes a magnificent codex archive within the imperial library, filling it with illuminated manuscripts on alchemy, astral navigation, and the hidden arts. Court wizards and scholars flock to study the ancient texts, greatly amplifying the empire's arcane energies! −${CODEX_MANA_COST} mana · −${CODEX_GOLD_COST} gold · +${CODEX_PRESTIGE_REWARD} prestige · +${CODEX_MORALE_REWARD} morale. Arcane surge: +${CODEX_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseAncientLoreScrolls() {
  const a = state.imperialLoreMaster;
  if (!a?.active) return { ok: false, reason: 'No lore master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lore master has departed.' };
  if ((state.resources.gold ?? 0) < SCROLLS_GOLD_COST) return { ok: false, reason: `Need ${SCROLLS_GOLD_COST} gold.` };
  state.resources.gold -= SCROLLS_GOLD_COST;
  awardPrestige(SCROLLS_PRESTIGE_REWARD, 'Purchased ancient lore scrolls from the imperial lore master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'loreMasterScrolls');
    state.randomEvents.activeModifiers.push({
      id: 'loreMasterScrolls', resource: 'gold',
      rateMult: 1 + (SCROLLS_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + SCROLLS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalScrolls = (a.totalScrolls ?? 0) + 1;
  emit(Events.IMPERIAL_LORE_MASTER_CHANGED, { scrolls: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗝️ The lore master unseals an iron-clasped chest to reveal ancient trade route scrolls, guild pricing agreements, and merchant cipher keys gathered from trading cities across three continents. Imperial merchants decode the hidden trade secrets and begin exploiting lucrative new market opportunities! −${SCROLLS_GOLD_COST} gold · +${SCROLLS_PRESTIGE_REWARD} prestige. Commerce surge: +${SCROLLS_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLoreMasterAway() {
  const a = state.imperialLoreMaster;
  if (!a?.active) return { ok: false, reason: 'No lore master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_LORE_MASTER_CHANGED, { dismissed: true });
  addMessage('📚 The imperial lore master bows graciously, carefully re-seals the ancient codices, and departs the imperial court with quiet dignity to continue their lifelong journey of preserving and transmitting the accumulated wisdom of civilizations past.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
