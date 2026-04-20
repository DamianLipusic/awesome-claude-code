/**
 * EmpireOS — Wonder Project definitions (T133).
 *
 * Three massive late-game constructions available at Medieval Age.
 * One per game; commission costs resources up front, then a 4-minute
 * build timer runs before the permanent bonus takes effect.
 *
 * Effects are applied in:
 *   resources.js  — gold/mana rate & mana cap bonuses
 *   research.js   — Tower of Babel tech cost reduction
 *   systems/market.js / ui/marketPanel.js — Grand Bazaar trade multiplier
 *   systems/festivals.js — Colosseum festival bonus
 *   systems/morale.js   — Colosseum morale on completion
 */

export const WONDERS = Object.freeze({
  colosseum: {
    id:          'colosseum',
    icon:        '🏟️',
    name:        'Grand Colosseum',
    desc:        'An eternal arena where legends are forged. Festivals grant +25% stronger effects. Permanent +10 morale on completion.',
    flavorText:  'Where empires prove their glory before the gods.',
    cost:        { gold: 500, stone: 400, iron: 200, wood: 150 },
    buildTicks:  960,   // 4 min at 4 ticks/s
    requires:    { age: 3 },
    bonusLabel:  '+10 morale | Festivals +25% stronger',
  },

  grand_bazaar: {
    id:          'grand_bazaar',
    icon:        '🏛️',
    name:        'Grand Bazaar',
    desc:        'The greatest marketplace in the known world. +2.5 gold/s permanently. Market buy/sell amounts ×1.5.',
    flavorText:  'Gold flows like water through these merchant halls.',
    cost:        { gold: 400, wood: 200, stone: 100, mana: 100 },
    buildTicks:  960,
    requires:    { age: 3, tech: 'tradeRoutes' },
    bonusLabel:  '+2.5 gold/s | Market trades ×1.5',
  },

  tower_of_babel: {
    id:          'tower_of_babel',
    icon:        '🗼',
    name:        'Tower of Babel',
    desc:        'A monument to mortal ambition. All tech costs −20%. +1.5 mana/s and +300 mana cap permanently.',
    flavorText:  'Knowledge beyond the reach of ordinary minds.',
    cost:        { gold: 350, mana: 200, stone: 200, iron: 150 },
    buildTicks:  960,
    requires:    { age: 3, tech: 'arcane' },
    bonusLabel:  '−20% tech costs | +1.5 mana/s | +300 mana cap',
  },
});

export const WONDER_ORDER = ['colosseum', 'grand_bazaar', 'tower_of_babel'];
