/**
 * EmpireOS — Building definitions (static, frozen at runtime).
 *
 * Each building entry:
 *   name         — display name
 *   icon         — emoji icon
 *   description  — tooltip text
 *   baseCost     — resource cost to build first instance
 *   production   — resources produced per second per building (positive)
 *   consumption  — resources consumed per second per building (positive value = consumed)
 *   capBonus     — extra resource cap per building
 *   requires     — array of { type: 'building'|'tech', id, count? }
 */
export const BUILDINGS = Object.freeze({

  // ── Economy ──────────────────────────────────────────────────────────────

  farm: {
    name: 'Farm',
    icon: '🌾',
    description: 'Produces food to sustain your population.',
    baseCost: { wood: 20, gold: 10 },
    production: { food: 2 },
    consumption: {},
    capBonus: {},
    requires: [],
  },

  lumberMill: {
    name: 'Lumber Mill',
    icon: '🪵',
    description: 'Harvests wood from nearby forests.',
    baseCost: { gold: 30 },
    production: { wood: 2 },
    consumption: {},
    capBonus: {},
    requires: [],
  },

  goldMine: {
    name: 'Gold Mine',
    icon: '⛏️',
    description: 'Extracts gold from the earth.',
    baseCost: { wood: 40, food: 20 },
    production: { gold: 2 },
    consumption: { food: 0.5 },
    capBonus: {},
    requires: [],
  },

  quarry: {
    name: 'Quarry',
    icon: '🪨',
    description: 'Mines stone for construction.',
    baseCost: { wood: 50, gold: 20 },
    production: { stone: 2 },
    consumption: { food: 0.5 },
    capBonus: {},
    requires: [],
  },

  ironFoundry: {
    name: 'Iron Foundry',
    icon: '⚒️',
    description: 'Smelts iron ore into usable iron.',
    baseCost: { stone: 60, wood: 40, gold: 50 },
    production: { iron: 1.5 },
    consumption: { food: 1, wood: 0.5 },
    capBonus: {},
    requires: [{ type: 'building', id: 'quarry', count: 1 }],
  },

  market: {
    name: 'Market',
    icon: '🏪',
    description: 'Boosts gold income from trade.',
    baseCost: { wood: 80, stone: 40, gold: 60 },
    production: { gold: 3 },
    consumption: {},
    capBonus: {},
    requires: [{ type: 'building', id: 'lumberMill', count: 1 }],
  },

  // ── Storage ───────────────────────────────────────────────────────────────

  warehouse: {
    name: 'Warehouse',
    icon: '🏚️',
    description: 'Increases resource storage capacity.',
    baseCost: { wood: 60, stone: 30 },
    production: {},
    consumption: {},
    capBonus: { gold: 250, food: 250, wood: 250, stone: 250, iron: 250 },
    requires: [],
  },

  // ── Military ──────────────────────────────────────────────────────────────

  barracks: {
    name: 'Barracks',
    icon: '⚔️',
    description: 'Allows training of military units.',
    baseCost: { wood: 100, stone: 50, gold: 80 },
    production: {},
    consumption: { food: 1 },
    capBonus: {},
    requires: [{ type: 'building', id: 'farm', count: 2 }],
  },

  archeryRange: {
    name: 'Archery Range',
    icon: '🏹',
    description: 'Unlocks ranged unit training. Requires Bronze Age.',
    baseCost: { wood: 120, gold: 100, iron: 40 },
    production: {},
    consumption: { food: 1 },
    capBonus: {},
    requires: [
      { type: 'building', id: 'barracks', count: 1 },
      { type: 'age',      minAge: 1 },
    ],
  },

  // ── Magic ─────────────────────────────────────────────────────────────────

  manaWell: {
    name: 'Mana Well',
    icon: '✨',
    description: 'Taps ley lines to generate mana.',
    baseCost: { stone: 100, gold: 150, iron: 30 },
    production: { mana: 1 },
    consumption: {},
    capBonus: { mana: 200 },
    requires: [{ type: 'building', id: 'quarry', count: 2 }],
  },

  // ── Defense ──────────────────────────────────────────────────────────────

  wall: {
    name: 'Fortified Wall',
    icon: '🧱',
    description: 'Strengthens your empire\'s defenses.',
    baseCost: { stone: 80, iron: 20, gold: 40 },
    production: {},
    consumption: {},
    capBonus: {},
    requires: [{ type: 'building', id: 'quarry', count: 1 }],
  },

  watchtower: {
    name: 'Watchtower',
    icon: '🗼',
    description: 'Provides early warning of attacks, adds small gold bonus.',
    baseCost: { wood: 60, stone: 60, gold: 50 },
    production: { gold: 1 },
    consumption: {},
    capBonus: {},
    requires: [
      { type: 'building', id: 'wall', count: 1 },
      { type: 'tech',     id: 'engineering' },
    ],
  },

  // ── Wonders ───────────────────────────────────────────────────────────────
  // Unique (max 1 per game). Provide powerful late-game bonuses.

  greatLibrary: {
    name: 'Great Library',
    icon: '🏛️',
    description: 'Centre of learning. Cuts research time by 25%. Generates mana.',
    baseCost: { gold: 500, stone: 300, iron: 200, mana: 100 },
    production: { mana: 1 },
    consumption: {},
    capBonus: { mana: 300 },
    requires: [
      { type: 'age',      minAge: 2 },
      { type: 'tech',     id: 'arcane' },
      { type: 'building', id: 'manaWell', count: 2 },
    ],
    unique: true,
    wonder: true,
  },

  colosseum: {
    name: 'Colosseum',
    icon: '🏟️',
    description: 'Grand arena. Cuts unit training time by 33%. Feeds your people.',
    baseCost: { gold: 400, stone: 350, iron: 120 },
    production: { food: 3 },
    consumption: {},
    capBonus: {},
    requires: [
      { type: 'age',      minAge: 1 },
      { type: 'building', id: 'barracks', count: 2 },
    ],
    unique: true,
    wonder: true,
  },

  grandCathedral: {
    name: 'Grand Cathedral',
    icon: '⛪',
    description: 'Sacred seat of power. +8 gold/s. Halves disaster severity.',
    baseCost: { gold: 600, stone: 400, iron: 200, mana: 150 },
    production: { gold: 8 },
    consumption: {},
    capBonus: { gold: 500 },
    requires: [
      { type: 'age',      minAge: 3 },
      { type: 'building', id: 'manaWell', count: 2 },
      { type: 'building', id: 'wall',     count: 2 },
    ],
    unique: true,
    wonder: true,
  },
});
