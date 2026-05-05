/**
 * EmpireOS — Trade Wind Events (T198).
 *
 * Every 5–8 seasons a trade wind event shifts the economic environment for
 * one full season. Active winds apply flat rate bonuses/penalties that are
 * integrated in resources.js via getTradeWindRateBonuses().
 *
 * Wind types:
 *   silk_road       — Eastern Silk Road:  +1.0 gold/s
 *   pirate_raids    — Pirate Season:      −0.5 gold/s
 *   boom_season     — Economic Boom:      +0.8 gold/s, +0.5 food/s
 *   supply_shortage — Supply Shortage:    −0.4 iron/s
 *   merchant_boom   — Merchant Windfall:  +0.6 gold/s, +0.3 iron/s
 *
 * state.tradeWind = {
 *   active: { id, icon, name, desc, goldBonus, ironBonus, foodBonus,
 *             endsAtSeason, startSeasonName } | null,
 *   nextWindSeason: number,   // countdown in seasons until next spawn
 *   history: [{ id, icon, name, seasonName }],  // newest first, max 4
 *   totalEvents: number,
 * }
 */

import { state }             from '../core/state.js';
import { on, emit, Events }  from '../core/events.js';
import { addMessage }        from '../core/actions.js';
import { recalcRates }       from './resources.js';
import { SEASONS }           from '../data/seasons.js';

// ── Wind definitions ─────────────────────────────────────────────────────────

const WIND_DEFS = {
  silk_road: {
    id:        'silk_road',
    icon:      '🛤️',
    name:      'Eastern Silk Road',
    desc:      'Far trade routes swell with exotic goods.',
    goldBonus: 1.0,
    ironBonus: 0,
    foodBonus: 0,
  },
  pirate_raids: {
    id:        'pirate_raids',
    icon:      '☠️',
    name:      'Pirate Season',
    desc:      'Sea pirates plague trade lanes.',
    goldBonus: -0.5,
    ironBonus: 0,
    foodBonus: 0,
  },
  boom_season: {
    id:        'boom_season',
    icon:      '📈',
    name:      'Economic Boom',
    desc:      'Markets boom with merchant activity.',
    goldBonus: 0.8,
    ironBonus: 0,
    foodBonus: 0.5,
  },
  supply_shortage: {
    id:        'supply_shortage',
    icon:      '📉',
    name:      'Supply Shortage',
    desc:      'Trade disruptions reduce material imports.',
    goldBonus: 0,
    ironBonus: -0.4,
    foodBonus: 0,
  },
  merchant_boom: {
    id:        'merchant_boom',
    icon:      '💹',
    name:      'Merchant Windfall',
    desc:      'Wandering merchants bring prosperity to the empire.',
    goldBonus: 0.6,
    ironBonus: 0.3,
    foodBonus: 0,
  },
};

const WIND_ORDER       = Object.keys(WIND_DEFS);
const MAX_HISTORY      = 4;
const MIN_GAP_SEASONS  = 5;
const MAX_GAP_SEASONS  = 8;

// ── Public API ───────────────────────────────────────────────────────────────

export function initTradeWinds() {
  if (!state.tradeWind) {
    state.tradeWind = {
      active:         null,
      nextWindSeason: _randInterval(),
      history:        [],
      totalEvents:    0,
    };
  }
  // Migration guards for older saves
  if (!state.tradeWind.history)     state.tradeWind.history     = [];
  if (!state.tradeWind.totalEvents) state.tradeWind.totalEvents = 0;
  if (state.tradeWind.nextWindSeason == null) state.tradeWind.nextWindSeason = _randInterval();

  on(Events.SEASON_CHANGED, _onSeasonChanged);
}

/**
 * Returns { gold, iron, food } flat bonuses from the active trade wind,
 * or null when no wind is active.  Called every recalcRates() by resources.js.
 */
export function getTradeWindRateBonuses() {
  const a = state.tradeWind?.active;
  if (!a) return null;
  return { gold: a.goldBonus, iron: a.ironBonus, food: a.foodBonus };
}

/** Returns the active wind object or null. */
export function getActiveTradeWind() {
  return state.tradeWind?.active ?? null;
}

/** Returns recent trade wind history (newest first). */
export function getTradeWindHistory() {
  return state.tradeWind?.history ?? [];
}

// ── Internal ─────────────────────────────────────────────────────────────────

function _onSeasonChanged(data) {
  if (!state.tradeWind) return;
  const tw  = state.tradeWind;
  const idx = data?.index ?? state.season?.index ?? 0;

  // 1. Expire active wind if its end season has arrived
  if (tw.active && tw.active.endsAtSeason === idx) {
    const prev = tw.active;
    tw.active  = null;
    addMessage(`🌬️ Trade winds calm — ${prev.icon} ${prev.name} has ended.`, 'info');
    emit(Events.TRADE_WIND_CHANGED, { active: null });
    recalcRates();
  }

  // 2. Only decrement countdown when no active wind (prevents immediate respawn)
  if (!tw.active) {
    tw.nextWindSeason--;
    if (tw.nextWindSeason <= 0) _spawnWind(idx);
  }
}

function _spawnWind(seasonIdx) {
  const tw = state.tradeWind;

  // Prefer a wind not used last time
  const lastId  = tw.history[0]?.id;
  const choices = WIND_ORDER.filter(id => id !== lastId);
  const id      = choices[Math.floor(Math.random() * choices.length)];
  const def     = WIND_DEFS[id];

  const seasonName  = SEASONS[seasonIdx]?.name ?? 'Season';
  const endsAtSeason = (seasonIdx + 1) % 4;   // expires at start of next season

  tw.active = {
    id,
    icon:            def.icon,
    name:            def.name,
    desc:            def.desc,
    goldBonus:       def.goldBonus,
    ironBonus:       def.ironBonus,
    foodBonus:       def.foodBonus,
    endsAtSeason,
    startSeasonName: seasonName,
  };

  tw.history.unshift({ id, icon: def.icon, name: def.name, seasonName });
  if (tw.history.length > MAX_HISTORY) tw.history.length = MAX_HISTORY;
  tw.totalEvents++;
  tw.nextWindSeason = _randInterval();

  // Build effect description
  const effects = [];
  if (def.goldBonus > 0)  effects.push(`+${def.goldBonus} 💰/s`);
  if (def.goldBonus < 0)  effects.push(`${def.goldBonus} 💰/s`);
  if (def.ironBonus > 0)  effects.push(`+${def.ironBonus} ⚒️/s`);
  if (def.ironBonus < 0)  effects.push(`${def.ironBonus} ⚒️/s`);
  if (def.foodBonus > 0)  effects.push(`+${def.foodBonus} 🌾/s`);
  if (def.foodBonus < 0)  effects.push(`${def.foodBonus} 🌾/s`);
  const effectStr = effects.join(', ');

  addMessage(
    `🌬️ Trade winds shift — ${def.icon} ${def.name}! ${def.desc} (${effectStr} for this season)`,
    'windfall'
  );
  emit(Events.TRADE_WIND_CHANGED, { active: tw.active });
  recalcRates();
}

function _randInterval() {
  return MIN_GAP_SEASONS + Math.floor(Math.random() * (MAX_GAP_SEASONS - MIN_GAP_SEASONS + 1));
}
