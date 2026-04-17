/**
 * EmpireOS — Tile improvement definitions (T051).
 *
 * Each terrain type (except 'capital') can have one improvement built on it
 * once the tile is player-owned. Improvements grant per-second production
 * bonuses on top of the base terrain rate.
 *
 * Keyed by terrain type (matches tile.type in map tiles).
 */

export const IMPROVEMENTS = {
  grass: {
    id:         'farm',
    icon:       '🌾',
    name:       'Farm',
    desc:       '+2 food/s',
    cost:       { wood: 40, stone: 20 },
    production: { food: 2 },
    // T095: Level 2 upgrade (requires Iron Age)
    level2: {
      name:        'Advanced Farm',
      icon:        '🌾',
      desc:        '+4 food/s',
      upgradeCost: { wood: 80, stone: 50, gold: 60 },
      production:  { food: 4 },
    },
  },
  forest: {
    id:         'sawmill',
    icon:       '🪚',
    name:       'Sawmill',
    desc:       '+2 wood/s',
    cost:       { stone: 40, gold: 30 },
    production: { wood: 2 },
    level2: {
      name:        'Advanced Sawmill',
      icon:        '🪚',
      desc:        '+4 wood/s',
      upgradeCost: { stone: 80, gold: 80 },
      production:  { wood: 4 },
    },
  },
  hills: {
    id:         'quarry',
    icon:       '⛏️',
    name:       'Quarry',
    desc:       '+1 stone/s',
    cost:       { gold: 50, wood: 30 },
    production: { stone: 1 },
    level2: {
      name:        'Advanced Quarry',
      icon:        '⛏️',
      desc:        '+2 stone/s',
      upgradeCost: { gold: 80, wood: 60 },
      production:  { stone: 2 },
    },
  },
  mountain: {
    id:         'mine',
    icon:       '⛏️',
    name:       'Mine',
    desc:       '+1 iron/s',
    cost:       { gold: 60, wood: 40 },
    production: { iron: 1 },
    level2: {
      name:        'Advanced Mine',
      icon:        '⛏️',
      desc:        '+2 iron/s',
      upgradeCost: { gold: 100, wood: 50 },
      production:  { iron: 2 },
    },
  },
  river: {
    id:         'dock',
    icon:       '⛵',
    name:       'Dock',
    desc:       '+1 gold/s, +1 food/s',
    cost:       { wood: 50, stone: 30 },
    production: { gold: 1, food: 1 },
    level2: {
      name:        'Advanced Dock',
      icon:        '⛵',
      desc:        '+2 gold/s, +2 food/s',
      upgradeCost: { wood: 80, stone: 60, gold: 60 },
      production:  { gold: 2, food: 2 },
    },
  },
};
