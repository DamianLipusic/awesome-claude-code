/**
 * EmpireOS — Age Council Boon definitions (T072).
 *
 * When the player advances to Bronze/Iron/Medieval Age, a council modal presents
 * three randomly-chosen boons from the age's pool. The player picks one permanent bonus.
 *
 * Boon effect types:
 *   rateBonus       — { [resource]: amount/s }   — added in resources.js recalcRates()
 *   capBonus        — { [resource]: amount }      — added in resources.js recalcRates()
 *   combatAttack    — fraction added to mult (0.1 = +10%)  — applied in combat.js
 *   popCap          — number — flat pop cap bonus  — applied in population.js
 *   counterattackPenalty — fraction multiplied on enemy win chance  — applied in enemyAI.js
 */

export const AGE_BOON_POOLS = {
  1: [  // Bronze Age
    {
      id:   'fertile_lands',
      icon: '🌾',
      name: 'Fertile Lands',
      desc: '+1.5 food/s permanently',
      effect: { rateBonus: { food: 1.5 } },
    },
    {
      id:   'logging_mastery',
      icon: '🪵',
      name: 'Logging Mastery',
      desc: '+1.5 wood/s permanently',
      effect: { rateBonus: { wood: 1.5 } },
    },
    {
      id:   'stone_quarrying',
      icon: '🪨',
      name: 'Stone Quarrying',
      desc: '+1.5 stone/s permanently',
      effect: { rateBonus: { stone: 1.5 } },
    },
    {
      id:   'bronze_weapons',
      icon: '⚔️',
      name: 'Bronze Weapons',
      desc: '+10% combat attack power',
      effect: { combatAttack: 0.10 },
    },
    {
      id:   'settlers_spirit',
      icon: '👥',
      name: "Settlers' Spirit",
      desc: '+100 population cap',
      effect: { popCap: 100 },
    },
  ],
  2: [  // Iron Age
    {
      id:   'iron_discipline',
      icon: '⚔️',
      name: 'Iron Discipline',
      desc: '+15% combat attack power',
      effect: { combatAttack: 0.15 },
    },
    {
      id:   'merchant_networks',
      icon: '💰',
      name: 'Merchant Networks',
      desc: '+2 gold/s permanently',
      effect: { rateBonus: { gold: 2.0 } },
    },
    {
      id:   'iron_reserves',
      icon: '⚙️',
      name: 'Iron Reserves',
      desc: '+1.5 iron/s · +200 iron cap',
      effect: { rateBonus: { iron: 1.5 }, capBonus: { iron: 200 } },
    },
    {
      id:   'advanced_farming',
      icon: '🌾',
      name: 'Advanced Farming',
      desc: '+2.5 food/s permanently',
      effect: { rateBonus: { food: 2.5 } },
    },
    {
      id:   'ley_lines',
      icon: '🔮',
      name: 'Ley Lines',
      desc: '+1 mana/s permanently',
      effect: { rateBonus: { mana: 1.0 } },
    },
  ],
  3: [  // Medieval Age
    {
      id:   'grand_tactics',
      icon: '⚔️',
      name: 'Grand Tactics',
      desc: '+25% combat attack power',
      effect: { combatAttack: 0.25 },
    },
    {
      id:   'royal_granaries',
      icon: '🌾',
      name: 'Royal Granaries',
      desc: '+3 food/s permanently',
      effect: { rateBonus: { food: 3.0 } },
    },
    {
      id:   'imperial_mint',
      icon: '💰',
      name: 'Imperial Mint',
      desc: '+3 gold/s permanently',
      effect: { rateBonus: { gold: 3.0 } },
    },
    {
      id:   'castle_walls',
      icon: '🏰',
      name: 'Castle Walls',
      desc: '−20% enemy counterattack success',
      effect: { counterattackPenalty: 0.80 },
    },
    {
      id:   'arcane_mastery',
      icon: '🔮',
      name: 'Arcane Mastery',
      desc: '+2 mana/s permanently',
      effect: { rateBonus: { mana: 2.0 } },
    },
  ],
};

/** Flat lookup of every boon by id (built from the pools above). */
export const BOONS = {};
for (const pool of Object.values(AGE_BOON_POOLS)) {
  for (const boon of pool) {
    BOONS[boon.id] = boon;
  }
}
