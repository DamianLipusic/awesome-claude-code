"use strict";
// ============================================================
// SHARED ENTITY TYPES — consumed by both server and client
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.RIVALRY_THRESHOLDS = exports.MANAGER_TIER_CONFIG = exports.SABOTAGE_CONFIG = exports.ZONE_BONUSES = exports.BUSINESS_BASE_COSTS = exports.CRIME_OP_CONFIGS = exports.HEAT_THRESHOLDS = exports.LAUNDERING_METHODS = exports.CITIES = void 0;
// ─── Game constants ───────────────────────────────────────────
exports.CITIES = [
    { name: 'Ironport', size: 'CAPITAL', region: 'North' },
    { name: 'Duskfield', size: 'LARGE', region: 'North' },
    { name: 'Ashvale', size: 'MEDIUM', region: 'South' },
    { name: 'Coldmarsh', size: 'MEDIUM', region: 'South' },
    { name: 'Farrow', size: 'SMALL', region: 'East' },
];
exports.LAUNDERING_METHODS = {
    BUSINESS_REVENUE: { fee: 0.15, hours_per_10k: 48, detection_modifier: 0.8, max_per_day: 50000 },
    REAL_ESTATE: { fee: 0.25, hours_per_10k: 33.6, detection_modifier: 0.5, max_per_day: 100000 },
    SHELL_COMPANY: { fee: 0.30, hours_per_10k: 9.6, detection_modifier: 1.0, max_per_day: 50000 },
    CRYPTO_ANALOG: { fee: 0.10, hours_per_10k: 12, detection_modifier: 2.0, max_per_day: 20000 },
};
exports.HEAT_THRESHOLDS = {
    COLD: { min: 0, max: 99 },
    WARM: { min: 100, max: 299 },
    HOT: { min: 300, max: 599 },
    BURNING: { min: 600, max: 899 },
    FUGITIVE: { min: 900, max: 1000 },
};
exports.CRIME_OP_CONFIGS = {
    SMUGGLING: { risk_level: 3, base_yield: 8000, duration_hours: 6, requires_criminal_employees: 2 },
    THEFT: { risk_level: 5, base_yield: 4000, duration_hours: 2, requires_criminal_employees: 1 },
    EXTORTION: { risk_level: 6, base_yield: 12000, duration_hours: 12, requires_criminal_employees: 2 },
    FRAUD: { risk_level: 4, base_yield: 15000, duration_hours: 24, requires_criminal_employees: 1 },
    DRUG_TRADE: { risk_level: 8, base_yield: 30000, duration_hours: 8, requires_criminal_employees: 3 },
    BRIBERY: { risk_level: 2, base_yield: 5000, duration_hours: 1, requires_criminal_employees: 0 },
    SABOTAGE: { risk_level: 7, base_yield: 0, duration_hours: 4, requires_criminal_employees: 2 },
};
exports.BUSINESS_BASE_COSTS = {
    RETAIL: { startup: 5000, daily_operating: 200 },
    FACTORY: { startup: 20000, daily_operating: 800 },
    MINE: { startup: 15000, daily_operating: 600 },
    FARM: { startup: 8000, daily_operating: 300 },
    LOGISTICS: { startup: 12000, daily_operating: 500 },
    SECURITY_FIRM: { startup: 10000, daily_operating: 400 },
    FRONT_COMPANY: { startup: 18000, daily_operating: 700 },
};
// Game constants for new systems
exports.ZONE_BONUSES = {
    TOURIST_DISTRICT: { revenue_modifier: 0.2, detection_modifier: 0.1, setup_cost_modifier: 1.0, description: 'High foot traffic, popular with tourists' },
    INDUSTRIAL: { revenue_modifier: -0.1, detection_modifier: -0.1, setup_cost_modifier: 0.8, description: 'Factory zone, great for manufacturing' },
    PORT: { revenue_modifier: 0.0, detection_modifier: 0.0, setup_cost_modifier: 1.1, description: 'Shipping hub, logistics bonuses' },
    DOWNTOWN: { revenue_modifier: 0.15, detection_modifier: 0.05, setup_cost_modifier: 1.25, description: 'City center, premium location' },
    SUBURB: { revenue_modifier: -0.1, detection_modifier: -0.15, setup_cost_modifier: 0.7, description: 'Quiet residential area' },
    REDLIGHT: { revenue_modifier: 0.4, detection_modifier: 0.3, setup_cost_modifier: 0.9, description: 'Underground economy thrives here' },
};
exports.SABOTAGE_CONFIG = {
    ARSON: { cost: 5000, success_chance: 0.5, rivalry_points: 15, description: 'Burn down a rival facility' },
    THEFT: { cost: 3000, success_chance: 0.6, rivalry_points: 10, description: 'Steal resources from a rival' },
    POACH_EMPLOYEE: { cost: 8000, success_chance: 0.4, rivalry_points: 8, description: 'Steal a rival employee' },
    SPREAD_RUMORS: { cost: 2000, success_chance: 0.7, rivalry_points: 5, description: 'Damage rival reputation' },
};
exports.MANAGER_TIER_CONFIG = {
    LEVEL_1: { min_efficiency: 60, efficiency_bonus: 0.1, embezzlement_risk: 0.05 },
    LEVEL_2: { min_efficiency: 75, efficiency_bonus: 0.2, embezzlement_risk: 0.03 },
    LEVEL_3: { min_efficiency: 90, efficiency_bonus: 0.3, embezzlement_risk: 0.01 },
};
exports.RIVALRY_THRESHOLDS = {
    NEUTRAL: { min: 0, max: 20 },
    COMPETITIVE: { min: 21, max: 50 },
    HOSTILE: { min: 51, max: 75 },
    WAR: { min: 76, max: 90 },
    BLOOD_FEUD: { min: 91, max: 100 },
};
//# sourceMappingURL=entities.js.map