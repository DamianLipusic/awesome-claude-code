/**
 * EmpireOS — Empire archetype definitions (T062).
 *
 * Archetypes are chosen once in the New Game Wizard.
 * The selection is stored in state.archetype and persists across new games
 * (like difficulty) so the player keeps their preferred playstyle.
 *
 * Archetype bonuses are applied at runtime, not baked into save data:
 *   conqueror — combat.js:     +25% unit attack power
 *               actions.js:    −10% building construction costs
 *   merchant  — resources.js:  +50% trade route income, +1.5 gold/s base
 *   arcane    — resources.js:  ×2 mana well production
 *               spells.js:     −25% spell mana costs
 *
 * 'none' is the default — no bonuses, fully balanced play.
 */

export const ARCHETYPES = {
  none: {
    id:         'none',
    icon:       '🏛️',
    name:       'Standard',
    desc:       'No specialisation — a balanced empire on equal footing.',
    bonusLines: [],
  },
  conqueror: {
    id:         'conqueror',
    icon:       '⚔️',
    name:       'Conqueror',
    desc:       'Military empire. Your armies strike harder and your castles cost less.',
    bonusLines: ['+25% unit attack power', '−10% building construction costs'],
  },
  merchant: {
    id:         'merchant',
    icon:       '💰',
    name:       'Merchant',
    desc:       'Trade empire. Wealth flows to those who master commerce.',
    bonusLines: ['+50% trade route income', '+1.5 gold/s base income'],
  },
  arcane: {
    id:         'arcane',
    icon:       '🔮',
    name:       'Arcane',
    desc:       'Mystic empire. Ancient magic permeates every stone of your kingdom.',
    bonusLines: ['×2 mana well production', '−25% spell mana costs'],
  },
};

export const ARCHETYPE_ORDER = ['none', 'conqueror', 'merchant', 'arcane'];
