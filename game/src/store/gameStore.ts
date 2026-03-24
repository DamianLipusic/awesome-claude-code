import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState, BusinessState, ActiveMission, HustleResult } from './types';
import { BUSINESSES } from '../data/businesses';
import { SHOP_ITEMS } from '../data/shopItems';
import { BUSINESS_UPGRADES, GLOBAL_UPGRADES } from '../data/upgrades';
import { STOCKS } from '../data/stocks';
import { HUSTLES } from '../data/hustles';
import { MISSION_TEMPLATES, WEEKLY_CHALLENGES } from '../data/missions';
import { ACHIEVEMENTS } from '../data/achievements';
import { GAME_EVENTS, getRandomEvent } from '../data/events';
import { GEM_PACKS, GEM_SHOP_ITEMS } from '../data/seasonPass';
import {
  getBusinessCost,
  getBusinessIncome,
  getTotalIncomePerSecond,
  getManualIncome,
  getPrestigeMultiplier,
  getMilestoneMultiplier,
} from '../utils/gameLogic';
import { calculateOfflineIncome } from '../utils/offlineIncome';

const SAVE_KEY = 'cash_empire_save_v2';

const initialBusinesses: BusinessState[] = BUSINESSES.map(b => ({
  id: b.id,
  level: 0,
  autoManaged: false,
  upgradeMultiplier: 1,
}));

function initStockPrices(): Record<string, number> {
  const prices: Record<string, number> = {};
  STOCKS.forEach(s => { prices[s.id] = s.basePrice; });
  return prices;
}

function pickDailyMissions(): ActiveMission[] {
  const shuffled = [...MISSION_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(t => ({
    templateId: t.id,
    targetIndex: 0,
    progress: 0,
    completed: false,
    claimed: false,
  }));
}

function pickWeeklyMission(): ActiveMission {
  const t = WEEKLY_CHALLENGES[Math.floor(Math.random() * WEEKLY_CHALLENGES.length)];
  return { templateId: t.id, targetIndex: 0, progress: 0, completed: false, claimed: false };
}

export const useGameStore = create<GameState>()((set, get) => ({
  money: 0,
  totalEarned: 0,
  lifetimeEarned: 0,
  tapValue: 1,
  tapCount: 0,
  prestigeLevel: 0,
  prestigeMultiplier: 1,
  prestigeCoins: 0,
  businesses: initialBusinesses,
  purchasedUpgrades: [],
  ownedItems: [],
  stockPrices: initStockPrices(),
  stockHoldings: {},
  stockInitialized: true,
  hustleCooldowns: {},
  hustleHistory: [],
  dailyMissions: pickDailyMissions(),
  weeklyMission: pickWeeklyMission(),
  lastMissionReset: Date.now(),
  unlockedAchievements: [],
  gems: 50, // starter gems
  seasonXp: 0,
  seasonPassPurchased: false,
  seasonPassClaimedTiers: [],
  activeEvent: null,
  lastEventCheck: Date.now(),
  boostActive: false,
  boostMultiplier: 1,
  boostExpiry: 0,
  lastSaveTime: Date.now(),
  isPremium: false,

  tap: () => {
    const s = get();
    const boostMult = s.boostActive && Date.now() < s.boostExpiry ? s.boostMultiplier : 1;
    const eventMult = s.activeEvent && Date.now() < s.activeEvent.endTime && GAME_EVENTS.find(e => e.id === s.activeEvent!.eventId)?.type === 'tap_boost'
      ? GAME_EVENTS.find(e => e.id === s.activeEvent!.eventId)!.multiplier : 1;
    const earned = getManualIncome(s.tapValue, s.ownedItems, s.prestigeMultiplier, boostMult * eventMult);

    set(state => ({
      money: state.money + earned,
      totalEarned: state.totalEarned + earned,
      lifetimeEarned: state.lifetimeEarned + earned,
      tapCount: state.tapCount + 1,
    }));

    get().updateMissionProgress('tap_count', 1);
    get().updateMissionProgress('earn_money', earned);
  },

  buyBusiness: (id: string) => {
    const s = get();
    const biz = s.businesses.find(b => b.id === id);
    if (!biz) return;
    const eventSale = s.activeEvent && Date.now() < s.activeEvent.endTime && GAME_EVENTS.find(e => e.id === s.activeEvent!.eventId)?.type === 'business_sale';
    const discount = eventSale ? GAME_EVENTS.find(e => e.id === s.activeEvent!.eventId)!.multiplier : 1;
    const cost = Math.floor(getBusinessCost(id, biz.level) * discount);
    if (s.money < cost) return;

    set(state => ({
      money: state.money - cost,
      businesses: state.businesses.map(b =>
        b.id === id ? { ...b, level: b.level + 1 } : b
      ),
    }));

    get().updateMissionProgress('buy_business', 1);
    get().updateMissionProgress('upgrade_business', 1);
    get().checkAchievements();
    get().saveGame();
  },

  toggleAutoManage: (id: string) => {
    set(state => ({
      businesses: state.businesses.map(b =>
        b.id === id ? { ...b, autoManaged: !b.autoManaged } : b
      ),
    }));
    get().saveGame();
  },

  purchaseUpgrade: (upgradeId: string) => {
    const s = get();
    if (s.purchasedUpgrades.includes(upgradeId)) return;

    const bizUpgrade = BUSINESS_UPGRADES.find(u => u.id === upgradeId);
    const globalUpgrade = GLOBAL_UPGRADES.find(u => u.id === upgradeId);
    const upgrade = bizUpgrade || globalUpgrade;
    if (!upgrade || s.money < upgrade.cost) return;

    set(state => {
      const newUpgrades = [...state.purchasedUpgrades, upgradeId];
      let newBusinesses = state.businesses;
      let newTapValue = state.tapValue;

      if (bizUpgrade) {
        newBusinesses = state.businesses.map(b =>
          b.id === bizUpgrade.businessId
            ? { ...b, upgradeMultiplier: b.upgradeMultiplier * bizUpgrade.multiplier }
            : b
        );
      }
      if (globalUpgrade && globalUpgrade.type === 'tap_multiplier') {
        newTapValue = state.tapValue * globalUpgrade.value;
      }

      return {
        money: state.money - upgrade.cost,
        purchasedUpgrades: newUpgrades,
        businesses: newBusinesses,
        tapValue: newTapValue,
      };
    });

    get().updateMissionProgress('upgrade_business', 1);
    get().saveGame();
  },

  buyItem: (id: string) => {
    const s = get();
    if (s.ownedItems.includes(id)) return;
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (!item || s.money < item.cost || item.unlockAt > s.prestigeLevel) return;

    set(state => ({
      money: state.money - item.cost,
      ownedItems: [...state.ownedItems, id],
      tapValue: state.tapValue * item.tapBonus,
    }));

    get().updateMissionProgress('buy_item', 1);
    get().checkAchievements();
    get().saveGame();
  },

  prestige: () => {
    const s = get();
    if (s.totalEarned < 1_000_000_000) return;
    const newPrestigeLevel = s.prestigeLevel + 1;
    const newMultiplier = getPrestigeMultiplier(newPrestigeLevel);
    const coinsEarned = Math.max(1, Math.floor(Math.log10(s.totalEarned / 1_000_000_000) + 1));

    set({
      money: 0,
      totalEarned: 0,
      tapValue: 1,
      tapCount: s.tapCount,
      prestigeLevel: newPrestigeLevel,
      prestigeMultiplier: newMultiplier,
      prestigeCoins: s.prestigeCoins + coinsEarned,
      businesses: initialBusinesses,
      purchasedUpgrades: [],
      ownedItems: [],
      boostActive: false,
      boostExpiry: 0,
      boostMultiplier: 1,
    });

    get().checkAchievements();
    get().saveGame();
  },

  tick: (deltaMs: number) => {
    const s = get();
    const now = Date.now();
    const boostActive = s.boostActive && now < s.boostExpiry;
    if (s.boostActive && !boostActive) {
      set({ boostActive: false });
    }

    const eventMultiplier = (() => {
      if (!s.activeEvent || now >= s.activeEvent.endTime) return 1;
      const ev = GAME_EVENTS.find(e => e.id === s.activeEvent!.eventId);
      if (!ev) return 1;
      if (ev.type === 'income_boost' || ev.type === 'double_everything') return ev.multiplier;
      return 1;
    })();

    const boostMult = boostActive ? s.boostMultiplier : 1;
    const ips = getTotalIncomePerSecond(
      s.businesses, s.ownedItems, s.prestigeMultiplier, boostMult * eventMultiplier, s.isPremium
    );
    const earned = ips * (deltaMs / 1000);

    if (earned > 0) {
      set(state => ({
        money: state.money + earned,
        totalEarned: state.totalEarned + earned,
        lifetimeEarned: state.lifetimeEarned + earned,
      }));
      get().updateMissionProgress('earn_money', earned);
      get().updateMissionProgress('earn_passive', earned);
    }

    // Random events check (every 5 minutes chance)
    if (now - s.lastEventCheck > 5 * 60 * 1000) {
      if (Math.random() < 0.15 && !s.activeEvent) {
        get().triggerRandomEvent();
      }
      set({ lastEventCheck: now });
    }
  },

  applyOfflineIncome: (offlineMs: number) => {
    const s = get();
    const globalOffMult = s.purchasedUpgrades.includes('gu_offline_2') ? 4
      : s.purchasedUpgrades.includes('gu_offline_1') ? 2 : 1;
    const earned = calculateOfflineIncome(
      s.businesses, s.ownedItems, s.prestigeMultiplier, s.isPremium, offlineMs, globalOffMult
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

  activateBoost: (multiplier: number, durationMs: number) => {
    set({ boostActive: true, boostMultiplier: multiplier, boostExpiry: Date.now() + durationMs });
    get().saveGame();
  },

  // --- STOCKS ---
  buyStock: (stockId: string, shares: number) => {
    const s = get();
    const price = s.stockPrices[stockId] || 0;
    const totalCost = price * shares;
    if (s.money < totalCost || shares <= 0) return;

    set(state => {
      const existing = state.stockHoldings[stockId];
      const prevShares = existing?.shares || 0;
      const prevAvg = existing?.avgBuyPrice || 0;
      const newAvg = (prevAvg * prevShares + price * shares) / (prevShares + shares);
      return {
        money: state.money - totalCost,
        stockHoldings: {
          ...state.stockHoldings,
          [stockId]: { shares: prevShares + shares, avgBuyPrice: newAvg },
        },
      };
    });
    get().saveGame();
  },

  sellStock: (stockId: string, shares: number) => {
    const s = get();
    const holding = s.stockHoldings[stockId];
    if (!holding || holding.shares < shares || shares <= 0) return;
    const price = s.stockPrices[stockId] || 0;
    const proceeds = price * shares;

    set(state => {
      const newShares = state.stockHoldings[stockId].shares - shares;
      const newHoldings = { ...state.stockHoldings };
      if (newShares <= 0) {
        delete newHoldings[stockId];
      } else {
        newHoldings[stockId] = { ...newHoldings[stockId], shares: newShares };
      }
      return {
        money: state.money + proceeds,
        totalEarned: state.totalEarned + Math.max(0, proceeds - state.stockHoldings[stockId].avgBuyPrice * shares),
        lifetimeEarned: state.lifetimeEarned + Math.max(0, proceeds - state.stockHoldings[stockId].avgBuyPrice * shares),
        stockHoldings: newHoldings,
      };
    });
    get().saveGame();
  },

  tickStocks: () => {
    const s = get();
    const newPrices: Record<string, number> = { ...s.stockPrices };
    STOCKS.forEach(stock => {
      const current = newPrices[stock.id] || stock.basePrice;
      const change = (Math.random() - 0.48) * stock.volatility * current + stock.trend * current;
      newPrices[stock.id] = Math.max(stock.basePrice * 0.01, current + change);
    });
    set({ stockPrices: newPrices });
  },

  // --- HUSTLES ---
  attemptHustle: (hustleId: string): HustleResult => {
    const s = get();
    const hustle = HUSTLES.find(h => h.id === hustleId);
    if (!hustle) return { hustleId, success: false, reward: 0, timestamp: Date.now() };

    const cooldownExpiry = s.hustleCooldowns[hustleId] || 0;
    if (Date.now() < cooldownExpiry) return { hustleId, success: false, reward: 0, timestamp: Date.now() };

    const success = Math.random() < hustle.successChance;
    const reward = success
      ? hustle.minReward + Math.random() * (hustle.maxReward - hustle.minReward)
      : -hustle.failPenalty;

    const result: HustleResult = { hustleId, success, reward, timestamp: Date.now() };

    set(state => ({
      money: Math.max(0, state.money + reward),
      totalEarned: success ? state.totalEarned + reward : state.totalEarned,
      lifetimeEarned: success ? state.lifetimeEarned + reward : state.lifetimeEarned,
      hustleCooldowns: {
        ...state.hustleCooldowns,
        [hustleId]: Date.now() + hustle.cooldownSec * 1000,
      },
      hustleHistory: [result, ...state.hustleHistory].slice(0, 20),
    }));

    if (success) {
      get().updateMissionProgress('earn_money', reward);
      get().checkAchievements();
    }
    get().saveGame();
    return result;
  },

  // --- MISSIONS ---
  updateMissionProgress: (type: string, amount: number) => {
    const s = get();
    let changed = false;

    const updateMissions = (missions: (typeof s.dailyMissions)) =>
      missions.map(m => {
        if (m.completed || m.claimed) return m;
        const template = MISSION_TEMPLATES.find(t => t.id === m.templateId);
        if (!template || template.type !== type) return m;
        const newProgress = m.progress + amount;
        const target = template.targets[m.targetIndex];
        if (newProgress >= target) {
          changed = true;
          return { ...m, progress: newProgress, completed: true };
        }
        return { ...m, progress: newProgress };
      });

    const newDaily = updateMissions(s.dailyMissions);
    let newWeekly = s.weeklyMission;
    if (newWeekly && !newWeekly.completed) {
      const wt = WEEKLY_CHALLENGES.find(t => t.id === newWeekly!.templateId);
      if (wt && wt.type === type) {
        const newProgress = newWeekly.progress + amount;
        if (newProgress >= wt.targets[newWeekly.targetIndex]) {
          newWeekly = { ...newWeekly, progress: newProgress, completed: true };
          changed = true;
        } else {
          newWeekly = { ...newWeekly, progress: newProgress };
        }
      }
    }

    if (changed || true) {
      set({ dailyMissions: newDaily, weeklyMission: newWeekly });
    }
  },

  claimMission: (templateId: string) => {
    const s = get();
    const mission = [...s.dailyMissions, s.weeklyMission].find(
      m => m && m.templateId === templateId && m.completed && !m.claimed
    );
    if (!mission) return;

    const isWeekly = WEEKLY_CHALLENGES.find(t => t.id === templateId);
    const template = isWeekly
      ? WEEKLY_CHALLENGES.find(t => t.id === templateId)!
      : MISSION_TEMPLATES.find(t => t.id === templateId)!;

    const gemMult = s.activeEvent && Date.now() < s.activeEvent.endTime
      && GAME_EVENTS.find(e => e.id === s.activeEvent!.eventId)?.type === 'gem_bonus'
      ? GAME_EVENTS.find(e => e.id === s.activeEvent!.eventId)!.multiplier : 1;

    const gems = Math.floor(template.gemReward * gemMult);
    const xp = template.xpReward;

    set(state => ({
      gems: state.gems + gems,
      seasonXp: state.seasonXp + xp,
      dailyMissions: state.dailyMissions.map(m =>
        m.templateId === templateId ? { ...m, claimed: true } : m
      ),
      weeklyMission: state.weeklyMission?.templateId === templateId
        ? { ...state.weeklyMission, claimed: true }
        : state.weeklyMission,
    }));
    get().saveGame();
  },

  resetDailyMissions: () => {
    set({
      dailyMissions: pickDailyMissions(),
      lastMissionReset: Date.now(),
    });
  },

  // --- GEMS & SEASON PASS ---
  purchaseGemPack: (packId: string) => {
    const pack = GEM_PACKS.find(p => p.id === packId);
    if (!pack) return;
    // In real app: IAP flow here. For now, just grant gems.
    set(state => ({ gems: state.gems + pack.gems }));
    get().saveGame();
  },

  purchaseSeasonPass: () => {
    set({ seasonPassPurchased: true });
    get().saveGame();
  },

  claimSeasonTier: (level: number, premium: boolean) => {
    const s = get();
    if (!premium || s.seasonPassPurchased) {
      set(state => ({
        seasonPassClaimedTiers: [...state.seasonPassClaimedTiers, level * (premium ? -1 : 1)],
        gems: state.gems + (premium && !s.seasonPassPurchased ? 0 : 20), // simplified
      }));
    }
    get().saveGame();
  },

  spendGems: (amount: number, itemId: string) => {
    const s = get();
    if (s.gems < amount) return;
    const item = GEM_SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    set(state => ({ gems: state.gems - amount }));

    if (item.id === 'gem_boost_2x') get().activateBoost(2, 4 * 60 * 60 * 1000);
    if (item.id === 'gem_boost_5x') get().activateBoost(5, 2 * 60 * 60 * 1000);
    if (item.id === 'gem_boost_10x') get().activateBoost(10, 1 * 60 * 60 * 1000);
    if (item.id === 'gem_tap_boost') get().activateBoost(10, 2 * 60 * 60 * 1000);
    if (item.id === 'gem_offline_extend') {
      const earned = get().applyOfflineIncome(24 * 60 * 60 * 1000);
    }
    if (item.id === 'gem_skip_cooldown') {
      set({ hustleCooldowns: {} });
    }

    get().saveGame();
  },

  // --- ACHIEVEMENTS ---
  checkAchievements: () => {
    const s = get();
    const newUnlocked: string[] = [];

    for (const ach of ACHIEVEMENTS) {
      if (s.unlockedAchievements.includes(ach.id)) continue;
      let value = 0;
      switch (ach.requirementType) {
        case 'total_earned': value = s.lifetimeEarned; break;
        case 'money_at_once': value = s.money; break;
        case 'businesses_owned': value = s.businesses.filter(b => b.level > 0).length; break;
        case 'business_level': value = Math.max(...s.businesses.map(b => b.level), 0); break;
        case 'items_owned': value = s.ownedItems.length; break;
        case 'prestige_count': value = s.prestigeLevel; break;
        case 'tap_count': value = s.tapCount; break;
        case 'ips': value = getTotalIncomePerSecond(s.businesses, s.ownedItems, s.prestigeMultiplier, 1, false); break;
      }
      if (value >= ach.requirement) {
        newUnlocked.push(ach.id);
      }
    }

    if (newUnlocked.length > 0) {
      const gemBonus = newUnlocked.reduce((acc, id) => {
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        return acc + (ach?.gemReward || 0);
      }, 0);
      set(state => ({
        unlockedAchievements: [...state.unlockedAchievements, ...newUnlocked],
        gems: state.gems + gemBonus,
      }));
    }
  },

  // --- EVENTS ---
  triggerRandomEvent: () => {
    const event = getRandomEvent();
    const durationMs = event.durationHours * 60 * 60 * 1000;
    set({
      activeEvent: {
        eventId: event.id,
        startTime: Date.now(),
        endTime: Date.now() + durationMs,
      },
      lastEventCheck: Date.now(),
    });
  },

  // --- PERSISTENCE ---
  saveGame: async () => {
    const s = get();
    try {
      const saveData = {
        money: s.money,
        totalEarned: s.totalEarned,
        lifetimeEarned: s.lifetimeEarned,
        tapValue: s.tapValue,
        tapCount: s.tapCount,
        prestigeLevel: s.prestigeLevel,
        prestigeMultiplier: s.prestigeMultiplier,
        prestigeCoins: s.prestigeCoins,
        businesses: s.businesses,
        purchasedUpgrades: s.purchasedUpgrades,
        ownedItems: s.ownedItems,
        stockPrices: s.stockPrices,
        stockHoldings: s.stockHoldings,
        hustleCooldowns: s.hustleCooldowns,
        dailyMissions: s.dailyMissions,
        weeklyMission: s.weeklyMission,
        lastMissionReset: s.lastMissionReset,
        unlockedAchievements: s.unlockedAchievements,
        gems: s.gems,
        seasonXp: s.seasonXp,
        seasonPassPurchased: s.seasonPassPurchased,
        seasonPassClaimedTiers: s.seasonPassClaimedTiers,
        boostActive: s.boostActive,
        boostMultiplier: s.boostMultiplier,
        boostExpiry: s.boostExpiry,
        lastSaveTime: Date.now(),
        isPremium: s.isPremium,
      };
      await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch { /* silent */ }
  },

  loadSave: async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVE_KEY);
      if (!raw) {
        get().checkAchievements();
        return;
      }
      const data = JSON.parse(raw);
      const offlineMs = Date.now() - (data.lastSaveTime || Date.now());

      // Check if missions need reset (daily)
      const msSinceReset = Date.now() - (data.lastMissionReset || 0);
      const dailyMissions = msSinceReset > 24 * 60 * 60 * 1000 ? pickDailyMissions() : (data.dailyMissions || pickDailyMissions());
      const weeklyMission = msSinceReset > 7 * 24 * 60 * 60 * 1000 ? pickWeeklyMission() : (data.weeklyMission || pickWeeklyMission());

      set({
        money: data.money ?? 0,
        totalEarned: data.totalEarned ?? 0,
        lifetimeEarned: data.lifetimeEarned ?? 0,
        tapValue: data.tapValue ?? 1,
        tapCount: data.tapCount ?? 0,
        prestigeLevel: data.prestigeLevel ?? 0,
        prestigeMultiplier: data.prestigeMultiplier ?? 1,
        prestigeCoins: data.prestigeCoins ?? 0,
        businesses: data.businesses ?? initialBusinesses,
        purchasedUpgrades: data.purchasedUpgrades ?? [],
        ownedItems: data.ownedItems ?? [],
        stockPrices: data.stockPrices ?? initStockPrices(),
        stockHoldings: data.stockHoldings ?? {},
        hustleCooldowns: data.hustleCooldowns ?? {},
        dailyMissions,
        weeklyMission,
        lastMissionReset: msSinceReset > 24 * 60 * 60 * 1000 ? Date.now() : (data.lastMissionReset ?? Date.now()),
        unlockedAchievements: data.unlockedAchievements ?? [],
        gems: data.gems ?? 50,
        seasonXp: data.seasonXp ?? 0,
        seasonPassPurchased: data.seasonPassPurchased ?? false,
        seasonPassClaimedTiers: data.seasonPassClaimedTiers ?? [],
        boostActive: data.boostActive ?? false,
        boostMultiplier: data.boostMultiplier ?? 1,
        boostExpiry: data.boostExpiry ?? 0,
        lastSaveTime: data.lastSaveTime ?? Date.now(),
        isPremium: data.isPremium ?? false,
      });

      if (offlineMs > 5000) {
        get().applyOfflineIncome(offlineMs);
      }
      get().checkAchievements();
    } catch {
      get().checkAchievements();
    }
  },
}));
