/**
 * EmpireOS — Imperial Marble Cutter (T354).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), an imperial marble
 * cutter arrives with precision chisels, diamond-tipped saws, and knowledge
 * of quarrying the finest marble veins. The player has 80 seconds to decide.
 *
 * Choices:
 *   🏛️ Commission Marble Columns  — pay 30 stone + 20 iron
 *        → +0.22 stone/s for 2.5 min · +25 prestige · +10 morale
 *   ⚒️ Exchange Cutting Techniques — pay 20 gold
 *        → +0.15 iron/s for 2 min · +15 prestige
 *   👋 Send Away                   — dismiss (no reward)
 *
 * state.imperialMarbleCutter = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
 *   totalExchanges:    number,
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

export const COMMISSION_STONE_COST        = 30;
export const COMMISSION_IRON_COST         = 20;
export const COMMISSION_STONE_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD   = 25;
export const COMMISSION_MORALE_REWARD     = 10;
export const COMMISSION_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_GOLD_COST           = 20;
export const EXCHANGE_IRON_RATE           = 0.15;
export const EXCHANGE_PRESTIGE_REWARD     = 15;
export const EXCHANGE_DURATION_TICKS      = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialMarbleCutter() {
  if (!state.imperialMarbleCutter) {
    state.imperialMarbleCutter = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalExchanges:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialMarbleCutter;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalExchanges   === undefined) s.totalExchanges   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialMarbleCutterTick() {
  const a = state.imperialMarbleCutter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_MARBLE_CUTTER_CHANGED, { expired: true });
      addMessage('🏛️ The imperial marble cutter carefully wraps the precision chisels and diamond-tipped saws, loads the demonstration marble samples back onto the cart, and departs for an empire with grander architectural ambitions.', 'info');
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
  emit(Events.IMPERIAL_MARBLE_CUTTER_CHANGED, { spawned: true });
  addMessage('🏛️ An imperial marble cutter arrives bearing polished sample columns, precision chisels of hardened steel, and diamond-tipped saws capable of producing flawlessly smooth marble surfaces. They propose either to commission a grand series of marble columns for the empire\'s most prestigious buildings, or to share the closely-guarded cutting techniques that allow them to extract twice as much usable stone from every quarried block. Respond within 80 seconds.', 'info');
}

export function getActiveImperialMarbleCutter() { return state.imperialMarbleCutter?.active ?? null; }
export function getMarbleCutterSecsLeft() {
  const a = state.imperialMarbleCutter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionMarbleColumns() {
  const a = state.imperialMarbleCutter;
  if (!a?.active) return { ok: false, reason: 'No marble cutter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The marble cutter has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.iron  ?? 0) < COMMISSION_IRON_COST)  return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.iron  -= COMMISSION_IRON_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned magnificent marble columns from the imperial marble cutter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'marbleCutterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'marbleCutterCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_MARBLE_CUTTER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏛️ The marble cutter directs a team of quarry workers and stonemasons in producing a magnificent series of fluted columns from the finest white marble — each one perfectly proportioned and polished to a mirror finish. The columns are installed in the empire's grandest forum, inspiring citizens and visitors alike with their timeless beauty and drawing new quarrying talent to the workforce! −${COMMISSION_STONE_COST} stone · −${COMMISSION_IRON_COST} iron · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeCuttingTechniques() {
  const a = state.imperialMarbleCutter;
  if (!a?.active) return { ok: false, reason: 'No marble cutter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The marble cutter has departed.' };
  if ((state.resources.gold ?? 0) < EXCHANGE_GOLD_COST) return { ok: false, reason: `Need ${EXCHANGE_GOLD_COST} gold.` };
  state.resources.gold -= EXCHANGE_GOLD_COST;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Acquired precision stone-cutting techniques from the imperial marble cutter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'marbleCutterExchange');
    state.randomEvents.activeModifiers.push({
      id: 'marbleCutterExchange', resource: 'iron',
      rateMult: 1 + (EXCHANGE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalExchanges = (a.totalExchanges ?? 0) + 1;
  emit(Events.IMPERIAL_MARBLE_CUTTER_CHANGED, { exchange: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚒️ The marble cutter demonstrates precision techniques for angling diamond-tipped saws to follow natural stone grain, dramatically reducing waste and tool wear while producing cleaner cuts. The empire's quarry workers adopt the methods immediately — less material wasted in cutting also means more efficient use of metal tools, boosting the ironworking trade throughout the empire! −${EXCHANGE_GOLD_COST} gold · +${EXCHANGE_PRESTIGE_REWARD} prestige. Iron surge: +${EXCHANGE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMarbleCutterAway() {
  const a = state.imperialMarbleCutter;
  if (!a?.active) return { ok: false, reason: 'No marble cutter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_MARBLE_CUTTER_CHANGED, { dismissed: true });
  addMessage('🏛️ The imperial marble cutter wraps the precision tools with practiced efficiency, loads the polished sample columns back onto the transport wagon, and departs with professional composure to find an empire whose architectural ambitions match the quality of their stonecraft.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
