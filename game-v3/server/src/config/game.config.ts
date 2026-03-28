// EmpireOS V3 — Static game configuration
// All balance numbers, formulas, and seed data live here.

// ─── Business Types ──────────────────────────────────────────────────
export const BUSINESS_TYPES = {
  SHOP:       { cost: 8000,  dailyCost: 200, category: 'sales',      emoji: '\u{1F3EA}' },
  FACTORY:    { cost: 15000, dailyCost: 400, category: 'production', emoji: '\u{1F3ED}' },
  MINE:       { cost: 12000, dailyCost: 350, category: 'resource',   emoji: '\u{26CF}\u{FE0F}' },
  WAREHOUSE:  { cost: 10000, dailyCost: 150, category: 'storage',    emoji: '\u{1F4E6}' },
  FARM:       { cost: 6000,  dailyCost: 180, category: 'resource',   emoji: '\u{1F33E}' },
  RESTAURANT: { cost: 20000, dailyCost: 500, category: 'premium',    emoji: '\u{1F37D}\u{FE0F}' },
} as const;

export type BusinessType = keyof typeof BUSINESS_TYPES;

// ─── Items ───────────────────────────────────────────────────────────
export const ITEMS = {
  wheat: { name: 'Wheat', basePrice: 5,   category: 'raw',          stage: 1 },
  ore:   { name: 'Ore',   basePrice: 12,  category: 'raw',          stage: 1 },
  flour: { name: 'Flour', basePrice: 22,  category: 'intermediate', stage: 2 },
  steel: { name: 'Steel', basePrice: 45,  category: 'intermediate', stage: 2 },
  bread: { name: 'Bread', basePrice: 60,  category: 'finished',     stage: 3 },
  tools: { name: 'Tools', basePrice: 120, category: 'finished',     stage: 3 },
  meals: { name: 'Meals', basePrice: 200, category: 'finished',     stage: 4 },
} as const;

export type ItemKey = keyof typeof ITEMS;

// ─── Recipes ─────────────────────────────────────────────────────────
export interface RecipeInput {
  item: ItemKey;
  qtyPerUnit: number;
}

export interface RecipeDef {
  businessType: BusinessType;
  outputItem: ItemKey;
  baseRate: number;
  cycleMinutes: number;
  inputs: RecipeInput[];
}

export const RECIPES: readonly RecipeDef[] = [
  // Raw production (no inputs)
  { businessType: 'MINE',    outputItem: 'ore',   baseRate: 5, cycleMinutes: 1, inputs: [] },
  { businessType: 'MINE',    outputItem: 'wheat', baseRate: 6, cycleMinutes: 1, inputs: [] },
  // Intermediate processing
  { businessType: 'FACTORY', outputItem: 'flour', baseRate: 3, cycleMinutes: 1, inputs: [{ item: 'wheat', qtyPerUnit: 2 }] },
  { businessType: 'FACTORY', outputItem: 'steel', baseRate: 2, cycleMinutes: 1, inputs: [{ item: 'ore',   qtyPerUnit: 3 }] },
  // Finished goods (SHOP)
  { businessType: 'SHOP',    outputItem: 'bread', baseRate: 2, cycleMinutes: 1, inputs: [{ item: 'flour', qtyPerUnit: 2 }] },
  { businessType: 'SHOP',    outputItem: 'tools', baseRate: 1, cycleMinutes: 1, inputs: [{ item: 'steel', qtyPerUnit: 2 }] },
  // Farm (cheap wheat producer)
  { businessType: 'FARM',    outputItem: 'wheat', baseRate: 8, cycleMinutes: 1, inputs: [] },
  // Restaurant (premium finished goods)
  { businessType: 'RESTAURANT', outputItem: 'meals', baseRate: 1, cycleMinutes: 1, inputs: [{ item: 'bread', qtyPerUnit: 2 }, { item: 'flour', qtyPerUnit: 1 }] },
] as const;

// ─── Business helper functions ───────────────────────────────────────
export function upgradeCost(businessType: BusinessType, tier: number): number {
  return BUSINESS_TYPES[businessType].cost * tier * 1.5;
}

export function storageCap(tier: number, businessType?: string): number {
  const base = 100 * tier * tier;
  return businessType === 'WAREHOUSE' ? base * 3 : base;
}

export function maxEmployees(tier: number): number {
  return tier * 4;
}

export function efficiencyBonus(tier: number): number {
  return tier * 5;
}

export function calcProduction(
  baseRate: number,
  avgEfficiency: number,
  businessEfficiency: number,
  avgStress: number,
): number {
  return (
    baseRate *
    (avgEfficiency / 100) *
    (businessEfficiency / 100) *
    Math.max(0.5, 1 - avgStress / 200)
  );
}

// ─── Auto-sell ───────────────────────────────────────────────────────
export const AUTOSELL = {
  priceModifier: 0.8,
  demandFactor: 0.5,
} as const;

// ─── Employee Pool ───────────────────────────────────────────────────
export const EMPLOYEE_POOL = {
  waveIntervalHours: 8,
  minPoolSize: 5,
  maxPoolSize: 15,
  tiers: {
    common:     { weight: 60, effMin: 30, effMax: 50, salaryMin: 500,  salaryMax: 1000 },
    skilled:    { weight: 25, effMin: 50, effMax: 70, salaryMin: 1000, salaryMax: 2000 },
    specialist: { weight: 12, effMin: 70, effMax: 85, salaryMin: 2000, salaryMax: 4000 },
    elite:      { weight: 3,  effMin: 85, effMax: 98, salaryMin: 4000, salaryMax: 8000 },
  },
} as const;

export type EmployeeTier = keyof typeof EMPLOYEE_POOL.tiers;

// ─── XP & Leveling ──────────────────────────────────────────────────
export const XP_REWARDS = {
  CREATE_BIZ: 100,
  HIRE: 50,
  UPGRADE: 200,
  SELL_PER_1000: 10,
  TRAIN: 75,
  DISCOVERY: 150,
} as const;

export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000] as const;

export function calculateLevel(xp: number): { level: number; xpCurrent: number; xpForNext: number } {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  const xpCurrent = xp - LEVEL_THRESHOLDS[Math.min(level - 1, LEVEL_THRESHOLDS.length - 1)];
  const nextIdx = Math.min(level, LEVEL_THRESHOLDS.length - 1);
  const xpForNext =
    level >= LEVEL_THRESHOLDS.length
      ? Infinity
      : LEVEL_THRESHOLDS[nextIdx] - LEVEL_THRESHOLDS[level - 1];
  return { level, xpCurrent, xpForNext };
}

// ─── Unlock Conditions ──────────────────────────────────────────────
export const UNLOCK_CONDITIONS: Record<number, { totalRevenue?: number; businessCount?: number; netWorth?: number; orLevel: number }> = {
  2: { totalRevenue: 50000, orLevel: 4 },
  3: { businessCount: 3, orLevel: 6 },
  4: { netWorth: 500000, orLevel: 8 },
};

// ─── Training ────────────────────────────────────────────────────────
export const TRAINING = {
  basic:    { durationMinutes: 60,  costMultiplier: 2,  maxStatGain: 10 },
  advanced: { durationMinutes: 240, costMultiplier: 5,  maxStatGain: 20 },
  elite:    { durationMinutes: 720, costMultiplier: 10, maxStatGain: 35 },
} as const;

export type TrainingType = keyof typeof TRAINING;

// ─── Seed Locations ──────────────────────────────────────────────────
export interface SeedLocation {
  name: string;
  type: string;
  zone: string;
  price: number;
  dailyCost: number;
  traffic: number;
  visibility: number;
  storage: number;
  laundering: number;
}

export const SEED_LOCATIONS: readonly SeedLocation[] = [
  { name: 'Industrial District',  type: 'industrial', zone: 'downtown',    price: 5000,  dailyCost: 100, traffic: 30, visibility: 40, storage: 800,  laundering: 10 },
  { name: 'Market Square',        type: 'commercial', zone: 'downtown',    price: 12000, dailyCost: 300, traffic: 85, visibility: 90, storage: 400,  laundering: 5  },
  { name: 'Harbor Warehouse',     type: 'warehouse',  zone: 'docks',       price: 8000,  dailyCost: 150, traffic: 20, visibility: 25, storage: 1200, laundering: 30 },
  { name: 'Suburban Mall',        type: 'commercial', zone: 'suburbs',     price: 10000, dailyCost: 250, traffic: 70, visibility: 75, storage: 500,  laundering: 5  },
  { name: 'Old Mine Entrance',    type: 'resource',   zone: 'outskirts',   price: 6000,  dailyCost: 120, traffic: 10, visibility: 15, storage: 600,  laundering: 20 },
  { name: 'Riverside Factory',    type: 'industrial', zone: 'riverside',   price: 9000,  dailyCost: 200, traffic: 25, visibility: 35, storage: 900,  laundering: 15 },
  { name: 'Downtown Storefront',  type: 'commercial', zone: 'downtown',    price: 15000, dailyCost: 400, traffic: 95, visibility: 95, storage: 300,  laundering: 3  },
  { name: 'Backstreet Workshop',  type: 'industrial', zone: 'backstreets', price: 4000,  dailyCost: 80,  traffic: 15, visibility: 20, storage: 700,  laundering: 40 },
] as const;
