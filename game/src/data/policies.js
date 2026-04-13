/**
 * EmpireOS — Empire policy definitions (T065).
 *
 * The player may have one active policy at a time.
 * Policies apply multipliers to resource production rates in recalcRates().
 * A 60-second cooldown prevents rapid switching.
 *
 * Special effects beyond simple rate multipliers:
 *   agrarian   — popCapMult: extra population capacity multiplier
 *   martial_law — trainMult: training time multiplier (applied in trainUnit())
 */

export const POLICIES = {
  taxation: {
    id:         'taxation',
    name:       'Taxation',
    icon:       '💰',
    desc:       'Heavy taxes fill the treasury but squeeze food production.',
    effectDesc: '+25% gold income · −15% food production · −3 morale',
    effects:    { gold: 1.25, food: 0.85 },
    moraleHit:  -3,
  },
  agrarian: {
    id:         'agrarian',
    name:       'Agrarian',
    icon:       '🌾',
    desc:       'Prioritise farms and population growth over gold.',
    effectDesc: '+30% food production · +25% population cap · −15% gold income',
    effects:    { food: 1.30, gold: 0.85 },
    popCapMult: 1.25,
    moraleHit:  0,
  },
  martial_law: {
    id:         'martial_law',
    name:       'Martial Law',
    icon:       '⚔️',
    desc:       'Draft citizens into service — faster armies, lower output.',
    effectDesc: '−30% training time · −8% all resource rates · −5 morale',
    trainMult:  0.70,
    allRatesMult: 0.92,
    moraleHit:  -5,
  },
};

export const POLICY_ORDER = ['taxation', 'agrarian', 'martial_law'];

/** Cooldown between policy changes (ticks = 60 seconds at 4 ticks/s). */
export const POLICY_COOLDOWN_TICKS = 240;
