/**
 * EmpireOS — Imperial Scrivener (T380).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), a master imperial
 * scrivener arrives at court bearing a portable writing desk, quill pens,
 * and a large collection of blank vellum sheets — offering to commission a
 * set of royal scrolls inscribed with official proclamations, or to sell a
 * comprehensive scrivener's compendium of wood-pulp papermaking techniques
 * to the palace workshops.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📋 Commission Royal Scrolls — pay 25 mana + 20 gold
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +8 morale
 *   📚 Purchase Scrivener's Compendium — pay 22 wood
 *        → +0.18 wood/s for 2 min · +15 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.imperialScrivener = {
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

export const PURCHASE_WOOD_COST             = 22;
export const PURCHASE_WOOD_RATE             = 0.18;
export const PURCHASE_PRESTIGE_REWARD       = 15;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialScrivener() {
  if (!state.imperialScrivener) {
    state.imperialScrivener = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialScrivener;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialScrivenerTick() {
  const a = state.imperialScrivener;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SCRIVENER_CHANGED, { expired: true });
      addMessage('📋 The imperial scrivener folds away the portable writing desk, wraps the quill pens in oilcloth, and rolls up the blank vellum sheets — giving a courtly bow before departing through the palace gates with ink-stained fingers.', 'info');
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
  emit(Events.IMPERIAL_SCRIVENER_CHANGED, { spawned: true });
  addMessage('📋 A master imperial scrivener arrives at court bearing a portable writing desk, fine quill pens, and a large collection of blank vellum sheets — offering to commission a set of royal scrolls inscribed with official proclamations, or to sell a comprehensive compendium of papermaking and wood-pulp techniques to the palace workshops. Respond within 80 seconds.', 'info');
}

export function getActiveImperialScrivener() { return state.imperialScrivener?.active ?? null; }
export function getScrivenerSecsLeft() {
  const a = state.imperialScrivener?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalScrolls() {
  const a = state.imperialScrivener;
  if (!a?.active) return { ok: false, reason: 'No scrivener present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The scrivener has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned royal scrolls from the imperial scrivener');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'scrivenerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'scrivenerCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SCRIVENER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📋 The scrivener establishes a temporary scriptorium in the palace library and produces a magnificent set of royal scrolls — the meticulously inscribed proclamations carry an unmistakable aura of authority that resonates through the empire's arcane network, amplifying the flow of magical energy through every ley line and power node! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseScrivenersCompendium() {
  const a = state.imperialScrivener;
  if (!a?.active) return { ok: false, reason: 'No scrivener present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The scrivener has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, "Purchased scrivener's compendium from the imperial scrivener");
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'scrivenerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'scrivenerPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SCRIVENER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📚 The scrivener presents a comprehensive compendium of advanced wood-pulp papermaking and vellum preparation techniques — the palace foresters immediately apply these methods to improve timber processing efficiency, using bark and wood fiber for high-value parchment production that significantly increases lumber output from every stand of trees! −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendScrivenerAway() {
  const a = state.imperialScrivener;
  if (!a?.active) return { ok: false, reason: 'No scrivener present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SCRIVENER_CHANGED, { dismissed: true });
  addMessage('📋 The imperial scrivener gives a polite bow, folds the writing desk under one arm, tucks the quill pens into a breast pocket, and departs through the palace gates — leaving only a faint trace of ink and the ghost of scratching quills in the air.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
