import type { TaxBracket, BusinessType, CitySize } from '../../../shared/src/types/entities';

// ─── Market constants ────────────────────────────────────────

export const AI_MARKUP = 1.25;
export const AI_BUY_DISCOUNT = 0.75;
export const LISTING_FEE_PERCENT = 0.02;
export const MARKET_EXPOSURE_CAP = 0.40;

// Max units AI will stock per resource tier per city size
export const AI_QUANTITY_CAPS: Record<CitySize, Record<number, number>> = {
  CAPITAL: { 1: 5000, 2: 3000, 3: 1500, 4: 500 },
  LARGE:   { 1: 3000, 2: 1800, 3:  900, 4: 300 },
  MEDIUM:  { 1: 1500, 2:  900, 3:  450, 4: 150 },
  SMALL:   { 1:  500, 2:  300, 3:  150, 4:  50 },
};

// ─── Crime constants ─────────────────────────────────────────

export const DIRTY_MONEY_LIABILITY_RATE = 0.005; // per day
export const DETECTION_BASE_RATE = 0.02;
export const BRIBE_DISCOUNT = 0.30;
export const BRIBE_COSTS: Record<string, number> = {
  COLD:     500,
  WARM:    2000,
  HOT:     8000,
  BURNING: 25000,
  FUGITIVE: 80000,
};
export const BRIBE_HEAT_REDUCTION = 100;
export const BRIBE_COOLDOWN_HOURS = 24;
export const LAY_LOW_DECAY_MULTIPLIER = 2.0;

// Heat decay per hour (base) — modified by lay_low flag and security
export const HEAT_DECAY_PER_HOUR = 2.0;

// ─── Tax brackets ─────────────────────────────────────────────

export const TAX_BRACKETS: TaxBracket[] = [
  { min_nw: 0,        max_nw: 50000,   rate: 0.00 },
  { min_nw: 50000,    max_nw: 150000,  rate: 0.05 },
  { min_nw: 150000,   max_nw: 500000,  rate: 0.10 },
  { min_nw: 500000,   max_nw: 1500000, rate: 0.18 },
  { min_nw: 1500000,  max_nw: 5000000, rate: 0.25 },
  { min_nw: 5000000,  max_nw: Infinity, rate: 0.35 },
];

// ─── Business upgrade costs per tier ────────────────────────

export const UPGRADE_COSTS: Record<BusinessType, Record<number, number>> = {
  RETAIL:        { 1: 0, 2: 8000,  3: 20000,  4: 60000  },
  FACTORY:       { 1: 0, 2: 30000, 3: 80000,  4: 200000 },
  MINE:          { 1: 0, 2: 22000, 3: 60000,  4: 150000 },
  FARM:          { 1: 0, 2: 12000, 3: 30000,  4: 80000  },
  LOGISTICS:     { 1: 0, 2: 18000, 3: 50000,  4: 120000 },
  SECURITY_FIRM: { 1: 0, 2: 15000, 3: 40000,  4: 100000 },
  FRONT_COMPANY: { 1: 0, 2: 25000, 3: 70000,  4: 175000 },
};

// Capacity multiplier per tier
export const TIER_CAPACITY_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 1.5,
  3: 2.5,
  4: 4.0,
};

// ─── Production recipes ──────────────────────────────────────

export interface ProductionInput {
  resource_name: string;
  quantity: number;
}

export interface ProductionOutput {
  resource_name: string;
  quantity: number;
}

export interface ProductionRecipe {
  inputs: ProductionInput[];
  outputs: ProductionOutput[];
  units_per_tick_per_worker: number;
  tick_interval_minutes: number;
}

// Keyed by business type; RETAIL has no production recipe
export const PRODUCTION_RECIPES: Partial<Record<BusinessType, Record<number, ProductionRecipe>>> = {
  MINE: {
    1: {
      inputs: [],
      outputs: [
        { resource_name: 'Coal', quantity: 10 },
      ],
      units_per_tick_per_worker: 10,
      tick_interval_minutes: 60,
    },
    2: {
      inputs: [],
      outputs: [
        { resource_name: 'Coal', quantity: 12 },
        { resource_name: 'Metals', quantity: 4 },
      ],
      units_per_tick_per_worker: 16,
      tick_interval_minutes: 60,
    },
    3: {
      inputs: [],
      outputs: [
        { resource_name: 'Coal', quantity: 15 },
        { resource_name: 'Metals', quantity: 8 },
        { resource_name: 'Steel', quantity: 2 },
      ],
      units_per_tick_per_worker: 25,
      tick_interval_minutes: 60,
    },
    4: {
      inputs: [],
      outputs: [
        { resource_name: 'Coal', quantity: 20 },
        { resource_name: 'Metals', quantity: 15 },
        { resource_name: 'Steel', quantity: 5 },
      ],
      units_per_tick_per_worker: 40,
      tick_interval_minutes: 60,
    },
  },
  FARM: {
    1: {
      inputs: [],
      outputs: [{ resource_name: 'Wheat', quantity: 15 }],
      units_per_tick_per_worker: 15,
      tick_interval_minutes: 60,
    },
    2: {
      inputs: [],
      outputs: [{ resource_name: 'Wheat', quantity: 20 }],
      units_per_tick_per_worker: 20,
      tick_interval_minutes: 60,
    },
    3: {
      inputs: [],
      outputs: [
        { resource_name: 'Wheat', quantity: 28 },
        { resource_name: 'Lumber', quantity: 5 },
      ],
      units_per_tick_per_worker: 33,
      tick_interval_minutes: 60,
    },
    4: {
      inputs: [],
      outputs: [
        { resource_name: 'Wheat', quantity: 40 },
        { resource_name: 'Lumber', quantity: 10 },
      ],
      units_per_tick_per_worker: 50,
      tick_interval_minutes: 60,
    },
  },
  FACTORY: {
    1: {
      inputs: [
        { resource_name: 'Coal', quantity: 2 },
        { resource_name: 'Metals', quantity: 1 },
      ],
      outputs: [{ resource_name: 'Steel', quantity: 1 }],
      units_per_tick_per_worker: 5,
      tick_interval_minutes: 60,
    },
    2: {
      inputs: [
        { resource_name: 'Coal', quantity: 2 },
        { resource_name: 'Metals', quantity: 1 },
      ],
      outputs: [
        { resource_name: 'Steel', quantity: 2 },
        { resource_name: 'Electronics', quantity: 1 },
      ],
      units_per_tick_per_worker: 8,
      tick_interval_minutes: 60,
    },
    3: {
      inputs: [
        { resource_name: 'Coal', quantity: 3 },
        { resource_name: 'Metals', quantity: 2 },
      ],
      outputs: [
        { resource_name: 'Steel', quantity: 3 },
        { resource_name: 'Electronics', quantity: 2 },
        { resource_name: 'Clothing', quantity: 2 },
      ],
      units_per_tick_per_worker: 15,
      tick_interval_minutes: 60,
    },
    4: {
      inputs: [
        { resource_name: 'Coal', quantity: 4 },
        { resource_name: 'Metals', quantity: 3 },
        { resource_name: 'Fuel', quantity: 1 },
      ],
      outputs: [
        { resource_name: 'Steel', quantity: 5 },
        { resource_name: 'Electronics', quantity: 4 },
        { resource_name: 'Clothing', quantity: 4 },
        { resource_name: 'Medicine', quantity: 1 },
      ],
      units_per_tick_per_worker: 25,
      tick_interval_minutes: 60,
    },
  },
  LOGISTICS: {
    1: {
      inputs: [{ resource_name: 'Fuel', quantity: 1 }],
      outputs: [{ resource_name: 'Fuel', quantity: 0 }], // Logistics generates transport capacity, not goods
      units_per_tick_per_worker: 0,
      tick_interval_minutes: 60,
    },
  },
  FRONT_COMPANY: {
    1: {
      inputs: [],
      outputs: [],
      units_per_tick_per_worker: 0,
      tick_interval_minutes: 60,
    },
  },
  SECURITY_FIRM: {
    1: {
      inputs: [],
      outputs: [],
      units_per_tick_per_worker: 0,
      tick_interval_minutes: 60,
    },
  },
};

// ─── Hire cost formula ────────────────────────────────────────

export const BASE_HIRE_COST = 500;

export function calculateHireCost(businessCount: number, employeeCount: number): number {
  return Math.round(BASE_HIRE_COST * (1 + businessCount * 0.15 + employeeCount / 100));
}

// ─── Net worth calculation helpers ──────────────────────────

export function calculateBusinessValue(type: BusinessType, tier: number): number {
  const { BUSINESS_BASE_COSTS } = require('../../../shared/src/types/entities');
  const startup = BUSINESS_BASE_COSTS[type]?.startup ?? 5000;
  const tierMultiplier = TIER_CAPACITY_MULTIPLIER[tier] ?? 1.0;
  return startup * tierMultiplier * 0.7;
}

// ─── Season economy scarcity formula ────────────────────────

export function calculateAiPrice(
  baseValue: number,
  globalSupply: number,
  globalDemand: number
): number {
  const scarcityRatio = globalDemand / Math.max(globalSupply, 1);
  // Price = base_value * scarcity_ratio^0.5 clamped between 20% and 500% of base
  const raw = baseValue * Math.sqrt(scarcityRatio);
  return Math.max(baseValue * 0.2, Math.min(baseValue * 5.0, raw));
}

// ─── Security layer constants ────────────────────────────────

export const SECURITY_TIER_STATS: Record<number, {
  protection_rating: number;
  employee_watch: number;
  anti_infiltration: number;
  daily_cost: number;
}> = {
  1: { protection_rating: 0.10, employee_watch: 0.10, anti_infiltration: 0.10, daily_cost: 200  },
  2: { protection_rating: 0.25, employee_watch: 0.25, anti_infiltration: 0.25, daily_cost: 500  },
  3: { protection_rating: 0.45, employee_watch: 0.40, anti_infiltration: 0.45, daily_cost: 1200 },
  4: { protection_rating: 0.65, employee_watch: 0.60, anti_infiltration: 0.65, daily_cost: 3000 },
};
