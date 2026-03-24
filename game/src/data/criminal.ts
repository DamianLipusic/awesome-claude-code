export interface CriminalOperation {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tier: 1 | 2 | 3 | 4; // minimum criminal level required
  successChance: number; // 0-1
  minReward: number;
  maxReward: number;
  criminalXpReward: number;
  heatGain: number;
  failPenaltyPercent: number; // fraction of street cash lost on failure
  healthDamage: number; // HP lost on failure
  federalChargeChance: number; // 0-1
  jailChance: number; // 0-1
  cooldownSec: number;
  riskLabel: 'medium' | 'high' | 'extreme' | 'lethal';
}

export const CRIMINAL_OPERATIONS: CriminalOperation[] = [
  // === TIER 1 - STREET THUG ===
  {
    id: 'street_dealing',
    name: 'Street Dealing',
    emoji: '💊',
    description: 'Move product on the corner. Watch for narcs.',
    tier: 1,
    successChance: 0.72,
    minReward: 50_000,
    maxReward: 300_000,
    criminalXpReward: 1,
    heatGain: 8,
    failPenaltyPercent: 0.10,
    healthDamage: 0,
    federalChargeChance: 0.05,
    jailChance: 0.20,
    cooldownSec: 300,
    riskLabel: 'medium',
  },
  {
    id: 'car_jacking',
    name: 'Grand Theft Auto',
    emoji: '🚗',
    description: 'Boost luxury rides for the chop shop. Fast in, fast out.',
    tier: 1,
    successChance: 0.68,
    minReward: 100_000,
    maxReward: 600_000,
    criminalXpReward: 1,
    heatGain: 12,
    failPenaltyPercent: 0.08,
    healthDamage: 15,
    federalChargeChance: 0.08,
    jailChance: 0.25,
    cooldownSec: 600,
    riskLabel: 'high',
  },
  {
    id: 'protection_racket',
    name: 'Protection Racket',
    emoji: '🔨',
    description: 'Business owners pay you for "protection". Monthly visits required.',
    tier: 1,
    successChance: 0.78,
    minReward: 150_000,
    maxReward: 1_000_000,
    criminalXpReward: 2,
    heatGain: 10,
    failPenaltyPercent: 0.12,
    healthDamage: 20,
    federalChargeChance: 0.10,
    jailChance: 0.15,
    cooldownSec: 900,
    riskLabel: 'high',
  },

  // === TIER 2 - CAREER CRIMINAL ===
  {
    id: 'drug_distribution',
    name: 'Drug Distribution Network',
    emoji: '📦',
    description: 'Supply the whole city. Big shipment, massive risk.',
    tier: 2,
    successChance: 0.62,
    minReward: 800_000,
    maxReward: 8_000_000,
    criminalXpReward: 4,
    heatGain: 22,
    failPenaltyPercent: 0.20,
    healthDamage: 0,
    federalChargeChance: 0.18,
    jailChance: 0.35,
    cooldownSec: 1800,
    riskLabel: 'extreme',
  },
  {
    id: 'money_laundering',
    name: 'Money Laundering',
    emoji: '🏦',
    description: 'Clean dirty money through offshore shells. Complex but lucrative.',
    tier: 2,
    successChance: 0.68,
    minReward: 2_000_000,
    maxReward: 15_000_000,
    criminalXpReward: 4,
    heatGain: 16,
    failPenaltyPercent: 0.35,
    healthDamage: 0,
    federalChargeChance: 0.28,
    jailChance: 0.28,
    cooldownSec: 3600,
    riskLabel: 'extreme',
  },
  {
    id: 'robbery_crew',
    name: 'Armed Robbery Crew',
    emoji: '🔫',
    description: 'Lead a crew of armed robbers. Your people don\'t always come back.',
    tier: 2,
    successChance: 0.52,
    minReward: 3_000_000,
    maxReward: 25_000_000,
    criminalXpReward: 6,
    heatGain: 32,
    failPenaltyPercent: 0.18,
    healthDamage: 35,
    federalChargeChance: 0.32,
    jailChance: 0.42,
    cooldownSec: 7200,
    riskLabel: 'extreme',
  },

  // === TIER 3 - CRIME BOSS ===
  {
    id: 'cartel_contract',
    name: 'Cartel Supply Contract',
    emoji: '🐊',
    description: 'Supply the Mexican cartel. Massive money. Fail and they collect — in blood.',
    tier: 3,
    successChance: 0.52,
    minReward: 15_000_000,
    maxReward: 150_000_000,
    criminalXpReward: 10,
    heatGain: 42,
    failPenaltyPercent: 0.50,
    healthDamage: 45,
    federalChargeChance: 0.22,
    jailChance: 0.18,
    cooldownSec: 14400,
    riskLabel: 'lethal',
  },
  {
    id: 'arms_deal',
    name: 'International Arms Deal',
    emoji: '💣',
    description: 'Black market weapons to the highest bidder. Interpol is watching.',
    tier: 3,
    successChance: 0.48,
    minReward: 30_000_000,
    maxReward: 300_000_000,
    criminalXpReward: 12,
    heatGain: 48,
    failPenaltyPercent: 0.42,
    healthDamage: 0,
    federalChargeChance: 0.45,
    jailChance: 0.25,
    cooldownSec: 28800,
    riskLabel: 'lethal',
  },
  {
    id: 'witness_elimination',
    name: 'Silence the Witness',
    emoji: '🎯',
    description: 'A witness can put you away for life. You know what must be done.',
    tier: 3,
    successChance: 0.58,
    minReward: 20_000_000,
    maxReward: 100_000_000,
    criminalXpReward: 8,
    heatGain: 55,
    failPenaltyPercent: 0.25,
    healthDamage: 50,
    federalChargeChance: 0.60,
    jailChance: 0.30,
    cooldownSec: 21600,
    riskLabel: 'lethal',
  },

  // === TIER 4 - GODFATHER ===
  {
    id: 'state_corruption',
    name: 'State Corruption Network',
    emoji: '🏛️',
    description: 'Own the politicians. Own the judges. Own the city. CIA is watching.',
    tier: 4,
    successChance: 0.44,
    minReward: 200_000_000,
    maxReward: 2_000_000_000,
    criminalXpReward: 25,
    heatGain: 65,
    failPenaltyPercent: 0.60,
    healthDamage: 0,
    federalChargeChance: 0.55,
    jailChance: 0.08,
    cooldownSec: 86400,
    riskLabel: 'lethal',
  },
  {
    id: 'ultimate_heist',
    name: '☠️ THE IMPOSSIBLE HEIST',
    emoji: '💀',
    description: 'The Federal Reserve. Your magnum opus. 38% chance. ALL or nothing.',
    tier: 4,
    successChance: 0.38,
    minReward: 1_000_000_000,
    maxReward: 20_000_000_000,
    criminalXpReward: 50,
    heatGain: 100,
    failPenaltyPercent: 0.80,
    healthDamage: 65,
    federalChargeChance: 0.75,
    jailChance: 0.55,
    cooldownSec: 86400 * 3,
    riskLabel: 'lethal',
  },
];

export const CRIMINAL_LEVELS = [
  { level: 0, title: 'Civilian', xpRequired: 0, color: '#888' },
  { level: 1, title: 'Street Thug', xpRequired: 0, color: '#fb923c' },
  { level: 2, title: 'Career Criminal', xpRequired: 10, color: '#f87171' },
  { level: 3, title: 'Crime Boss', xpRequired: 50, color: '#c084fc' },
  { level: 4, title: '★ GODFATHER', xpRequired: 200, color: '#FFD700' },
];

export const CRIMINAL_LEVEL_XP = [0, 0, 10, 50, 200];

export const LEGACY_UPGRADES = [
  {
    id: 'legacy_ghost_protocol',
    name: 'Ghost Protocol',
    emoji: '👻',
    cost: 5,
    description: 'Criminal ops generate 25% less heat. Permanent.',
  },
  {
    id: 'legacy_street_medic',
    name: 'Street Medic',
    emoji: '💉',
    cost: 4,
    description: 'Start each run with 120 HP instead of 100.',
  },
  {
    id: 'legacy_blood_money',
    name: 'Blood Money',
    emoji: '💸',
    cost: 8,
    description: 'Keep 8% of your banked money when you die.',
  },
  {
    id: 'legacy_connections',
    name: 'Connections',
    emoji: '🤝',
    cost: 6,
    description: 'Jail sentences are 50% shorter. Lawyers on speed dial.',
  },
  {
    id: 'legacy_ghost_income',
    name: 'Ghost Income',
    emoji: '📈',
    cost: 10,
    description: '+15% passive income multiplier every new run.',
  },
  {
    id: 'legacy_iron_will',
    name: 'Iron Will',
    emoji: '🛡️',
    cost: 20,
    description: 'Survive one fatal hit per run. One time only.',
    maxPurchases: 1,
  },
  {
    id: 'legacy_clean_slate',
    name: 'Clean Slate',
    emoji: '📋',
    cost: 15,
    description: 'Start with no heat and federal charges never accumulate faster.',
  },
];

export const RISK_COLORS_CRIMINAL = {
  medium: '#facc15',
  high: '#fb923c',
  extreme: '#f87171',
  lethal: '#dc2626',
};

export const RISK_LABELS_CRIMINAL = {
  medium: 'Medium',
  high: 'High',
  extreme: 'EXTREME',
  lethal: '☠️ LETHAL',
};
