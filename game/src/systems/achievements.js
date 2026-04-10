/**
 * EmpireOS — Achievements System.
 *
 * 15 cross-game achievements stored in `empireos-achievements` localStorage.
 * Achievements persist across New Game resets (separate key from the save file).
 * Checks are triggered by relevant game events; each achievement unlocks once ever.
 *
 * Storage format:
 *   { unlocked: { [id]: { date: ISO-string } } }
 */

import { state } from '../core/state.js';
import { on, emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { BUILDINGS } from '../data/buildings.js';

const STORAGE_KEY = 'empireos-achievements';

// ---------------------------------------------------------------------------
// Achievement definitions
// ---------------------------------------------------------------------------

export const ACHIEVEMENTS = Object.freeze({
  founder: {
    icon:  '🏛️',
    title: 'An Empire is Born',
    desc:  'Start your first game.',
  },
  builder: {
    icon:  '🏗️',
    title: 'Master Builder',
    desc:  'Construct 10 buildings in a single game.',
  },
  warlord: {
    icon:  '⚔️',
    title: 'Warlord',
    desc:  'Train 10 military units in a single game.',
  },
  scholar: {
    icon:  '🔬',
    title: 'Scholar',
    desc:  'Research 5 technologies in a single game.',
  },
  bronze_dawn: {
    icon:  '⚒️',
    title: 'Bronze Dawn',
    desc:  'Advance your empire to the Bronze Age.',
  },
  medieval: {
    icon:  '👑',
    title: 'Medieval Ruler',
    desc:  'Reach the Medieval Age.',
  },
  conqueror: {
    icon:  '🗺️',
    title: 'Conqueror',
    desc:  'Hold 30 territory tiles simultaneously.',
  },
  diplomat: {
    icon:  '🤝',
    title: 'Grand Diplomat',
    desc:  'Be allied with all 3 empires at the same time.',
  },
  champion: {
    icon:  '⭐',
    title: "Champion's Call",
    desc:  'Recruit the Champion hero.',
  },
  wonder_built: {
    icon:  '🏟️',
    title: 'Wonder of the World',
    desc:  'Construct any Wonder building.',
  },
  quest_master: {
    icon:  '📜',
    title: 'Quest Master',
    desc:  'Complete all 11 quests in a single game.',
  },
  millionaire: {
    icon:  '💰',
    title: 'Millionaire',
    desc:  'Earn 10,000 gold over the course of one game.',
  },
  trader: {
    icon:  '🏪',
    title: 'Market Magnate',
    desc:  'Complete 20 resource trades in one game.',
  },
  emperor: {
    icon:  '🏆',
    title: 'Emperor',
    desc:  'Win the game by fulfilling the victory conditions.',
  },
  comeback: {
    icon:  '💪',
    title: 'Against All Odds',
    desc:  'Receive a starvation warning and survive without losing.',
  },
});

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

// Set of achievement IDs already unlocked (loaded from localStorage on init)
let _unlocked = new Set();
// Whether we've seen a starvation warning this session (for comeback tracking)
let _sawStarvationWarning = false;
// Registered render callback set by settingsPanel
let _renderer = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a callback for settings panel to call when achievements update.
 */
export function setAchievementRenderer(fn) {
  _renderer = fn;
}

/**
 * Read currently unlocked achievements from localStorage.
 * Returns { unlocked: { [id]: { date } } }
 */
export function loadAchievements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { unlocked: {} };
  } catch {
    return { unlocked: {} };
  }
}

/**
 * Initialise the achievements system.
 * Rebuilds the in-memory _unlocked set from localStorage and
 * registers event listeners that trigger unlock checks.
 */
export function initAchievements() {
  _sawStarvationWarning = false;

  // Rebuild in-memory set
  const saved = loadAchievements();
  _unlocked = new Set(Object.keys(saved.unlocked ?? {}));

  // Unlock on game start (always grant "founder" on first-ever game)
  _checkAndUnlock('founder');

  // Building events
  on(Events.BUILDING_CHANGED, () => {
    _checkAndUnlock('builder');
    _checkAndUnlock('wonder_built');
  });

  // Unit events
  on(Events.UNIT_CHANGED, () => {
    _checkAndUnlock('warlord');
  });

  // Tech events
  on(Events.TECH_CHANGED, () => {
    _checkAndUnlock('scholar');
  });

  // Age events
  on(Events.AGE_CHANGED, () => {
    _checkAndUnlock('bronze_dawn');
    _checkAndUnlock('medieval');
  });

  // Map / territory events
  on(Events.MAP_CHANGED, () => {
    _checkAndUnlock('conqueror');
  });

  // Diplomacy events
  on(Events.DIPLOMACY_CHANGED, () => {
    _checkAndUnlock('diplomat');
  });

  // Hero events
  on(Events.HERO_CHANGED, () => {
    _checkAndUnlock('champion');
  });

  // Quest events
  on(Events.QUEST_COMPLETED, () => {
    _checkAndUnlock('quest_master');
  });

  // Market events
  on(Events.MARKET_CHANGED, () => {
    _checkAndUnlock('trader');
  });

  // Resource events (for millionaire check)
  on(Events.RESOURCE_CHANGED, () => {
    _checkAndUnlock('millionaire');
  });

  // Game over (victory)
  on(Events.GAME_OVER, (data) => {
    if (data?.outcome === 'win') _checkAndUnlock('emperor');
    if (data?.outcome === 'lose') {
      // Even on death, check if they had the warning (no comeback, but still)
    }
  });

  // Starvation warning detection via message log
  on(Events.MESSAGE, (data) => {
    if (data?.type === 'danger' && data?.text?.includes('starvation')) {
      _sawStarvationWarning = true;
    }
    // If we saw a warning and now food is positive again, grant comeback
    if (_sawStarvationWarning && (state.resources?.food ?? 0) > 5 && (state.rates?.food ?? 0) >= 0) {
      _checkAndUnlock('comeback');
    }
  });
}

// ---------------------------------------------------------------------------
// Internal: check + unlock
// ---------------------------------------------------------------------------

function _checkAndUnlock(id) {
  if (_unlocked.has(id)) return; // already unlocked
  if (!_predicate(id)) return;   // condition not met

  _unlock(id);
}

function _predicate(id) {
  const s = state;
  switch (id) {
    case 'founder':
      return true; // always grant on first init

    case 'builder': {
      const total = Object.values(s.buildings ?? {}).reduce((a, b) => a + b, 0);
      return total >= 10;
    }

    case 'warlord': {
      const total = Object.values(s.units ?? {}).reduce((a, b) => a + b, 0);
      return total >= 10;
    }

    case 'scholar':
      return Object.keys(s.techs ?? {}).length >= 5;

    case 'bronze_dawn':
      return (s.age ?? 0) >= 1;

    case 'medieval':
      return (s.age ?? 0) >= 3;

    case 'conqueror': {
      if (!s.map) return false;
      let count = 0;
      for (const row of s.map.tiles) {
        for (const tile of row) {
          if (tile.owner === 'player') count++;
        }
      }
      return count >= 30;
    }

    case 'diplomat': {
      if (!s.diplomacy) return false;
      const allAllied = s.diplomacy.empires.every(e => e.relations === 'allied');
      return allAllied && s.diplomacy.empires.length >= 3;
    }

    case 'champion':
      return !!s.hero?.recruited;

    case 'wonder_built': {
      const WONDER_IDS = Object.entries(BUILDINGS)
        .filter(([, def]) => def.wonder)
        .map(([id]) => id);
      return WONDER_IDS.some(id => (s.buildings?.[id] ?? 0) >= 1);
    }

    case 'quest_master': {
      const count = Object.keys(s.quests?.completed ?? {}).length;
      return count >= 11;
    }

    case 'millionaire':
      return (s.stats?.goldEarned ?? 0) >= 10_000;

    case 'trader':
      return (s.market?.totalTrades ?? 0) >= 20;

    case 'emperor':
      return s.gameOver?.outcome === 'win';

    case 'comeback':
      return _sawStarvationWarning && (s.resources?.food ?? 0) > 5;

    default:
      return false;
  }
}

function _unlock(id) {
  _unlocked.add(id);

  // Persist to localStorage
  const saved = loadAchievements();
  saved.unlocked[id] = { date: new Date().toLocaleDateString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch (e) {
    console.error('[achievements save error]', e);
  }

  const def = ACHIEVEMENTS[id];
  if (def) {
    addMessage(`🏅 Achievement unlocked: ${def.title}!`, 'achievement');
    emit(Events.ACHIEVEMENT_UNLOCKED, { id, def });
  }

  // Re-render achievements UI if panel is open
  if (_renderer) _renderer();
}
