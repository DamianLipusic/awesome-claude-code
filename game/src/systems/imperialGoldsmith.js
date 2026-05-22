/**
 * EmpireOS — Imperial Goldsmith (T364).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a master imperial
 * goldsmith arrives with exquisite golden artifacts and offers to craft
 * ceremonial regalia or share precious metalworking secrets.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🥇 Commission Golden Regalia    — pay 25 iron + 20 gold
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Purchase Gold Crafting Secrets — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   👋 Send Away                    — dismiss (no reward)
 *
 * state.imperialGoldsmith = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
 *   totalPurchases:    number,
 *   totalDismissals:   number,
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
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_IRON_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST           = 20;
export const PURCHASE_STONE_RATE           = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialGoldsmith() {
  if (!state.imperialGoldsmith) {
    state.imperialGoldsmith = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialGoldsmith;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialGoldsmithTick() {
  const a = state.imperialGoldsmith;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_GOLDSMITH_CHANGED, { expired: true });
      addMessage('🥇 The imperial goldsmith carefully wraps the golden artifacts back in velvet cloth, tucks the metalworking patterns into a brass-clasped satchel, and departs for the royal courts of distant kingdoms — the gleam of gold fading from sight.', 'info');
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
  emit(Events.IMPERIAL_GOLDSMITH_CHANGED, { spawned: true });
  addMessage('🥇 A master imperial goldsmith arrives at the palace, bearing an exquisite display of golden crowns, scepters, and ceremonial vessels forged with ancient techniques passed down through generations. They offer to commission a grand set of golden imperial regalia or to share their precious metalworking secrets with the palace craftsmen. Respond within 80 seconds.', 'info');
}

export function getActiveImperialGoldsmith() { return state.imperialGoldsmith?.active ?? null; }
export function getGoldsmithSecsLeft() {
  const a = state.imperialGoldsmith?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGoldenRegalia() {
  const a = state.imperialGoldsmith;
  if (!a?.active) return { ok: false, reason: 'No goldsmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The goldsmith has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned golden regalia from the imperial goldsmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'goldsmithCommission');
    state.randomEvents.activeModifiers.push({
      id: 'goldsmithCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_GOLDSMITH_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🥇 The goldsmith establishes a gleaming forge in the palace workshop, directing the palace smiths in alloying and shaping iron with gold leaf inlays — the precision metalworking techniques push the foundries to new heights of excellence! −${COMMISSION_IRON_COST} iron · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseGoldCraftingSecrets() {
  const a = state.imperialGoldsmith;
  if (!a?.active) return { ok: false, reason: 'No goldsmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The goldsmith has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased gold crafting secrets from the imperial goldsmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'goldsmithPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'goldsmithPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_GOLDSMITH_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The golden metalworking secrets are inscribed on stone tablets and shared with the palace quarry masters, who apply the precision techniques to their stonecutting — the improved craftsmanship dramatically increases the quality and output of worked stone! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGoldsmithAway() {
  const a = state.imperialGoldsmith;
  if (!a?.active) return { ok: false, reason: 'No goldsmith present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_GOLDSMITH_CHANGED, { dismissed: true });
  addMessage('🥇 The imperial goldsmith bows graciously, gathers the golden artifacts and velvet display cloths, and departs with quiet dignity — heading to courts that may better appreciate the ancient art of gold mastery.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
