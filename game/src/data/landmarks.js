/**
 * EmpireOS — Special Map Landmarks (T089).
 *
 * Five legendary sites are placed across the map during generation.
 * Each is visible once fog-of-war is cleared around it.
 * Capturing a landmark grants a unique permanent rate or cap bonus.
 *
 * Landmarks differ from relics (T064) in that they are fixed map objectives
 * — visible targets a player can plan to capture — not random drops.
 */

export const LANDMARKS = {
  ancient_temple: {
    id:        'ancient_temple',
    icon:      '🏛️',
    name:      'Ancient Temple',
    desc:      'A sacred ruin radiating old power. +2 mana/s and +300 mana cap permanently.',
    mapLabel:  'Ancient Temple',
    defenseBonus: 20,
    bonus:     { rates: { mana: 2 }, caps: { mana: 300 } },
  },
  golden_fields: {
    id:        'golden_fields',
    icon:      '🌾',
    name:      'Golden Fields',
    desc:      'Impossibly fertile land worked for millennia. +3 food/s permanently.',
    mapLabel:  'Golden Fields',
    defenseBonus: 10,
    bonus:     { rates: { food: 3 }, caps: {} },
  },
  ancient_quarry: {
    id:        'ancient_quarry',
    icon:      '⛏️',
    name:      'Ancient Quarry',
    desc:      'A vast quarry untouched for centuries. +2 stone/s and +200 stone cap permanently.',
    mapLabel:  'Ancient Quarry',
    defenseBonus: 15,
    bonus:     { rates: { stone: 2 }, caps: { stone: 200 } },
  },
  dragon_hoard: {
    id:        'dragon_hoard',
    icon:      '🐉',
    name:      "Dragon's Hoard",
    desc:      "Remnants of a dragon's treasure vault. +3 gold/s and +400 gold cap permanently.",
    mapLabel:  "Dragon's Hoard",
    defenseBonus: 30,
    bonus:     { rates: { gold: 3 }, caps: { gold: 400 } },
  },
  iron_forge: {
    id:        'iron_forge',
    icon:      '⚒️',
    name:      'Titan Forge',
    desc:      'A legendary forge of the ancients. +2 iron/s and +200 iron cap permanently.',
    mapLabel:  'Titan Forge',
    defenseBonus: 20,
    bonus:     { rates: { iron: 2 }, caps: { iron: 200 } },
  },
};

export const LANDMARK_ORDER = [
  'ancient_temple', 'golden_fields', 'ancient_quarry', 'dragon_hoard', 'iron_forge',
];
