// ============================================================
// SHARED ENTITY TYPES — consumed by both server and client
// ============================================================

// ─── Enums ───────────────────────────────────────────────────

export type BusinessType =
  | 'RETAIL'
  | 'FACTORY'
  | 'MINE'
  | 'FARM'
  | 'LOGISTICS'
  | 'SECURITY_FIRM'
  | 'FRONT_COMPANY';

export type BusinessStatus = 'ACTIVE' | 'IDLE' | 'RAIDED' | 'BANKRUPT' | 'SUSPENDED';

export type EmployeeRole =
  | 'WORKER'
  | 'MANAGER'
  | 'SECURITY'
  | 'DRIVER'
  | 'ENFORCER'
  | 'ACCOUNTANT';

export type ResourceCategory =
  | 'RAW_MATERIAL'
  | 'PROCESSED_GOOD'
  | 'LUXURY'
  | 'ILLEGAL'
  | 'SERVICE';

export type ListingType = 'AI_SELL' | 'AI_BUY' | 'PLAYER_SELL' | 'PLAYER_BUY';
export type ListingStatus = 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED';

export type ContractPeriod = 'DAILY' | 'WEEKLY';
export type ContractStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'BREACHED' | 'CANCELLED';

export type CrimeOpType =
  | 'SMUGGLING'
  | 'THEFT'
  | 'EXTORTION'
  | 'FRAUD'
  | 'DRUG_TRADE'
  | 'BRIBERY'
  | 'SABOTAGE';

export type CrimeOpStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'BUSTED' | 'ABORTED';

export type LaunderingMethod =
  | 'BUSINESS_REVENUE'
  | 'REAL_ESTATE'
  | 'SHELL_COMPANY'
  | 'CRYPTO_ANALOG';

export type LaunderingStatus = 'IN_PROGRESS' | 'COMPLETED' | 'SEIZED';

export type HeatLevel = 'COLD' | 'WARM' | 'HOT' | 'BURNING' | 'FUGITIVE';

export type PlayerAlignment = 'LEGAL' | 'MIXED' | 'CRIMINAL';

export type SeasonStatus = 'UPCOMING' | 'ACTIVE' | 'ENDING' | 'COMPLETED';

export type CitySize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'CAPITAL';

// ─── Core Entities ────────────────────────────────────────────

export interface Player {
  id: string;
  username: string;
  email: string;
  created_at: string;
  last_active: string;
  // Season-scoped
  season_id: string;
  cash: number;
  net_worth: number;
  business_slots: number;
  reputation_score: number;
  alignment: PlayerAlignment;
  // Cross-season persistent
  meta_points: number;
  season_history: SeasonHistoryEntry[];
  cosmetics: string[];
  veteran_bonus_cash: number;
}

export interface SeasonHistoryEntry {
  season_id: string;
  rank: number;
  net_worth: number;
  achievements: string[];
}

export interface Business {
  id: string;
  owner_id: string;
  season_id: string;
  name: string;
  type: BusinessType;
  tier: number;
  city: string;
  established_at: string;
  status: BusinessStatus;
  capacity: number;
  efficiency: number;
  inventory: Record<string, number>;
  storage_cap: number;
  daily_operating_cost: number;
  total_revenue: number;
  total_expenses: number;
  is_front: boolean;
  front_capacity: number;
  suspicion_level: number;
  security_layer_id: string | null;
}

export interface Employee {
  id: string;
  business_id: string;
  season_id: string;
  name: string;
  hired_at: string;
  efficiency: number;
  speed: number;
  loyalty: number;
  reliability: number;
  corruption_risk: number;
  salary: number;
  role: EmployeeRole;
  experience_points: number;
  morale: number;
  criminal_capable: boolean;
  bribe_resistance: number;
}

export interface Resource {
  id: string;
  name: string;
  category: ResourceCategory;
  tier: number;
  base_value: number;
  weight: number;
  perishable: boolean;
  perish_hours: number | null;
  illegal: boolean;
  season_id: string;
  global_supply: number;
  global_demand: number;
  current_ai_price: number;
}

export interface MarketListing {
  id: string;
  season_id: string;
  listing_type: ListingType;
  seller_id: string | null;
  seller_username?: string;
  business_id: string | null;
  resource_id: string;
  resource_name?: string;
  city: string;
  quantity: number;
  quantity_remaining: number;
  price_per_unit: number;
  min_quantity: number;
  expires_at: string | null;
  is_anonymous: boolean;
  status: ListingStatus;
  created_at: string;
  filled_at: string | null;
}

export interface TradeContract {
  id: string;
  season_id: string;
  initiator_id: string;
  initiator_username?: string;
  counterparty_id: string | null;
  counterparty_username?: string;
  resource_id: string;
  resource_name?: string;
  quantity_per_period: number;
  price_per_unit: number;
  period: ContractPeriod;
  duration_periods: number;
  periods_completed: number;
  status: ContractStatus;
  created_at: string;
  next_settlement: string;
  breach_penalty: number;
  auto_renew: boolean;
  price_locked: boolean;
  delivery_city: string;
}

export interface CriminalOperation {
  id: string;
  player_id: string;
  business_id: string | null;
  season_id: string;
  op_type: CrimeOpType;
  target_id: string | null;
  status: CrimeOpStatus;
  started_at: string;
  completes_at: string;
  dirty_money_yield: number;
  risk_level: number;
  employees_assigned: string[];
  was_detected: boolean | null;
  penalty_applied: CrimePenalty | null;
  detection_roll: number | null;
}

export interface CrimePenalty {
  type: 'FINE' | 'RAID' | 'ARREST' | 'FULL_TAKEDOWN';
  amount?: number;
  duration_hours?: number;
  assets_seized_percent?: number;
}

export interface DirtyMoneyBalance {
  id: string;
  player_id: string;
  season_id: string;
  total_dirty: number;
  total_earned: number;
  total_laundered: number;
  flagged: boolean;
  flagged_since: string | null;
}

export interface LaunderingProcess {
  id: string;
  player_id: string;
  business_id: string;
  season_id: string;
  dirty_amount: number;
  fee_percent: number;
  clean_amount: number;
  method: LaunderingMethod;
  started_at: string;
  completes_at: string;
  status: LaunderingStatus;
  detection_risk: number;
}

export interface SecurityLayer {
  id: string;
  business_id: string;
  player_id: string;
  season_id: string;
  tier: number;
  daily_cost: number;
  protection_rating: number;
  employee_watch: number;
  anti_infiltration: number;
  purchased_at: string;
  last_upgraded: string;
  security_staff_ids: string[];
}

export interface SeasonProfile {
  id: string;
  season_number: number;
  name: string;
  started_at: string;
  ends_at: string;
  status: SeasonStatus;
  starting_cash: number;
  tax_rate_brackets: TaxBracket[];
  crime_multiplier: number;
  resource_set: string[];
  special_rule: string | null;
  total_players: number;
  top_players: TopPlayer[];
  winner_id: string | null;
}

export interface TaxBracket {
  min_nw: number;
  max_nw: number;
  rate: number;
}

export interface TopPlayer {
  player_id: string;
  username: string;
  rank: number;
  net_worth: number;
}

export interface HeatScore {
  id: string;
  player_id: string;
  season_id: string;
  score: number;
  level: HeatLevel;
  last_criminal_act: string | null;
  decay_rate: number;
  bribe_cooldown: string | null;
  informant_active: boolean;
  under_investigation: boolean;
  investigation_ends: string | null;
}

export interface City {
  name: string;
  size: CitySize;
  region: string;
}

// ─── API Response shapes ──────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface LeaderboardEntry {
  rank: number;
  player_id: string;
  username: string;
  net_worth: number;
  alignment: PlayerAlignment;
  business_count: number;
}

export interface DashboardData {
  player: Player;
  active_ops: CriminalOperation[];
  active_laundering: LaunderingProcess[];
  season: SeasonProfile;
  rank: number;
  alerts: GameAlert[];
}

export interface GameAlert {
  id: string;
  type: AlertType;
  message: string;
  created_at: string;
  read: boolean;
  data?: Record<string, unknown>;
}

export type AlertType =
  | 'CONTRACT_SETTLED'
  | 'CONTRACT_BREACHED'
  | 'EMPLOYEE_THEFT'
  | 'DETECTION_WARNING'
  | 'CRIME_COMPLETED'
  | 'CRIME_BUSTED'
  | 'LAUNDERING_COMPLETE'
  | 'LAUNDERING_SEIZED'
  | 'BUSINESS_RAIDED'
  | 'SEASON_ENDING'
  | 'EMPLOYEE_QUIT'
  | 'MARKET_CONTRACT_OFFER';

// ─── Game constants ───────────────────────────────────────────

export const CITIES: City[] = [
  { name: 'Ironport', size: 'CAPITAL', region: 'North' },
  { name: 'Duskfield', size: 'LARGE', region: 'North' },
  { name: 'Ashvale', size: 'MEDIUM', region: 'South' },
  { name: 'Coldmarsh', size: 'MEDIUM', region: 'South' },
  { name: 'Farrow', size: 'SMALL', region: 'East' },
];

export const LAUNDERING_METHODS: Record<
  LaunderingMethod,
  { fee: number; hours_per_10k: number; detection_modifier: number; max_per_day: number }
> = {
  BUSINESS_REVENUE: { fee: 0.15, hours_per_10k: 48, detection_modifier: 0.8, max_per_day: 50000 },
  REAL_ESTATE: { fee: 0.25, hours_per_10k: 33.6, detection_modifier: 0.5, max_per_day: 100000 },
  SHELL_COMPANY: { fee: 0.30, hours_per_10k: 9.6, detection_modifier: 1.0, max_per_day: 50000 },
  CRYPTO_ANALOG: { fee: 0.10, hours_per_10k: 12, detection_modifier: 2.0, max_per_day: 20000 },
};

export const HEAT_THRESHOLDS: Record<HeatLevel, { min: number; max: number }> = {
  COLD: { min: 0, max: 99 },
  WARM: { min: 100, max: 299 },
  HOT: { min: 300, max: 599 },
  BURNING: { min: 600, max: 899 },
  FUGITIVE: { min: 900, max: 1000 },
};

export const CRIME_OP_CONFIGS: Record<
  CrimeOpType,
  { risk_level: number; base_yield: number; duration_hours: number; requires_criminal_employees: number }
> = {
  SMUGGLING: { risk_level: 3, base_yield: 8000, duration_hours: 6, requires_criminal_employees: 2 },
  THEFT: { risk_level: 5, base_yield: 4000, duration_hours: 2, requires_criminal_employees: 1 },
  EXTORTION: { risk_level: 6, base_yield: 12000, duration_hours: 12, requires_criminal_employees: 2 },
  FRAUD: { risk_level: 4, base_yield: 15000, duration_hours: 24, requires_criminal_employees: 1 },
  DRUG_TRADE: { risk_level: 8, base_yield: 30000, duration_hours: 8, requires_criminal_employees: 3 },
  BRIBERY: { risk_level: 2, base_yield: 5000, duration_hours: 1, requires_criminal_employees: 0 },
  SABOTAGE: { risk_level: 7, base_yield: 0, duration_hours: 4, requires_criminal_employees: 2 },
};

export const BUSINESS_BASE_COSTS: Record<BusinessType, { startup: number; daily_operating: number }> = {
  RETAIL: { startup: 5000, daily_operating: 200 },
  FACTORY: { startup: 20000, daily_operating: 800 },
  MINE: { startup: 15000, daily_operating: 600 },
  FARM: { startup: 8000, daily_operating: 300 },
  LOGISTICS: { startup: 12000, daily_operating: 500 },
  SECURITY_FIRM: { startup: 10000, daily_operating: 400 },
  FRONT_COMPANY: { startup: 18000, daily_operating: 700 },
};
