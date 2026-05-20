/**
 * EmpireOS — Imperial Glassmaker (T344).
 *
 * Every 14–19 minutes (Iron Age+, 10+ player tiles), a renowned imperial
 * glassmaker arrives at the palace gates bearing hand-blown crystal vessels,
 * coloured glass samples, and the closely guarded secrets of the glassblower's
 * furnace. The player has 80 seconds to decide.
 *
 * Choices:
 *   🔮 Commission Crystal Workshop — pay 20 iron + 15 stone
 *        → +0.22 iron/s for 2.5 min · +20 prestige · +12 morale
 *   📜 Purchase Glass Formulas — pay 20 gold
 *        → +0.15 stone/s for 2 min  · +15 prestige
 *   🚶 Send Away            — dismiss (no reward)
 *
 * state.imperialGlassmaker = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissioned:   number,
 *   totalPurchased:      number,
 *   totalDismissals:     number,
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
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST        = 20;
export const COMMISSION_STONE_COST       = 15;
export const COMMISSION_IRON_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 20;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 20;
export const PURCHASE_STONE_RATE         = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialGlassmaker() {
  if (!state.imperialGlassmaker) {
    state.imperialGlassmaker = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalCommissioned: 0,
      totalPurchased:    0,
      totalDismissals:   0,
    };
  }
  const s = state.imperialGlassmaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissioned === undefined) s.totalCommissioned = 0;
  if (s.totalPurchased    === undefined) s.totalPurchased    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialGlassmakerTick() {
  const a = state.imperialGlassmaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_GLASSMAKER_CHANGED, { expired: true });
      addMessage('🔮 The imperial glassmaker carefully wraps their crystal samples in silk cloth, extinguishes their travelling furnace, and departs the palace grounds bound for distant glass-hungry courts.', 'info');
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
  emit(Events.IMPERIAL_GLASSMAKER_CHANGED, { spawned: true });
  addMessage('🔮 A renowned imperial glassmaker arrives at the palace gates bearing hand-blown crystal vessels, coloured glass samples, and the closely guarded secrets of the master furnace. They offer to establish a crystal workshop or share glass formulas with imperial artisans. Respond within 80 seconds.', 'info');
}

export function getActiveImperialGlassmaker() { return state.imperialGlassmaker?.active ?? null; }
export function getGlassmakerSecsLeft() {
  const a = state.imperialGlassmaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCrystalWorkshop() {
  const a = state.imperialGlassmaker;
  if (!a?.active) return { ok: false, reason: 'No glassmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The glassmaker has departed.' };
  if ((state.resources.iron  ?? 0) < COMMISSION_IRON_COST)  return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.iron  -= COMMISSION_IRON_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned crystal workshop from the imperial glassmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'glassmakingCommission');
    state.randomEvents.activeModifiers.push({
      id: 'glassmakingCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.IMPERIAL_GLASSMAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔮 The glassmaker constructs a roaring crystal workshop on the imperial estate, melting silica sand and iron-rich minerals into brilliant glass that refracts light across the palace halls. The precision furnace work also unlocks new metalworking efficiencies! −${COMMISSION_IRON_COST} iron · −${COMMISSION_STONE_COST} stone · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseGlassFormulas() {
  const a = state.imperialGlassmaker;
  if (!a?.active) return { ok: false, reason: 'No glassmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The glassmaker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Acquired glass formulas from the imperial glassmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'glassmakingPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'glassmakingPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.IMPERIAL_GLASSMAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The glassmaker shares mineral composition charts, silica sourcing guides, and high-temperature furnace blueprints with imperial quarry masters. Stone selection and processing improve remarkably! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGlassMakerAway() {
  const a = state.imperialGlassmaker;
  if (!a?.active) return { ok: false, reason: 'No glassmaker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_GLASSMAKER_CHANGED, { dismissed: true });
  addMessage('🔮 The imperial glassmaker bows graciously, wraps their crystal samples in silk cloth, and departs the palace grounds bound for distant courts that will better appreciate their craft.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
