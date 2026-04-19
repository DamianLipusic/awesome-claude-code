/**
 * EmpireOS — Empire Crisis type definitions (T117).
 *
 * Each crisis fires as a timed emergency requiring resource payment.
 * If not resolved within the window, a rate penalty is applied via
 * state.randomEvents.activeModifiers.
 */

export const CRISIS_TYPES = [
  {
    id:          'plague',
    icon:        '🦠',
    name:        'Plague Outbreak',
    desc:        'A deadly plague sweeps the empire. Your healers need mana to contain it before food production collapses.',
    resolveCost: { mana: 60 },
    penalty:     { resource: 'food', rateMult: 0.4, durationTicks: 2400 },
    resolveMsg:  '🦠 Plague contained! Your healers\' mana drove back the sickness.',
    failMsg:     '🦠 The plague spreads unchecked — food production crippled for 10 minutes!',
    prestigeReward: 80,
  },
  {
    id:          'drought',
    icon:        '🌵',
    name:        'Great Drought',
    desc:        'Crops fail across the land. Spend gold to import emergency food supplies and prevent famine.',
    resolveCost: { gold: 150 },
    penalty:     { resource: 'food', rateMult: 0.3, durationTicks: 2880 },
    resolveMsg:  '🌵 Drought survived! Emergency rations keep the empire fed.',
    failMsg:     '🌵 Famine sets in — food production decimated for 12 minutes!',
    prestigeReward: 70,
  },
  {
    id:          'rebellion',
    icon:        '✊',
    name:        'Province Rebellion',
    desc:        'Peasants rise against heavy taxation. Pay to restore order before the treasury suffers.',
    resolveCost: { gold: 200 },
    penalty:     { resource: 'gold', rateMult: 0.4, durationTicks: 1920 },
    resolveMsg:  '✊ Rebellion quelled! Order is restored across the provinces.',
    failMsg:     '✊ The rebellion rages — tax collection collapses for 8 minutes!',
    prestigeReward: 90,
  },
  {
    id:          'market_crash',
    icon:        '📉',
    name:        'Market Collapse',
    desc:        'Trade routes have collapsed. Spend supplies to rebuild market confidence.',
    resolveCost: { wood: 100, stone: 80 },
    penalty:     { resource: 'gold', rateMult: 0.5, durationTicks: 1440 },
    resolveMsg:  '📉 Markets stabilised! Trade and commerce resume.',
    failMsg:     '📉 Markets in freefall — gold income halved for 6 minutes!',
    prestigeReward: 60,
  },
];
