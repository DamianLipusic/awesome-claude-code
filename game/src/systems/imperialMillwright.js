/**
 * EmpireOS — Imperial Millwright (T460).
 *
 * Every 14–18 minutes (Iron Age+, 12+ player tiles), an imperial millwright
 * arrives at the settlement carrying a portfolio of mill construction drawings —
 * large-format sheets of oiled paper showing plan views, cross-sections, and
 * detail elevations of water-powered grist mills in various configurations:
 * horizontal wheel mills where the millstone shaft runs directly from the paddle
 * wheel without the complex gearing needed in a vertical wheel installation;
 * vertical undershot wheel mills where the current pushes horizontally against
 * flat paddles generating lower torque but requiring less head of water; and
 * vertical overshot wheel mills where the water strikes the paddles from above
 * and the weight of the water in the buckets provides additional turning force
 * on top of its kinetic energy — each drawing annotated with dimensional
 * calculations showing how shaft diameter, millstone weight, and stone-dressing
 * pattern are matched to achieve the grinding efficiency required for the
 * expected grain throughput — offering to construct a complete imperial grist
 * mill installation from foundation to millstone dressing, or to sell the full
 * portfolio of construction drawings and calculation tables. The player has
 * 80 seconds to decide.
 *
 * Choices:
 *   ⚙️ Commission Imperial Grist Mill   — pay 25 iron + 20 gold
 *        → +0.22 iron/s for 2.5 min · +22 prestige · +12 morale
 *   📐 Purchase Millwright's Drawings   — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.imperialMillwright = {
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_IRON_COST           = 25;
export const COMMISSION_GOLD_COST           = 20;
export const COMMISSION_IRON_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD     = 22;
export const COMMISSION_MORALE_REWARD       = 12;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST            = 20;
export const PURCHASE_STONE_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD       = 15;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialMillwright() {
  if (!state.imperialMillwright) {
    state.imperialMillwright = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialMillwright;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialMillwrightTick() {
  const a = state.imperialMillwright;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_MILLWRIGHT_CHANGED, { expired: true });
      addMessage('⚙️ The imperial millwright carefully rolls up the construction drawings, secures the portfolio straps, and departs to the next settlement requiring mill engineering expertise.', 'info');
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
  emit(Events.IMPERIAL_MILLWRIGHT_CHANGED, { spawned: true });
  addMessage('⚙️ An imperial millwright arrives at the settlement with a portfolio of large-format mill construction drawings — oiled-paper sheets showing plan views, cross-sections, and detail elevations of water-powered grist mills in horizontal, undershot, and overshot wheel configurations, each annotated with dimensional calculations matching shaft diameter, millstone weight, and stone-dressing pattern to required grain throughput — offering to construct a complete imperial grist mill from foundation to millstone dressing, or to sell the full portfolio of drawings and calculation tables. Respond within 80 seconds.', 'info');
}

export function getActiveImperialMillwright() { return state.imperialMillwright?.active ?? null; }
export function getMillwrightSecsLeft() {
  const a = state.imperialMillwright?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialGristMill() {
  const a = state.imperialMillwright;
  if (!a?.active) return { ok: false, reason: 'No millwright present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The millwright has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.iron -= COMMISSION_IRON_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned an imperial grist mill from the imperial millwright');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'millwrightCommission');
    state.randomEvents.activeModifiers.push({
      id: 'millwrightCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_MILLWRIGHT_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚙️ The millwright examines the settlement's watercourse with evident professional thoroughness — measuring the fall over a ten-yard length using a sighting level mounted on a portable tripod, gauging the flow volume by timing how long the stream takes to fill a barrel of known capacity held in the current, and assessing the substrate at the proposed mill site by driving a pointed iron rod into the streambed to determine whether the foundation can be taken directly to rock or will require a driven timber grillage — then confirms the commission: an overshot wheel installation is appropriate given the available head, the wheel diameter calculated to match the flow rate to the millstone speed required for fine grinding, the cast iron shaft running in bronze bearings set into dressed stone pedestals, the millstones to be dressed in the quarter-furrow pattern that produces the finest flour from the local grain varieties, the whole structure to be completed within the season with the settlement's own quarrymen cutting the foundation blocks to the millwright's specified dimensions. The iron components are carefully inventoried and earmarked for fabrication. −${COMMISSION_IRON_COST} iron −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseMillwrightDrawings() {
  const a = state.imperialMillwright;
  if (!a?.active) return { ok: false, reason: 'No millwright present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The millwright has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased millwright construction drawings from the imperial millwright');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'millwrightPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'millwrightPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_MILLWRIGHT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📐 The millwright spreads the full portfolio across the counting table and walks through each drawing methodically — beginning with the site survey sheet showing how to measure the available head and flow using simple instruments; the foundation drawings with their standard dimensions for different substrate types, the stone courses set in hydraulic lime mortar which hardens underwater; the wheel assembly drawings showing the spoke-and-rim construction in detail, the bucket shapes for an overshot wheel calculated to retain the water weight for the maximum arc of descent, the iron gudgeon pins that carry the wheel shaft in its journal bearings; the millstone dressing drawings showing the radial furrow pattern, the land width and furrow depth that control the grinding gap, the marks left by a properly dressed stone on a flour-dusted test board; and the calculation tables relating water flow, wheel diameter, gear ratio, and millstone speed — everything needed for the settlement's own craftspeople to build a working mill without further outside expertise, and to dress and maintain the millstones correctly once operating. −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMillwrightAway() {
  const a = state.imperialMillwright;
  if (!a?.active) return { ok: false, reason: 'No millwright present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_MILLWRIGHT_CHANGED, { dismissed: true });
  addMessage('⚙️ The imperial millwright rolls up the construction drawings and departs to the next settlement requiring mill engineering expertise.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
