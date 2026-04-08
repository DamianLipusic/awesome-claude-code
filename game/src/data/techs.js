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

  arcane: {
    name: 'Arcane Studies',
    icon: '🔮',
    description: 'Mana Wells produce 100% more mana.',
    cost: { gold: 300, mana: 60 },
    researchTicks: 200,
    effectDesc: '+100% mana well production',
    requires: ['metalworking'],
  },

});
