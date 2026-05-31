/**
 * EmpireOS — Wandering Canoe Builder (T463).
 *
 * Every 12–16 minutes (Bronze Age+, 8+ player tiles), a wandering canoe
 * builder arrives at the settlement carrying adzes, a bundle of cedar-bark
 * caulking, and a scale model of a flat-bottomed river cargo canoe —
 * demonstrating the hollowing technique whereby a full log is charred along
 * the interior with controlled fire then scraped clean with a curved adze,
 * the sides spread by steaming to the required beam, thwarts fitted to
 * maintain the shape, and the hull sealed with a mixture of pine pitch and
 * cedar bark pressed into every seam — offering to commission a complete
 * river fleet for cargo and fishing, or to teach the full canoe-building
 * craft enabling year-round boat production. The player has 80 seconds to
 * decide.
 *
 * Choices:
 *   🛶 Commission River Fleet       — pay 20 wood + 15 food
 *        → +0.22 wood/s for 2.5 min · +18 prestige · +10 morale
 *   📜 Purchase Boat Building Lore  — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingCanoeBuilder = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_WOOD_COST           = 20;
export const COMMISSION_FOOD_COST           = 15;
export const COMMISSION_WOOD_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD     = 18;
export const COMMISSION_MORALE_REWARD       = 10;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST             = 18;
export const PURCHASE_GOLD_RATE             = 0.15;
export const PURCHASE_PRESTIGE_REWARD       = 12;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCanoeBuilder() {
  if (!state.wanderingCanoeBuilder) {
    state.wanderingCanoeBuilder = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingCanoeBuilder;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function wanderingCanoeBuilderTick() {
  const a = state.wanderingCanoeBuilder;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_CANOE_BUILDER_CHANGED, { expired: true });
      addMessage('🛶 The wandering canoe builder lashes the scale model to the pack-frame and sets off downriver to the next settlement in need of boat-building expertise.', 'info');
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
  emit(Events.WANDERING_CANOE_BUILDER_CHANGED, { spawned: true });
  addMessage('🛶 A wandering canoe builder arrives at the settlement carrying adzes, a bundle of cedar-bark caulking, and a scale model of a flat-bottomed river cargo canoe — demonstrating how the hull is hollowed by charring the interior log with controlled fire then scraping it clean with a curved adze, the sides spread by steaming to the required beam, thwarts fitted to maintain the shape, and the hull sealed with pine pitch and cedar bark pressed into every seam. The builder offers to commission a complete river fleet for cargo and fishing, or to teach the full craft for year-round boat production. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingCanoeBuilder() { return state.wanderingCanoeBuilder?.active ?? null; }
export function getCanoeBuilderSecsLeft() {
  const a = state.wanderingCanoeBuilder?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRiverFleet() {
  const a = state.wanderingCanoeBuilder;
  if (!a?.active) return { ok: false, reason: 'No canoe builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The canoe builder has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned a river fleet from the wandering canoe builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'canoeBuilderCommission');
    state.randomEvents.activeModifiers.push({
      id: 'canoeBuilderCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_CANOE_BUILDER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🛶 The canoe builder sets to work immediately — selecting the straightest logs from the timber store, scoring the grain with a hatchet to mark the interior to be removed, then directing the controlled burn that chars the wood to the required depth: a smoldering fire banked against the log's interior surface, allowed to char through three finger-widths of wood before being extinguished with wet clay, the charred material scraped clean with the adze leaving a smooth, hardened bowl of dense wood that will resist water and rot better than the raw timber. The steaming frame is rigged over a kettle of boiling water with the log secured above it: the sides forced apart gradually by wedges inserted at intervals, checked with a spreader board of the required beam width until the hull holds its shape without springing back. Thwarts of seasoned ash are mortised in, fitted snug against the gunwales, and the hull is calked: cedar bark fibres packed into every seam with a calking iron, sealed over with pine pitch heated to pouring consistency and brushed into every interstice until the surface is uniform and waterproof. −${COMMISSION_WOOD_COST} wood −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseBoatBuildingLore() {
  const a = state.wanderingCanoeBuilder;
  if (!a?.active) return { ok: false, reason: 'No canoe builder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The canoe builder has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased boat building lore from the wandering canoe builder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'canoeBuilderPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'canoeBuilderPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_CANOE_BUILDER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The canoe builder opens the pattern book — a collection of thin pine boards each cut to the exact profile of a cross-section of the hull at successive stations along the keel, together with sheets of ruled paper showing the offset tables: the precise measurement from centerline to the hull surface at each station and waterline intersection, allowing any competent woodworker to reproduce the design without reference to the original boat. The fire-hollowing technique is described in careful sequence: the correct moisture content of the log to produce a clean char rather than a runaway fire; the clay poultice formula for extinguishing sections selectively to control the depth and angle of the hollowing; the adze geometry required for the finishing cut that leaves the interior surface smooth enough to require no lining. The spreading and steaming schedule follows: at what temperature the wood becomes plastic enough to accept the required spread; how long to maintain the shape before the wood will hold it permanently; the moisture content at which the thwarts should be fitted so that subsequent drying will lock them immovably in compression against the hull sides. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCanoeBuilderAway() {
  const a = state.wanderingCanoeBuilder;
  if (!a?.active) return { ok: false, reason: 'No canoe builder present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_CANOE_BUILDER_CHANGED, { dismissed: true });
  addMessage('🛶 The wandering canoe builder lashes the scale model to the pack-frame and sets off downriver to the next settlement in need of boat-building expertise.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
