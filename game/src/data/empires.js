/**
 * EmpireOS — AI Empire definitions.
 * Imported by systems/diplomacy.js (logic) and systems/resources.js (trade bonuses).
 */

export const EMPIRES = {
  ironHorde: {
    id:          'ironHorde',
    name:        'Iron Horde',
    icon:        '⚔️',
    desc:        'Fierce warriors from the eastern steppes. Masters of iron and stone.',
    specialty:   ['iron', 'stone'],
    // Per-second income per active trade route when allied
    tradeGift:   { iron: 0.30, stone: 0.20 },
    // AI stance probabilities (evaluated each AI turn)
    warChance:        0.15,   // neutral → war
    allyChance:       0.20,   // neutral → allied (AI-initiated)
    peaceChance:      0.15,   // war → neutral (AI-initiated)
    breakAllyChance:  0.05,   // allied → neutral (AI-initiated)
  },

  mageCouncil: {
    id:          'mageCouncil',
    name:        'Mage Council',
    icon:        '🔮',
    desc:        'Ancient scholars who trade arcane secrets for material wealth.',
    specialty:   ['mana', 'gold'],
    tradeGift:   { mana: 0.30, gold: 0.20 },
    warChance:        0.05,
    allyChance:       0.25,
    peaceChance:      0.25,
    breakAllyChance:  0.03,
  },

  seaWolves: {
    id:          'seaWolves',
    name:        'Sea Wolves',
    icon:        '🐺',
    desc:        'Seafaring raiders who also trade timber and provisions across vast oceans.',
    specialty:   ['wood', 'food'],
    tradeGift:   { wood: 0.30, food: 0.20 },
    warChance:        0.10,
    allyChance:       0.20,
    peaceChance:      0.20,
    breakAllyChance:  0.04,
  },
};
