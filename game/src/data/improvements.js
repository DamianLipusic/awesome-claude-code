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
  },
  forest: {
    id:         'sawmill',
    icon:       '🪚',
    name:       'Sawmill',
    desc:       '+2 wood/s',
    cost:       { stone: 40, gold: 30 },
    production: { wood: 2 },
  },
  hills: {
    id:         'quarry',
    icon:       '⛏️',
    name:       'Quarry',
    desc:       '+1 stone/s',
    cost:       { gold: 50, wood: 30 },
    production: { stone: 1 },
  },
  mountain: {
    id:         'mine',
    icon:       '⛏️',
    name:       'Mine',
    desc:       '+1 iron/s',
    cost:       { gold: 60, wood: 40 },
    production: { iron: 1 },
  },
  river: {
    id:         'dock',
    icon:       '⛵',
    name:       'Dock',
    desc:       '+1 gold/s, +1 food/s',
    cost:       { wood: 50, stone: 30 },
    production: { gold: 1, food: 1 },
  },
};
