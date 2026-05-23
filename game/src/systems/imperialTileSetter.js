/**
 * EmpireOS — Imperial Tile Setter (T384).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), a master tile setter
 * arrives at court carrying a collection of hand-painted ceramic tiles,
 * grout tools, and pattern templates — offering to commission a grand display
 * of imperial tilework throughout the palace, or to sell rare tile patterns
 * and mosaic-laying secrets to the palace construction teams.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🏛️ Commission Imperial Tilework — pay 25 stone + 15 gold
 *        → +0.22 stone/s for 2.5 min · +20 prestige · +10 morale
 *   🎨 Purchase Tile Patterns      — pay 18 iron
 *        → +0.15 iron/s for 2 min · +12 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.imperialTileSetter = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
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

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_STONE_COST         = 25;
export const COMMISSION_GOLD_COST          = 15;
export const COMMISSION_STONE_RATE         = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 20;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_IRON_COST            = 18;
export const PURCHASE_IRON_RATE            = 0.15;
export const PURCHASE_PRESTIGE_REWARD      = 12;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialTileSetter() {
  if (!state.imperialTileSetter) {
    state.imperialTileSetter = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialTileSetter;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialTileSetterTick() {
  const a = state.imperialTileSetter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_TILE_SETTER_CHANGED, { expired: true });
      addMessage('🏛️ The master tile setter carefully wraps the hand-painted ceramic samples in cloth, collects the grout tools, and departs with a respectful bow — leaving behind only faint chalk lines traced on the palace floor where magnificent tilework might have been.', 'info');
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
  emit(Events.IMPERIAL_TILE_SETTER_CHANGED, { spawned: true });
  addMessage('🏛️ A master imperial tile setter arrives at court carrying hand-painted ceramic tiles, geometric pattern templates, and fine grout tools — offering to commission a breathtaking display of mosaic tilework throughout the palace halls, or to share rare tile-laying patterns and techniques with the imperial construction teams. Respond within 80 seconds.', 'info');
}

export function getActiveImperialTileSetter() { return state.imperialTileSetter?.active ?? null; }
export function getTileSetterSecsLeft() {
  const a = state.imperialTileSetter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialTilework() {
  const a = state.imperialTileSetter;
  if (!a?.active) return { ok: false, reason: 'No tile setter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The tile setter has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold  ?? 0) < COMMISSION_GOLD_COST)  return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial tilework from the tile setter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tileSetterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'tileSetterCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_TILE_SETTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏛️ The tile setter organises a team of skilled craftspeople who transform the palace halls with sweeping geometric mosaics and intricate painted-tile friezes — so impressed are visiting nobles and merchants by the palace's new splendour that they place lavish orders for tilework in their own estates, driving a boom in quarrying, cutting, and stone delivery across the empire! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseTilePatterns() {
  const a = state.imperialTileSetter;
  if (!a?.active) return { ok: false, reason: 'No tile setter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The tile setter has departed.' };
  if ((state.resources.iron ?? 0) < PURCHASE_IRON_COST) return { ok: false, reason: `Need ${PURCHASE_IRON_COST} iron.` };
  state.resources.iron -= PURCHASE_IRON_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased tile patterns from the imperial tile setter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tileSetterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'tileSetterPurchase', resource: 'iron',
      rateMult: 1 + (PURCHASE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_TILE_SETTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The tile setter unrolls a magnificent folio of geometric pattern templates, Byzantine-inspired mosaics, and ancient Roman floor designs — palace craftspeople master the advanced tile-cutting and iron-bracket anchoring techniques, dramatically improving the precision and output of the imperial metalworking and stonecutting workshops! −${PURCHASE_IRON_COST} iron · +${PURCHASE_PRESTIGE_REWARD} prestige. Iron surge: +${PURCHASE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendTileSetterAway() {
  const a = state.imperialTileSetter;
  if (!a?.active) return { ok: false, reason: 'No tile setter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_TILE_SETTER_CHANGED, { dismissed: true });
  addMessage('🏛️ The tile setter gathers the ceramic samples and pattern folios with practiced efficiency, loads the grout tools into a sturdy case, and departs through the palace courtyard — the faint clink of ceramic tiles echoing as the craftsperson heads on to the next commission.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
