/**
 * EmpireOS — Building Specialization Definitions (T090).
 *
 * Each eligible building can receive ONE permanent specialization upgrade.
 * The player pays a one-time gold cost and permanently changes how that
 * building performs. Specialization bonuses stack multiplicatively on top of
 * the existing production rates and are applied in resources.js.
 *
 * Format per specialization:
 *   id          — unique key (also used as the trigger in state.buildingSpecials)
 *   buildingId  — which building this belongs to
 *   icon        — display emoji
 *   name        — display name
 *   desc        — short effect description (shown in panel)
 *   cost        — one-time gold cost (plus optional resources)
 *   prodMult    — { [res]: multiplier } applied to that building's production
 *   rateBonus   — { [res]: flat /s added to empire rates }
 *   capBonus    — { [res]: flat cap added }
 *   requires    — optional tech/age requirements (same shape as building requires[])
 */

export const SPECIALIZATIONS = {

  // Farm specializations
  granary: {
    id:         'granary',
    buildingId: 'farm',
    icon:       '🏚️',
    name:       'Granary',
    desc:       '+200 food cap, -10% food production. Prioritises storage over yield.',
    cost:       { gold: 80 },
    prodMult:   { food: 0.90 },
    rateBonus:  {},
    capBonus:   { food: 200 },
    requires:   [],
  },
  market_garden: {
    id:         'market_garden',
    buildingId: 'farm',
    icon:       '🥦',
    name:       'Market Garden',
    desc:       '+30% food production, +0.5 gold/s. Sells surplus produce.',
    cost:       { gold: 100 },
    prodMult:   { food: 1.30 },
    rateBonus:  { gold: 0.5 },
    capBonus:   {},
    requires:   [],
  },

  // Lumber Mill specializations
  timber_mill: {
    id:         'timber_mill',
    buildingId: 'lumberMill',
    icon:       '🪚',
    name:       'Timber Mill',
    desc:       '+40% wood production. Industrial-grade lumber processing.',
    cost:       { gold: 90 },
    prodMult:   { wood: 1.40 },
    rateBonus:  {},
    capBonus:   {},
    requires:   [],
  },
  charcoal_forge: {
    id:         'charcoal_forge',
    buildingId: 'lumberMill',
    icon:       '🔥',
    name:       'Charcoal Forge',
    desc:       '+0.5 iron/s, -20% wood production. Burns wood to smelt iron.',
    cost:       { gold: 120 },
    prodMult:   { wood: 0.80 },
    rateBonus:  { iron: 0.5 },
    capBonus:   {},
    requires:   [{ type: 'tech', id: 'metalworking' }],
  },

  // Barracks specializations
  training_grounds: {
    id:         'training_grounds',
    buildingId: 'barracks',
    icon:       '🏋️',
    name:       'Training Grounds',
    desc:       '-25% unit training time. Hardened drill routines.',
    cost:       { gold: 100, stone: 30 },
    prodMult:   {},
    rateBonus:  {},
    capBonus:   {},
    requires:   [],
    trainTimeMult: 0.75,
  },
  armory: {
    id:         'armory',
    buildingId: 'barracks',
    icon:       '⚔️',
    name:       'Armory',
    desc:       '+15% unit attack power. Stores superior weapons.',
    cost:       { gold: 120, iron: 40 },
    prodMult:   {},
    rateBonus:  {},
    capBonus:   {},
    requires:   [{ type: 'tech', id: 'metalworking' }],
    combatMult: 1.15,
  },

  // Quarry specializations
  deep_quarry: {
    id:         'deep_quarry',
    buildingId: 'quarry',
    icon:       '⛏️',
    name:       'Deep Quarry',
    desc:       '+40% stone production. Excavates deeper seams.',
    cost:       { gold: 80, iron: 20 },
    prodMult:   { stone: 1.40 },
    rateBonus:  {},
    capBonus:   {},
    requires:   [],
  },
  iron_quarry: {
    id:         'iron_quarry',
    buildingId: 'quarry',
    icon:       '🔩',
    name:       'Iron Quarry',
    desc:       '+30% stone production, +0.5 iron/s. Dual extraction.',
    cost:       { gold: 110, iron: 30 },
    prodMult:   { stone: 1.30 },
    rateBonus:  { iron: 0.5 },
    capBonus:   {},
    requires:   [{ type: 'tech', id: 'metalworking' }],
  },
};

// Ordered list of specialization ids per building
export const SPECIALS_BY_BUILDING = {
  farm:       ['granary', 'market_garden'],
  lumberMill: ['timber_mill', 'charcoal_forge'],
  barracks:   ['training_grounds', 'armory'],
  quarry:     ['deep_quarry', 'iron_quarry'],
};

export const ELIGIBLE_BUILDINGS = Object.keys(SPECIALS_BY_BUILDING);
