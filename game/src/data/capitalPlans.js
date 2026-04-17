/**
 * EmpireOS — Capital Development Plans (T100).
 *
 * One-time permanent upgrade for the player's capital.
 * The player selects exactly one plan per game.
 */

export const CAPITAL_PLANS = {
  fortress: {
    id:        'fortress',
    icon:      '🏰',
    name:      'Fortress Capital',
    desc:      'Reinforce your capital with mighty walls and trained garrison commanders.',
    cost:      { gold: 300, stone: 150, iron: 100 },
    bonusDesc: ['+20% combat attack power', '–20% enemy counterattack success'],
    requiresAge: 0,
  },
  commerce: {
    id:        'commerce',
    icon:      '💼',
    name:      'Commerce Hub',
    desc:      'Transform your capital into a thriving centre of trade and finance.',
    cost:      { gold: 300, wood: 150 },
    bonusDesc: ['+2 gold/s base income', '+500 gold storage cap'],
    requiresAge: 0,
  },
  academy: {
    id:        'academy',
    icon:      '📚',
    name:      'Grand Academy',
    desc:      'Establish a prestigious seat of learning that accelerates research.',
    cost:      { gold: 200, stone: 100, mana: 100 },
    bonusDesc: ['–25% research time', '+500 mana cap'],
    requiresAge: 1,  // Bronze Age
  },
  arcane_tower: {
    id:        'arcane_tower',
    icon:      '🔮',
    name:      'Arcane Tower',
    desc:      'A crystalline spire that channels raw mana through your capital.',
    cost:      { mana: 200, stone: 150, iron: 100 },
    bonusDesc: ['+1.5 mana/s', '–25% spell mana cost'],
    requiresAge: 1,  // Bronze Age
  },
};

export const CAPITAL_PLAN_ORDER = ['fortress', 'commerce', 'academy', 'arcane_tower'];
