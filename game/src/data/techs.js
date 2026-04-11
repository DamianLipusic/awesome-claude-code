/**
 * EmpireOS — Technology definitions (static, frozen).
 *
 * Each tech entry:
 *   name         — display name
 *   icon         — emoji icon
 *   description  — tooltip text
 *   cost         — resource cost to begin research
 *   researchTicks — ticks to complete
 *   effect       — description of the buff (applied in resources.js rate calc)
 *   requires     — array of techIds that must be researched first
 */
export const TECHS = Object.freeze({

  agriculture: {
    name: 'Agriculture',
    icon: '🌱',
    description: 'Farms produce 50% more food.',
    cost: { gold: 80, food: 50 },
    researchTicks: 80,   // 20 seconds
    effectDesc: '+50% farm food production',
    requires: [],
  },

  masonry: {
    name: 'Masonry',
    icon: '🧱',
    description: 'Quarries produce 50% more stone.',
    cost: { gold: 100, stone: 40 },
    researchTicks: 100,
    effectDesc: '+50% quarry stone production',
    requires: [],
  },

  metalworking: {
    name: 'Metalworking',
    icon: '⚒️',
    description: 'Iron Foundries produce 50% more iron.',
    cost: { gold: 150, iron: 30 },
    researchTicks: 120,
    effectDesc: '+50% iron foundry production',
    requires: ['masonry'],
  },

  tradeRoutes: {
    name: 'Trade Routes',
    icon: '🚢',
    description: 'Markets produce 75% more gold.',
    cost: { gold: 200, food: 100 },
    researchTicks: 150,
    effectDesc: '+75% market gold production',
    requires: ['agriculture'],
  },

  warcraft: {
    name: 'Warcraft',
    icon: '⚔️',
    description: 'All military units train 25% faster.',
    cost: { gold: 250, iron: 80 },
    researchTicks: 160,
    effectDesc: '-25% unit training time',
    requires: ['metalworking'],
  },

  tactics: {
    name: 'Tactics',
    icon: '📜',
    description: 'Advanced battlefield tactics improve unit coordination. +25% attack power in combat.',
    cost: { gold: 200, iron: 60 },
    researchTicks: 130,
    effectDesc: '+25% army attack power in battle',
    requires: ['warcraft'],
  },

  steel: {
    name: 'Steel Forging',
    icon: '🗡️',
    description: 'Superior alloys craft devastating weapons. +50% attack power in combat.',
    cost: { gold: 350, iron: 150 },
    researchTicks: 200,
    effectDesc: '+50% army attack power in battle',
    requires: ['tactics'],
  },

  engineering: {
    name: 'Engineering',
    icon: '🏗️',
    description: 'Siege craft and fortification techniques. +10% attack power, unlocks Watchtower.',
    cost: { gold: 250, stone: 100 },
    researchTicks: 150,
    effectDesc: '+10% attack power, unlocks Watchtower',
    requires: ['masonry'],
  },

  arcane: {
    name: 'Arcane Studies',
    icon: '🔮',
    description: 'Mana Wells produce 100% more mana. Required to recruit Mages.',
    cost: { gold: 300, mana: 60 },
    researchTicks: 200,
    effectDesc: '+100% mana well production, unlocks Mage',
    requires: ['metalworking'],
  },

  // ── Phase 9 advanced technologies ─────────────────────────────────────────

  navigation: {
    name: 'Navigation',
    icon: '⚓',
    description: 'Master the seas. Trade route income from allied empires is boosted by 50%.',
    cost: { gold: 250, wood: 100, food: 80 },
    researchTicks: 160,
    effectDesc: '+50% trade route income from allies',
    requires: ['tradeRoutes'],
  },

  alchemy: {
    name: 'Alchemy',
    icon: '⚗️',
    description: 'Transmute base materials. Mana Wells produce 75% more mana; Quarries produce 25% more stone.',
    cost: { gold: 350, mana: 80, stone: 60 },
    researchTicks: 240,
    effectDesc: '+75% mana well, +25% quarry production',
    requires: ['arcane'],
  },

  siege_craft: {
    name: 'Siege Craft',
    icon: '🏹',
    description: 'Devastating siege engines complement your forces. +75% army attack power in all combat.',
    cost: { gold: 400, iron: 200, stone: 100 },
    researchTicks: 220,
    effectDesc: '+75% army attack power in battle',
    requires: ['steel'],
  },

  fortification: {
    name: 'Fortification',
    icon: '🛡️',
    description: 'Reinforce your borders with walls and garrisons. Enemy counterattack success chance reduced by 40%.',
    cost: { gold: 300, stone: 150, iron: 80 },
    researchTicks: 180,
    effectDesc: '-40% enemy counterattack success vs your tiles',
    requires: ['engineering'],
  },

  economics: {
    name: 'Economics',
    icon: '📈',
    description: 'Advanced trade theory and currency management. Markets produce 50% more gold; gold storage cap +500.',
    cost: { gold: 300, stone: 80, food: 100 },
    researchTicks: 170,
    effectDesc: '+50% market gold production, +500 gold cap',
    requires: ['tradeRoutes'],
  },

  divine_favor: {
    name: 'Divine Favor',
    icon: '✨',
    description: 'Blessings of the gods increase agricultural and arcane output. +30% farm food production; +30% mana well production.',
    cost: { gold: 500, mana: 150, food: 200 },
    researchTicks: 280,
    effectDesc: '+30% farm food and mana well production',
    requires: ['alchemy'],
  },

});
