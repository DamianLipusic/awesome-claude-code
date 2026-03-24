export type MissionType =
  | 'earn_money'
  | 'tap_count'
  | 'buy_business'
  | 'buy_item'
  | 'upgrade_business'
  | 'earn_passive'
  | 'reach_ips';

export interface MissionTemplate {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  emoji: string;
  targets: number[]; // progressive targets for each "rotation"
  gemReward: number;
  xpReward: number;
}

export interface ActiveMission {
  templateId: string;
  targetIndex: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

// Daily missions (3 random ones per day)
export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: 'earn_daily',
    type: 'earn_money',
    title: 'Grind Session',
    description: 'Earn ${target} today',
    emoji: '💵',
    targets: [1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000],
    gemReward: 5,
    xpReward: 50,
  },
  {
    id: 'tap_daily',
    type: 'tap_count',
    title: 'Hustle Hard',
    description: 'Tap {target} times',
    emoji: '👆',
    targets: [50, 100, 200, 500, 1000],
    gemReward: 3,
    xpReward: 30,
  },
  {
    id: 'buy_biz_daily',
    type: 'buy_business',
    title: 'Empire Builder',
    description: 'Buy/upgrade {target} businesses',
    emoji: '🏢',
    targets: [3, 5, 10, 20, 30],
    gemReward: 4,
    xpReward: 40,
  },
  {
    id: 'buy_item_daily',
    type: 'buy_item',
    title: 'Baller',
    description: 'Buy {target} luxury items',
    emoji: '💎',
    targets: [1, 2, 3, 5],
    gemReward: 6,
    xpReward: 60,
  },
  {
    id: 'passive_daily',
    type: 'earn_passive',
    title: 'Passive King',
    description: 'Earn ${target} from passive income',
    emoji: '😴',
    targets: [500, 5_000, 50_000, 500_000, 5_000_000],
    gemReward: 5,
    xpReward: 50,
  },
  {
    id: 'reach_ips',
    type: 'reach_ips',
    title: 'Money Machine',
    description: 'Reach ${target}/sec income',
    emoji: '⚡',
    targets: [10, 100, 1_000, 10_000, 100_000, 1_000_000],
    gemReward: 8,
    xpReward: 80,
  },
  {
    id: 'upgrade_daily',
    type: 'upgrade_business',
    title: 'Level Up',
    description: 'Upgrade businesses {target} times',
    emoji: '📈',
    targets: [5, 10, 25, 50, 100],
    gemReward: 5,
    xpReward: 50,
  },
];

// Weekly challenge (bigger rewards)
export const WEEKLY_CHALLENGES: MissionTemplate[] = [
  {
    id: 'weekly_earn',
    type: 'earn_money',
    title: 'Weekly Hustle',
    description: 'Earn ${target} this week',
    emoji: '🏆',
    targets: [1_000_000, 100_000_000, 10_000_000_000, 1_000_000_000_000],
    gemReward: 50,
    xpReward: 500,
  },
  {
    id: 'weekly_tap',
    type: 'tap_count',
    title: 'Grind Week',
    description: 'Tap {target} times this week',
    emoji: '💪',
    targets: [500, 1000, 2500, 5000],
    gemReward: 30,
    xpReward: 300,
  },
];
