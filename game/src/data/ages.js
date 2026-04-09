/**
 * EmpireOS — Age definitions.
 *
 * Each age entry:
 *   id             — numeric age index (0–3)
 *   name           — display name
 *   icon           — emoji icon
 *   description    — flavour text / active bonus description
 *   productionMult — multiplier applied to all building production in recalcRates()
 *   cost           — resource cost to advance TO this age (null for Stone Age)
 *   requires       — conditions that must be met to advance to this age:
 *                      { type: 'tech',           id }          — tech must be researched
 *                      { type: 'totalBuildings', count }       — total buildings owned
 *                      { type: 'totalUnits',     count }       — total trained units
 *                      { type: 'territory',      count }       — player-owned map tiles
 */
export const AGES = Object.freeze([

  {
    id: 0,
    name: 'Stone Age',
    icon: '🪨',
    description: 'Humble beginnings. Gather resources and lay the foundations of your empire.',
    productionMult: 1.0,
    cost: null,     // starting age — no cost
    requires: [],
  },

  {
    id: 1,
    name: 'Bronze Age',
    icon: '🔔',
    description: 'Mastery of smelting and trade. All building production +25%.',
    productionMult: 1.25,
    cost: { gold: 500, stone: 200, food: 100 },
    requires: [
      { type: 'totalBuildings', count: 5,        label: '5 total buildings' },
      { type: 'tech',           id: 'masonry',   label: 'Masonry researched' },
    ],
  },

  {
    id: 2,
    name: 'Iron Age',
    icon: '⚒️',
    description: 'Iron and military dominance reshape the world. All building production +50%.',
    productionMult: 1.5,
    cost: { gold: 1200, iron: 400, food: 300 },
    requires: [
      { type: 'totalBuildings', count: 12,          label: '12 total buildings' },
      { type: 'tech',           id: 'metalworking', label: 'Metalworking researched' },
      { type: 'territory',      count: 10,          label: '10 territories captured' },
    ],
  },

  {
    id: 3,
    name: 'Medieval Age',
    icon: '🏰',
    description: 'The apex of empire. Castles, knights, and arcane power. All building production doubled.',
    productionMult: 2.0,
    cost: { gold: 3000, iron: 1000, stone: 800 },
    requires: [
      { type: 'totalBuildings', count: 20,       label: '20 total buildings' },
      { type: 'tech',           id: 'warcraft',  label: 'Warcraft researched' },
      { type: 'territory',      count: 25,       label: '25 territories captured' },
      { type: 'totalUnits',     count: 10,       label: '10 trained units' },
    ],
  },

]);
