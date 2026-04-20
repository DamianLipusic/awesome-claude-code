/**
 * EmpireOS — Season definitions.
 * Imported by systems/seasons.js (logic) and systems/resources.js (rate multipliers).
 *
 * Each season lasts 90 real seconds (360 ticks at 4 tps).
 * modifiers: rate multiplier per resource (only applies to positive production).
 */

export const SEASONS = [
  {
    id:        'spring',
    name:      'Spring',
    icon:      '🌸',
    desc:      'Crops grow fast and forests bloom.',
    modifiers: { food: 1.25, wood: 1.10 },
  },
  {
    id:        'summer',
    name:      'Summer',
    icon:      '☀️',
    desc:      'Long days boost lumber and trade.',
    modifiers: { wood: 1.20, food: 1.10, gold: 1.10 },
  },
  {
    id:        'autumn',
    name:      'Autumn',
    icon:      '🍂',
    desc:      'Harvest season and rich quarries.',
    modifiers: { food: 1.15, stone: 1.20, gold: 1.20 },
  },
  {
    id:        'winter',
    name:      'Winter',
    icon:      '❄️',
    desc:      'Cold months strain food and timber.',
    modifiers: { food: 0.70, wood: 0.80 },
  },
];

/**
 * T128: Per-building production bonuses by season index.
 * Applied as a multiplier inside _buildingProdMultiplier() in resources.js.
 * Stacks on top of existing tech/age multipliers and the global season rate modifier.
 */
export const SEASON_BUILDING_BONUSES = [
  { farm: 1.5, manaWell: 1.2 },              // Spring: farms flourish, ley lines surge
  { lumberMill: 1.3, goldMine: 1.2 },        // Summer: peak lumbering and mining
  { quarry: 1.3, market: 1.25 },             // Autumn: quarrying and trade fair season
  { ironFoundry: 1.25, watchtower: 1.5 },    // Winter: smithing and vigilant watch
];

/** Human-readable building bonus labels per season (for the season badge tooltip). */
export const SEASON_BUILDING_LABELS = [
  '🌾 Farms +50%  ·  ✨ Mana Wells +20%',
  '🪵 Lumber Mills +30%  ·  ⛏️ Gold Mines +20%',
  '🪨 Quarries +30%  ·  🏪 Markets +25%',
  '⚒️ Iron Foundries +25%  ·  🗼 Watchtowers +50%',
];
