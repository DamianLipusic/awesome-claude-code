/**
 * EmpireOS — Unit definitions (static, frozen at runtime).
 *
 * Each unit entry:
 *   name        — display name
 *   icon        — emoji icon
 *   description — tooltip text
 *   cost        — one-time resource cost to train
 *   trainTicks  — game ticks to complete training
 *   attack      — offensive power
 *   defense     — defensive power
 *   upkeep      — resources consumed per second while alive
 *   requires    — array of { type: 'building'|'tech', id }
 */
export const UNITS = Object.freeze({

  soldier: {
    name: 'Soldier',
    icon: '🗡️',
    description: 'Basic melee infantry.',
    cost: { gold: 30, food: 20 },
    trainTicks: 16,   // 4 seconds
    attack: 10,
    defense: 8,
    upkeep: { food: 0.2 },
    requires: [{ type: 'building', id: 'barracks' }],
  },

  archer: {
    name: 'Archer',
    icon: '🏹',
    description: 'Ranged unit. High attack, low defense.',
    cost: { gold: 40, wood: 20, food: 15 },
    trainTicks: 20,   // 5 seconds
    attack: 15,
    defense: 4,
    upkeep: { food: 0.2 },
    requires: [{ type: 'building', id: 'archeryRange' }],
  },

  knight: {
    name: 'Knight',
    icon: '🛡️',
    description: 'Heavy cavalry. Expensive but powerful. Requires Bronze Age.',
    cost: { gold: 100, iron: 50, food: 30 },
    trainTicks: 40,   // 10 seconds
    attack: 25,
    defense: 25,
    upkeep: { food: 0.5, gold: 0.2 },
    requires: [
      { type: 'building', id: 'barracks' },
      { type: 'building', id: 'ironFoundry' },
      { type: 'tech',     id: 'metalworking' },
      { type: 'age',      minAge: 1 },
    ],
  },

  mage: {
    name: 'Mage',
    icon: '🧙',
    description: 'Magical attacker. Requires mana upkeep.',
    cost: { gold: 120, mana: 40, food: 20 },
    trainTicks: 48,   // 12 seconds
    attack: 35,
    defense: 5,
    upkeep: { food: 0.3, mana: 0.3 },
    requires: [
      { type: 'building', id: 'manaWell' },
      { type: 'tech',     id: 'arcane' },
    ],
  },

});
