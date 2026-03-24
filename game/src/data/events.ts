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

// Events trigger randomly, this is the schedule logic seed
export function getRandomEvent(): GameEvent {
  return GAME_EVENTS[Math.floor(Math.random() * GAME_EVENTS.length)];
}
