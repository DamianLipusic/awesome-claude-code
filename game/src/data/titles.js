/**
 * EmpireOS — Empire title definitions (T105).
 *
 * Titles are milestone-based ranks earned as the empire grows.
 * Each title grants cumulative passive bonuses applied in resources.js / combat.js.
 * Titles are computed dynamically from current state — no extra state needed.
 */

export const TITLES = [
  {
    id: 'village_chief',
    level: 0,
    name: 'Village Chief',
    icon: '🏕️',
    requires: { territory: 0, age: 0 },
    bonusDesc: 'Starting title',
    bonus: { ratesMult: 0, combatMult: 0 },
  },
  {
    id: 'regional_lord',
    level: 1,
    name: 'Regional Lord',
    icon: '⚜️',
    requires: { territory: 15, age: 0 },
    bonusDesc: '+0.3 gold/s',
    bonus: { gold: 0.3, ratesMult: 0, combatMult: 0 },
  },
  {
    id: 'high_lord',
    level: 2,
    name: 'High Lord',
    icon: '🏰',
    requires: { territory: 30, age: 1 },
    bonusDesc: '+5% all production rates',
    bonus: { ratesMult: 0.05, combatMult: 0 },
  },
  {
    id: 'king',
    level: 3,
    name: 'King',
    icon: '👑',
    requires: { territory: 50, age: 2 },
    bonusDesc: '+10% all production rates, +5% combat attack',
    bonus: { ratesMult: 0.10, combatMult: 0.05 },
  },
  {
    id: 'emperor',
    level: 4,
    name: 'Emperor',
    icon: '🌟',
    requires: { territory: 80, age: 3 },
    bonusDesc: '+15% all production rates, +10% combat attack',
    bonus: { ratesMult: 0.15, combatMult: 0.10 },
  },
];

export const TITLE_ORDER = TITLES.map(t => t.id);

/**
 * Returns the highest title the player currently qualifies for.
 * @param {object} state - live game state
 * @returns {object} title definition
 */
export function getCurrentTitle(state) {
  const tiles = state.map?.tiles;
  const territory = tiles
    ? tiles.flat().filter(t => t.owner === 'player').length
    : 0;
  let best = TITLES[0];
  for (const title of TITLES) {
    if (territory >= title.requires.territory && state.age >= title.requires.age) {
      best = title;
    }
  }
  return best;
}
