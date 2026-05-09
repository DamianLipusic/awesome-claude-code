/**
 * EmpireOS — Empire Epithet System (T243).
 *
 * Derives a dynamic epithet for the empire from the player's dominant
 * accomplishment. Recalculated each season and at game-over.
 *
 * The current epithet is stored in state.empire.epithet and shown in
 * the Summary panel header and the Game-Over screen.
 */

import { state }        from '../core/state.js';
import { on, Events }   from '../core/events.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function _alliedCount() {
  return (state.diplomacy?.empires ?? []).filter(e => e.relations === 'allied').length;
}

function _techCount() {
  return Object.keys(state.techs ?? {}).length;
}

function _goldEarned() {
  return state.stats?.goldEarned ?? 0;
}

function _battlesWon() {
  return (state.combatHistory ?? []).filter(h => h.outcome === 'win').length;
}

function _buildingCount() {
  return Object.values(state.buildings ?? {}).reduce((a, b) => a + b, 0);
}

function _prestigeScore() {
  return state.prestige?.score ?? 0;
}

function _seasonsElapsed() {
  return Math.floor((state.tick ?? 0) / 360); // 360 ticks per season
}

function _playerTiles() {
  if (!state.map) return 0;
  let n = 0;
  for (const row of state.map.tiles)
    for (const tile of row)
      if (tile.owner === 'player') n++;
  return n;
}

// ── Epithet rules (ordered — first match wins) ─────────────────────────────

const EPITHET_RULES = [
  // Diplomatic paths
  { check: () => _alliedCount() >= 3,
    epithet: 'the Peacemaker' },
  { check: () => _alliedCount() >= 2 && _battlesWon() < 5,
    epithet: 'the Diplomat' },

  // Research mastery
  { check: () => _techCount() >= 14,
    epithet: 'the Enlightened' },
  { check: () => _techCount() >= 10,
    epithet: 'the Scholar' },

  // Economic dominance
  { check: () => _goldEarned() >= 40_000,
    epithet: 'the Golden' },
  { check: () => _goldEarned() >= 20_000,
    epithet: 'the Merchant' },

  // Military prowess
  { check: () => _battlesWon() >= 40,
    epithet: 'the Conqueror' },
  { check: () => _battlesWon() >= 20,
    epithet: 'the Warlord' },
  { check: () => _battlesWon() >= 10,
    epithet: 'the Warrior' },

  // Construction mastery
  { check: () => _buildingCount() >= 40,
    epithet: 'the Great Builder' },
  { check: () => _buildingCount() >= 25,
    epithet: 'the Architect' },

  // Prestige tiers
  { check: () => _prestigeScore() >= 600,
    epithet: 'the Magnificent' },
  { check: () => _prestigeScore() >= 300,
    epithet: 'the Glorious' },
  { check: () => _prestigeScore() >= 100,
    epithet: 'the Renowned' },

  // Territorial control
  { check: () => _playerTiles() >= 60,
    epithet: 'the Expansionist' },

  // Longevity
  { check: () => _seasonsElapsed() >= 8,
    epithet: 'the Enduring' },
  { check: () => _seasonsElapsed() >= 4,
    epithet: 'the Steadfast' },

  // Default
  { check: () => true,
    epithet: 'the Young' },
];

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns the epithet string matching the empire's dominant accomplishment. */
export function calcEpithet() {
  const rule = EPITHET_RULES.find(r => r.check());
  return rule?.epithet ?? 'the Young';
}

/**
 * Recalculates and writes the epithet into state.empire.epithet.
 * Returns the new epithet string.
 */
export function updateEpithet() {
  const e = calcEpithet();
  state.empire.epithet = e;
  return e;
}

/**
 * Registers the SEASON_CHANGED listener so the epithet stays up-to-date.
 * Called once during game boot.
 */
export function initEpithet() {
  on(Events.SEASON_CHANGED, updateEpithet);
  on(Events.GAME_OVER,      updateEpithet);
  updateEpithet(); // initial calculation
}
