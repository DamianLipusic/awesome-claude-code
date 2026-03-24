export interface BusinessUpgrade {
  id: string;
  businessId: string;
  name: string;
  description: string;
  emoji: string;
  cost: number;
  multiplier: number; // income multiplier for this business
  requires: number;   // business must be at this level
}

export const BUSINESS_UPGRADES: BusinessUpgrade[] = [
  // Lemonade Stand
  { id: 'ls_1', businessId: 'lemonade_stand', name: 'Secret Recipe', description: '2× lemonade income', emoji: '📋', cost: 500, multiplier: 2, requires: 5 },
  { id: 'ls_2', businessId: 'lemonade_stand', name: 'Premium Lemons', description: '3× lemonade income', emoji: '🍋', cost: 5_000, multiplier: 3, requires: 25 },
  { id: 'ls_3', businessId: 'lemonade_stand', name: 'Franchise Expansion', description: '5× lemonade income', emoji: '🏪', cost: 50_000, multiplier: 5, requires: 50 },

  // Food Cart
  { id: 'fc_1', businessId: 'food_cart', name: 'Hot Sauce Lab', description: '2× cart income', emoji: '🌶️', cost: 5_000, multiplier: 2, requires: 5 },
  { id: 'fc_2', businessId: 'food_cart', name: 'Social Media Viral', description: '3× cart income', emoji: '📱', cost: 50_000, multiplier: 3, requires: 25 },
  { id: 'fc_3', businessId: 'food_cart', name: 'Food Truck Fleet', description: '5× cart income', emoji: '🚚', cost: 500_000, multiplier: 5, requires: 50 },

  // Car Wash
  { id: 'cw_1', businessId: 'car_wash', name: 'Ceramic Coating', description: '2× car wash income', emoji: '✨', cost: 50_000, multiplier: 2, requires: 5 },
  { id: 'cw_2', businessId: 'car_wash', name: 'Detailing Service', description: '3× car wash income', emoji: '🧴', cost: 500_000, multiplier: 3, requires: 25 },
  { id: 'cw_3', businessId: 'car_wash', name: 'Franchise Chain', description: '5× car wash income', emoji: '🔗', cost: 5_000_000, multiplier: 5, requires: 50 },

  // Pizza
  { id: 'pp_1', businessId: 'pizza_shop', name: 'Wood-Fired Oven', description: '2× pizza income', emoji: '🔥', cost: 500_000, multiplier: 2, requires: 5 },
  { id: 'pp_2', businessId: 'pizza_shop', name: 'Delivery Empire', description: '3× pizza income', emoji: '🛵', cost: 5_000_000, multiplier: 3, requires: 25 },
  { id: 'pp_3', businessId: 'pizza_shop', name: 'Michelin Star', description: '5× pizza income', emoji: '⭐', cost: 50_000_000, multiplier: 5, requires: 50 },

  // Gym
  { id: 'gym_1', businessId: 'gym', name: 'Personal Trainers', description: '2× gym income', emoji: '🏋️', cost: 3_000_000, multiplier: 2, requires: 5 },
  { id: 'gym_2', businessId: 'gym', name: 'Celebrity Endorsement', description: '3× gym income', emoji: '⭐', cost: 30_000_000, multiplier: 3, requires: 25 },
  { id: 'gym_3', businessId: 'gym', name: 'Global Franchise', description: '5× gym income', emoji: '🌍', cost: 300_000_000, multiplier: 5, requires: 50 },

  // Nightclub
  { id: 'nc_1', businessId: 'nightclub', name: 'Celebrity DJ', description: '2× club income', emoji: '🎧', cost: 25_000_000, multiplier: 2, requires: 5 },
  { id: 'nc_2', businessId: 'nightclub', name: 'Rooftop Expansion', description: '3× club income', emoji: '🌃', cost: 250_000_000, multiplier: 3, requires: 25 },
  { id: 'nc_3', businessId: 'nightclub', name: 'Global Club Chain', description: '5× club income', emoji: '🌐', cost: 2_500_000_000, multiplier: 5, requires: 50 },

  // Hotel
  { id: 'ht_1', businessId: 'hotel', name: 'Spa & Wellness', description: '2× hotel income', emoji: '🧖', cost: 200_000_000, multiplier: 2, requires: 5 },
  { id: 'ht_2', businessId: 'hotel', name: 'Michelin Restaurant', description: '3× hotel income', emoji: '🍽️', cost: 2_000_000_000, multiplier: 3, requires: 25 },
  { id: 'ht_3', businessId: 'hotel', name: 'Luxury Brand', description: '5× hotel income', emoji: '💎', cost: 20_000_000_000, multiplier: 5, requires: 50 },

  // Bank
  { id: 'bk_1', businessId: 'bank', name: 'Investment Division', description: '2× bank income', emoji: '📈', cost: 1_500_000_000, multiplier: 2, requires: 5 },
  { id: 'bk_2', businessId: 'bank', name: 'Crypto Arm', description: '3× bank income', emoji: '₿', cost: 15_000_000_000, multiplier: 3, requires: 25 },
  { id: 'bk_3', businessId: 'bank', name: 'Central Bank Status', description: '5× bank income', emoji: '🏛️', cost: 150_000_000_000, multiplier: 5, requires: 50 },

  // Casino
  { id: 'cs_1', businessId: 'casino', name: 'High Roller Lounge', description: '2× casino income', emoji: '🎰', cost: 12_000_000_000, multiplier: 2, requires: 5 },
  { id: 'cs_2', businessId: 'casino', name: 'Online Platform', description: '3× casino income', emoji: '💻', cost: 120_000_000_000, multiplier: 3, requires: 25 },
  { id: 'cs_3', businessId: 'casino', name: 'Monopoly License', description: '5× casino income', emoji: '🗝️', cost: 1_200_000_000_000, multiplier: 5, requires: 50 },

  // Tech Startup
  { id: 'ts_1', businessId: 'tech_startup', name: 'Series A Funding', description: '2× startup income', emoji: '💰', cost: 100_000_000_000, multiplier: 2, requires: 5 },
  { id: 'ts_2', businessId: 'tech_startup', name: 'IPO', description: '3× startup income', emoji: '📊', cost: 1_000_000_000_000, multiplier: 3, requires: 25 },
  { id: 'ts_3', businessId: 'tech_startup', name: 'Global Domination', description: '5× startup income', emoji: '🌍', cost: 10_000_000_000_000, multiplier: 5, requires: 50 },
];

export interface GlobalUpgrade {
  id: string;
  name: string;
  description: string;
  emoji: string;
  cost: number;
  type: 'tap_multiplier' | 'income_multiplier' | 'offline_multiplier' | 'prestige_boost';
  value: number;
}

export const GLOBAL_UPGRADES: GlobalUpgrade[] = [
  { id: 'gu_tap_1', name: 'Golden Touch', description: '2× tap value', emoji: '✋', cost: 100_000, type: 'tap_multiplier', value: 2 },
  { id: 'gu_tap_2', name: 'Diamond Hands', description: '5× tap value', emoji: '💎', cost: 10_000_000, type: 'tap_multiplier', value: 5 },
  { id: 'gu_tap_3', name: 'Midas Touch', description: '10× tap value', emoji: '👑', cost: 1_000_000_000, type: 'tap_multiplier', value: 10 },
  { id: 'gu_income_1', name: 'Efficiency Expert', description: '+50% all income', emoji: '📊', cost: 500_000, type: 'income_multiplier', value: 1.5 },
  { id: 'gu_income_2', name: 'Monopoly Man', description: '2× all income', emoji: '🎩', cost: 50_000_000, type: 'income_multiplier', value: 2 },
  { id: 'gu_income_3', name: 'Economy God', description: '5× all income', emoji: '⚡', cost: 5_000_000_000, type: 'income_multiplier', value: 5 },
  { id: 'gu_offline_1', name: 'Night Owl', description: '2× offline income', emoji: '🌙', cost: 1_000_000, type: 'offline_multiplier', value: 2 },
  { id: 'gu_offline_2', name: 'Sleep Money', description: '4× offline income', emoji: '😴', cost: 100_000_000, type: 'offline_multiplier', value: 4 },
];
