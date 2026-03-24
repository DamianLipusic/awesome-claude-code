import { BUSINESSES } from '../data/businesses';
import { SHOP_ITEMS } from '../data/shopItems';
import { BUSINESS_UPGRADES, GLOBAL_UPGRADES } from '../data/upgrades';
import { BusinessState } from '../store/types';

export function getBusinessCost(businessId: string, currentLevel: number): number {
  const def = BUSINESSES.find(b => b.id === businessId);
  if (!def) return Infinity;
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, currentLevel));
}

export function getMilestoneMultiplier(businessId: string, level: number): number {
  const def = BUSINESSES.find(b => b.id === businessId);
  if (!def) return 1;
  let mult = 1;
  for (const milestone of def.milestones) {
    if (level >= milestone) mult *= 2;
  }
  return mult;
}

export function getBusinessIncome(businessId: string, level: number, upgradeMultiplier = 1): number {
  const def = BUSINESSES.find(b => b.id === businessId);
  if (!def || level === 0) return 0;
  return def.baseIncome * level * getMilestoneMultiplier(businessId, level) * upgradeMultiplier;
}

export function getGlobalIncomeMultiplier(purchasedUpgrades: string[]): number {
  let mult = 1;
  for (const id of purchasedUpgrades) {
    const gu = GLOBAL_UPGRADES.find(u => u.id === id);
    if (gu && gu.type === 'income_multiplier') mult *= gu.value;
  }
  return mult;
}

export function getTotalIncomePerSecond(
  businesses: BusinessState[],
  ownedItems: string[],
  prestigeMultiplier: number,
  boostMultiplier: number = 1,
  isPremium: boolean = false,
): number {
  let base = 0;
  for (const bs of businesses) {
    if (bs.autoManaged) {
      base += getBusinessIncome(bs.id, bs.level, bs.upgradeMultiplier);
    }
  }

  let itemMult = 1;
  for (const itemId of ownedItems) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (item) itemMult *= item.incomeBonus;
  }

  let total = base * itemMult * prestigeMultiplier * boostMultiplier;
  if (isPremium) total *= 1.5;
  return total;
}

export function getManualIncome(
  tapValue: number,
  ownedItems: string[],
  prestigeMultiplier: number,
  boostMultiplier: number = 1,
): number {
  let itemMult = 1;
  for (const itemId of ownedItems) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (item) itemMult *= item.tapBonus;
  }
  return tapValue * itemMult * prestigeMultiplier * boostMultiplier;
}

export function canPrestige(totalEarned: number): boolean {
  return totalEarned >= 1_000_000_000;
}

export function getPrestigeMultiplier(prestigeLevel: number): number {
  if (prestigeLevel === 0) return 1;
  return Math.pow(2, prestigeLevel);
}

export function getPortfolioValue(
  holdings: Record<string, { shares: number; avgBuyPrice: number }>,
  prices: Record<string, number>
): number {
  return Object.entries(holdings).reduce((total, [stockId, holding]) => {
    return total + (prices[stockId] || 0) * holding.shares;
  }, 0);
}

export function getPortfolioPnL(
  holdings: Record<string, { shares: number; avgBuyPrice: number }>,
  prices: Record<string, number>
): number {
  return Object.entries(holdings).reduce((total, [stockId, holding]) => {
    const currentVal = (prices[stockId] || 0) * holding.shares;
    const costBasis = holding.avgBuyPrice * holding.shares;
    return total + (currentVal - costBasis);
  }, 0);
}
