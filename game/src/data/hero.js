/**
 * EmpireOS — Hero unit definition.
 *
 * One hero (the Champion) can be recruited per game. The hero adds significant
 * attack power to the army and has three active abilities with cooldowns.
 *
 * Ability lifecycle:
 *   battleCry — one-shot flag consumed on the next attackTile() call
 *   inspire   — timed flag (tick expiry) that doubles training speed
 *   siege     — one-shot flag that grants guaranteed victory on next attack
 */
export const HERO_DEF = Object.freeze({
  name: 'Champion',
  icon: '⭐',
  description: 'A legendary warrior who leads your armies into battle and inspires greatness.',
  cost: { gold: 500, food: 200, iron: 100 },
  attack:  60,
  defense: 30,
  upkeep:  { gold: 0.5, food: 0.3 },
  // Hero requires Bronze Age before recruitment
  requires: [{ type: 'age', minAge: 1 }],

  abilities: Object.freeze({
    battleCry: Object.freeze({
      id:            'battleCry',
      name:          'Battle Cry',
      icon:          '📣',
      desc:          'Next attack deals double damage.',
      cooldownTicks: 480,   // 120 s at 4 ticks/s
    }),
    inspire: Object.freeze({
      id:             'inspire',
      name:           'Inspire',
      icon:           '✨',
      desc:           'Training speed doubled for 60 seconds.',
      cooldownTicks:  720,  // 180 s
      durationTicks:  240,  // 60 s
    }),
    siege: Object.freeze({
      id:            'siege',
      name:          'Siege Master',
      icon:          '🏰',
      desc:          'Next attack ignores all tile defenses.',
      cooldownTicks: 1200,  // 300 s
    }),
  }),
});
