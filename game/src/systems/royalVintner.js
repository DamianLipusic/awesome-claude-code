/**
 * EmpireOS — Royal Vintner (T302).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), a celebrated royal
 * vintner arrives bearing exquisite wines and viticultural wisdom. The
 * player has 80 seconds to decide.
 *
 * Choices:
 *   🍷 Commission Imperial Vintage  — pay 25 food + 10 gold
 *        → +0.2 food/s for 2.5 min · +18 prestige · +12 morale
 *   📜 Purchase Vintner's Knowledge — pay 22 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Vintner Away            — dismiss (no reward)
 *
 * state.royalVintner = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalVintages:       number,
 *   totalKnowledge:      number,
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

export const VINTAGE_FOOD_COST           = 25;
export const VINTAGE_GOLD_COST           = 10;
export const VINTAGE_FOOD_RATE           = 0.2;
export const VINTAGE_PRESTIGE_REWARD     = 18;
export const VINTAGE_MORALE_REWARD       = 12;
export const VINTAGE_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const KNOWLEDGE_GOLD_COST         = 22;
export const KNOWLEDGE_GOLD_RATE         = 0.15;
export const KNOWLEDGE_PRESTIGE_REWARD   = 10;
export const KNOWLEDGE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initRoyalVintner() {
  if (!state.royalVintner) {
    state.royalVintner = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalVintages:   0,
      totalKnowledge:  0,
      totalDismissals: 0,
    };
  }
  const s = state.royalVintner;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalVintages    === undefined) s.totalVintages    = 0;
  if (s.totalKnowledge   === undefined) s.totalKnowledge   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function royalVintnerTick() {
  const a = state.royalVintner;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.ROYAL_VINTNER_CHANGED, { expired: true });
      addMessage('🍷 The royal vintner carefully reseals his finest casks, loads his wagon with prized bottles, and departs the imperial estate to seek a more welcoming court.', 'info');
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
  emit(Events.ROYAL_VINTNER_CHANGED, { spawned: true });
  addMessage('🍷 A celebrated royal vintner arrives bearing wagon loads of exquisite wines and viticultural wisdom gathered from the finest vineyard estates across distant lands. Respond within 80 seconds.', 'info');
}

export function getActiveVintner() { return state.royalVintner?.active ?? null; }
export function getVintnerSecsLeft() {
  const a = state.royalVintner?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialVintage() {
  const a = state.royalVintner;
  if (!a?.active) return { ok: false, reason: 'No vintner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The vintner has departed.' };
  if ((state.resources.food ?? 0) < VINTAGE_FOOD_COST) return { ok: false, reason: `Need ${VINTAGE_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < VINTAGE_GOLD_COST) return { ok: false, reason: `Need ${VINTAGE_GOLD_COST} gold.` };
  state.resources.food -= VINTAGE_FOOD_COST;
  state.resources.gold -= VINTAGE_GOLD_COST;
  changeMorale(VINTAGE_MORALE_REWARD);
  awardPrestige(VINTAGE_PRESTIGE_REWARD, 'Commissioned imperial vintage with the royal vintner');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'vintnerVintage');
    state.randomEvents.activeModifiers.push({
      id: 'vintnerVintage', resource: 'food',
      rateMult: 1 + (VINTAGE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + VINTAGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalVintages = (a.totalVintages ?? 0) + 1;
  emit(Events.ROYAL_VINTNER_CHANGED, { vintage: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍷 The vintner establishes an imperial winery, and soon the empire's finest wines grace every noble feast and market stall. Morale soars and agricultural production surges! −${VINTAGE_FOOD_COST} food · −${VINTAGE_GOLD_COST} gold · +${VINTAGE_PRESTIGE_REWARD} prestige · +${VINTAGE_MORALE_REWARD} morale. Harvest surge: +${VINTAGE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseVintnersKnowledge() {
  const a = state.royalVintner;
  if (!a?.active) return { ok: false, reason: 'No vintner present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The vintner has departed.' };
  if ((state.resources.gold ?? 0) < KNOWLEDGE_GOLD_COST) return { ok: false, reason: `Need ${KNOWLEDGE_GOLD_COST} gold.` };
  state.resources.gold -= KNOWLEDGE_GOLD_COST;
  awardPrestige(KNOWLEDGE_PRESTIGE_REWARD, 'Purchased vintner\'s trade knowledge');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'vintnerKnowledge');
    state.randomEvents.activeModifiers.push({
      id: 'vintnerKnowledge', resource: 'gold',
      rateMult: 1 + (KNOWLEDGE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + KNOWLEDGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalKnowledge = (a.totalKnowledge ?? 0) + 1;
  emit(Events.ROYAL_VINTNER_CHANGED, { knowledge: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The vintner's trade secrets reveal lucrative wine export routes and premium pricing strategies. Imperial merchants immediately begin commanding top gold for exported goods! −${KNOWLEDGE_GOLD_COST} gold · +${KNOWLEDGE_PRESTIGE_REWARD} prestige. Trade surge: +${KNOWLEDGE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendVintnerAway() {
  const a = state.royalVintner;
  if (!a?.active) return { ok: false, reason: 'No vintner present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.ROYAL_VINTNER_CHANGED, { dismissed: true });
  addMessage('🍷 The royal vintner bows graciously, carefully wraps his finest vintage in cloth, and departs with his wagon of wines toward the next prospective patron\'s court.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
