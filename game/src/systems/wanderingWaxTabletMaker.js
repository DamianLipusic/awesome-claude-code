/**
 * EmpireOS — Wandering Wax Tablet Maker (T417).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), a wandering wax
 * tablet maker arrives at the palace carrying stacks of freshly cast beeswax
 * tablets framed in carved boxwood boards, a collection of bronze styli, and
 * smooth ivory spatulas for erasure — offering to commission a complete set of
 * imperial administrative records impressed into durable wax tablets for every
 * chancery and treasury office, or to sell the wax-tablet lore compendium
 * detailing the beeswax-to-resin ratios, stylus-angle techniques, and
 * storage-temperature guidance that extend tablet life across decades.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📋 Commission Imperial Wax Records — pay 25 mana + 20 gold
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +10 morale
 *   📖 Purchase Wax Tablet Lore        — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.wanderingWaxTabletMaker = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissioned: number,
 *   totalPurchased:    number,
 *   totalDismissals:   number,
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
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_MANA_RATE          = 0.25;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST           = 20;
export const PURCHASE_STONE_RATE           = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingWaxTabletMaker() {
  if (!state.wanderingWaxTabletMaker) {
    state.wanderingWaxTabletMaker = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalCommissioned: 0,
      totalPurchased:    0,
      totalDismissals:   0,
    };
  }
  const s = state.wanderingWaxTabletMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissioned=== undefined) s.totalCommissioned= 0;
  if (s.totalPurchased   === undefined) s.totalPurchased   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingWaxTabletMakerTick() {
  const a = state.wanderingWaxTabletMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_WAX_TABLET_MAKER_CHANGED, { expired: true });
      addMessage('📋 The wandering wax tablet maker stacks the boxwood-framed tablets back into the carrying crate, tucks the bronze styli and ivory spatulas into their leather roll, and departs the palace — the faint scent of warm beeswax fading as the cart rounds the gatehouse corner.', 'info');
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
  emit(Events.WANDERING_WAX_TABLET_MAKER_CHANGED, { spawned: true });
  addMessage('📋 A wandering wax tablet maker arrives at the palace carrying stacks of freshly cast beeswax tablets framed in carved boxwood boards, a collection of bronze styli, and smooth ivory spatulas for erasure — offering to commission a complete set of imperial administrative records for every chancery and treasury office, or to sell the wax-tablet lore compendium detailing beeswax-to-resin ratios, stylus-angle techniques, and storage-temperature guidance. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingWaxTabletMaker() { return state.wanderingWaxTabletMaker?.active ?? null; }
export function getWaxTabletMakerSecsLeft() {
  const a = state.wanderingWaxTabletMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialWaxRecords() {
  const a = state.wanderingWaxTabletMaker;
  if (!a?.active) return { ok: false, reason: 'No wax tablet maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The wax tablet maker has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial wax records from the wandering wax tablet maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'waxTabletCommission');
    state.randomEvents.activeModifiers.push({
      id: 'waxTabletCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.WANDERING_WAX_TABLET_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📋 The wax tablet maker pours the blended beeswax-and-resin mixture into each carved boxwood frame, smooths the surface with a heated spatula to a perfectly level field, and impresses the imperial administrative decrees, tax schedules, census tallies, and supply inventories letter-by-letter with a fine bronze stylus — delivering a complete archival record set to every chancery desk and treasury counting room in the empire, so that every official can read, update, and erase their working documents with a warm spatula stroke! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseWaxTabletLore() {
  const a = state.wanderingWaxTabletMaker;
  if (!a?.active) return { ok: false, reason: 'No wax tablet maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The wax tablet maker has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased wax tablet lore from the wandering wax tablet maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'waxTabletPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'waxTabletPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.WANDERING_WAX_TABLET_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The tablet maker opens the lore compendium and walks the imperial master masons through the beeswax-to-resin mixture ratios that determine hardness and writing resistance, the correct storage-temperature range that prevents summer warping and winter brittleness, and the spatula-heating technique for perfect surface re-use — the masons apply the same material-science precision and temperature-controlled preparation discipline to every quarried block, dressed facing stone, and arch-voussoir commission across the empire! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendWaxTabletMakerAway() {
  const a = state.wanderingWaxTabletMaker;
  if (!a?.active) return { ok: false, reason: 'No wax tablet maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_WAX_TABLET_MAKER_CHANGED, { dismissed: true });
  addMessage('📋 The wandering wax tablet maker repacks the boxwood-framed tablets and bronze styli, bows respectfully, and departs the palace — the faint warm scent of beeswax fading as the carrying crate disappears through the gatehouse.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
