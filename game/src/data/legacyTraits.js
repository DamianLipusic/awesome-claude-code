/**
 * EmpireOS — Empire Legacy Traits (T124)
 *
 * Cross-game meta-progression. Legacy points are earned when a game ends
 * (floor(score / 100)) and saved to localStorage. Players spend points between
 * games to permanently unlock starting-bonus traits that apply at the beginning
 * of every new game.
 *
 * The localStorage key is 'empireos-legacy':
 *   { points: number, owned: string[] }
 */

export const LEGACY_KEY = 'empireos-legacy';

/**
 * Trait definitions.
 * Each entry has:
 *   id         — unique string key
 *   icon       — emoji
 *   name       — display name
 *   desc       — short description shown in the UI
 *   cost       — legacy points required to buy
 *   apply(s)   — function called with the live state object after initState();
 *                mutates resources, units, techs, buildings, etc. directly.
 */
export const LEGACY_TRAITS = {
  ancient_bloodline: {
    id: 'ancient_bloodline',
    icon: '🩸',
    name: 'Ancient Bloodline',
    desc: 'Start with +150 gold, +80 food, and +60 wood.',
    cost: 50,
    apply(s) {
      s.resources.gold  = Math.min(s.resources.gold  + 150, s.caps.gold);
      s.resources.food  = Math.min(s.resources.food  + 80,  s.caps.food);
      s.resources.wood  = Math.min(s.resources.wood  + 60,  s.caps.wood);
    },
  },

  military_tradition: {
    id: 'military_tradition',
    icon: '⚔️',
    name: 'Military Tradition',
    desc: 'Start each game with 3 free Soldiers already trained.',
    cost: 80,
    apply(s) {
      s.units.soldier = (s.units.soldier ?? 0) + 3;
    },
  },

  trade_heritage: {
    id: 'trade_heritage',
    icon: '🏪',
    name: 'Trade Heritage',
    desc: 'Begin with the Market building already constructed.',
    cost: 100,
    apply(s) {
      s.buildings.market = (s.buildings.market ?? 0) + 1;
    },
  },

  scholars_legacy: {
    id: 'scholars_legacy',
    icon: '📚',
    name: "Scholar's Legacy",
    desc: 'Start each game with Agriculture already researched.',
    cost: 70,
    apply(s) {
      s.techs.agriculture = true;
    },
  },

  iron_constitution: {
    id: 'iron_constitution',
    icon: '🛡️',
    name: 'Iron Constitution',
    desc: 'Begin each game with +10 army morale (capped at 100).',
    cost: 40,
    apply(s) {
      s.morale = Math.min(100, (s.morale ?? 50) + 10);
    },
  },

  builders_instinct: {
    id: 'builders_instinct',
    icon: '🏗️',
    name: "Builder's Instinct",
    desc: 'Start each game with a free Lumber Mill already built.',
    cost: 60,
    apply(s) {
      s.buildings.lumberMill = (s.buildings.lumberMill ?? 0) + 1;
    },
  },

  explorers_heritage: {
    id: 'explorers_heritage',
    icon: '🗺️',
    name: "Explorer's Heritage",
    desc: 'Start with +100 stone and +80 iron — spoils of past expeditions.',
    cost: 60,
    apply(s) {
      s.resources.stone = Math.min(s.resources.stone + 100, s.caps.stone);
      s.resources.iron  = Math.min(s.resources.iron  + 80,  s.caps.iron);
    },
  },

  arcane_lineage: {
    id: 'arcane_lineage',
    icon: '🔮',
    name: 'Arcane Lineage',
    desc: 'Bloodline touched by magic — begin each game with 80 mana.',
    cost: 90,
    apply(s) {
      s.resources.mana = Math.min(80, s.caps.mana);
    },
  },
};

export const LEGACY_TRAIT_ORDER = [
  'ancient_bloodline',
  'military_tradition',
  'trade_heritage',
  'scholars_legacy',
  'iron_constitution',
  'builders_instinct',
  'explorers_heritage',
  'arcane_lineage',
];

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

export function loadLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return { points: 0, owned: [] };
    const data = JSON.parse(raw);
    return {
      points: data.points ?? 0,
      owned:  Array.isArray(data.owned) ? data.owned : [],
    };
  } catch {
    return { points: 0, owned: [] };
  }
}

export function saveLegacy(legacy) {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
  } catch {
    // Storage full — silently ignore
  }
}

/**
 * Award legacy points after a game ends.
 * @param {number} score — the final empire score
 * @returns {number} points awarded
 */
export function awardLegacyPoints(score) {
  const pts    = Math.floor(Math.max(0, score) / 100);
  if (pts <= 0) return 0;
  const legacy = loadLegacy();
  legacy.points += pts;
  saveLegacy(legacy);
  return pts;
}

/**
 * Attempt to buy a trait.
 * @param {string} traitId
 * @returns {{ ok: boolean, reason?: string }}
 */
export function buyLegacyTrait(traitId) {
  const def = LEGACY_TRAITS[traitId];
  if (!def) return { ok: false, reason: 'Unknown trait.' };

  const legacy = loadLegacy();

  if (legacy.owned.includes(traitId)) {
    return { ok: false, reason: 'Trait already owned.' };
  }
  if (legacy.points < def.cost) {
    return { ok: false, reason: `Need ${def.cost} points (have ${legacy.points}).` };
  }

  legacy.points -= def.cost;
  legacy.owned.push(traitId);
  saveLegacy(legacy);
  return { ok: true };
}
