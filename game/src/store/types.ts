export interface BusinessDefinition {
  id: string;
  name: string;
  emoji: string;
  baseCost: number;
  baseIncome: number; // per second
  costMultiplier: number; // each level costs this much more
  description: string;
  unlockAt: number; // total money earned to unlock
}

export interface BusinessState {
  id: string;
  level: number;
  autoManaged: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  category: 'vehicle' | 'property' | 'status';
  cost: number;
  incomeBonus: number; // multiplier e.g. 1.05 = +5%
  description: string;
  unlockAt: number; // prestige level needed
}

export interface PrestigeTier {
  level: number;
  requiredTotalEarned: number;
  multiplierBonus: number;
  label: string;
}

export interface GameState {
  money: number;
  totalEarned: number;
  lifetimeEarned: number; // never resets
  tapValue: number;
  prestigeLevel: number;
  prestigeMultiplier: number;
  prestigeCoins: number;
  businesses: BusinessState[];
  ownedItems: string[];
  lastSaveTime: number;
  isPremium: boolean;
  boostActive: boolean;
  boostExpiry: number;

  // Actions
  tap: () => void;
  buyBusiness: (id: string) => void;
  upgradeBusiness: (id: string) => void;
  toggleAutoManage: (id: string) => void;
  buyItem: (id: string) => void;
  prestige: () => void;
  tick: (deltaMs: number) => void;
  loadSave: () => Promise<void>;
  saveGame: () => Promise<void>;
  applyOfflineIncome: (offlineMs: number) => void;
  activateBoost: () => void;
}
