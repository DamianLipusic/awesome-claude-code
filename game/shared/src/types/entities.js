"use strict";
// ============================================================
// SHARED ENTITY TYPES — consumed by both server and client
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUSINESS_BASE_COSTS = exports.CRIME_OP_CONFIGS = exports.HEAT_THRESHOLDS = exports.LAUNDERING_METHODS = exports.CITIES = void 0;
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
//# sourceMappingURL=entities.js.map