export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: 'money' | 'business' | 'shop' | 'prestige' | 'hustle' | 'social';
  requirement: number;
  requirementType:
    | 'total_earned'
    | 'money_at_once'
    | 'businesses_owned'
    | 'business_level'
    | 'items_owned'
    | 'prestige_count'
    | 'tap_count'
    | 'ips';
  gemReward: number;
  hidden?: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Money milestones
  { id: 'first_k', title: 'First Thousand', description: 'Earn $1,000 total', emoji: '💰', category: 'money', requirement: 1_000, requirementType: 'total_earned', gemReward: 2 },
  { id: 'first_100k', title: 'Six Figures', description: 'Earn $100,000 total', emoji: '💸', category: 'money', requirement: 100_000, requirementType: 'total_earned', gemReward: 5 },
  { id: 'first_million', title: 'Millionaire', description: 'Earn $1,000,000 total', emoji: '🤑', category: 'money', requirement: 1_000_000, requirementType: 'total_earned', gemReward: 10 },
  { id: 'first_billion', title: 'Billionaire', description: 'Earn $1,000,000,000 total', emoji: '🏆', category: 'money', requirement: 1_000_000_000, requirementType: 'total_earned', gemReward: 25 },
  { id: 'first_trillion', title: 'Trillionaire', description: 'Earn $1,000,000,000,000 total', emoji: '👑', category: 'money', requirement: 1_000_000_000_000, requirementType: 'total_earned', gemReward: 50 },
  { id: 'first_quadrillion', title: 'Beyond Wealth', description: 'Earn $1 Quadrillion total', emoji: '🌌', category: 'money', requirement: 1e15, requirementType: 'total_earned', gemReward: 100 },
  { id: 'pocket_change', title: 'Pocket Change', description: 'Have $1M cash at once', emoji: '💵', category: 'money', requirement: 1_000_000, requirementType: 'money_at_once', gemReward: 8 },
  { id: 'big_stacks', title: 'Big Stacks', description: 'Have $1B cash at once', emoji: '💳', category: 'money', requirement: 1_000_000_000, requirementType: 'money_at_once', gemReward: 20 },

  // Business milestones
  { id: 'first_biz', title: 'Entrepreneur', description: 'Buy your first business', emoji: '🤝', category: 'business', requirement: 1, requirementType: 'businesses_owned', gemReward: 2 },
  { id: 'five_biz', title: 'Business Mogul', description: 'Own 5 different businesses', emoji: '📊', category: 'business', requirement: 5, requirementType: 'businesses_owned', gemReward: 8 },
  { id: 'all_biz', title: 'Full Portfolio', description: 'Own all 14 businesses', emoji: '🗂️', category: 'business', requirement: 14, requirementType: 'businesses_owned', gemReward: 30 },
  { id: 'level_10', title: 'Serious Money', description: 'Reach level 10 on any business', emoji: '📈', category: 'business', requirement: 10, requirementType: 'business_level', gemReward: 10 },
  { id: 'level_50', title: 'Half Century', description: 'Reach level 50 on any business', emoji: '🔥', category: 'business', requirement: 50, requirementType: 'business_level', gemReward: 25 },
  { id: 'level_100', title: 'Century Mark', description: 'Reach level 100 on any business', emoji: '💯', category: 'business', requirement: 100, requirementType: 'business_level', gemReward: 50 },

  // IPS milestones
  { id: 'ips_100', title: 'Cash Flow', description: 'Earn $100/sec passively', emoji: '🌊', category: 'business', requirement: 100, requirementType: 'ips', gemReward: 5 },
  { id: 'ips_1m', title: 'Money River', description: 'Earn $1M/sec passively', emoji: '🏞️', category: 'business', requirement: 1_000_000, requirementType: 'ips', gemReward: 20 },
  { id: 'ips_1b', title: 'Money Ocean', description: 'Earn $1B/sec passively', emoji: '🌊', category: 'business', requirement: 1_000_000_000, requirementType: 'ips', gemReward: 50 },

  // Shop milestones
  { id: 'first_item', title: 'Treating Yourself', description: 'Buy your first luxury item', emoji: '🛍️', category: 'shop', requirement: 1, requirementType: 'items_owned', gemReward: 3 },
  { id: 'five_items', title: 'Lifestyle Upgrade', description: 'Own 5 luxury items', emoji: '✨', category: 'shop', requirement: 5, requirementType: 'items_owned', gemReward: 10 },
  { id: 'fifteen_items', title: 'Elite Status', description: 'Own 15 luxury items', emoji: '🎖️', category: 'shop', requirement: 15, requirementType: 'items_owned', gemReward: 30 },
  { id: 'all_items', title: 'Everything', description: 'Own every item in the shop', emoji: '🌟', category: 'shop', requirement: 28, requirementType: 'items_owned', gemReward: 100 },

  // Prestige milestones
  { id: 'first_prestige', title: 'Reborn', description: 'Prestige for the first time', emoji: '♻️', category: 'prestige', requirement: 1, requirementType: 'prestige_count', gemReward: 20 },
  { id: 'prestige_5', title: 'Serial Prestige', description: 'Prestige 5 times', emoji: '🔄', category: 'prestige', requirement: 5, requirementType: 'prestige_count', gemReward: 50 },
  { id: 'prestige_10', title: 'Legend', description: 'Prestige 10 times', emoji: '🌠', category: 'prestige', requirement: 10, requirementType: 'prestige_count', gemReward: 100 },

  // Tap milestones
  { id: 'tap_100', title: 'Warm Up', description: 'Tap 100 times', emoji: '☝️', category: 'money', requirement: 100, requirementType: 'tap_count', gemReward: 2 },
  { id: 'tap_1000', title: 'Dedicated', description: 'Tap 1,000 times', emoji: '✌️', category: 'money', requirement: 1_000, requirementType: 'tap_count', gemReward: 5 },
  { id: 'tap_10000', title: 'Obsessed', description: 'Tap 10,000 times', emoji: '🤌', category: 'money', requirement: 10_000, requirementType: 'tap_count', gemReward: 15 },

  // Hidden achievements
  { id: 'night_owl', title: 'Night Owl', description: 'Earn while you sleep', emoji: '🦉', category: 'money', requirement: 1, requirementType: 'ips', gemReward: 5, hidden: true },
];
