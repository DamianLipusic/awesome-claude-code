/**
 * EmpireOS — Imperial Stonecutter's Guild (T390).
 *
 * Every 14–18 minutes (Iron Age+, 12+ player tiles), a delegation from the
 * imperial stonecutter's guild arrives at court bearing master-cut stone
 * samples, quarrying diagrams, and guild commission contracts — offering to
 * commission a grand series of precision stoneworks for the realm's
 * infrastructure, or to sell rare stonecutting lore and master guild
 * techniques to the imperial quarrymen.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ⛏️ Commission Grand Stoneworks    — pay 30 stone + 25 gold
 *        → +0.25 stone/s for 2.5 min · +25 prestige · +12 morale
 *   📜 Purchase Stonecutting Lore     — pay 25 iron
 *        → +0.20 iron/s for 2 min · +18 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.imperialStonecutterGuild = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_STONE_COST       = 30;
export const COMMISSION_GOLD_COST        = 25;
export const COMMISSION_STONE_RATE       = 0.25;
export const COMMISSION_PRESTIGE_REWARD  = 25;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_IRON_COST          = 25;
export const PURCHASE_IRON_RATE          = 0.20;
export const PURCHASE_PRESTIGE_REWARD    = 18;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialStonecutterGuild() {
  if (!state.imperialStonecutterGuild) {
    state.imperialStonecutterGuild = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialStonecutterGuild;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function imperialStonecutterGuildTick() {
  const a = state.imperialStonecutterGuild;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_STONECUTTER_GUILD_CHANGED, { expired: true });
      addMessage('⛏️ The guild delegation carefully rolls the commission contracts back into their leather cases, and departs from the capital with professional dignity — the steady crunch of iron-shod boots on stone fading as the master stonecutters march away through the gate.', 'info');
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
  emit(Events.IMPERIAL_STONECUTTER_GUILD_CHANGED, { spawned: true });
  addMessage('⛏️ A delegation from the imperial stonecutter\'s guild arrives at the capital bearing master-cut stone samples, quarrying diagrams, and sealed guild commission contracts — offering to commission a grand series of precision stoneworks for the realm\'s infrastructure and monuments, or to share rare stonecutting lore and master quarrying techniques with the imperial engineers. Respond within 80 seconds.', 'info');
}

export function getActiveImperialStonecutterGuild() { return state.imperialStonecutterGuild?.active ?? null; }
export function getStonecutterGuildSecsLeft() {
  const a = state.imperialStonecutterGuild?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGrandStoneworks() {
  const a = state.imperialStonecutterGuild;
  if (!a?.active) return { ok: false, reason: 'No stonecutter guild present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The guild delegation has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold  ?? 0) < COMMISSION_GOLD_COST)  return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned grand stoneworks from the imperial stonecutter\'s guild');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'stonecutterGuildCommission');
    state.randomEvents.activeModifiers.push({
      id: 'stonecutterGuildCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_STONECUTTER_GUILD_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⛏️ The guild master stonecutters deploy across the realm's quarries and construction sites, executing a magnificent series of precision stoneworks — perfectly dressed ashlar blocks, soaring column drums, and intricately carved frieze sections that showcase the pinnacle of imperial craftsmanship and drive the entire stone extraction and dressing industry to peak production! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseStonecuttingLore() {
  const a = state.imperialStonecutterGuild;
  if (!a?.active) return { ok: false, reason: 'No stonecutter guild present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The guild delegation has departed.' };
  if ((state.resources.iron ?? 0) < PURCHASE_IRON_COST) return { ok: false, reason: `Need ${PURCHASE_IRON_COST} iron.` };
  state.resources.iron -= PURCHASE_IRON_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased stonecutting lore from the imperial stonecutter\'s guild');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'stonecutterGuildPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'stonecutterGuildPurchase', resource: 'iron',
      rateMult: 1 + (PURCHASE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_STONECUTTER_GUILD_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The guild masters share a comprehensive compendium of stonecutting lore — advanced iron tool tempering methods, chisel geometry secrets, and systematic quarry face extraction techniques that the imperial smiths and mine engineers eagerly apply, dramatically improving iron tool production and longevity throughout the realm! −${PURCHASE_IRON_COST} iron · +${PURCHASE_PRESTIGE_REWARD} prestige. Iron surge: +${PURCHASE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendStonecutterGuildAway() {
  const a = state.imperialStonecutterGuild;
  if (!a?.active) return { ok: false, reason: 'No stonecutter guild present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_STONECUTTER_GUILD_CHANGED, { dismissed: true });
  addMessage('⛏️ The guild delegation rolls the commission contracts back into the leather cases with professional composure, and departs from the capital — the steady rhythm of iron-shod boots on stone fading as the master stonecutters march away through the gate.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
