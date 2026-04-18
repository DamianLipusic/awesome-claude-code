/**
 * EmpireOS — Empire Festival definitions (T103).
 *
 * Festivals are player-declared temporary boosts.  One festival may be active
 * at a time.  After a festival ends, an 8-minute cooldown must elapse before
 * the next one can be declared.
 */

export const FESTIVALS = {
  harvest: {
    id:           'harvest',
    icon:         '🌾',
    name:         'Harvest Festival',
    desc:         '+60% food and wood production for 90 seconds.',
    cost:         { gold: 80, food: 40 },
    durationTicks: 360,   // 90 seconds at 4 ticks/s
    moraleDelta:  4,
    effects:      { foodMult: 1.6, woodMult: 1.6 },
  },

  parade: {
    id:           'parade',
    icon:         '⚔️',
    name:         'Military Parade',
    desc:         '+25% combat attack power for the next 3 battles, +6 morale.',
    cost:         { gold: 100, iron: 30 },
    charges:      3,      // consumed by combat.js on each battle (win or loss)
    moraleDelta:  6,
    effects:      { combatMult: 1.25 },
  },

  trade_fair: {
    id:           'trade_fair',
    icon:         '🏪',
    name:         'Grand Trade Fair',
    desc:         '+50% gold production for 90 seconds, +3 morale.',
    cost:         { gold: 150 },
    durationTicks: 360,
    moraleDelta:  3,
    effects:      { goldMult: 1.5 },
  },
};

export const FESTIVAL_ORDER = ['harvest', 'parade', 'trade_fair'];

/** Cooldown (ticks) that starts AFTER a festival ends before a new one can begin. */
export const FESTIVAL_COOLDOWN_TICKS = 1920; // 8 minutes at 4 ticks/s
