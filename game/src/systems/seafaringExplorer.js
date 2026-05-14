/**
 * EmpireOS — Seafaring Explorer (T270).
 *
 * Every 13–18 minutes (Bronze Age+, 10+ player tiles), a legendary seafaring
 * explorer arrives seeking imperial sponsorship for their next great voyage.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   ⛵ Fund Expedition          — pay 40 gold
 *        → +0.2 gold/s for 2.5 min + 25 prestige + 8 morale
 *   🗺️ Exchange Navigation Charts — pay 20 wood
 *        → +0.15 wood/s for 2 min + 15 prestige
 *   🍖 Provide Provisions       — pay 20 food
 *        → +6 morale + 5 prestige
 *
 * state.seafaringExplorer = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalFunded:      number,
 *   totalCharts:      number,
 *   totalProvisioned: number,
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
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 10;

export const FUND_GOLD_COST         = 40;
export const FUND_GOLD_RATE         = 0.2;
export const FUND_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);
export const FUND_PRESTIGE_REWARD   = 25;
export const FUND_MORALE_REWARD     = 8;

export const CHARTS_WOOD_COST       = 20;
export const CHARTS_WOOD_RATE       = 0.15;
export const CHARTS_DURATION_TICKS  = 2 * 60 * TICKS_PER_SECOND;
export const CHARTS_PRESTIGE_REWARD = 15;

export const PROVISIONS_FOOD_COST      = 20;
export const PROVISIONS_MORALE_REWARD  = 6;
export const PROVISIONS_PRESTIGE_REWARD= 5;

export function initSeafaringExplorer() {
  if (!state.seafaringExplorer) {
    state.seafaringExplorer = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalFunded:      0,
      totalCharts:      0,
      totalProvisioned: 0,
    };
  }
  if (state.seafaringExplorer.nextSpawnTick      === undefined) state.seafaringExplorer.nextSpawnTick      = _nextSpawnTick();
  if (state.seafaringExplorer.totalVisits        === undefined) state.seafaringExplorer.totalVisits        = 0;
  if (state.seafaringExplorer.totalFunded        === undefined) state.seafaringExplorer.totalFunded        = 0;
  if (state.seafaringExplorer.totalCharts        === undefined) state.seafaringExplorer.totalCharts        = 0;
  if (state.seafaringExplorer.totalProvisioned   === undefined) state.seafaringExplorer.totalProvisioned   = 0;
}

export function seafaringExplorerTick() {
  const se = state.seafaringExplorer;
  if (!se) return;
  if (se.active) {
    if (state.tick >= se.active.expiresAt) {
      se.active = null; se.nextSpawnTick = _nextSpawnTick();
      emit(Events.SEAFARING_EXPLORER_CHANGED, { expired: true });
      addMessage('⛵ The seafaring explorer sails on without imperial backing, seeking fortune on distant shores.', 'info');
    }
    return;
  }
  if (state.tick < se.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  se.active      = { expiresAt: state.tick + WINDOW_TICKS };
  se.totalVisits = (se.totalVisits ?? 0) + 1;
  emit(Events.SEAFARING_EXPLORER_CHANGED, { spawned: true });
  addMessage('⛵ A legendary seafaring explorer has arrived seeking imperial sponsorship for their next great voyage! They carry charts of uncharted waters and tales of distant riches. Respond within 75 seconds.', 'info');
}

export function getActiveSeafaringExplorer()  { return state.seafaringExplorer?.active ?? null; }
export function getExplorerSecsLeft() {
  const a = state.seafaringExplorer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function fundExpedition() {
  const se = state.seafaringExplorer;
  if (!se?.active) return { ok: false, reason: 'No explorer present.' };
  if (state.tick >= se.active.expiresAt) return { ok: false, reason: 'The explorer has set sail.' };
  if ((state.resources.gold ?? 0) < FUND_GOLD_COST) return { ok: false, reason: `Need ${FUND_GOLD_COST} gold.` };
  state.resources.gold -= FUND_GOLD_COST;
  changeMorale(FUND_MORALE_REWARD);
  awardPrestige(FUND_PRESTIGE_REWARD, 'Funded a seafaring expedition');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'explorerFund');
    state.randomEvents.activeModifiers.push({
      id: 'explorerFund', resource: 'gold',
      rateMult: 1 + (FUND_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + FUND_DURATION_TICKS,
    });
  }
  se.active = null; se.nextSpawnTick = _nextSpawnTick(); se.totalFunded = (se.totalFunded ?? 0) + 1;
  emit(Events.SEAFARING_EXPLORER_CHANGED, { funded: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⛵ The empire sponsors a grand maritime expedition! +${FUND_MORALE_REWARD} morale · +${FUND_PRESTIGE_REWARD} prestige. Trade returns pour in: +${FUND_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeNavigationCharts() {
  const se = state.seafaringExplorer;
  if (!se?.active) return { ok: false, reason: 'No explorer present.' };
  if (state.tick >= se.active.expiresAt) return { ok: false, reason: 'The explorer has set sail.' };
  if ((state.resources.wood ?? 0) < CHARTS_WOOD_COST) return { ok: false, reason: `Need ${CHARTS_WOOD_COST} wood.` };
  state.resources.wood -= CHARTS_WOOD_COST;
  awardPrestige(CHARTS_PRESTIGE_REWARD, 'Exchanged navigation charts with a seafaring explorer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'explorerCharts');
    state.randomEvents.activeModifiers.push({
      id: 'explorerCharts', resource: 'wood',
      rateMult: 1 + (CHARTS_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + CHARTS_DURATION_TICKS,
    });
  }
  se.active = null; se.nextSpawnTick = _nextSpawnTick(); se.totalCharts = (se.totalCharts ?? 0) + 1;
  emit(Events.SEAFARING_EXPLORER_CHANGED, { charts: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ The explorer shares maritime navigation techniques with imperial lumberjacks! +${CHARTS_PRESTIGE_REWARD} prestige. Timber operations improve: +${CHARTS_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function provideProvisions() {
  const se = state.seafaringExplorer;
  if (!se?.active) return { ok: false, reason: 'No explorer present.' };
  if (state.tick >= se.active.expiresAt) return { ok: false, reason: 'The explorer has set sail.' };
  if ((state.resources.food ?? 0) < PROVISIONS_FOOD_COST) return { ok: false, reason: `Need ${PROVISIONS_FOOD_COST} food.` };
  state.resources.food -= PROVISIONS_FOOD_COST;
  changeMorale(PROVISIONS_MORALE_REWARD);
  awardPrestige(PROVISIONS_PRESTIGE_REWARD, 'Provided provisions to a seafaring explorer');
  se.active = null; se.nextSpawnTick = _nextSpawnTick(); se.totalProvisioned = (se.totalProvisioned ?? 0) + 1;
  emit(Events.SEAFARING_EXPLORER_CHANGED, { provisioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍖 The explorer accepts imperial provisions with gratitude and tells tales of distant wonders! +${PROVISIONS_MORALE_REWARD} morale · +${PROVISIONS_PRESTIGE_REWARD} prestige. The people are inspired by stories of the sea.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
