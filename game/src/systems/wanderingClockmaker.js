/**
 * EmpireOS — Wandering Clockmaker (T309).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), a wandering clockmaker
 * arrives bearing intricate timepieces and mechanical marvels from distant lands.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ⚙️ Commission Celestial Clock  — pay 30 stone + 20 gold
 *        → +0.2 stone/s for 2.5 min · +22 prestige · +10 morale
 *   🕰️ Purchase Timepiece Mechanisms — pay 25 gold
 *        → +0.15 gold/s for 2 min · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.wanderingClockmaker = {
 *   active:               { expiresAt: tick } | null,
 *   nextSpawnTick:        tick,
 *   totalVisits:          number,
 *   totalCommissions:     number,
 *   totalPurchases:       number,
 *   totalDismissals:      number,
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

export const CLOCK_STONE_COST          = 30;
export const CLOCK_GOLD_COST           = 20;
export const CLOCK_STONE_RATE          = 0.2;
export const CLOCK_PRESTIGE_REWARD     = 22;
export const CLOCK_MORALE_REWARD       = 10;
export const CLOCK_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TIMEPIECE_GOLD_COST       = 25;
export const TIMEPIECE_GOLD_RATE       = 0.15;
export const TIMEPIECE_PRESTIGE_REWARD = 15;
export const TIMEPIECE_DURATION_TICKS  = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingClockmaker() {
  if (!state.wanderingClockmaker) {
    state.wanderingClockmaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingClockmaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingClockmakerTick() {
  const a = state.wanderingClockmaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_CLOCKMAKER_CHANGED, { expired: true });
      addMessage('⚙️ The wandering clockmaker winds the last spring of their demonstration timepiece, packs the intricate mechanisms back into a velvet-lined case, and departs down the imperial road.', 'info');
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
  emit(Events.WANDERING_CLOCKMAKER_CHANGED, { spawned: true });
  addMessage('⚙️ A wandering clockmaker arrives at the imperial gates, their cart laden with astrolabes, celestial globes, and mechanical timepieces of extraordinary precision. They claim their mechanisms can coordinate the empire\'s activities with mathematical perfection. Respond within 80 seconds.', 'info');
}

export function getActiveClockmaker() { return state.wanderingClockmaker?.active ?? null; }
export function getClockmakerSecsLeft() {
  const a = state.wanderingClockmaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCelestialClock() {
  const a = state.wanderingClockmaker;
  if (!a?.active) return { ok: false, reason: 'No clockmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The clockmaker has departed.' };
  if ((state.resources.stone ?? 0) < CLOCK_STONE_COST) return { ok: false, reason: `Need ${CLOCK_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < CLOCK_GOLD_COST)   return { ok: false, reason: `Need ${CLOCK_GOLD_COST} gold.` };
  state.resources.stone -= CLOCK_STONE_COST;
  state.resources.gold  -= CLOCK_GOLD_COST;
  changeMorale(CLOCK_MORALE_REWARD);
  awardPrestige(CLOCK_PRESTIGE_REWARD, 'Commissioned a celestial clock from the wandering clockmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'clockmakerClock');
    state.randomEvents.activeModifiers.push({
      id: 'clockmakerClock', resource: 'stone',
      rateMult: 1 + (CLOCK_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + CLOCK_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_CLOCKMAKER_CHANGED, { clock: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚙️ The clockmaker sets to work constructing a magnificent celestial clock for the imperial palace! Its great bronze gears and crystal lenses coordinate the schedules of quarry workers and masons with unprecedented precision, dramatically accelerating construction output across the empire! −${CLOCK_STONE_COST} stone · −${CLOCK_GOLD_COST} gold · +${CLOCK_PRESTIGE_REWARD} prestige · +${CLOCK_MORALE_REWARD} morale. Construction surge: +${CLOCK_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseTimepieceMechanisms() {
  const a = state.wanderingClockmaker;
  if (!a?.active) return { ok: false, reason: 'No clockmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The clockmaker has departed.' };
  if ((state.resources.gold ?? 0) < TIMEPIECE_GOLD_COST) return { ok: false, reason: `Need ${TIMEPIECE_GOLD_COST} gold.` };
  state.resources.gold -= TIMEPIECE_GOLD_COST;
  awardPrestige(TIMEPIECE_PRESTIGE_REWARD, 'Purchased timepiece mechanisms from the wandering clockmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'clockmakerTimepiece');
    state.randomEvents.activeModifiers.push({
      id: 'clockmakerTimepiece', resource: 'gold',
      rateMult: 1 + (TIMEPIECE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + TIMEPIECE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_CLOCKMAKER_CHANGED, { timepiece: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🕰️ The intricate timepiece mechanisms are distributed to the empire's counting houses and trading posts. The newfound ability to precisely schedule merchant convoys and market hours opens profitable new commercial opportunities! −${TIMEPIECE_GOLD_COST} gold · +${TIMEPIECE_PRESTIGE_REWARD} prestige. Commerce surge: +${TIMEPIECE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendClockmakerAway() {
  const a = state.wanderingClockmaker;
  if (!a?.active) return { ok: false, reason: 'No clockmaker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_CLOCKMAKER_CHANGED, { dismissed: true });
  addMessage('⚙️ The wandering clockmaker bows respectfully, secures the springs and gears of their magnificent timepieces, and wheels their cart back down the cobbled road toward the next imperial court.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
