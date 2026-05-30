/**
 * EmpireOS — Wandering Pearl Diver (T457).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a wandering pearl diver
 * arrives at the settlement carrying a collection of freshwater pearls harvested
 * from river mussels and lake beds upstream — displaying them in shallow wooden
 * trays lined with damp moss to keep the nacre lustrous, ranging in colour from
 * creamy white through pale silver to faint rose depending on the mineral
 * content of the water where each mussel was found, separated by size using
 * graduated wire gauges, with the largest and most perfectly spherical specimens
 * set apart in a small lacquered box — offering to trade the full season's
 * harvest for a supply of worked stone that the diver can use to build a
 * permanent drying station at the riverside, or to sell a detailed guide to the
 * best pearl-bearing mussel beds mapped over years of diving, including the water
 * depths, current speeds, and seasonal timing that produce the most valuable
 * specimens. The player has 80 seconds to decide.
 *
 * Choices:
 *   🦪 Trade Rare Pearls               — pay 20 stone
 *        → +0.22 stone/s for 2.5 min · +20 prestige · +10 morale
 *   📜 Purchase Pearl Diving Guide     — pay 25 gold
 *        → +0.18 gold/s for 2 min · +15 prestige
 *   🚶 Send Away                       — dismiss (no reward)
 *
 * state.wanderingPearlDiver = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalTrades:         number,
 *   totalPurchases:      number,
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

export const TRADE_STONE_COST             = 20;
export const TRADE_STONE_RATE             = 0.22;
export const TRADE_PRESTIGE_REWARD        = 20;
export const TRADE_MORALE_REWARD          = 10;
export const TRADE_DURATION_TICKS         = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST           = 25;
export const PURCHASE_GOLD_RATE           = 0.18;
export const PURCHASE_PRESTIGE_REWARD     = 15;
export const PURCHASE_DURATION_TICKS      = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingPearlDiver() {
  if (!state.wanderingPearlDiver) {
    state.wanderingPearlDiver = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalTrades:      0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingPearlDiver;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalTrades      === undefined) s.totalTrades      = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingPearlDiverTick() {
  const a = state.wanderingPearlDiver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_PEARL_DIVER_CHANGED, { expired: true });
      addMessage('🦪 The wandering pearl diver carefully repacks the trays of freshwater pearls into the travelling case, wraps the lacquered box of finest specimens in oiled cloth, and departs upstream to continue the season\'s harvest.', 'info');
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
  emit(Events.WANDERING_PEARL_DIVER_CHANGED, { spawned: true });
  addMessage('🦪 A wandering pearl diver arrives at the settlement carrying shallow wooden trays lined with damp moss displaying freshwater pearls harvested from river mussels and lake beds upstream — ranging from creamy white through pale silver to faint rose, separated by size using graduated wire gauges, with the finest specimens set apart in a lacquered box — offering to trade the season\'s harvest for worked stone to build a riverside drying station, or to sell a detailed guide to the best pearl-bearing mussel beds mapped over years of diving. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingPearlDiver() { return state.wanderingPearlDiver?.active ?? null; }
export function getPearlDiverSecsLeft() {
  const a = state.wanderingPearlDiver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function tradeRarePearls() {
  const a = state.wanderingPearlDiver;
  if (!a?.active) return { ok: false, reason: 'No pearl diver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The pearl diver has departed.' };
  if ((state.resources.stone ?? 0) < TRADE_STONE_COST) return { ok: false, reason: `Need ${TRADE_STONE_COST} stone.` };
  state.resources.stone -= TRADE_STONE_COST;
  changeMorale(TRADE_MORALE_REWARD);
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Traded stone for rare pearls from the wandering pearl diver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'pearldiverTrade');
    state.randomEvents.activeModifiers.push({
      id: 'pearldiverTrade', resource: 'stone',
      rateMult: 1 + (TRADE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.WANDERING_PEARL_DIVER_CHANGED, { traded: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🦪 The pearl diver counts out the worked stone blocks with evident satisfaction — explaining that the flat-faced stones are exactly what is needed to build the elevated drying racks where the freshly harvested mussels can be spread in the wind and sun to open naturally without heat damage to the nacre — then carefully hands over the full season's pearl harvest: the trays are heavy with lustrous freshwater pearls in graduated sizes, the nacre on each one smooth and unmarked, the larger specimens displaying the deep orient that distinguishes river pearls harvested at the right moment in the mussel's growth cycle from those taken too early. The diver notes the locations of the richest beds as a gesture of goodwill. −${TRADE_STONE_COST} stone · +${TRADE_PRESTIGE_REWARD} prestige · +${TRADE_MORALE_REWARD} morale. Stone surge: +${TRADE_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchasePearlDivingGuide() {
  const a = state.wanderingPearlDiver;
  if (!a?.active) return { ok: false, reason: 'No pearl diver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The pearl diver has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased pearl diving guide from the wandering pearl diver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'pearldiverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'pearldiverPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_PEARL_DIVER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The pearl diver produces a worn but carefully maintained manuscript — pages of thin scraped skin covered in hand-drawn maps of river stretches and lake margins annotated with depth markings scratched in charcoal, current speed measurements recorded by counting the time for a floating stick to travel a fixed distance, seasonal notes indicating the months when the water level is right and the mussels are actively growing rather than dormant, descriptions of the substrate preferences of the most productive mussel colonies, and small illustrations showing how to distinguish a mussel likely to contain a pearl by the slight asymmetry in its shell that develops when nacre layers accumulate around a foreign particle — giving the settlement's fishermen and traders the knowledge to source their own pearl supply without depending on the irregular appearance of travelling divers. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendPearlDiverAway() {
  const a = state.wanderingPearlDiver;
  if (!a?.active) return { ok: false, reason: 'No pearl diver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_PEARL_DIVER_CHANGED, { dismissed: true });
  addMessage('🦪 The wandering pearl diver secures the trays of pearls in the travelling case and departs upstream to find another settlement interested in the season\'s harvest.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
