/**
 * EmpireOS — Ancient Manuscript Trader (T293).
 *
 * Every 15–19 minutes (Medieval Age+, 10+ player tiles), a secretive
 * manuscript trader arrives with illuminated codices, ancient star charts,
 * and lost records of vanished civilisations. The player has 80 seconds to
 * decide.
 *
 * Choices:
 *   📜 Purchase Illuminated Codex  — pay 35 mana
 *        → +0.25 mana/s for 2.5 min · +22 prestige
 *   🪙 Acquire Trade Secrets       — pay 30 gold
 *        → +0.18 gold/s for 2 min · +18 prestige · +8 morale
 *   👋 Send Away                   — dismiss (no reward)
 *
 * state.ancientManuscriptTrader = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCodexes:     number,
 *   totalSecrets:     number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const CODEX_MANA_COST           = 35;
export const CODEX_MANA_RATE           = 0.25;
export const CODEX_PRESTIGE_REWARD     = 22;
export const CODEX_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const SECRETS_GOLD_COST         = 30;
export const SECRETS_GOLD_RATE         = 0.18;
export const SECRETS_PRESTIGE_REWARD   = 18;
export const SECRETS_MORALE_REWARD     = 8;
export const SECRETS_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initAncientManuscriptTrader() {
  if (!state.ancientManuscriptTrader) {
    state.ancientManuscriptTrader = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalCodexes:    0,
      totalSecrets:    0,
      totalDismissals: 0,
    };
  }
  const s = state.ancientManuscriptTrader;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalCodexes    === undefined) s.totalCodexes    = 0;
  if (s.totalSecrets    === undefined) s.totalSecrets    = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function ancientManuscriptTraderTick() {
  const t = state.ancientManuscriptTrader;
  if (!t) return;
  if (t.active) {
    if (state.tick >= t.active.expiresAt) {
      t.active = null; t.nextSpawnTick = _nextSpawnTick();
      emit(Events.ANCIENT_MANUSCRIPT_TRADER_CHANGED, { expired: true });
      addMessage('📜 The manuscript trader carefully rolls their parchments and departs through the imperial gates, their cart of ancient knowledge vanishing into the distance.', 'info');
    }
    return;
  }
  if (state.tick < t.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  t.active      = { expiresAt: state.tick + WINDOW_TICKS };
  t.totalVisits = (t.totalVisits ?? 0) + 1;
  emit(Events.ANCIENT_MANUSCRIPT_TRADER_CHANGED, { spawned: true });
  addMessage('📜 A secretive manuscript trader arrives at the imperial court, their reinforced cart filled with illuminated codices, ancient star charts, and the lost records of vanished civilisations — knowledge that could reshape your empire\'s destiny. Respond within 80 seconds.', 'info');
}

export function getActiveManuscriptTrader() { return state.ancientManuscriptTrader?.active ?? null; }
export function getManuscriptTraderSecsLeft() {
  const a = state.ancientManuscriptTrader?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function purchaseIlluminatedCodex() {
  const t = state.ancientManuscriptTrader;
  if (!t?.active) return { ok: false, reason: 'No trader present.' };
  if (state.tick >= t.active.expiresAt) return { ok: false, reason: 'The trader has departed.' };
  if ((state.resources.mana ?? 0) < CODEX_MANA_COST) return { ok: false, reason: `Need ${CODEX_MANA_COST} mana.` };
  state.resources.mana -= CODEX_MANA_COST;
  awardPrestige(CODEX_PRESTIGE_REWARD, 'Purchased an illuminated codex from a manuscript trader');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'manuscriptCodex');
    state.randomEvents.activeModifiers.push({
      id: 'manuscriptCodex', resource: 'mana',
      rateMult: 1 + (CODEX_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + CODEX_DURATION_TICKS,
    });
  }
  t.active = null; t.nextSpawnTick = _nextSpawnTick(); t.totalCodexes = (t.totalCodexes ?? 0) + 1;
  emit(Events.ANCIENT_MANUSCRIPT_TRADER_CHANGED, { codex: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The illuminated codex unveils arcane formulae and forgotten rites, flooding the imperial academies with mystical insight! −${CODEX_MANA_COST} mana · +${CODEX_PRESTIGE_REWARD} prestige. Arcane surge: +${CODEX_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function acquireTradeSecrets() {
  const t = state.ancientManuscriptTrader;
  if (!t?.active) return { ok: false, reason: 'No trader present.' };
  if (state.tick >= t.active.expiresAt) return { ok: false, reason: 'The trader has departed.' };
  if ((state.resources.gold ?? 0) < SECRETS_GOLD_COST) return { ok: false, reason: `Need ${SECRETS_GOLD_COST} gold.` };
  state.resources.gold -= SECRETS_GOLD_COST;
  changeMorale(SECRETS_MORALE_REWARD);
  awardPrestige(SECRETS_PRESTIGE_REWARD, 'Acquired trade secrets from a manuscript trader');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'manuscriptSecrets');
    state.randomEvents.activeModifiers.push({
      id: 'manuscriptSecrets', resource: 'gold',
      rateMult: 1 + (SECRETS_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + SECRETS_DURATION_TICKS,
    });
  }
  t.active = null; t.nextSpawnTick = _nextSpawnTick(); t.totalSecrets = (t.totalSecrets ?? 0) + 1;
  emit(Events.ANCIENT_MANUSCRIPT_TRADER_CHANGED, { secrets: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪙 The merchant's trade secrets unlock lucrative new commerce routes and tariff loopholes, flooding the imperial treasury with coin! −${SECRETS_GOLD_COST} gold · +${SECRETS_PRESTIGE_REWARD} prestige · +${SECRETS_MORALE_REWARD} morale. Treasury surge: +${SECRETS_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendManuscriptTraderAway() {
  const t = state.ancientManuscriptTrader;
  if (!t?.active) return { ok: false, reason: 'No trader present.' };
  t.active = null; t.nextSpawnTick = _nextSpawnTick(); t.totalDismissals = (t.totalDismissals ?? 0) + 1;
  emit(Events.ANCIENT_MANUSCRIPT_TRADER_CHANGED, { dismissed: true });
  addMessage('📜 The manuscript trader accepts the polite dismissal, carefully securing their parchments before guiding their cart back through the imperial gates.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
