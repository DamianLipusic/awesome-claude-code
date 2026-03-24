export interface SeasonPassTier {
  level: number;
  xpRequired: number;
  freeReward: { type: 'gems' | 'boost' | 'none'; value: number; label: string };
  premiumReward: { type: 'gems' | 'boost' | 'income_mult' | 'tap_mult'; value: number; label: string };
}

export const SEASON_NAME = 'Money Season 1';
export const SEASON_PASS_COST_USD = 4.99;
export const MAX_SEASON_LEVEL = 30;

export const SEASON_TIERS: SeasonPassTier[] = [
  { level: 1,  xpRequired: 0,     freeReward: { type: 'gems', value: 5, label: '5 Gems' },  premiumReward: { type: 'gems', value: 20, label: '20 Gems' } },
  { level: 2,  xpRequired: 100,   freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'boost', value: 1.5, label: '1.5× Boost 30min' } },
  { level: 3,  xpRequired: 250,   freeReward: { type: 'gems', value: 10, label: '10 Gems' }, premiumReward: { type: 'gems', value: 30, label: '30 Gems' } },
  { level: 4,  xpRequired: 500,   freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'income_mult', value: 1.1, label: '+10% Income (24h)' } },
  { level: 5,  xpRequired: 800,   freeReward: { type: 'gems', value: 15, label: '15 Gems' }, premiumReward: { type: 'gems', value: 50, label: '50 Gems' } },
  { level: 6,  xpRequired: 1200,  freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'boost', value: 2, label: '2× Boost 1h' } },
  { level: 7,  xpRequired: 1700,  freeReward: { type: 'gems', value: 20, label: '20 Gems' }, premiumReward: { type: 'gems', value: 75, label: '75 Gems' } },
  { level: 8,  xpRequired: 2300,  freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'tap_mult', value: 2, label: '2× Tap (24h)' } },
  { level: 9,  xpRequired: 3000,  freeReward: { type: 'gems', value: 25, label: '25 Gems' }, premiumReward: { type: 'gems', value: 100, label: '100 Gems' } },
  { level: 10, xpRequired: 3800,  freeReward: { type: 'boost', value: 2, label: '2× Boost 30min' }, premiumReward: { type: 'income_mult', value: 1.25, label: '+25% Income (48h)' } },
  { level: 11, xpRequired: 4700,  freeReward: { type: 'gems', value: 30, label: '30 Gems' }, premiumReward: { type: 'gems', value: 150, label: '150 Gems' } },
  { level: 12, xpRequired: 5700,  freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'boost', value: 3, label: '3× Boost 1h' } },
  { level: 13, xpRequired: 6800,  freeReward: { type: 'gems', value: 35, label: '35 Gems' }, premiumReward: { type: 'gems', value: 200, label: '200 Gems' } },
  { level: 14, xpRequired: 8000,  freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'income_mult', value: 1.5, label: '+50% Income (48h)' } },
  { level: 15, xpRequired: 9500,  freeReward: { type: 'gems', value: 50, label: '50 Gems' }, premiumReward: { type: 'gems', value: 300, label: '300 Gems' } },
  { level: 16, xpRequired: 11000, freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'boost', value: 5, label: '5× Boost 2h' } },
  { level: 17, xpRequired: 13000, freeReward: { type: 'gems', value: 60, label: '60 Gems' }, premiumReward: { type: 'gems', value: 400, label: '400 Gems' } },
  { level: 18, xpRequired: 15000, freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'tap_mult', value: 3, label: '3× Tap (72h)' } },
  { level: 19, xpRequired: 17500, freeReward: { type: 'gems', value: 75, label: '75 Gems' }, premiumReward: { type: 'gems', value: 500, label: '500 Gems' } },
  { level: 20, xpRequired: 20000, freeReward: { type: 'boost', value: 3, label: '3× Boost 1h' }, premiumReward: { type: 'income_mult', value: 2, label: '2× Income (72h)' } },
  { level: 21, xpRequired: 23000, freeReward: { type: 'gems', value: 80, label: '80 Gems' }, premiumReward: { type: 'gems', value: 600, label: '600 Gems' } },
  { level: 22, xpRequired: 26500, freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'boost', value: 10, label: '10× Boost 1h' } },
  { level: 23, xpRequired: 30000, freeReward: { type: 'gems', value: 100, label: '100 Gems' }, premiumReward: { type: 'gems', value: 750, label: '750 Gems' } },
  { level: 24, xpRequired: 34000, freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'income_mult', value: 3, label: '3× Income (72h)' } },
  { level: 25, xpRequired: 38000, freeReward: { type: 'gems', value: 125, label: '125 Gems' }, premiumReward: { type: 'gems', value: 1000, label: '1000 Gems' } },
  { level: 26, xpRequired: 43000, freeReward: { type: 'boost', value: 5, label: '5× Boost 1h' }, premiumReward: { type: 'boost', value: 20, label: '20× Boost 2h' } },
  { level: 27, xpRequired: 48000, freeReward: { type: 'gems', value: 150, label: '150 Gems' }, premiumReward: { type: 'gems', value: 1500, label: '1500 Gems' } },
  { level: 28, xpRequired: 54000, freeReward: { type: 'none', value: 0, label: '-' },         premiumReward: { type: 'income_mult', value: 5, label: '5× Income (72h)' } },
  { level: 29, xpRequired: 60000, freeReward: { type: 'gems', value: 200, label: '200 Gems' }, premiumReward: { type: 'gems', value: 2000, label: '2000 Gems' } },
  { level: 30, xpRequired: 67000, freeReward: { type: 'boost', value: 10, label: '10× Boost 2h' }, premiumReward: { type: 'income_mult', value: 10, label: '10× Income (1 WEEK)' } },
];

export const GEM_PACKS = [
  { id: 'gems_80',   gems: 80,   price: 0.99, label: '80 Gems',   bonus: '',        emoji: '💎' },
  { id: 'gems_200',  gems: 200,  price: 1.99, label: '200 Gems',  bonus: '',        emoji: '💎💎' },
  { id: 'gems_500',  gems: 500,  price: 4.99, label: '500 Gems',  bonus: 'Best!',   emoji: '💎💎💎' },
  { id: 'gems_1200', gems: 1200, price: 9.99, label: '1200 Gems', bonus: '+200 Free', emoji: '💎💎💎💎' },
  { id: 'gems_2500', gems: 2500, price: 19.99, label: '2500 Gems', bonus: '+500 Free', emoji: '💎×5' },
  { id: 'gems_6500', gems: 6500, price: 49.99, label: '6500 Gems', bonus: 'MEGA VALUE', emoji: '👑' },
];

export const GEM_SHOP_ITEMS = [
  { id: 'gem_boost_2x', name: '2× Income Boost', description: '2× all income for 4 hours', cost: 50, emoji: '⚡', type: 'boost' as const },
  { id: 'gem_boost_5x', name: '5× Income Boost', description: '5× all income for 2 hours', cost: 100, emoji: '🔥', type: 'boost' as const },
  { id: 'gem_boost_10x', name: '10× Mega Boost', description: '10× all income for 1 hour', cost: 200, emoji: '💥', type: 'boost' as const },
  { id: 'gem_tap_boost', name: '10× Tap Power', description: '10× tap value for 2 hours', cost: 75, emoji: '👆', type: 'boost' as const },
  { id: 'gem_offline_extend', name: 'Offline Extender', description: 'Collect 24h of offline income now', cost: 150, emoji: '😴', type: 'utility' as const },
  { id: 'gem_skip_cooldown', name: 'Hustle Skip', description: 'Reset all hustle cooldowns', cost: 80, emoji: '⏩', type: 'utility' as const },
];
