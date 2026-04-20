/**
 * EmpireOS — Forge item definitions (T125).
 *
 * Six unique items craftable at the Iron Foundry (requires metalworking tech).
 * Each item can be crafted once per game and grants a permanent passive bonus.
 */

export const FORGE_ITEMS = {
  iron_helm: {
    id:         'iron_helm',
    icon:       '⛑️',
    name:       'Iron Helm',
    desc:       'Forged battle helmet boosts troop effectiveness.',
    cost:       { iron: 100, gold: 80 },
    requires:   { tech: 'metalworking' },
    bonusLabel: '+25 ⚔️ flat attack power',
  },
  ring_of_prosperity: {
    id:         'ring_of_prosperity',
    icon:       '💍',
    name:       'Ring of Prosperity',
    desc:       'A golden ring inscribed with trade runes.',
    cost:       { gold: 150, mana: 50 },
    requires:   { tech: 'tradeRoutes' },
    bonusLabel: '+0.8 💰 gold/s',
  },
  arcane_tome: {
    id:         'arcane_tome',
    icon:       '📖',
    name:       'Arcane Tome',
    desc:       'Forgotten knowledge accelerates scholarly research.',
    cost:       { mana: 100, gold: 80 },
    requires:   { tech: 'arcane' },
    bonusLabel: '-20% 🔬 research time',
  },
  war_drums: {
    id:         'war_drums',
    icon:       '🥁',
    name:       'War Drums',
    desc:       'Ancient drumbeats rally troops to train faster.',
    cost:       { iron: 80, wood: 80, gold: 60 },
    requires:   { tech: 'warcraft' },
    bonusLabel: '-20% ⚔️ training time',
  },
  farmers_almanac: {
    id:         'farmers_almanac',
    icon:       '📋',
    name:       "Farmer's Almanac",
    desc:       'Seasonal planting charts maximize crop yields.',
    cost:       { food: 150, wood: 60, gold: 50 },
    requires:   { tech: 'agriculture' },
    bonusLabel: '+1.5 🍞 food/s',
  },
  ironwood_shield: {
    id:         'ironwood_shield',
    icon:       '🛡️',
    name:       'Ironwood Shield',
    desc:       'Impenetrable shield deflects enemy counterattacks.',
    cost:       { iron: 100, stone: 80 },
    requires:   { tech: 'engineering' },
    bonusLabel: '-20% 🏹 enemy counterattack success',
  },
};

export const FORGE_ORDER = [
  'iron_helm',
  'ring_of_prosperity',
  'arcane_tome',
  'war_drums',
  'farmers_almanac',
  'ironwood_shield',
];
