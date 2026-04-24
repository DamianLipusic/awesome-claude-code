/**
 * EmpireOS — Ancient Relic Definitions (T064).
 *
 * Six unique relics that can be discovered by capturing territory tiles.
 * Each terrain type has one associated relic; the arcane shard can drop from any tile.
 * Once discovered a relic grants a permanent passive bonus applied in resources.js.
 *
 * Drop mapping (used by combat.js):
 *   terrain → relicId  (one per terrain, except arcane shard which has its own chance)
 */

export const RELICS = {
  terra_idol: {
    id:      'terra_idol',
    icon:    '🗿',
    name:    'Terra Idol',
    terrain: 'grass',
    desc:    'Ancient idol of harvest — +1.5 food/s permanently.',
    bonus:   { rates: { food: 1.5 } },
  },
  lumber_talisman: {
    id:      'lumber_talisman',
    icon:    '🌿',
    name:    'Lumber Talisman',
    terrain: 'forest',
    desc:    'Carved wood-spirit charm — +1.5 wood/s permanently.',
    bonus:   { rates: { wood: 1.5 } },
  },
  mason_rune: {
    id:      'mason_rune',
    icon:    '🪨',
    name:    "Mason's Rune",
    terrain: 'hills',
    desc:    "Engraved mason's mark — +1.5 stone/s permanently.",
    bonus:   { rates: { stone: 1.5 } },
  },
  river_compass: {
    id:      'river_compass',
    icon:    '🧭',
    name:    'River Compass',
    terrain: 'river',
    desc:    'Ancient navigator token — +1 gold/s and +200 gold cap permanently.',
    bonus:   { rates: { gold: 1 }, caps: { gold: 200 } },
  },
  iron_crown: {
    id:      'iron_crown',
    icon:    '👑',
    name:    'Iron Crown',
    terrain: 'mountain',
    desc:    'Fragment of an ancient crown — +1.5 iron/s permanently.',
    bonus:   { rates: { iron: 1.5 } },
  },
  arcane_shard: {
    id:      'arcane_shard',
    icon:    '💎',
    name:    'Arcane Shard',
    terrain: null,   // drops from any terrain (separate lower chance)
    desc:    'Crystallised mana from a lost age — +1 mana/s and +150 mana cap permanently.',
    bonus:   { rates: { mana: 1 }, caps: { mana: 150 } },
  },
};

// Terrain → relic lookup (excludes arcane_shard)
export const TERRAIN_RELIC = {
  grass:    'terra_idol',
  forest:   'lumber_talisman',
  hills:    'mason_rune',
  river:    'river_compass',
  mountain: 'iron_crown',
};

// Discovery probability per tile capture
export const RELIC_DROP_CHANCE        = 0.08;   // 8% for terrain-matched relic
export const ARCANE_SHARD_DROP_CHANCE = 0.04;   // 4% for the universal arcane shard

export const RELIC_ORDER = [
  'terra_idol', 'lumber_talisman', 'mason_rune', 'river_compass', 'iron_crown', 'arcane_shard',
];

/**
 * T147: Relic combination bonuses.
 * When ALL listed relics in a combo are discovered, the combo's bonus is applied
 * permanently in resources.js (on top of individual relic bonuses).
 * combos with a prestige field award that prestige once on unlock (tracked in combat.js).
 */
export const RELIC_COMBOS = [
  {
    id:     'natures_harmony',
    icon:   '🌱',
    name:   "Nature's Harmony",
    relics: ['terra_idol', 'lumber_talisman'],
    desc:   'Terra Idol + Lumber Talisman — +0.8 food/s and +0.8 wood/s.',
    bonus:  { rates: { food: 0.8, wood: 0.8 } },
  },
  {
    id:     'stonemasons_craft',
    icon:   '⚒️',
    name:   "Stonemason's Craft",
    relics: ['mason_rune', 'iron_crown'],
    desc:   "Mason's Rune + Iron Crown — +0.8 stone/s and +0.8 iron/s.",
    bonus:  { rates: { stone: 0.8, iron: 0.8 } },
  },
  {
    id:     'arcane_navigator',
    icon:   '🔮',
    name:   'Arcane Navigator',
    relics: ['river_compass', 'arcane_shard'],
    desc:   'River Compass + Arcane Shard — +1 gold/s and +1 mana/s.',
    bonus:  { rates: { gold: 1, mana: 1 } },
  },
  {
    id:       'ancient_trove',
    icon:     '🏛️',
    name:     'Ancient Trove',
    relics:   ['terra_idol', 'lumber_talisman', 'mason_rune', 'river_compass', 'iron_crown', 'arcane_shard'],
    desc:     'All 6 relics — +0.5/s to all resources and +200 prestige (one-time).',
    bonus:    { rates: { gold: 0.5, food: 0.5, wood: 0.5, stone: 0.5, iron: 0.5, mana: 0.5 } },
    prestige: 200,
  },
];
