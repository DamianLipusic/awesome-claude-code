/**
 * EmpireOS — Imperial Quarryman (T366).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), a master imperial quarryman
 * arrives with plans for grand stone works and quarrying expertise.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🪨 Commission Stone Works          — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +22 prestige · +12 morale
 *   ⛏️ Exchange Quarrying Techniques   — pay 20 iron
 *        → +0.18 iron/s for 2 min · +15 prestige
 *   👋 Send Away                       — dismiss (no reward)
 *
 * state.imperialQuarryman = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_STONE_COST         = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_STONE_RATE         = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_IRON_COST            = 20;
export const EXCHANGE_IRON_RATE            = 0.18;
export const EXCHANGE_PRESTIGE_REWARD      = 15;
export const EXCHANGE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialQuarryman() {
  if (!state.imperialQuarryman) {
    state.imperialQuarryman = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalExchanges:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialQuarryman;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalExchanges    === undefined) s.totalExchanges    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialQuarrymanTick() {
  const a = state.imperialQuarryman;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_QUARRYMAN_CHANGED, { expired: true });
      addMessage('🪨 The imperial quarryman rolls up the stone survey plans, tucks the iron chisels back into their leather case, and departs to find quarry work in the highlands — the faint echo of stonecutting ringing in their wake.', 'info');
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
  emit(Events.IMPERIAL_QUARRYMAN_CHANGED, { spawned: true });
  addMessage('🪨 A master imperial quarryman arrives at the palace bearing rolled survey plans, precision iron chisels, and detailed quarrying charts mapping the finest stone deposits in the realm. They offer to oversee a grand commission of imperial stone works — arches, columns, and foundation blocks — or to share the advanced quarrying and cutting techniques that double extraction efficiency. Respond within 75 seconds.', 'info');
}

export function getActiveImperialQuarryman() { return state.imperialQuarryman?.active ?? null; }
export function getQuarrymanSecsLeft() {
  const a = state.imperialQuarryman?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionStoneWorks() {
  const a = state.imperialQuarryman;
  if (!a?.active) return { ok: false, reason: 'No quarryman present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The quarryman has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial stone works from the imperial quarryman');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'quarrymanCommission');
    state.randomEvents.activeModifiers.push({
      id: 'quarrymanCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_QUARRYMAN_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪨 The quarryman directs teams of workers with precise chisel strokes and stone-splitting wedges — grand arches and polished foundation columns rise across the palace district, inspiring the quarry crews to work with renewed pride and efficiency! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeQuarryingTechniques() {
  const a = state.imperialQuarryman;
  if (!a?.active) return { ok: false, reason: 'No quarryman present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The quarryman has departed.' };
  if ((state.resources.iron ?? 0) < EXCHANGE_IRON_COST) return { ok: false, reason: `Need ${EXCHANGE_IRON_COST} iron.` };
  state.resources.iron -= EXCHANGE_IRON_COST;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged quarrying techniques with the imperial quarryman');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'quarrymanExchange');
    state.randomEvents.activeModifiers.push({
      id: 'quarrymanExchange', resource: 'iron',
      rateMult: 1 + (EXCHANGE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalExchanges = (a.totalExchanges ?? 0) + 1;
  emit(Events.IMPERIAL_QUARRYMAN_CHANGED, { exchange: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⛏️ The precision iron chisels and specialized stone-splitting wedges are demonstrated to the mine foremen — the quarrying techniques dramatically improve ore extraction, with workers now splitting seams in half the time and smelting twice the iron per shift! −${EXCHANGE_IRON_COST} iron · +${EXCHANGE_PRESTIGE_REWARD} prestige. Iron surge: +${EXCHANGE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendQuarrymanAway() {
  const a = state.imperialQuarryman;
  if (!a?.active) return { ok: false, reason: 'No quarryman present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_QUARRYMAN_CHANGED, { dismissed: true });
  addMessage('🪨 The imperial quarryman bows respectfully, rolls the survey plans into their leather tube, and departs for the highland quarries — the ring of iron chisel on stone echoing faintly as they disappear over the ridge.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
