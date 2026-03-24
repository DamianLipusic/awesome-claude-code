import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState, BusinessState } from './types';
import { BUSINESSES } from '../data/businesses';
import { SHOP_ITEMS } from '../data/shopItems';
import {
  getBusinessCost,
  getManualIncome,
  getTotalIncomePerSecond,
  getPrestigeMultiplier,
} from '../utils/gameLogic';
import { calculateOfflineIncome } from '../utils/offlineIncome';

const SAVE_KEY = 'cash_empire_save_v1';

const initialBusinesses: BusinessState[] = BUSINESSES.map(b => ({
  id: b.id,
  level: 0,
  autoManaged: false,
}));

interface SaveData {
  money: number;
  totalEarned: number;
  lifetimeEarned: number;
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
}

export const useGameStore = create<GameState>()((set, get) => ({
  money: 0,
  totalEarned: 0,
  lifetimeEarned: 0,
  tapValue: 1,
  prestigeLevel: 0,
  prestigeMultiplier: 1,
  prestigeCoins: 0,
  businesses: initialBusinesses,
  ownedItems: [],
  lastSaveTime: Date.now(),
  isPremium: false,
  boostActive: false,
  boostExpiry: 0,

  tap: () => {
    const s = get();
    const earned = getManualIncome(s.tapValue, s.ownedItems, s.prestigeMultiplier, s.boostActive);
    set(state => ({
      money: state.money + earned,
      totalEarned: state.totalEarned + earned,
      lifetimeEarned: state.lifetimeEarned + earned,
    }));
  },

  buyBusiness: (id: string) => {
    const s = get();
    const biz = s.businesses.find(b => b.id === id);
    if (!biz) return;
    const cost = getBusinessCost(id, biz.level);
    if (s.money < cost) return;
    set(state => ({
      money: state.money - cost,
      businesses: state.businesses.map(b =>
        b.id === id ? { ...b, level: b.level + 1 } : b
      ),
    }));
    get().saveGame();
  },

  upgradeBusiness: (id: string) => {
    get().buyBusiness(id);
  },

  toggleAutoManage: (id: string) => {
    set(state => ({
      businesses: state.businesses.map(b =>
        b.id === id ? { ...b, autoManaged: !b.autoManaged } : b
      ),
    }));
    get().saveGame();
  },

  buyItem: (id: string) => {
    const s = get();
    if (s.ownedItems.includes(id)) return;
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (!item) return;
    if (s.money < item.cost) return;
    if (item.unlockAt > s.prestigeLevel) return;
    set(state => ({
      money: state.money - item.cost,
      ownedItems: [...state.ownedItems, id],
    }));
    get().saveGame();
  },

  prestige: () => {
    const s = get();
    if (s.totalEarned < 1_000_000_000) return;
    const newPrestigeLevel = s.prestigeLevel + 1;
    const newMultiplier = getPrestigeMultiplier(newPrestigeLevel);
    const coinsEarned = Math.floor(Math.log10(s.totalEarned / 1_000_000_000) + 1);

    set({
      money: 0,
      totalEarned: 0,
      tapValue: 1,
      prestigeLevel: newPrestigeLevel,
      prestigeMultiplier: newMultiplier,
      prestigeCoins: s.prestigeCoins + coinsEarned,
      businesses: initialBusinesses,
      ownedItems: [],
      boostActive: false,
      boostExpiry: 0,
    });
    get().saveGame();
  },

  tick: (deltaMs: number) => {
    const s = get();
    const now = Date.now();
    const boostActive = s.boostActive && now < s.boostExpiry;
    if (s.boostActive && !boostActive) {
      set({ boostActive: false });
    }

    const ips = getTotalIncomePerSecond(
      s.businesses, s.ownedItems, s.prestigeMultiplier, boostActive, s.isPremium
    );
    const earned = ips * (deltaMs / 1000);
    if (earned > 0) {
      set(state => ({
        money: state.money + earned,
        totalEarned: state.totalEarned + earned,
        lifetimeEarned: state.lifetimeEarned + earned,
      }));
    }
  },

  applyOfflineIncome: (offlineMs: number) => {
    const s = get();
    const earned = calculateOfflineIncome(
      s.businesses, s.ownedItems, s.prestigeMultiplier, s.isPremium, offlineMs
    );
    if (earned > 0) {
      set(state => ({
        money: state.money + earned,
        totalEarned: state.totalEarned + earned,
        lifetimeEarned: state.lifetimeEarned + earned,
      }));
    }
    return earned;
  },

  activateBoost: () => {
    set({
      boostActive: true,
      boostExpiry: Date.now() + 30 * 60 * 1000, // 30 minutes
    });
    get().saveGame();
  },

  saveGame: async () => {
    const s = get();
    const saveData: SaveData = {
      money: s.money,
      totalEarned: s.totalEarned,
      lifetimeEarned: s.lifetimeEarned,
      tapValue: s.tapValue,
      prestigeLevel: s.prestigeLevel,
      prestigeMultiplier: s.prestigeMultiplier,
      prestigeCoins: s.prestigeCoins,
      businesses: s.businesses,
      ownedItems: s.ownedItems,
      lastSaveTime: Date.now(),
      isPremium: s.isPremium,
      boostActive: s.boostActive,
      boostExpiry: s.boostExpiry,
    };
    try {
      await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch {
      // save failed silently
    }
  },

  loadSave: async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data: SaveData = JSON.parse(raw);
      const offlineMs = Date.now() - (data.lastSaveTime || Date.now());

      set({
        money: data.money ?? 0,
        totalEarned: data.totalEarned ?? 0,
        lifetimeEarned: data.lifetimeEarned ?? 0,
        tapValue: data.tapValue ?? 1,
        prestigeLevel: data.prestigeLevel ?? 0,
        prestigeMultiplier: data.prestigeMultiplier ?? 1,
        prestigeCoins: data.prestigeCoins ?? 0,
        businesses: data.businesses ?? initialBusinesses,
        ownedItems: data.ownedItems ?? [],
        lastSaveTime: data.lastSaveTime ?? Date.now(),
        isPremium: data.isPremium ?? false,
        boostActive: data.boostActive ?? false,
        boostExpiry: data.boostExpiry ?? 0,
      });

      if (offlineMs > 5000) {
        get().applyOfflineIncome(offlineMs);
      }
    } catch {
      // load failed, start fresh
    }
  },
}));
