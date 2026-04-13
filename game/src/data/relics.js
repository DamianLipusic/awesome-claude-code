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
