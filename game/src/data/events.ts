export interface GameEvent {
  id: string;
  title: string;
  description: string;
  emoji: string;
  type: 'income_boost' | 'tap_boost' | 'double_everything' | 'business_sale' | 'gem_bonus';
  multiplier: number;
  durationHours: number;
  color: string;
  backgroundColor: string;
}

export const GAME_EVENTS: GameEvent[] = [
  {
    id: 'rush_hour',
    title: 'RUSH HOUR',
    description: 'All businesses are slammed! 3× income for 2 hours!',
    emoji: '⚡',
    type: 'income_boost',
    multiplier: 3,
    durationHours: 2,
    color: '#FFD700',
    backgroundColor: '#1a1500',
  },
  {
    id: 'bull_market',
    title: 'BULL MARKET',
    description: 'Markets are surging! 5× tap value for 1 hour!',
    emoji: '🐂',
    type: 'tap_boost',
    multiplier: 5,
    durationHours: 1,
    color: '#4ade80',
    backgroundColor: '#0a1a0f',
  },
  {
    id: 'double_down',
    title: 'DOUBLE DOWN',
    description: 'EVERYTHING is 2× for 3 hours! Do not sleep.',
    emoji: '2️⃣',
    type: 'double_everything',
    multiplier: 2,
    durationHours: 3,
    color: '#a855f7',
    backgroundColor: '#14001a',
  },
  {
    id: 'black_friday',
    title: 'BLACK FRIDAY',
    description: 'All businesses cost 50% less for 4 hours!',
    emoji: '🛒',
    type: 'business_sale',
    multiplier: 0.5,
    durationHours: 4,
    color: '#f97316',
    backgroundColor: '#1a0a00',
  },
  {
    id: 'gem_rush',
    title: 'GEM RUSH',
    description: 'All missions reward 3× gems for 2 hours!',
    emoji: '💎',
    type: 'gem_bonus',
    multiplier: 3,
    durationHours: 2,
    color: '#38bdf8',
    backgroundColor: '#001a1a',
  },
];

export function getRandomEvent(): GameEvent {
  return GAME_EVENTS[Math.floor(Math.random() * GAME_EVENTS.length)];
}

// ===== NEGATIVE / HARDCORE EVENTS =====

export type NegativeEventType =
  | 'police_raid'
  | 'rival_attack'
  | 'shot'
  | 'market_crash'
  | 'cartel_squeeze'
  | 'federal_investigation'
  | 'arson'
  | 'informant';

export interface NegativeEvent {
  id: string;
  title: string;
  description: string;
  emoji: string;
  type: NegativeEventType;
  color: string;
  minHeat: number;
  criminalOnly: boolean;
  probabilityPerMinute: number; // base chance per minute at minimum heat
}

export const NEGATIVE_EVENTS: NegativeEvent[] = [
  {
    id: 'police_raid',
    title: '🚨 POLICE RAID',
    description: 'SWAT hits your operation. All street cash seized.',
    emoji: '🚔',
    type: 'police_raid',
    color: '#ef4444',
    minHeat: 35,
    criminalOnly: false,
    probabilityPerMinute: 0.009,
  },
  {
    id: 'rival_attack',
    title: '💀 RIVAL HIT',
    description: 'A rival crew attacks one of your businesses.',
    emoji: '🔫',
    type: 'rival_attack',
    color: '#dc2626',
    minHeat: 25,
    criminalOnly: true,
    probabilityPerMinute: 0.007,
  },
  {
    id: 'shot_wounded',
    title: '🩸 AMBUSH',
    description: 'You walked into a trap. You survived... barely.',
    emoji: '💉',
    type: 'shot',
    color: '#dc2626',
    minHeat: 45,
    criminalOnly: true,
    probabilityPerMinute: 0.005,
  },
  {
    id: 'market_crash',
    title: '📉 BLACK MONDAY',
    description: 'Global market crash. All stocks plunge 80%.',
    emoji: '📉',
    type: 'market_crash',
    color: '#f97316',
    minHeat: 0,
    criminalOnly: false,
    probabilityPerMinute: 0.0015,
  },
  {
    id: 'cartel_squeeze',
    title: '🐊 CARTEL DEMANDS',
    description: 'The cartel wants 30% of your street cash. Pay up.',
    emoji: '🐊',
    type: 'cartel_squeeze',
    color: '#a855f7',
    minHeat: 55,
    criminalOnly: true,
    probabilityPerMinute: 0.006,
  },
  {
    id: 'federal_investigation',
    title: '🕵️ FBI INVESTIGATION',
    description: 'Feds opened a case. +1 Federal Charge. Income -50% for 24h.',
    emoji: '🏛️',
    type: 'federal_investigation',
    color: '#3b82f6',
    minHeat: 65,
    criminalOnly: true,
    probabilityPerMinute: 0.004,
  },
  {
    id: 'arson',
    title: '🔥 ARSON',
    description: 'A rival torched one of your businesses. It\'s gone.',
    emoji: '🔥',
    type: 'arson',
    color: '#f97316',
    minHeat: 30,
    criminalOnly: true,
    probabilityPerMinute: 0.005,
  },
  {
    id: 'informant',
    title: '🐀 INFORMANT',
    description: 'Someone talked. Criminal ops locked for 12 hours.',
    emoji: '🐀',
    type: 'informant',
    color: '#eab308',
    minHeat: 40,
    criminalOnly: true,
    probabilityPerMinute: 0.006,
  },
];
