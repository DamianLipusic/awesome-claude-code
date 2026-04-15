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
import { RELIC_ORDER } from '../data/relics.js';
import { DECREES } from '../data/decrees.js';

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

  // ── T084: 10 new late-game achievements ────────────────────────────────────

  siege_repelled: {
    icon:  '🛡️',
    title: 'Wall of Steel',
    desc:  'Successfully repel a Barbarian Grand Siege.',
  },
  all_relics: {
    icon:  '🏺',
    title: 'Relic Hunter',
    desc:  'Discover all 6 ancient relics.',
  },
  prestige_1000: {
    icon:  '✨',
    title: 'Prestigious',
    desc:  'Accumulate 1,000 Empire Prestige points.',
  },
  elite_unit: {
    icon:  '★',
    title: 'Battle-Forged',
    desc:  'Promote a unit type to Elite rank through combat.',
  },
  weathered: {
    icon:  '❄️',
    title: 'Weathered the Storm',
    desc:  'Survive a Snowstorm with morale above zero.',
  },
  treasury: {
    icon:  '🏦',
    title: 'Full Treasury',
    desc:  'Have all 6 resources at or above 80% of their capacity at the same time.',
  },
  speed_builder: {
    icon:  '⚡',
    title: 'Speed of Progress',
    desc:  'Advance to the Bronze Age within 8 minutes of starting a new game.',
  },
  veteran_army: {
    icon:  '🎖️',
    title: 'Veteran Corps',
    desc:  'Field 3 or more veteran or elite unit types simultaneously.',
  },
  mercenary_lord: {
    icon:  '💼',
    title: 'Mercenary Lord',
    desc:  'Hire 3 mercenaries in a single game.',
  },
  decree_master: {
    icon:  '📜',
    title: 'Supreme Commander',
    desc:  'Use all 5 Empire Decrees at least once in a single session.',
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
// T084: track the weather type before it cleared (for weathered achievement)
let _lastWeatherType = null;
// T084: set of decree IDs used this session (for decree_master achievement)
let _decreesUsed = new Set();

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
  _lastWeatherType      = null;
  _decreesUsed          = new Set();

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
    _checkAndUnlock('veteran_army');    // T084
    _checkAndUnlock('mercenary_lord'); // T084
  });

  // Tech events
  on(Events.TECH_CHANGED, () => {
    _checkAndUnlock('scholar');
  });

  // Age events
  on(Events.AGE_CHANGED, () => {
    _checkAndUnlock('bronze_dawn');
    _checkAndUnlock('medieval');
    _checkAndUnlock('speed_builder'); // T084
  });

  // Map / territory events
  on(Events.MAP_CHANGED, () => {
    _checkAndUnlock('conqueror');
    _checkAndUnlock('veteran_army');  // T084: unit ranks promoted on combat wins
    _checkAndUnlock('elite_unit');    // T084
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

  // Resource events (for millionaire + treasury checks)
  on(Events.RESOURCE_CHANGED, () => {
    _checkAndUnlock('millionaire');
    _checkAndUnlock('treasury');  // T084
  });

  // Game over (victory)
  on(Events.GAME_OVER, (data) => {
    if (data?.outcome === 'win') _checkAndUnlock('emperor');
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

  // T084: Barbarian siege repelled
  on(Events.BARBARIAN_SIEGE, (data) => {
    if (data?.type === 'repelled') _checkAndUnlock('siege_repelled');
  });

  // T084: All relics discovered
  on(Events.RELIC_DISCOVERED, () => {
    _checkAndUnlock('all_relics');
  });

  // T084: Prestige score milestones
  on(Events.PRESTIGE_CHANGED, () => {
    _checkAndUnlock('prestige_1000');
  });

  // T084: Weathered — detect snowstorm expiry with morale > 0
  on(Events.WEATHER_CHANGED, (data) => {
    const weatherId = data?.type;   // chosen.id when starting; null when expiring
    if (weatherId) {
      // Weather just started — remember its id
      _lastWeatherType = weatherId;
    } else {
      // Weather just ended — grant achievement if it was a snowstorm and morale > 0
      if (_lastWeatherType === 'snowstorm' && (state.morale ?? 0) > 0) {
        _checkAndUnlock('weathered');
      }
      _lastWeatherType = null;
    }
  });

  // T084: Decree master — track which decrees used this session
  on(Events.DECREE_USED, (data) => {
    if (data?.phase === 'activated' && data?.id) {
      _decreesUsed.add(data.id);
      _checkAndUnlock('decree_master');
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

    // ── T084: new achievements ──────────────────────────────────────────────

    case 'siege_repelled':
      // Predicate always true when called — the event IS the trigger
      return true;

    case 'all_relics': {
      const discovered = Object.keys(s.relics?.discovered ?? {});
      return RELIC_ORDER.every(id => discovered.includes(id));
    }

    case 'prestige_1000':
      return (s.prestige?.score ?? 0) >= 1000;

    case 'elite_unit':
      return Object.values(s.unitRanks ?? {}).some(r => r === 'elite');

    case 'weathered':
      // Predicate always true when called — checked only after snowstorm ends
      return true;

    case 'treasury': {
      const keys = ['gold', 'food', 'wood', 'stone', 'iron', 'mana'];
      return keys.every(r => {
        const val = s.resources?.[r] ?? 0;
        const cap = s.caps?.[r] ?? 500;
        return cap > 0 && val >= cap * 0.80;
      });
    }

    case 'speed_builder':
      // Reached Bronze Age (age >= 1) within first 1920 ticks (8 min)
      return (s.age ?? 0) >= 1 && (s.tick ?? Infinity) <= 1920;

    case 'veteran_army': {
      const rankedCount = Object.values(s.unitRanks ?? {})
        .filter(r => r === 'veteran' || r === 'elite').length;
      return rankedCount >= 3;
    }

    case 'mercenary_lord':
      return (s.mercenaries?.totalHired ?? 0) >= 3;

    case 'decree_master':
      return DECREES.every(d => _decreesUsed.has(d.id));

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
