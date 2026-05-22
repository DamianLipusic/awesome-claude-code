/**
 * EmpireOS — Imperial Coin Minter (T372).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), an imperial coin minter
 * arrives at court bearing polished iron dies, bronze blanks, and engraving
 * tools — offering to strike a fresh run of golden imperial coins for the
 * treasury or sell their master minting techniques to the palace craftsmen.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🪙 Commission Golden Coins  — pay 25 iron + 20 gold
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +12 morale
 *   🔨 Purchase Minting Secrets — pay 20 stone
 *        → +0.18 stone/s for 2 min  · +15 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.imperialCoinMinter = {
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
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_IRON_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST           = 20;
export const PURCHASE_STONE_RATE           = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialCoinMinter() {
  if (!state.imperialCoinMinter) {
    state.imperialCoinMinter = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialCoinMinter;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialCoinMinterTick() {
  const a = state.imperialCoinMinter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_COIN_MINTER_CHANGED, { expired: true });
      addMessage('🪙 The imperial coin minter wraps the iron dies and bronze blanks back in protective cloth, secures the engraving tools in the leather case, and departs for the next lord\'s treasury — the chink of coin dies fading into the distance.', 'info');
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
  emit(Events.IMPERIAL_COIN_MINTER_CHANGED, { spawned: true });
  addMessage('🪙 An imperial coin minter arrives at the palace treasury bearing polished iron dies engraved with the imperial crest, bronze blanks, and precision engraving tools — offering to strike a commemorative run of golden imperial coins or teach the palace craftsmen master minting techniques. Respond within 75 seconds.', 'info');
}

export function getActiveImperialCoinMinter() { return state.imperialCoinMinter?.active ?? null; }
export function getCoinMinterSecsLeft() {
  const a = state.imperialCoinMinter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGoldenCoins() {
  const a = state.imperialCoinMinter;
  if (!a?.active) return { ok: false, reason: 'No coin minter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The coin minter has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned golden coins from the imperial coin minter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'coinMinterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'coinMinterCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_COIN_MINTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪙 The coin minter sets up the striking frame in the palace treasury — hundreds of gleaming golden coins bearing the imperial crest ring out as the dies meet the blanks. Merchants across the realm celebrate the new currency and trade flows freely! −${COMMISSION_IRON_COST} iron · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseMintingSecrets() {
  const a = state.imperialCoinMinter;
  if (!a?.active) return { ok: false, reason: 'No coin minter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The coin minter has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased minting secrets from the imperial coin minter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'coinMinterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'coinMinterPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_COIN_MINTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔨 The coin minter reveals the closely guarded secrets of alloy ratios and die-cutting angles to the palace craftsmen — the masonry workshops immediately apply the precision techniques to their stone-cutting frames, improving throughput across all quarry operations! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCoinMinterAway() {
  const a = state.imperialCoinMinter;
  if (!a?.active) return { ok: false, reason: 'No coin minter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_COIN_MINTER_CHANGED, { dismissed: true });
  addMessage('🪙 The imperial coin minter wraps the engraving dies and bronze blanks in protective cloth, picks up the leather tool case, and departs the palace gates with a respectful bow — the treasury door swings quietly shut behind them.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
