/**
 * EmpireOS — Hero unit definition.
 *
 * One hero (the Champion) can be recruited per game. The hero adds significant
 * attack power to the army and has three active abilities with cooldowns.
 *
 * T070: Hero Skills — the Champion earns a skill choice every
 * HERO_SKILL_WIN_INTERVAL combat victories, up to HERO_MAX_SKILLS total.
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

// ── T070: Hero Skills ─────────────────────────────────────────────────────────

/** Number of combat victories needed to earn each skill choice. */
export const HERO_SKILL_WIN_INTERVAL = 5;

/** Maximum number of skills the Champion can learn. */
export const HERO_MAX_SKILLS = 3;

/**
 * Pool of 10 learnable skills. Each has an effect descriptor used by
 * combat.js, resources.js, research.js, and actions.js.
 *
 * effect.type values:
 *   'attackBonus'  — flat addition to hero attack power
 *   'combatMult'   — multiplicative bonus on total attack power in combat
 *   'ratesMult'    — multiplicative bonus on all positive resource rates
 *   'resourceRate' — flat per-second bonus for a specific resource (effect.resource)
 *   'trainingMult' — multiplier on unit training ticks (<1 = faster)
 *   'researchMult' — multiplier on research ticks (<1 = faster)
 *   'moraleBonus'  — extra morale gained per combat victory (added to base MORALE_COMBAT_WIN)
 *   'lootMult'     — multiplier on loot gained from capturing tiles
 */
export const HERO_SKILLS = Object.freeze([
  {
    id: 'battle_hardened',
    icon: '⚔️',
    name: 'Battle-Hardened',
    desc: '+20 bonus attack power.',
    effect: { type: 'attackBonus', value: 20 },
  },
  {
    id: 'war_drums',
    icon: '🥁',
    name: 'War Drums',
    desc: '+25% attack power in combat.',
    effect: { type: 'combatMult', value: 1.25 },
  },
  {
    id: 'logistics',
    icon: '📦',
    name: 'Logistics',
    desc: '+10% all positive resource rates.',
    effect: { type: 'ratesMult', value: 1.10 },
  },
  {
    id: 'treasury_guard',
    icon: '💎',
    name: 'Treasury Guard',
    desc: '+0.8 gold/s passive income.',
    effect: { type: 'resourceRate', resource: 'gold', value: 0.8 },
  },
  {
    id: 'quartermaster',
    icon: '🌾',
    name: 'Quartermaster',
    desc: '+0.6 food/s passive income.',
    effect: { type: 'resourceRate', resource: 'food', value: 0.6 },
  },
  {
    id: 'arcane_attunement',
    icon: '🌀',
    name: 'Arcane Attunement',
    desc: '+0.5 mana/s passive income.',
    effect: { type: 'resourceRate', resource: 'mana', value: 0.5 },
  },
  {
    id: 'swift_training',
    icon: '⚡',
    name: 'Swift Training',
    desc: '−20% unit training time.',
    effect: { type: 'trainingMult', value: 0.80 },
  },
  {
    id: 'veteran_knowledge',
    icon: '📚',
    name: 'Veteran Knowledge',
    desc: '−20% research time.',
    effect: { type: 'researchMult', value: 0.80 },
  },
  {
    id: 'iron_will',
    icon: '🛡️',
    name: 'Iron Will',
    desc: '+8 bonus morale per combat victory.',
    effect: { type: 'moraleBonus', value: 8 },
  },
  {
    id: 'war_profiteer',
    icon: '💰',
    name: 'War Profiteer',
    desc: '+30% bonus loot from tile captures.',
    effect: { type: 'lootMult', value: 1.30 },
  },
]);

// ── T119: Hero Commander Traits ──────────────────────────────────────────────

/**
 * Pool of 8 commander traits. One is chosen at hero recruitment and persists
 * for the champion's lifetime.  Effects are applied in combat.js, resources.js,
 * research.js, spells.js, and core/actions.js.
 *
 * effect.types (checked by name in each system):
 *   iron_fist       — +30 flat attack, all positive rates ×0.90
 *   war_scholar     — research ×0.80, +15% combat attack
 *   merchant_heart  — +0.8 gold/s
 *   tactician       — formation bonuses doubled
 *   naturalist      — +25% food and wood rates
 *   rally_master    — rally is free (0 gold cost), +10 morale/win
 *   arcane_mind     — +0.5 mana/s, spell mana costs ×0.70
 *   iron_will       — +10 morale/win, morale loss on defeat ×0.50
 */
export const HERO_TRAITS = Object.freeze([
  {
    id:   'iron_fist',
    icon: '🔱',
    name: 'Iron Fist',
    desc: '+30 bonus attack. All positive resource rates −10%.',
  },
  {
    id:   'war_scholar',
    icon: '📜',
    name: 'War Scholar',
    desc: '+15% combat attack. Research time −20%.',
  },
  {
    id:   'merchant_heart',
    icon: '💛',
    name: 'Merchant Heart',
    desc: '+0.8 gold/s passive income from champion\'s trade connections.',
  },
  {
    id:   'tactician',
    icon: '🗺️',
    name: 'Tactician',
    desc: 'Formation bonuses doubled (Defensive/Aggressive multipliers doubled).',
  },
  {
    id:   'naturalist',
    icon: '🌿',
    name: 'Naturalist',
    desc: '+25% food production rate and +25% wood production rate.',
  },
  {
    id:   'rally_master',
    icon: '📣',
    name: 'Rally Master',
    desc: 'Rally Troops costs 0 gold. +10 morale per combat victory.',
  },
  {
    id:   'arcane_mind',
    icon: '🔮',
    name: 'Arcane Mind',
    desc: '+0.5 mana/s. All spell mana costs reduced by 30%.',
  },
  {
    id:   'iron_will',
    icon: '🛡️',
    name: 'Iron Will',
    desc: '+10 morale per combat victory. Morale loss on defeat halved.',
  },
]);

export const HERO_TRAIT_ORDER = HERO_TRAITS.map(t => t.id);

// ── T122: Hero Companions ─────────────────────────────────────────────────────

/** Combat victories needed to unlock a companion offer. */
export const COMPANION_UNLOCK_WINS = 15;

/**
 * Three companion types, each providing a passive combat bonus.
 * The player chooses one when the offer appears (15 wins, no existing companion).
 */
export const COMPANIONS = Object.freeze({
  scout: Object.freeze({
    id:   'scout',
    icon: '🦅',
    name: 'Scout',
    desc: 'Reveals extra tiles in a wider radius after each combat victory.',
  }),
  healer: Object.freeze({
    id:   'healer',
    icon: '🩺',
    name: 'Healer',
    desc: '15% chance to prevent a unit casualty when your attack is repelled.',
  }),
  warlock: Object.freeze({
    id:   'warlock',
    icon: '🔮',
    name: 'Warlock',
    desc: 'Grants +12 mana after every combat victory.',
  }),
});

export const COMPANION_ORDER = ['scout', 'healer', 'warlock'];

/**
 * Compute the combined numeric value for a given effect type across
 * an array of learned skill IDs.  Pure function — no state access.
 *
 * @param {string[]} skillIds   Array of learned skill IDs (state.hero.skills)
 * @param {string}   effectType One of the effect.type values listed above
 * @param {string}   [resource] Required only for effectType === 'resourceRate'
 * @returns {number}  Additive total (attackBonus/moraleBonus/resourceRate) OR
 *                    multiplicative product (combatMult / ratesMult / trainingMult /
 *                    researchMult / lootMult).  Multiplier functions default to 1.0.
 */
export function heroSkillBonus(skillIds, effectType, resource) {
  if (!skillIds?.length) return effectType.endsWith('Mult') ? 1.0 : 0;

  if (effectType === 'resourceRate') {
    return skillIds.reduce((sum, id) => {
      const skill = HERO_SKILLS.find(s => s.id === id);
      if (!skill || skill.effect.type !== 'resourceRate') return sum;
      if (skill.effect.resource !== resource) return sum;
      return sum + skill.effect.value;
    }, 0);
  }

  if (effectType.endsWith('Mult')) {
    return skillIds.reduce((prod, id) => {
      const skill = HERO_SKILLS.find(s => s.id === id);
      if (!skill || skill.effect.type !== effectType) return prod;
      return prod * skill.effect.value;
    }, 1.0);
  }

  // Additive types: attackBonus, moraleBonus
  return skillIds.reduce((sum, id) => {
    const skill = HERO_SKILLS.find(s => s.id === id);
    if (!skill || skill.effect.type !== effectType) return sum;
    return sum + skill.effect.value;
  }, 0);
}
