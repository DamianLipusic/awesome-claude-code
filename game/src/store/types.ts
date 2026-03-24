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
  upgradeMultiplier: number;
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

export interface ActiveLoan {
  id: string;
  principal: number;
  totalOwed: number;
  borrowedAt: number;
  dueAt: number;
}

export interface DeathRecord {
  runNumber: number;
  cause: string;
  moneyAtDeath: number;
  lifetimeEarned: number;
  criminalLevel: number;
  ghostPointsEarned: number;
  timestamp: number;
}

export interface NegativeEventNotification {
  id: string;
  title: string;
  description: string;
  emoji: string;
  timestamp: number;
}

export interface CriminalOpResult {
  success: boolean;
  reward: number;
  message: string;
  jailed?: boolean;
  charged?: boolean;
  healthDamage?: number;
}

export interface GameState {
  // Economy - street cash (unbanked, at risk)
  money: number;
  bankedMoney: number; // secured in vault, safe from raids
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
  businessConditions: Record<string, number>; // 0-100 health per business
  lastConditionDecay: number;

  // Shop
  ownedItems: string[];

  // Stocks
  stockPrices: Record<string, number>;
  stockHoldings: Record<string, StockHolding>;
  stockInitialized: boolean;

  // Hustles
  hustleCooldowns: Record<string, number>;
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

  // Positive Events
  activeEvent: ActiveEvent | null;
  lastEventCheck: number;

  // Negative Events
  lastNegativeCheck: number;
  activeNegativeNotification: NegativeEventNotification | null;

  // Boosts
  boostActive: boolean;
  boostMultiplier: number;
  boostExpiry: number;

  // ===== HARDCORE SYSTEMS =====

  // Criminal Path
  criminalPathChosen: boolean;
  isCriminal: boolean;
  criminalLevel: number; // 0-4
  criminalXp: number;
  criminalOpsLockedUntil: number;

  // Heat / Wanted Level
  heatLevel: number; // 0-100
  lastHeatDecay: number;

  // Health
  health: number; // 0-100 (0 = permadeath)
  isHospitalized: boolean;
  hospitalReleaseTime: number;

  // Jail
  inJail: boolean;
  jailReleaseTime: number;
  jailSentences: number; // accumulated arrests
  federalCharges: number; // 0-3, at 3 = life sentence = permadeath

  // Loan Shark
  activeLoans: ActiveLoan[];

  // FBI Investigation modifier
  federalInvestigationExpiry: number;

  // Permadeath / Legacy
  isDeceased: boolean;
  deathCause: string;
  runNumber: number;
  totalDeaths: number;
  deathRecords: DeathRecord[];
  ghostPoints: number;
  legacyUpgrades: string[];

  // Meta
  lastSaveTime: number;
  isPremium: boolean;

  // ===== ACTIONS =====
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

  // Criminal Operations
  chooseCriminalPath: (accept: boolean) => void;
  attemptCriminalOp: (opId: string) => CriminalOpResult;

  // Banking
  bankMoney: (amount: number) => void;
  withdrawMoney: (amount: number) => void;

  // Loans
  takeLoan: (amount: number) => void;
  repayLoan: (loanId: string) => void;

  // Business repair
  repairBusiness: (businessId: string) => void;

  // Heat
  reduceHeat: (amount: number) => void;

  // Hospital
  payHospital: () => void;

  // Permadeath
  triggerPermadeath: (cause: string) => void;
  startNewRun: () => void;
  purchaseLegacyUpgrade: (upgradeId: string) => void;

  // Negative events
  dismissNegativeNotification: () => void;
  applyNegativeEvent: (eventId: string) => void;

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
