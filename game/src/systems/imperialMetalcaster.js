/**
 * EmpireOS — Imperial Metalcaster (T368).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), an imperial metalcaster
 * arrives bearing bronze moulds, iron tongs, and casting furnace designs,
 * offering to cast grand metal sculptures or sell refined cast-metal goods.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🔩 Commission Metal Sculptures — pay 25 iron + 20 stone
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +12 morale
 *   🪙 Purchase Cast Metal Goods   — pay 22 gold
 *        → +0.18 gold/s for 2 min  · +15 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.imperialMetalcaster = {
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

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST          = 25;
export const COMMISSION_STONE_COST         = 20;
export const COMMISSION_IRON_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 22;
export const PURCHASE_GOLD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialMetalcaster() {
  if (!state.imperialMetalcaster) {
    state.imperialMetalcaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialMetalcaster;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialMetalcasterTick() {
  const a = state.imperialMetalcaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_METALCASTER_CHANGED, { expired: true });
      addMessage('🔩 The imperial metalcaster cools the bronze moulds, stows the iron tongs into their leather satchel, and departs for the next foundry commission — the distant ring of hammer on anvil fading with their footsteps.', 'info');
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
  emit(Events.IMPERIAL_METALCASTER_CHANGED, { spawned: true });
  addMessage('🔩 A renowned imperial metalcaster arrives at the palace bearing gleaming bronze casting moulds, precision iron tongs, and detailed furnace designs capable of producing magnificent decorative sculptures and refined metal goods. They offer their foundry expertise for grand imperial commissions or to sell their finest cast-metal wares. Respond within 80 seconds.', 'info');
}

export function getActiveImperialMetalcaster() { return state.imperialMetalcaster?.active ?? null; }
export function getMetalcasterSecsLeft() {
  const a = state.imperialMetalcaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionMetalSculptures() {
  const a = state.imperialMetalcaster;
  if (!a?.active) return { ok: false, reason: 'No metalcaster present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The metalcaster has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.iron  -= COMMISSION_IRON_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned metal sculptures from the imperial metalcaster');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'metalcasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'metalcasterCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_METALCASTER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔩 The metalcaster fires the palace foundry furnaces to glowing white heat — magnificent bronze eagles, iron bas-relief friezes, and cast-metal door panels are unveiled across the imperial quarter. The proud craftsmanship inspires the smelting guilds to redouble their iron output! −${COMMISSION_IRON_COST} iron · −${COMMISSION_STONE_COST} stone · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCastMetalGoods() {
  const a = state.imperialMetalcaster;
  if (!a?.active) return { ok: false, reason: 'No metalcaster present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The metalcaster has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased cast metal goods from the imperial metalcaster');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'metalcasterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'metalcasterPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_METALCASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪙 Polished bronze door-rings, ornate cast-iron candelabra, and decorative metal fittings are distributed through the imperial markets — foreign merchants compete eagerly to purchase the refined metal goods, filling the palace coffers with a surge of trade coin! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMetalcasterAway() {
  const a = state.imperialMetalcaster;
  if (!a?.active) return { ok: false, reason: 'No metalcaster present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_METALCASTER_CHANGED, { dismissed: true });
  addMessage('🔩 The imperial metalcaster bows respectfully, loads the bronze casting moulds and iron tongs back onto the cart, and departs along the foundry road — the faint glow of the travelling furnace lantern disappearing into the dusk.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
