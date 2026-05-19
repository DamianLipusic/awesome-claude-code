/**
 * EmpireOS — Imperial Engraver (T330).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), a master imperial
 * engraver arrives at the court, offering to inscribe coins and monuments
 * and share the secrets of fine metalwork. The player has 80 seconds to decide.
 *
 * Choices:
 *   🪙 Commission Coin Engravings — pay 25 iron + 20 gold
 *        → +0.20 iron/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Purchase Engraving Secrets — pay 20 stone
 *        → +0.15 stone/s for 2 min  · +15 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.imperialEngraver = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalPurchases:     number,
 *   totalDismissals:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_IRON_RATE          = 0.20;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST           = 20;
export const PURCHASE_STONE_RATE           = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialEngraver() {
  if (!state.imperialEngraver) {
    state.imperialEngraver = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialEngraver;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialEngraverTick() {
  const a = state.imperialEngraver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_ENGRAVER_CHANGED, { expired: true });
      addMessage('🪙 The imperial engraver carefully wraps their finest gravers and burins in chamois leather and departs the imperial mint to seek other commissions.', 'info');
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
  emit(Events.IMPERIAL_ENGRAVER_CHANGED, { spawned: true });
  addMessage('🪙 A master imperial engraver arrives bearing a case of precision gravers and sample medallions displaying breathtaking detail. They offer to engrave the imperial coinage or share the secrets of fine metalwork. Respond within 80 seconds.', 'info');
}

export function getActiveImperialEngraver() { return state.imperialEngraver?.active ?? null; }
export function getEngraverSecsLeft() {
  const a = state.imperialEngraver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCoinEngravings() {
  const a = state.imperialEngraver;
  if (!a?.active) return { ok: false, reason: 'No engraver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The engraver has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned coin engravings from the imperial engraver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'engraverCommission');
    state.randomEvents.activeModifiers.push({
      id: 'engraverCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_ENGRAVER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪙 The engraver establishes a permanent workshop in the imperial mint, producing coins bearing the ruler's likeness with extraordinary artistry. The prestige of the currency spurs metalworkers throughout the empire to greater excellence! −${COMMISSION_IRON_COST} iron · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseEngravingSecrets() {
  const a = state.imperialEngraver;
  if (!a?.active) return { ok: false, reason: 'No engraver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The engraver has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased engraving secrets from the imperial engraver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'engraverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'engraverPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_ENGRAVER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The engraver shares the techniques of relief carving, intaglio cutting, and surface preparation. Imperial stonemasons apply these skills to quarry stone more efficiently and shape it with finer precision! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendEngraverAway() {
  const a = state.imperialEngraver;
  if (!a?.active) return { ok: false, reason: 'No engraver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_ENGRAVER_CHANGED, { dismissed: true });
  addMessage('🪙 The imperial engraver carefully packs their precision tools, bows graciously, and departs the imperial court to seek other worthy commissions.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
