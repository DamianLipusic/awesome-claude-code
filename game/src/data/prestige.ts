import { PrestigeTier } from '../store/types';

export const PRESTIGE_TIERS: PrestigeTier[] = [
  { level: 1, requiredTotalEarned: 1_000_000_000, multiplierBonus: 2, label: 'Millionaire' },
  { level: 2, requiredTotalEarned: 100_000_000_000, multiplierBonus: 5, label: 'Billionaire' },
  { level: 3, requiredTotalEarned: 10_000_000_000_000, multiplierBonus: 10, label: 'Trillionaire' },
  { level: 4, requiredTotalEarned: 1e15, multiplierBonus: 25, label: 'Mogul' },
  { level: 5, requiredTotalEarned: 1e18, multiplierBonus: 50, label: 'Legend' },
];

export const PRESTIGE_UPGRADES = [
  { id: 'tap_boost', name: 'Golden Fingers', cost: 1, description: '+100% tap value permanently', emoji: '👆' },
  { id: 'offline_boost', name: 'Night Owl', cost: 2, description: '2× offline income', emoji: '🌙' },
  { id: 'start_cash', name: 'Head Start', cost: 2, description: 'Start with $10k after prestige', emoji: '💰' },
  { id: 'business_boost', name: 'Empire Builder', cost: 3, description: '+50% all business income', emoji: '🏗️' },
  { id: 'auto_all', name: 'Auto CEO', cost: 5, description: 'All businesses auto-managed from start', emoji: '🤖' },
];
