/**
 * EmpireOS — Grand Theory specialization definitions (T150).
 *
 * At Iron Age with 8+ technologies researched, the player may choose one
 * Grand Theory for a permanent empire-wide strategic bonus.  Only one theory
 * can be active per game.
 *
 * Each entry:
 *   id          — unique key stored in state.grandTheory
 *   icon        — emoji
 *   name        — display name
 *   desc        — short description shown in selector
 *   requires    — optional array of tech IDs that must be researched first
 *   bonusLines  — array of short strings listing the bonuses
 *   bonus       — structured bonus object consumed by game systems:
 *     combatMult     — flat multiplier on all combat attack power
 *     goldRate       — flat gold/s bonus
 *     marketSellMult — market sell price multiplier (stacks with other modifiers)
 *     tradeIncomeMult — trade-route income multiplier
 *     manaRate       — flat mana/s bonus
 *     spellCostMult  — multiplier on all spell mana costs (< 1 = cheaper)
 *     researchMult   — multiplier on research time (< 1 = faster)
 */

export const GRAND_THEORIES = Object.freeze({
  military_supremacy: {
    id:    'military_supremacy',
    icon:  '🏆',
    name:  'Military Supremacy',
    desc:  'Your armies become an unstoppable force, their discipline and training elevated to legendary heights.',
    requires: [],
    bonusLines: [
      '+40% all combat attack power',
      'Compounds with all other attack bonuses',
    ],
    bonus: {
      combatMult: 1.40,
    },
  },

  economic_mastery: {
    id:    'economic_mastery',
    icon:  '💰',
    name:  'Economic Mastery',
    desc:  'Your empire becomes the wealthiest in the land, dominating trade and commerce.',
    requires: [],
    bonusLines: [
      '+3 gold/s flat income',
      'Market sell prices ×1.5',
      'Trade route income ×1.5',
    ],
    bonus: {
      goldRate:        3,
      marketSellMult:  1.5,
      tradeIncomeMult: 1.5,
    },
  },

  arcane_omniscience: {
    id:    'arcane_omniscience',
    icon:  '🌟',
    name:  'Arcane Omniscience',
    desc:  'Your scholars unlock the deepest secrets of magic and lore, bending reality to your will.',
    requires: ['arcane'],
    bonusLines: [
      '+2 mana/s flat production',
      'All spell mana costs −50%',
      'Research time −25%',
    ],
    bonus: {
      manaRate:       2,
      spellCostMult:  0.50,
      researchMult:   0.75,
    },
  },
});

export const GRAND_THEORY_ORDER = ['military_supremacy', 'economic_mastery', 'arcane_omniscience'];

/** Minimum number of techs required to unlock Grand Theory selection. */
export const GRAND_THEORY_MIN_TECHS = 8;
