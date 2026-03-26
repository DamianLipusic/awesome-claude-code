/**
 * Update AI prices based on scarcity formula for all resources in season.
 */
export declare function economy_update(season_id: string): Promise<void>;
/**
 * Run one production tick for a specific business.
 */
export declare function employee_production(business_id: string): Promise<void>;
/**
 * Replenish AI listings per city, applying player price pressure.
 */
export declare function market_refresh(season_id: string): Promise<void>;
/**
 * Resolve a completed criminal operation.
 */
export declare function crime_action_resolve(operation_id: string): Promise<void>;
/**
 * Complete due laundering processes.
 */
export declare function laundering_tick(): Promise<void>;
/**
 * Decay all players' heat scores by configured rate.
 */
export declare function heat_decay(): Promise<void>;
/**
 * Deduct daily salaries, operating costs, and dirty money liability.
 */
export declare function daily_costs(season_id: string): Promise<void>;
/**
 * Apply progressive tax brackets to all players.
 */
export declare function progressive_tax(season_id: string): Promise<void>;
/**
 * Full wipe + new season creation after ending season.
 */
export declare function season_reset(ending_season_id: string): Promise<void>;
//# sourceMappingURL=simulation.d.ts.map