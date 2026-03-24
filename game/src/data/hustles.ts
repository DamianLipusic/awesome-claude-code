export interface HustleDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  risk: 'low' | 'medium' | 'high' | 'extreme';
  successChance: number; // 0-1
  minReward: number;
  maxReward: number;
  failPenalty: number; // flat amount lost on failure
  cooldownSec: number;
  unlockAt: number; // total earned needed
  category: 'hustle' | 'crime' | 'investment';
}

export const HUSTLES: HustleDefinition[] = [
  // Low risk hustles
  {
    id: 'flip_sneakers',
    name: 'Flip Sneakers',
    emoji: '👟',
    description: 'Buy limited drops, sell for 3x online.',
    risk: 'low',
    successChance: 0.85,
    minReward: 500,
    maxReward: 5_000,
    failPenalty: 200,
    cooldownSec: 60,
    unlockAt: 0,
    category: 'hustle',
  },
  {
    id: 'sell_merch',
    name: 'Drop Merch',
    emoji: '👕',
    description: 'Design and flip streetwear online.',
    risk: 'low',
    successChance: 0.80,
    minReward: 1_000,
    maxReward: 10_000,
    failPenalty: 300,
    cooldownSec: 90,
    unlockAt: 500,
    category: 'hustle',
  },
  {
    id: 'crypto_day_trade',
    name: 'Crypto Day Trade',
    emoji: '📈',
    description: 'Buy low, sell high. What could go wrong?',
    risk: 'medium',
    successChance: 0.65,
    minReward: 5_000,
    maxReward: 50_000,
    failPenalty: 2_000,
    cooldownSec: 120,
    unlockAt: 5_000,
    category: 'hustle',
  },
  {
    id: 'poker_game',
    name: 'Underground Poker',
    emoji: '🃏',
    description: 'Run a high-stakes poker night.',
    risk: 'medium',
    successChance: 0.60,
    minReward: 10_000,
    maxReward: 100_000,
    failPenalty: 5_000,
    cooldownSec: 180,
    unlockAt: 20_000,
    category: 'crime',
  },
  {
    id: 'art_forgery',
    name: 'Art Forgery',
    emoji: '🖼️',
    description: 'Sell "authenticated" masterpieces.',
    risk: 'high',
    successChance: 0.50,
    minReward: 50_000,
    maxReward: 500_000,
    failPenalty: 25_000,
    cooldownSec: 300,
    unlockAt: 100_000,
    category: 'crime',
  },
  {
    id: 'shell_company',
    name: 'Shell Company Scam',
    emoji: '🏢',
    description: 'Complex offshore money moves.',
    risk: 'high',
    successChance: 0.55,
    minReward: 200_000,
    maxReward: 2_000_000,
    failPenalty: 100_000,
    cooldownSec: 600,
    unlockAt: 500_000,
    category: 'crime',
  },
  {
    id: 'ipo_pump',
    name: 'Pump & Dump',
    emoji: '📊',
    description: 'Hype a penny stock, exit before crash.',
    risk: 'extreme',
    successChance: 0.40,
    minReward: 1_000_000,
    maxReward: 10_000_000,
    failPenalty: 500_000,
    cooldownSec: 900,
    unlockAt: 2_000_000,
    category: 'crime',
  },
  {
    id: 'bank_heist',
    name: 'Bank Heist',
    emoji: '🏦',
    description: 'The big score. The ultimate risk.',
    risk: 'extreme',
    successChance: 0.35,
    minReward: 10_000_000,
    maxReward: 100_000_000,
    failPenalty: 5_000_000,
    cooldownSec: 1800,
    unlockAt: 10_000_000,
    category: 'crime',
  },
  {
    id: 'insider_trading',
    name: 'Insider Trading',
    emoji: '🤫',
    description: 'Your Wall Street contact has info.',
    risk: 'high',
    successChance: 0.70,
    minReward: 500_000,
    maxReward: 5_000_000,
    failPenalty: 250_000,
    cooldownSec: 1200,
    unlockAt: 1_000_000,
    category: 'investment',
  },
  {
    id: 'country_hack',
    name: 'Government Contract',
    emoji: '🕵️',
    description: 'Shady defense contracts. No questions asked.',
    risk: 'extreme',
    successChance: 0.45,
    minReward: 50_000_000,
    maxReward: 500_000_000,
    failPenalty: 25_000_000,
    cooldownSec: 3600,
    unlockAt: 100_000_000,
    category: 'crime',
  },
];

export const RISK_COLORS = {
  low: '#4ade80',
  medium: '#facc15',
  high: '#fb923c',
  extreme: '#f87171',
};

export const RISK_LABELS = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  extreme: 'EXTREME',
};
