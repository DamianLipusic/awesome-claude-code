/**
 * EmpireOS — Empire Decree definitions (T083).
 *
 * Decrees are player-activated strategic abilities with cooldowns.
 * Each decree has an immediate or timed effect that can swing the course
 * of a battle or economy.  Available from the Military tab → Decrees section.
 *
 * Cooldowns and durations are in ticks (TICKS_PER_SECOND = 4).
 */

export const DECREES = Object.freeze([
  {
    id:            'conscription',
    icon:          '⚔️',
    name:          'Conscription',
    desc:          'Draft citizens immediately — train 5 Infantry and 3 Archers at no queue cost.',
    cost:          { gold: 200, food: 30 },
    cooldownTicks: 1800,   // 7.5 min
    // No duration — instant effect
  },
  {
    id:            'emergency_levy',
    icon:          '💰',
    name:          'Emergency Levy',
    desc:          'Collect 200 gold and 100 food from your citizens. Costs 5 morale.',
    cost:          {},     // no resource cost — morale is the price
    cooldownTicks: 2400,   // 10 min
  },
  {
    id:            'harvest_edict',
    icon:          '🌾',
    name:          'Harvest Edict',
    desc:          '+40% food and wood production for 120 seconds.',
    cost:          { gold: 75 },
    cooldownTicks: 2880,   // 12 min
    durationTicks: 480,    // 120 s
  },
  {
    id:            'war_banner',
    icon:          '🚩',
    name:          'War Banner',
    desc:          '+40% attack power for your next 3 battles.',
    cost:          { gold: 100, iron: 20 },
    cooldownTicks: 1800,   // 7.5 min
    charges:       3,
  },
  {
    id:            'scholars_edict',
    icon:          '📚',
    name:          "Scholar's Edict",
    desc:          'Accelerate research — reduce current project by 2 minutes.',
    cost:          { gold: 150, mana: 50 },
    cooldownTicks: 3600,   // 15 min
  },
]);
