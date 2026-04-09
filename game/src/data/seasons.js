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
