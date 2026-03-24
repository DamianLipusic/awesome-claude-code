import { BusinessState } from '../store/types';
import { getTotalIncomePerSecond } from './gameLogic';

const MAX_OFFLINE_HOURS = 12;

export function calculateOfflineIncome(
  businesses: BusinessState[],
  ownedItems: string[],
  prestigeMultiplier: number,
  isPremium: boolean,
  offlineMs: number,
): number {
  const cappedMs = Math.min(offlineMs, MAX_OFFLINE_HOURS * 60 * 60 * 1000);
  const offlineSec = cappedMs / 1000;
  const ips = getTotalIncomePerSecond(businesses, ownedItems, prestigeMultiplier, false, isPremium);
  const multiplier = isPremium ? 1.0 : 0.5; // premium gets full offline, free gets 50%
  return ips * offlineSec * multiplier;
}
