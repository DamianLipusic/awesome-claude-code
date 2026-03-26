import type { TaxBracket, BusinessType, CitySize } from '../../../shared/src/types/entities';
export declare const AI_MARKUP = 1.25;
export declare const AI_BUY_DISCOUNT = 0.75;
export declare const LISTING_FEE_PERCENT = 0.02;
export declare const MARKET_EXPOSURE_CAP = 0.4;
export declare const AI_QUANTITY_CAPS: Record<CitySize, Record<number, number>>;
export declare const DIRTY_MONEY_LIABILITY_RATE = 0.005;
export declare const DETECTION_BASE_RATE = 0.02;
export declare const BRIBE_DISCOUNT = 0.3;
export declare const BRIBE_COSTS: Record<string, number>;
export declare const BRIBE_HEAT_REDUCTION = 100;
export declare const BRIBE_COOLDOWN_HOURS = 24;
export declare const LAY_LOW_DECAY_MULTIPLIER = 2;
export declare const HEAT_DECAY_PER_HOUR = 2;
export declare const TAX_BRACKETS: TaxBracket[];
export declare const UPGRADE_COSTS: Record<BusinessType, Record<number, number>>;
export declare const TIER_CAPACITY_MULTIPLIER: Record<number, number>;
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
export declare const PRODUCTION_RECIPES: Partial<Record<BusinessType, Record<number, ProductionRecipe>>>;
export declare const BASE_HIRE_COST = 500;
export declare function calculateHireCost(businessCount: number, employeeCount: number): number;
export declare function calculateBusinessValue(type: BusinessType, tier: number): number;
export declare function calculateAiPrice(baseValue: number, globalSupply: number, globalDemand: number): number;
export declare const SECURITY_TIER_STATS: Record<number, {
    protection_rating: number;
    employee_watch: number;
    anti_infiltration: number;
    daily_cost: number;
}>;
//# sourceMappingURL=constants.d.ts.map