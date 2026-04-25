/**
 * EmpireOS — Lifetime cross-game records.
 *
 * Persisted under 'empireos-records' in localStorage. Updated at GAME_OVER.
 * Records are never wiped — they accumulate across all sessions / new games.
 */

import { state } from '../core/state.js';

const RECORDS_KEY = 'empireos-records';

export const RECORD_DEFS = [
  { key: 'longestGame',        icon: '⏱️', label: 'Longest Game',         unit: 'ticks'    },
  { key: 'mostGoldEarned',     icon: '💰', label: 'Most Gold Earned',     unit: 'gold'     },
  { key: 'mostPopulation',     icon: '👥', label: 'Peak Population',      unit: 'citizens' },
  { key: 'mostBuildings',      icon: '🏛️', label: 'Most Buildings',       unit: ''         },
  { key: 'mostTechResearched', icon: '🔬', label: 'Most Techs Researched',unit: ''         },
  { key: 'mostTerritory',      icon: '🗺️', label: 'Peak Territory',       unit: 'tiles'    },
  { key: 'mostTradeRoutes',    icon: '🛤️', label: 'Peak Trade Routes',    unit: ''         },
  { key: 'mostPrestige',       icon: '👑', label: 'Most Prestige',        unit: 'pts'      },
];

/** Return the current records object from localStorage. */
export function getRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/**
 * Snapshot the current game state and update any beaten records.
 * Call this on GAME_OVER.
 */
export function updateRecords() {
  const records = getRecords();
  let changed = false;

  function beat(key, value) {
    const v = Math.floor(value ?? 0);
    if (v > (records[key] ?? 0)) { records[key] = v; changed = true; }
  }

  beat('longestGame',        state.tick);
  beat('mostGoldEarned',     state.stats?.goldEarned ?? 0);
  beat('mostPopulation',     state.population?.count ?? 0);
  beat('mostBuildings',      Object.values(state.buildings ?? {}).reduce((a, b) => a + b, 0));
  beat('mostTechResearched', Object.values(state.techs ?? {}).filter(Boolean).length);
  beat('mostTerritory',      state.stats?.peakTerritory ?? 0);
  beat('mostTradeRoutes',    (state.diplomacy?.empires ?? []).reduce((s, e) => s + (e.tradeRoutes ?? 0), 0));
  beat('mostPrestige',       state.prestige?.score ?? 0);

  if (changed) {
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch {}
  }
  return records;
}
