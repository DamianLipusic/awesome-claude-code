import { BusinessState } from '../store/types';
import { getTotalIncomePerSecond } from './gameLogic';

const MAX_OFFLINE_HOURS = 12;

export function calculateOfflineIncome(
  businesses: BusinessState[],
  ownedItems: string[],
  prestigeMultiplier: number,
  isPremium: boolean,
  offlineMs: number,
  globalOfflineMultiplier: number = 1,
): number {
  const cappedMs = Math.min(offlineMs, MAX_OFFLINE_HOURS * 60 * 60 * 1000);
  const offlineSec = cappedMs / 1000;
  const ips = getTotalIncomePerSecond(businesses, ownedItems, prestigeMultiplier, 1, isPremium);
  const baseMultiplier = isPremium ? 1.0 : 0.5;
  return ips * offlineSec * baseMultiplier * globalOfflineMultiplier;
}
