/**
 * EmpireOS — Imperial Dockmaster (T346).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), a seasoned imperial
 * dockmaster arrives bearing harbor charts, dock-building blueprints, and
 * knowledge of lucrative maritime trade lanes. The player has 75 seconds
 * to decide.
 *
 * Choices:
 *   ⚓ Establish Trading Docks  — pay 25 wood + 20 gold
 *        → +0.25 wood/s for 2.5 min · +22 prestige · +10 morale
 *   ⚙️  Commission Harbor Works  — pay 20 iron
 *        → +0.18 iron/s for 2 min   · +15 prestige
 *   👋 Send Away                — dismiss (no reward)
 *
 * state.imperialDockmaster = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalEstablished:  number,
 *   totalCommissioned: number,
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
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const ESTABLISH_WOOD_COST         = 25;
export const ESTABLISH_GOLD_COST         = 20;
export const ESTABLISH_WOOD_RATE         = 0.25;
export const ESTABLISH_PRESTIGE_REWARD   = 22;
export const ESTABLISH_MORALE_REWARD     = 10;
export const ESTABLISH_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const COMMISSION_IRON_COST        = 20;
export const COMMISSION_IRON_RATE        = 0.18;
export const COMMISSION_PRESTIGE_REWARD  = 15;
export const COMMISSION_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialDockmaster() {
  if (!state.imperialDockmaster) {
    state.imperialDockmaster = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalEstablished:  0,
      totalCommissioned: 0,
      totalDismissals:   0,
    };
  }
  const s = state.imperialDockmaster;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalEstablished  === undefined) s.totalEstablished  = 0;
  if (s.totalCommissioned === undefined) s.totalCommissioned = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialDockmasterTick() {
  const a = state.imperialDockmaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_DOCKMASTER_CHANGED, { expired: true });
      addMessage('⚓ The imperial dockmaster rolls up their harbor charts, secures the dock blueprints in a waterproof oilskin case, and departs to inspect the next imperial port on their survey circuit.', 'info');
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
  emit(Events.IMPERIAL_DOCKMASTER_CHANGED, { spawned: true });
  addMessage('⚓ An imperial dockmaster arrives at the imperial court bearing detailed harbor charts, seasoned dock-building blueprints, and extensive knowledge of lucrative maritime trade lanes. They offer to establish full trading docks on the imperial waterfront, or to commission iron-reinforced harbor works to strengthen existing port facilities. Respond within 75 seconds.', 'info');
}

export function getActiveImperialDockmaster() { return state.imperialDockmaster?.active ?? null; }
export function getDockmasterSecsLeft() {
  const a = state.imperialDockmaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function establishTradingDocks() {
  const a = state.imperialDockmaster;
  if (!a?.active) return { ok: false, reason: 'No dockmaster present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The dockmaster has departed.' };
  if ((state.resources.wood ?? 0) < ESTABLISH_WOOD_COST) return { ok: false, reason: `Need ${ESTABLISH_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < ESTABLISH_GOLD_COST) return { ok: false, reason: `Need ${ESTABLISH_GOLD_COST} gold.` };
  state.resources.wood -= ESTABLISH_WOOD_COST;
  state.resources.gold -= ESTABLISH_GOLD_COST;
  changeMorale(ESTABLISH_MORALE_REWARD);
  awardPrestige(ESTABLISH_PRESTIGE_REWARD, 'Established imperial trading docks with the dockmaster');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dockmasterEstablish');
    state.randomEvents.activeModifiers.push({
      id: 'dockmasterEstablish', resource: 'wood',
      rateMult: 1 + (ESTABLISH_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + ESTABLISH_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalEstablished = (a.totalEstablished ?? 0) + 1;
  emit(Events.IMPERIAL_DOCKMASTER_CHANGED, { established: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚓ The dockmaster oversees the rapid construction of broad timber wharves, loading cranes, and warehouses along the imperial waterfront. Trade vessels arrive in greater numbers to unload exotic hardwoods, teak planks, and seasoned ship timber from distant forest kingdoms! −${ESTABLISH_WOOD_COST} wood · −${ESTABLISH_GOLD_COST} gold · +${ESTABLISH_PRESTIGE_REWARD} prestige · +${ESTABLISH_MORALE_REWARD} morale. Timber surge: +${ESTABLISH_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function commissionHarborWorks() {
  const a = state.imperialDockmaster;
  if (!a?.active) return { ok: false, reason: 'No dockmaster present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The dockmaster has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned harbor works from the imperial dockmaster');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'dockmasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'dockmasterCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.IMPERIAL_DOCKMASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚙️ The dockmaster directs imperial smiths to install iron chain-ferry bollards, reinforced iron dock-ring anchors, and forge-hardened cargo hooks throughout the harbor works. The improved facilities attract heavy iron-laden ore barges! −${COMMISSION_IRON_COST} iron · +${COMMISSION_PRESTIGE_REWARD} prestige. Forge surge: +${COMMISSION_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendDockmasterAway() {
  const a = state.imperialDockmaster;
  if (!a?.active) return { ok: false, reason: 'No dockmaster present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_DOCKMASTER_CHANGED, { dismissed: true });
  addMessage('⚓ The imperial dockmaster respectfully acknowledges the decision, secures their harbor charts in the oilskin roll-case, and departs to consult with other imperial port authorities along the survey route.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
