/**
 * EmpireOS — Empire Proclamation definitions (T131).
 *
 * Proclamations are strategic age-long declarations: one per age, permanent until
 * the next age advance.  Unlike Decrees (short cooldown tactical abilities),
 * Proclamations commit the empire to a lasting trade-off for the rest of the age.
 */

export const PROCLAMATIONS = Object.freeze([
  {
    id:       'war_economy',
    icon:     '⚔️',
    name:     'War Economy',
    desc:     '+25% attack power for this age.',
    tradeoff: 'All resource production −15%.',
    cost:     { gold: 150 },
  },
  {
    id:       'golden_era',
    icon:     '💰',
    name:     'Golden Era',
    desc:     '+40% gold production for this age.',
    tradeoff: 'Food and wood production −20%.',
    cost:     { gold: 100 },
  },
  {
    id:       'great_works',
    icon:     '📚',
    name:     'Great Works',
    desc:     'Research completes 30% faster for this age.',
    tradeoff: 'Mana production −25%.',
    cost:     { gold: 200, mana: 50 },
  },
  {
    id:       'iron_will',
    icon:     '🛡️',
    name:     'Iron Will',
    desc:     'Enemy counterattacks −20% success for this age.',
    tradeoff: '−10 morale when issued.',
    cost:     { gold: 120, iron: 30 },
  },
]);
