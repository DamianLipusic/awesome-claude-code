export interface BusinessDefinition {
  id: string;
  name: string;
  emoji: string;
  baseCost: number;
  baseIncome: number;
  costMultiplier: number;
  description: string;
  unlockAt: number;
  milestones: number[];
}

export interface BusinessState {
  id: string;
  level: number;
  autoManaged: boolean;
  upgradeMultiplier: number; // accumulated from purchased upgrades
}

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  category: 'vehicle' | 'property' | 'status' | 'experience';
  cost: number;
  incomeBonus: number;
  tapBonus: number;
  description: string;
  unlockAt: number;
  tier: number;
}

export interface PrestigeTier {
  level: number;
  requiredTotalEarned: number;
  multiplierBonus: number;
  label: string;
}

export interface StockHolding {
  shares: number;
  avgBuyPrice: number;
}

export interface ActiveMission {
  templateId: string;
  targetIndex: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface ActiveEvent {
  eventId: string;
  startTime: number;
  endTime: number;
}

export interface HustleResult {
  hustleId: string;
  success: boolean;
  reward: number;
  timestamp: number;
}

export interface GameState {
  // Economy
  money: number;
  totalEarned: number;
  lifetimeEarned: number;
  tapValue: number;
  tapCount: number;

  // Prestige
  prestigeLevel: number;
  prestigeMultiplier: number;
  prestigeCoins: number;

  // Businesses
  businesses: BusinessState[];
  purchasedUpgrades: string[];

  // Shop
  ownedItems: string[];

  // Stocks
  stockPrices: Record<string, number>;
  stockHoldings: Record<string, StockHolding>;
  stockInitialized: boolean;

  // Hustles
  hustleCooldowns: Record<string, number>; // expiry timestamp
  hustleHistory: HustleResult[];

  // Missions
  dailyMissions: ActiveMission[];
  weeklyMission: ActiveMission | null;
  lastMissionReset: number;

  // Achievements
  unlockedAchievements: string[];

  // Season Pass
  gems: number;
  seasonXp: number;
  seasonPassPurchased: boolean;
  seasonPassClaimedTiers: number[];

  // Events
  activeEvent: ActiveEvent | null;
  lastEventCheck: number;

  // Boosts
  boostActive: boolean;
  boostMultiplier: number;
  boostExpiry: number;

  // Meta
  lastSaveTime: number;
  isPremium: boolean;

  // Actions
  tap: () => void;
  buyBusiness: (id: string) => void;
  toggleAutoManage: (id: string) => void;
  purchaseUpgrade: (upgradeId: string) => void;
  buyItem: (id: string) => void;
  prestige: () => void;
  tick: (deltaMs: number) => void;
  loadSave: () => Promise<void>;
  saveGame: () => Promise<void>;
  applyOfflineIncome: (offlineMs: number) => number;
  activateBoost: (multiplier: number, durationMs: number) => void;

  // Stocks
  buyStock: (stockId: string, shares: number) => void;
  sellStock: (stockId: string, shares: number) => void;
  tickStocks: () => void;

  // Hustles
  attemptHustle: (hustleId: string) => HustleResult;

  // Missions
  updateMissionProgress: (type: string, amount: number) => void;
  claimMission: (templateId: string) => void;
  resetDailyMissions: () => void;

  // Gems & Season Pass
  purchaseGemPack: (packId: string) => void;
  purchaseSeasonPass: () => void;
  claimSeasonTier: (level: number, premium: boolean) => void;
  spendGems: (amount: number, itemId: string) => void;

  // Achievements
  checkAchievements: () => void;

  // Events
  triggerRandomEvent: () => void;
}
