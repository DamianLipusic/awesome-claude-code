/**
 * EmpireOS — Imperial Calligrapher (T378).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), a renowned imperial
 * calligrapher arrives at court bearing ornate brushes, hand-ground ink stones,
 * and rolls of finest vellum — offering to inscribe elaborate imperial decrees
 * in gilded script for proclamation across the empire, or to sell a curated
 * collection of classic script forms to the palace scribes.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ✒️ Commission Imperial Decrees — pay 25 mana + 20 gold
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +8 morale
 *   📜 Purchase Script Collection — pay 20 gold
 *        → +0.18 gold/s for 2 min · +15 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.imperialCalligrapher = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST           = 25;
export const COMMISSION_GOLD_COST           = 20;
export const COMMISSION_MANA_RATE           = 0.25;
export const COMMISSION_PRESTIGE_REWARD     = 22;
export const COMMISSION_MORALE_REWARD       = 8;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST             = 20;
export const PURCHASE_GOLD_RATE             = 0.18;
export const PURCHASE_PRESTIGE_REWARD       = 15;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialCalligrapher() {
  if (!state.imperialCalligrapher) {
    state.imperialCalligrapher = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialCalligrapher;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialCalligrapherTick() {
  const a = state.imperialCalligrapher;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_CALLIGRAPHER_CHANGED, { expired: true });
      addMessage('✒️ The imperial calligrapher carefully rolls the vellum scrolls, wraps the brushes in silk cloth, and stows the ink stones in their lacquered box — bowing gracefully before departing through the palace gates, leaving only the faint scent of ground ink behind.', 'info');
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
  emit(Events.IMPERIAL_CALLIGRAPHER_CHANGED, { spawned: true });
  addMessage('✒️ A renowned imperial calligrapher arrives at court bearing ornate brushes, hand-ground ink stones, and rolls of finest vellum — offering to inscribe elaborate imperial decrees in gilded script for proclamation across the empire, or to sell a curated collection of classic script forms to the palace scribes. Respond within 80 seconds.', 'info');
}

export function getActiveImperialCalligrapher() { return state.imperialCalligrapher?.active ?? null; }
export function getCalligrapherSecsLeft() {
  const a = state.imperialCalligrapher?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialDecrees() {
  const a = state.imperialCalligrapher;
  if (!a?.active) return { ok: false, reason: 'No calligrapher present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The calligrapher has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial decrees from the imperial calligrapher');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'calligrapherCommission');
    state.randomEvents.activeModifiers.push({
      id: 'calligrapherCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_CALLIGRAPHER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`✒️ The calligrapher sets up their writing desk in the throne room and labours through the night inscribing imperial decrees in sweeping gilded script — the proclamations radiate a palpable authority that resonates with the empire's arcane ley lines, amplifying magical energy flow through every tower and sanctum! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseScriptCollection() {
  const a = state.imperialCalligrapher;
  if (!a?.active) return { ok: false, reason: 'No calligrapher present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The calligrapher has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased script collection from the imperial calligrapher');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'calligrapherPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'calligrapherPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_CALLIGRAPHER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The calligrapher presents an exquisite portfolio of classic script forms — flowing imperial chancery hands, formal court scripts, and decorative border patterns — the palace scribes immediately incorporate these prestigious styles into official correspondence, dramatically increasing the perceived value of imperial commercial documents and contracts in the markets! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCalligrapherAway() {
  const a = state.imperialCalligrapher;
  if (!a?.active) return { ok: false, reason: 'No calligrapher present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_CALLIGRAPHER_CHANGED, { dismissed: true });
  addMessage('✒️ The imperial calligrapher gives a dignified bow, rerolls the vellum, wraps the brushes in silk, and departs through the palace gates — the faint scratch of a final flourish trail behind as they go.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
