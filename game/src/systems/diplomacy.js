/**
 * EmpireOS — Diplomacy system.
 *
 * Manages relations with 3 AI empires: Iron Horde, Mage Council, Sea Wolves.
 * Relations: neutral | allied | war
 *
 * Allied empires accept trade routes (100 gold each, max 3) that grant
 * per-second resource income (see data/empires.js tradeGift values).
 * War empires periodically raid your gold and food stores.
 * AI empires change their stance autonomously every 60–120 s.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { recalcRates } from './resources.js';
import { EMPIRES } from '../data/empires.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const AI_MIN_INTERVAL  = 60  * TICKS_PER_SECOND;   // 240 ticks  (~60 s)
const AI_MAX_INTERVAL  = 120 * TICKS_PER_SECOND;   // 480 ticks  (~120 s)
const WAR_RAID_MIN     = 45  * TICKS_PER_SECOND;   // 180 ticks  (~45 s)
const WAR_RAID_MAX     = 90  * TICKS_PER_SECOND;   // 360 ticks  (~90 s)

export const ALLIANCE_COST    = 200;
export const TRADE_ROUTE_COST = 100;
export const PEACE_COST       = 300;
export const MAX_TRADE_ROUTES = 3;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Called once during boot. Initialises state.diplomacy for a new game,
 * or leaves existing save data intact.
 */
export function initDiplomacy() {
  if (!state.diplomacy) {
    state.diplomacy = {
      empires: Object.keys(EMPIRES).map(id => ({
        id,
        relations:       'neutral',
        tradeRoutes:     0,
        nextAITick:      state.tick + _aiInterval(),
        nextWarRaidTick: 0,
      })),
    };
  }
}

/**
 * Registered as a tick system. Processes AI actions and war raids each tick.
 */
export function diplomacyTick() {
  if (!state.diplomacy) return;

  for (const emp of state.diplomacy.empires) {
    // War raids — check periodically
    if (emp.relations === 'war' && state.tick >= emp.nextWarRaidTick) {
      _warRaid(emp);
      emp.nextWarRaidTick = state.tick + WAR_RAID_MIN +
        Math.floor(Math.random() * (WAR_RAID_MAX - WAR_RAID_MIN));
    }

    // AI diplomatic stance change
    if (state.tick >= emp.nextAITick) {
      _aiAction(emp);
      emp.nextAITick = state.tick + _aiInterval();
    }
  }
}

// ── Player actions ─────────────────────────────────────────────────────────────

/** Spend 200 gold to propose an alliance with a neutral empire. */
export function proposeAlliance(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'neutral')
    return { ok: false, reason: 'Can only propose an alliance from neutral relations.' };
  if ((state.resources.gold ?? 0) < ALLIANCE_COST)
    return { ok: false, reason: `Need ${ALLIANCE_COST} gold.` };

  state.resources.gold -= ALLIANCE_COST;
  emp.relations = 'allied';
  const def = EMPIRES[empireId];
  recalcRates();
  emit(Events.DIPLOMACY_CHANGED, { empireId, relations: 'allied' });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🤝 Alliance forged with ${def.icon} ${def.name}!`, 'diplomacy');
  return { ok: true };
}

/** Spend 100 gold to open a trade route with an allied empire (max 3). */
export function openTradeRoute(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'allied')
    return { ok: false, reason: 'Must be allied to open trade routes.' };
  if (emp.tradeRoutes >= MAX_TRADE_ROUTES)
    return { ok: false, reason: `Maximum ${MAX_TRADE_ROUTES} trade routes per empire.` };
  if ((state.resources.gold ?? 0) < TRADE_ROUTE_COST)
    return { ok: false, reason: `Need ${TRADE_ROUTE_COST} gold.` };

  state.resources.gold -= TRADE_ROUTE_COST;
  emp.tradeRoutes++;
  const def = EMPIRES[empireId];
  recalcRates();
  emit(Events.DIPLOMACY_CHANGED, { empireId, tradeRoutes: emp.tradeRoutes });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🛤️ Trade route opened with ${def.icon} ${def.name} (${emp.tradeRoutes}/${MAX_TRADE_ROUTES}).`,
    'diplomacy',
  );
  return { ok: true };
}

/** Close one trade route with an allied empire (free). */
export function closeTradeRoute(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp || emp.tradeRoutes <= 0)
    return { ok: false, reason: 'No trade routes to close.' };

  emp.tradeRoutes--;
  const def = EMPIRES[empireId];
  recalcRates();
  emit(Events.DIPLOMACY_CHANGED, { empireId, tradeRoutes: emp.tradeRoutes });
  addMessage(`❌ Trade route closed with ${def.icon} ${def.name}.`, 'info');
  return { ok: true };
}

/** Declare war on any empire (free; closes all trade routes). */
export function declareWar(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations === 'war') return { ok: false, reason: 'Already at war.' };

  const wasAllied   = emp.relations === 'allied';
  emp.relations     = 'war';
  emp.tradeRoutes   = 0;
  emp.nextWarRaidTick = state.tick + WAR_RAID_MIN;
  const def = EMPIRES[empireId];
  recalcRates();
  emit(Events.DIPLOMACY_CHANGED, { empireId, relations: 'war' });
  if (wasAllied) emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚔️ You declared WAR on ${def.icon} ${def.name}!`, 'raid');
  return { ok: true };
}

/** Spend 300 gold to end a war and restore neutral relations. */
export function proposePeace(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'war')
    return { ok: false, reason: 'Not at war with this empire.' };
  if ((state.resources.gold ?? 0) < PEACE_COST)
    return { ok: false, reason: `Need ${PEACE_COST} gold.` };

  state.resources.gold -= PEACE_COST;
  emp.relations = 'neutral';
  const def = EMPIRES[empireId];
  recalcRates();
  emit(Events.DIPLOMACY_CHANGED, { empireId, relations: 'neutral' });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🕊️ Peace treaty signed with ${def.icon} ${def.name}.`, 'diplomacy');
  return { ok: true };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _findEmpire(id) {
  return state.diplomacy?.empires.find(e => e.id === id) ?? null;
}

function _aiInterval() {
  return AI_MIN_INTERVAL + Math.floor(Math.random() * (AI_MAX_INTERVAL - AI_MIN_INTERVAL));
}

function _warRaid(emp) {
  if (Math.random() >= 0.5) return;  // 50% chance each check
  const def  = EMPIRES[emp.id];
  const gold = Math.floor(Math.max(15, (state.resources.gold ?? 0) * 0.08));
  const food = Math.floor(Math.max(5,  (state.resources.food ?? 0) * 0.05));
  state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - gold);
  state.resources.food = Math.max(0, (state.resources.food ?? 0) - food);
  addMessage(`${def.icon} ${def.name} war raid! Lost ${gold} gold and ${food} food.`, 'raid');
  emit(Events.RESOURCE_CHANGED, {});
}

function _aiAction(emp) {
  const def = EMPIRES[emp.id];
  const r   = Math.random();

  if (emp.relations === 'neutral') {
    if (r < def.warChance) {
      // AI declares war
      emp.relations       = 'war';
      emp.tradeRoutes     = 0;
      emp.nextWarRaidTick = state.tick + WAR_RAID_MIN;
      recalcRates();
      emit(Events.DIPLOMACY_CHANGED, { empireId: emp.id, relations: 'war' });
      addMessage(`⚔️ The ${def.icon} ${def.name} has declared WAR on your empire!`, 'raid');
    } else if (r < def.warChance + def.allyChance) {
      // AI proposes alliance (player gets it for free)
      emp.relations = 'allied';
      recalcRates();
      emit(Events.DIPLOMACY_CHANGED, { empireId: emp.id, relations: 'allied' });
      addMessage(
        `🤝 The ${def.icon} ${def.name} has proposed an ALLIANCE! You are now allied.`,
        'diplomacy',
      );
    }
  } else if (emp.relations === 'allied') {
    if (r < def.breakAllyChance) {
      // AI breaks the alliance
      emp.relations   = 'neutral';
      emp.tradeRoutes = 0;
      recalcRates();
      emit(Events.DIPLOMACY_CHANGED, { empireId: emp.id, relations: 'neutral' });
      addMessage(
        `💔 The ${def.icon} ${def.name} has broken the alliance. Relations: neutral.`,
        'info',
      );
    }
  } else if (emp.relations === 'war') {
    if (r < def.peaceChance) {
      // AI proposes peace
      emp.relations = 'neutral';
      recalcRates();
      emit(Events.DIPLOMACY_CHANGED, { empireId: emp.id, relations: 'neutral' });
      addMessage(
        `🕊️ The ${def.icon} ${def.name} proposes PEACE. Hostilities have ceased.`,
        'diplomacy',
      );
    }
  }
}
