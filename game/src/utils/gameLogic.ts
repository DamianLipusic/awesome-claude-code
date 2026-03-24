import { BUSINESSES } from '../data/businesses';
import { SHOP_ITEMS } from '../data/shopItems';
import { BusinessState } from '../store/types';

export function getBusinessCost(businessId: string, currentLevel: number): number {
  const def = BUSINESSES.find(b => b.id === businessId);
  if (!def) return Infinity;
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, currentLevel));
}

export function getBusinessIncome(businessId: string, level: number): number {
  const def = BUSINESSES.find(b => b.id === businessId);
  if (!def || level === 0) return 0;
  return def.baseIncome * level;
}

export function getTotalIncomePerSecond(
  businesses: BusinessState[],
  ownedItems: string[],
  prestigeMultiplier: number,
  boostActive: boolean,
  isPremium: boolean,
): number {
  let base = 0;
  for (const bs of businesses) {
    if (bs.autoManaged) {
      base += getBusinessIncome(bs.id, bs.level);
    }
  }

  let itemMultiplier = 1;
  for (const itemId of ownedItems) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (item) itemMultiplier *= item.incomeBonus;
  }

  let total = base * itemMultiplier * prestigeMultiplier;
  if (boostActive) total *= 5;
  if (isPremium) total *= 1.5;
  return total;
}

export function getManualIncome(
  tapValue: number,
  ownedItems: string[],
  prestigeMultiplier: number,
  boostActive: boolean,
): number {
  let itemMultiplier = 1;
  for (const itemId of ownedItems) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (item) itemMultiplier *= item.incomeBonus;
  }
  let total = tapValue * itemMultiplier * prestigeMultiplier;
  if (boostActive) total *= 5;
  return total;
}

export function canPrestige(totalEarned: number): boolean {
  return totalEarned >= 1_000_000_000;
}

export function getPrestigeMultiplier(prestigeLevel: number): number {
  if (prestigeLevel === 0) return 1;
  return Math.pow(2, prestigeLevel);
}
