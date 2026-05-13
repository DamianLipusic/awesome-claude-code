/**
 * EmpireOS — Desert Oasis Discovery (T257).
 *
 * Every 12–16 minutes (Bronze Age+, 8+ player tiles), scouts report a hidden
 * oasis on the frontier. The player has 80 seconds to decide.
 *
 * Choices:
 *   🏪 Develop Trade Stop  — pay 25 gold → +0.2 gold/s for 3 min
 *                             (establish a caravan waypoint) + 15 prestige
 *   💧 Draw Water          — free → +60 food + 8 morale
 *                             (fill wagons from the spring)
 *   🌟 Sacred Offering     — pay 20 mana → +30 prestige
 *                             + 0.15 food/s for 2 min (invoke desert spirits)
 *
 * state.desertOasis = {
 *   active:        { expiresAt: tick } | null,
 *   nextSpawnTick: tick,
 *   totalOases:    number,
 *   totalTraded:   number,
 *   totalWatered:  number,
 *   totalOffered:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND; // 12 min
const SPAWN_RANGE      = 4  * 60 * TICKS_PER_SECOND; // +0–4 min jitter
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;       // 80-second decision window
const MIN_AGE          = 1;                            // Bronze Age
const MIN_PLAYER_TILES = 8;

export const TRADE_GOLD_COST         = 25;
export const TRADE_GOLD_RATE         = 0.2; // +0.2 gold/s
export const TRADE_DURATION_TICKS    = 3 * 60 * TICKS_PER_SECOND; // 3 min
export const TRADE_PRESTIGE_REWARD   = 15;

export const WATER_FOOD_REWARD       = 60;
export const WATER_MORALE_REWARD     = 8;

export const OFFERING_MANA_COST      = 20;
export const OFFERING_PRESTIGE_REWARD = 30;
export const OFFERING_FOOD_RATE      = 0.15; // +0.15 food/s
export const OFFERING_DURATION_TICKS = 2 * 60 * TICKS_PER_SECOND; // 2 min

// ── Init ──────────────────────────────────────────────────────────────────

export function initDesertOasis() {
  if (!state.desertOasis) {
    state.desertOasis = {
      active:        null,
      nextSpawnTick: _nextSpawnTick(),
      totalOases:    0,
      totalTraded:   0,
      totalWatered:  0,
      totalOffered:  0,
    };
  }
  if (state.desertOasis.nextSpawnTick === undefined) state.desertOasis.nextSpawnTick = _nextSpawnTick();
  if (state.desertOasis.totalOases   === undefined) state.desertOasis.totalOases   = 0;
  if (state.desertOasis.totalTraded  === undefined) state.desertOasis.totalTraded  = 0;
  if (state.desertOasis.totalWatered === undefined) state.desertOasis.totalWatered = 0;
  if (state.desertOasis.totalOffered === undefined) state.desertOasis.totalOffered = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function desertOasisTick() {
  const oa = state.desertOasis;
  if (!oa) return;

  // Expire active window
  if (oa.active) {
    if (state.tick >= oa.active.expiresAt) {
      oa.active        = null;
      oa.nextSpawnTick = _nextSpawnTick();
      emit(Events.DESERT_OASIS_CHANGED, { expired: true });
      addMessage('🌵 The desert oasis dries up before the empire could act. Scouts move on.', 'info');
    }
    return;
  }

  if (state.tick < oa.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  oa.active      = { expiresAt: state.tick + WINDOW_TICKS };
  oa.totalOases  = (oa.totalOases ?? 0) + 1;

  emit(Events.DESERT_OASIS_CHANGED, { spawned: true });
  addMessage('🌵 Scouts report a hidden oasis on the frontier! Fresh water and shade await. Respond within 80 seconds.', 'info');
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getActiveDesertOasis() {
  return state.desertOasis?.active ?? null;
}

export function getDesertOasisSecsLeft() {
  const a = state.desertOasis?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Develop Trade Stop — pay 25 gold; +0.2 gold/s for 3 min + 15 prestige.
 */
export function developOasisTradeStop() {
  const oa = state.desertOasis;
  if (!oa?.active) return { ok: false, reason: 'No oasis available.' };
  if (state.tick >= oa.active.expiresAt) return { ok: false, reason: 'The oasis has dried up.' };
  if ((state.resources.gold ?? 0) < TRADE_GOLD_COST) {
    return { ok: false, reason: `Need ${TRADE_GOLD_COST} gold.` };
  }

  state.resources.gold -= TRADE_GOLD_COST;
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Desert trade stop established at frontier oasis');

  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'oasisTrade');
    state.randomEvents.activeModifiers.push({
      id:        'oasisTrade',
      resource:  'gold',
      rateMult:  1 + (TRADE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }

  oa.active        = null;
  oa.nextSpawnTick = _nextSpawnTick();
  oa.totalTraded   = (oa.totalTraded ?? 0) + 1;

  emit(Events.DESERT_OASIS_CHANGED, { traded: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏪 A trade stop is established at the oasis! +${TRADE_PRESTIGE_REWARD} prestige. Caravans flow: +${TRADE_GOLD_RATE} gold/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

/**
 * Draw Water — free; +60 food + 8 morale.
 */
export function drawOasisWater() {
  const oa = state.desertOasis;
  if (!oa?.active) return { ok: false, reason: 'No oasis available.' };
  if (state.tick >= oa.active.expiresAt) return { ok: false, reason: 'The oasis has dried up.' };

  state.resources.food = Math.min(
    state.caps?.food ?? 500,
    (state.resources.food ?? 0) + WATER_FOOD_REWARD,
  );
  changeMorale(WATER_MORALE_REWARD);

  oa.active        = null;
  oa.nextSpawnTick = _nextSpawnTick();
  oa.totalWatered  = (oa.totalWatered ?? 0) + 1;

  emit(Events.DESERT_OASIS_CHANGED, { watered: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💧 Wagons are filled from the oasis spring! +${WATER_FOOD_REWARD} food, +${WATER_MORALE_REWARD} morale. The army's spirits are refreshed.`, 'windfall');
  return { ok: true };
}

/**
 * Sacred Offering — pay 20 mana; +30 prestige + 0.15 food/s for 2 min.
 */
export function offerOasisSacrifice() {
  const oa = state.desertOasis;
  if (!oa?.active) return { ok: false, reason: 'No oasis available.' };
  if (state.tick >= oa.active.expiresAt) return { ok: false, reason: 'The oasis has dried up.' };
  if ((state.resources.mana ?? 0) < OFFERING_MANA_COST) {
    return { ok: false, reason: `Need ${OFFERING_MANA_COST} mana.` };
  }

  state.resources.mana -= OFFERING_MANA_COST;
  awardPrestige(OFFERING_PRESTIGE_REWARD, 'Sacred offering appeases the desert spirits of the oasis');

  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'oasisOffering');
    state.randomEvents.activeModifiers.push({
      id:        'oasisOffering',
      resource:  'food',
      rateMult:  1 + (OFFERING_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + OFFERING_DURATION_TICKS,
    });
  }

  oa.active        = null;
  oa.nextSpawnTick = _nextSpawnTick();
  oa.totalOffered  = (oa.totalOffered ?? 0) + 1;

  emit(Events.DESERT_OASIS_CHANGED, { offered: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌟 Desert spirits are appeased by the sacred offering! +${OFFERING_PRESTIGE_REWARD} prestige. Fertile rains bless the fields: +${OFFERING_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}
