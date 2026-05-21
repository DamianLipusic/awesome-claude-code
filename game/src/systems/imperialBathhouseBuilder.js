/**
 * EmpireOS — Imperial Bathhouse Builder (T352).
 *
 * Every 15–20 minutes (Medieval Age+, 12+ player tiles), an imperial
 * bathhouse builder arrives with detailed engineering drawings for grand
 * public bathhouses that will raise morale, restore the workforce, and
 * signal civilisational might. The player has 80 seconds to decide.
 *
 * Choices:
 *   🏛️ Construct Bathhouse Complex  — pay 30 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +25 prestige · +15 morale
 *   📐 Share Engineering Plans      — pay 25 mana
 *        → +0.18 mana/s for 2 min · +18 prestige
 *   👋 Send Away                    — dismiss (no reward)
 *
 * state.imperialBathhouseBuilder = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalConstructions:  number,
 *   totalPlans:          number,
 *   totalDismissals:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 12;

export const CONSTRUCT_STONE_COST         = 30;
export const CONSTRUCT_GOLD_COST          = 20;
export const CONSTRUCT_STONE_RATE         = 0.22;
export const CONSTRUCT_PRESTIGE_REWARD    = 25;
export const CONSTRUCT_MORALE_REWARD      = 15;
export const CONSTRUCT_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PLANS_MANA_COST              = 25;
export const PLANS_MANA_RATE              = 0.18;
export const PLANS_PRESTIGE_REWARD        = 18;
export const PLANS_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialBathhouseBuilder() {
  if (!state.imperialBathhouseBuilder) {
    state.imperialBathhouseBuilder = {
      active:             null,
      nextSpawnTick:      _nextSpawnTick(),
      totalVisits:        0,
      totalConstructions: 0,
      totalPlans:         0,
      totalDismissals:    0,
    };
  }
  const s = state.imperialBathhouseBuilder;
  if (s.nextSpawnTick       === undefined) s.nextSpawnTick       = _nextSpawnTick();
  if (s.totalVisits         === undefined) s.totalVisits         = 0;
  if (s.totalConstructions  === undefined) s.totalConstructions  = 0;
  if (s.totalPlans          === undefined) s.totalPlans          = 0;
  if (s.totalDismissals     === undefined) s.totalDismissals     = 0;
}

export function imperialBathhouseBuilderTick() {
  const a = state.imperialBathhouseBuilder;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_BATHHOUSE_BUILDER_CHANGED, { expired: true });
      addMessage('🏛️ The imperial bathhouse builder rolls up the architectural drawings, collects the survey instruments, and departs to seek a more receptive patron for the bathhouse project.', 'info');
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
  emit(Events.IMPERIAL_BATHHOUSE_BUILDER_CHANGED, { spawned: true });
  addMessage('🏛️ A celebrated imperial bathhouse builder arrives bearing exquisitely detailed engineering drawings for a grand public bathhouse — heated marble halls, cascading cold plunges, and vaulted steam rooms adorned with mythological frescoes. They propose either to oversee full construction of the bathhouse complex for the empire\'s citizens, or to share the advanced hydraulic engineering plans that have revolutionised stonework across the known world. Respond within 80 seconds.', 'info');
}

export function getActiveImperialBathhouseBuilder() { return state.imperialBathhouseBuilder?.active ?? null; }
export function getBathhouseBuilderSecsLeft() {
  const a = state.imperialBathhouseBuilder?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function constructBathhouseComplex() {
  const a = state.imperialBathhouseBuilder;
  if (!a?.active) return { ok: false, reason: 'No bathhouse builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bathhouse builder has departed.' };
  if ((state.resources.stone ?? 0) < CONSTRUCT_STONE_COST) return { ok: false, reason: `Need ${CONSTRUCT_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < CONSTRUCT_GOLD_COST)  return { ok: false, reason: `Need ${CONSTRUCT_GOLD_COST} gold.` };
  state.resources.stone -= CONSTRUCT_STONE_COST;
  state.resources.gold  -= CONSTRUCT_GOLD_COST;
  changeMorale(CONSTRUCT_MORALE_REWARD);
  awardPrestige(CONSTRUCT_PRESTIGE_REWARD, 'Constructed an imperial bathhouse complex');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bathhouseConstruct');
    state.randomEvents.activeModifiers.push({
      id: 'bathhouseConstruct', resource: 'stone',
      rateMult: 1 + (CONSTRUCT_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + CONSTRUCT_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalConstructions = (a.totalConstructions ?? 0) + 1;
  emit(Events.IMPERIAL_BATHHOUSE_BUILDER_CHANGED, { construct: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏛️ The bathhouse builder directs a skilled team of stonemasons, hydraulic engineers, and fresco painters in raising a magnificent public bathhouse from the ground up. Citizens queue from dawn to use the heated pools, cold plunges, and steam rooms — workers emerge refreshed and stronger, productivity surges across the empire's quarries and construction sites! −${CONSTRUCT_STONE_COST} stone · −${CONSTRUCT_GOLD_COST} gold · +${CONSTRUCT_PRESTIGE_REWARD} prestige · +${CONSTRUCT_MORALE_REWARD} morale. Stone surge: +${CONSTRUCT_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function shareEngineeringPlans() {
  const a = state.imperialBathhouseBuilder;
  if (!a?.active) return { ok: false, reason: 'No bathhouse builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bathhouse builder has departed.' };
  if ((state.resources.mana ?? 0) < PLANS_MANA_COST) return { ok: false, reason: `Need ${PLANS_MANA_COST} mana.` };
  state.resources.mana -= PLANS_MANA_COST;
  awardPrestige(PLANS_PRESTIGE_REWARD, 'Acquired advanced engineering plans from the imperial bathhouse builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bathhousePlans');
    state.randomEvents.activeModifiers.push({
      id: 'bathhousePlans', resource: 'mana',
      rateMult: 1 + (PLANS_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + PLANS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPlans = (a.totalPlans ?? 0) + 1;
  emit(Events.IMPERIAL_BATHHOUSE_BUILDER_CHANGED, { plans: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📐 The bathhouse builder unrolls a set of advanced hydraulic engineering plans — pressurised aqueduct feeds, underfloor hypocaust heating channels, and optimised stone-cutting templates that eliminate waste in the quarrying process. The empire's scholars study the designs eagerly, applying the principles to improve dozens of ongoing construction projects! −${PLANS_MANA_COST} mana · +${PLANS_PRESTIGE_REWARD} prestige. Arcane surge: +${PLANS_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBathhouseBuilderAway() {
  const a = state.imperialBathhouseBuilder;
  if (!a?.active) return { ok: false, reason: 'No bathhouse builder present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_BATHHOUSE_BUILDER_CHANGED, { dismissed: true });
  addMessage('🏛️ The imperial bathhouse builder accepts the decision with professional composure, carefully re-rolls the architectural drawings, and departs with the quiet confidence of one who knows another city will soon welcome the bathhouse project with open arms.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
