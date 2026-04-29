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

  // ── Housing ───────────────────────────────────────────────────────────────

  house: {
    name: 'House',
    icon: '🏠',
    description: 'Provides housing for more citizens. Each House raises the population cap by 100.',
    baseCost: { wood: 30, gold: 15 },
    production: {},
    consumption: {},
    capBonus: {},
    requires: [],
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

  workshop: {
    name: 'Workshop',
    icon: '⚙️',
    description: 'Skilled craftsmen convert surplus resources. Enables resource conversion in the Building tab.',
    baseCost: { gold: 120, wood: 80, stone: 60 },
    production: {},
    consumption: {},
    capBonus: {},
    requires: [
      { type: 'building', id: 'farm',      count: 2 },
      { type: 'building', id: 'lumberMill', count: 1 },
    ],
    unique: true,
  },

  militaryAcademy: {
    name: 'Military Academy',
    icon: '🎓',
    description: 'Elite officer training. Reduces training time by 10%. Enables Battle Drills command.',
    baseCost: { gold: 200, stone: 100, iron: 80 },
    production: {},
    consumption: {},
    capBonus: {},
    requires: [
      { type: 'age',      minAge: 1 },
      { type: 'building', id: 'barracks', count: 2 },
      { type: 'tech',     id: 'metalworking' },
    ],
    unique: true,
  },

  imperialVault: {
    name: 'Imperial Vault',
    icon: '🏦',
    description: 'Secure treasury vault. Deposit 200 gold for 5 minutes and receive 260 back (+30% interest). Locked gold is safe from raids and disasters.',
    baseCost: { gold: 200, stone: 150, iron: 100 },
    production: {},
    consumption: {},
    capBonus: {},
    requires: [
      { type: 'age',      minAge: 2 },
      { type: 'building', id: 'market', count: 1 },
    ],
    unique: true,
  },

  supplyDepot: {
    name: 'Supply Depot',
    icon: '🏗️',
    description: 'Logistics hub. Reduces all unit upkeep by 15%. Enables the Surge Provisions ability in the Military tab.',
    baseCost: { gold: 300, stone: 200, iron: 100, food: 50 },
    production: {},
    consumption: { food: 1 },
    capBonus: {},
    requires: [
      { type: 'age',      minAge: 2 },
      { type: 'building', id: 'barracks',    count: 2 },
      { type: 'building', id: 'ironFoundry', count: 1 },
    ],
    unique: true,
  },

  // T179: Cartographer's Guild — passive fog reveal + survey reports
  cartographersGuild: {
    name: "Cartographer's Guild",
    icon: '🗺️',
    description: "Systematic exploration hub. Passively reveals 1 fog tile every 10 seconds along your borders. Every 8 minutes generates a Survey Report identifying the richest unexplored terrain nearby.",
    baseCost: { gold: 100, wood: 80, stone: 60 },
    production: {},
    consumption: {},
    capBonus: {},
    requires: [
      { type: 'age',      minAge: 2 },
      { type: 'building', id: 'market', count: 1 },
    ],
    unique: true,
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

  // T180: Relic Shrine — unique Medieval Age shrine powering up discovered relics
  relicShrine: {
    name: 'Relic Shrine',
    icon: '⛩️',
    description: "Sacred shrine for ancient relics. +0.3 mana/s. Passively awards prestige equal to 12 × relic count per minute. Every 5 minutes, Commune with Relics for a bonus that scales with your relic collection.",
    baseCost: { gold: 150, stone: 100, mana: 80 },
    production: { mana: 0.3 },
    consumption: {},
    capBonus: {},
    requires: [
      { type: 'age',      minAge: 3 },
      { type: 'building', id: 'manaWell', count: 1 },
    ],
    unique: true,
  },

  // T190: Trade Guild Hall — unique Iron Age building boosting trade route income
  tradeGuildHall: {
    name: 'Trade Guild Hall',
    icon: '🏦',
    description: 'Headquarters of the merchant guilds. +0.4 gold/s. Each open trade route yields +0.3 extra gold/s. Guild masters can boost individual routes (×1.5 income for 5 min, 50 gold each).',
    baseCost: { gold: 120, wood: 80, stone: 60 },
    production: { gold: 0.4 },
    consumption: {},
    capBonus: {},
    requires: [
      { type: 'age',      minAge: 2 },
      { type: 'building', id: 'market', count: 1 },
      { type: 'tech',     id: 'tradeRoutes' },
    ],
    unique: true,
  },

  // T176: Ancient Monument — unique Medieval Age landmark with periodic ceremonies
  ancientMonument: {
    name: 'Ancient Monument',
    icon: '🏛️',
    description: 'A grand monument to your empire\'s glory. +0.4/s all resources, +5 morale. Every 8 min triggers a Dedication Ceremony: +100 gold, +50 mana, +25 prestige.',
    baseCost: { gold: 300, stone: 200, iron: 100 },
    production: { gold: 0.4, food: 0.4, wood: 0.4, stone: 0.4, iron: 0.4, mana: 0.4 },
    consumption: {},
    capBonus: {},
    requires: [
      { type: 'age',      minAge: 3 },
      { type: 'building', id: 'library', count: 1 },
    ],
    unique: true,
  },
});
