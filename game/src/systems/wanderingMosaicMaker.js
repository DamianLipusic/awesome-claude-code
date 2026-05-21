/**
 * EmpireOS — Wandering Mosaic Maker (T351).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a wandering mosaic
 * maker arrives with carts of coloured stone tesserae and an eye for imperial
 * grandeur. They offer to craft stunning decorative mosaics for the empire's
 * public spaces, or sell their hard-won pattern lore. The player has 80
 * seconds to decide.
 *
 * Choices:
 *   🎨 Commission Imperial Mosaic  — pay 20 stone + 15 gold
 *        → +0.20 stone/s for 2.5 min · +20 prestige · +10 morale
 *   📜 Exchange Pattern Lore       — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   👋 Send Away                   — dismiss (no reward)
 *
 * state.wanderingMosaicMaker = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
 *   totalExchanges:      number,
 *   totalDismissals:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_STONE_COST        = 20;
export const COMMISSION_GOLD_COST         = 15;
export const COMMISSION_STONE_RATE        = 0.20;
export const COMMISSION_PRESTIGE_REWARD   = 20;
export const COMMISSION_MORALE_REWARD     = 10;
export const COMMISSION_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_GOLD_COST           = 18;
export const EXCHANGE_GOLD_RATE           = 0.15;
export const EXCHANGE_PRESTIGE_REWARD     = 12;
export const EXCHANGE_DURATION_TICKS      = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingMosaicMaker() {
  if (!state.wanderingMosaicMaker) {
    state.wanderingMosaicMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalExchanges:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingMosaicMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalExchanges   === undefined) s.totalExchanges   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingMosaicMakerTick() {
  const a = state.wanderingMosaicMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_MOSAIC_MAKER_CHANGED, { expired: true });
      addMessage('🎨 The wandering mosaic maker carefully wraps the remaining tesserae in linen cloth, loads the colour-sorted crates back onto the cart, and trundles off down the road in search of another patron.', 'info');
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
  emit(Events.WANDERING_MOSAIC_MAKER_CHANGED, { spawned: true });
  addMessage('🎨 A wandering mosaic maker arrives with a cart overflowing with coloured stone tesserae — deep blues, warm terracottas, glittering golds — and an eye trained on the finest imperial palaces. They propose to cover the empire\'s public halls with magnificent stone mosaics that will endure for centuries, or sell the secret pattern lore that speeds the cutting and laying of decorative stonework. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingMosaicMaker() { return state.wanderingMosaicMaker?.active ?? null; }
export function getMosaicMakerSecsLeft() {
  const a = state.wanderingMosaicMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialMosaic() {
  const a = state.wanderingMosaicMaker;
  if (!a?.active) return { ok: false, reason: 'No mosaic maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The mosaic maker has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST)  return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial mosaics from the wandering mosaic maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'mosaicCommission');
    state.randomEvents.activeModifiers.push({
      id: 'mosaicCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_MOSAIC_MAKER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The mosaic maker sets to work with extraordinary precision, pressing thousands of hand-cut tesserae into wet plaster to form sweeping imperial scenes across the floors and walls of the empire's grandest buildings. Citizens gather daily to marvel at the shimmering stonework, their civic pride swelling with every new panel revealed! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stonework surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangePatternLore() {
  const a = state.wanderingMosaicMaker;
  if (!a?.active) return { ok: false, reason: 'No mosaic maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The mosaic maker has departed.' };
  if ((state.resources.gold ?? 0) < EXCHANGE_GOLD_COST) return { ok: false, reason: `Need ${EXCHANGE_GOLD_COST} gold.` };
  state.resources.gold -= EXCHANGE_GOLD_COST;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged pattern lore with the wandering mosaic maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'mosaicLore');
    state.randomEvents.activeModifiers.push({
      id: 'mosaicLore', resource: 'gold',
      rateMult: 1 + (EXCHANGE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalExchanges = (a.totalExchanges ?? 0) + 1;
  emit(Events.WANDERING_MOSAIC_MAKER_CHANGED, { exchange: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The mosaic maker opens a battered pattern book filled with ancient geometric designs, floral borders, and mythological scenes perfected over generations. The empire's master stone-cutters study the techniques avidly, applying the mosaic-maker's trade secrets to speed the quarrying and finishing of decorative stonework! −${EXCHANGE_GOLD_COST} gold · +${EXCHANGE_PRESTIGE_REWARD} prestige. Commerce surge: +${EXCHANGE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMosaicMakerAway() {
  const a = state.wanderingMosaicMaker;
  if (!a?.active) return { ok: false, reason: 'No mosaic maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_MOSAIC_MAKER_CHANGED, { dismissed: true });
  addMessage('🎨 The wandering mosaic maker bows graciously, repacks the tessera crates with the care of one who values their craft above all, and guides the loaded cart back onto the road toward distant cities.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
