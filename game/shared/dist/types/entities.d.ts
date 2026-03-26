export type BusinessType = 'RETAIL' | 'FACTORY' | 'MINE' | 'FARM' | 'LOGISTICS' | 'SECURITY_FIRM' | 'FRONT_COMPANY';
export type BusinessStatus = 'ACTIVE' | 'IDLE' | 'RAIDED' | 'BANKRUPT' | 'SUSPENDED';
export type EmployeeRole = 'WORKER' | 'MANAGER' | 'SECURITY' | 'DRIVER' | 'ENFORCER' | 'ACCOUNTANT';
export type ResourceCategory = 'RAW_MATERIAL' | 'PROCESSED_GOOD' | 'LUXURY' | 'ILLEGAL' | 'SERVICE';
export type ListingType = 'AI_SELL' | 'AI_BUY' | 'PLAYER_SELL' | 'PLAYER_BUY';
export type ListingStatus = 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
export type ContractPeriod = 'DAILY' | 'WEEKLY';
export type ContractStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'BREACHED' | 'CANCELLED';
export type CrimeOpType = 'SMUGGLING' | 'THEFT' | 'EXTORTION' | 'FRAUD' | 'DRUG_TRADE' | 'BRIBERY' | 'SABOTAGE';
export type CrimeOpStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'BUSTED' | 'ABORTED';
export type LaunderingMethod = 'BUSINESS_REVENUE' | 'REAL_ESTATE' | 'SHELL_COMPANY' | 'CRYPTO_ANALOG';
export type LaunderingStatus = 'IN_PROGRESS' | 'COMPLETED' | 'SEIZED';
export type HeatLevel = 'COLD' | 'WARM' | 'HOT' | 'BURNING' | 'FUGITIVE';
export type PlayerAlignment = 'LEGAL' | 'MIXED' | 'CRIMINAL';
export type SeasonStatus = 'UPCOMING' | 'ACTIVE' | 'ENDING' | 'COMPLETED';
export type CitySize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'CAPITAL';
export interface Player {
    id: string;
    username: string;
    email: string;
    created_at: string;
    last_active: string;
    season_id: string;
    cash: number;
    net_worth: number;
    business_slots: number;
    reputation_score: number;
    alignment: PlayerAlignment;
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
export type AlertType = 'CONTRACT_SETTLED' | 'CONTRACT_BREACHED' | 'EMPLOYEE_THEFT' | 'DETECTION_WARNING' | 'CRIME_COMPLETED' | 'CRIME_BUSTED' | 'LAUNDERING_COMPLETE' | 'LAUNDERING_SEIZED' | 'BUSINESS_RAIDED' | 'SEASON_ENDING' | 'EMPLOYEE_QUIT' | 'MARKET_CONTRACT_OFFER';
export declare const CITIES: City[];
export declare const LAUNDERING_METHODS: Record<LaunderingMethod, {
    fee: number;
    hours_per_10k: number;
    detection_modifier: number;
    max_per_day: number;
}>;
export declare const HEAT_THRESHOLDS: Record<HeatLevel, {
    min: number;
    max: number;
}>;
export declare const CRIME_OP_CONFIGS: Record<CrimeOpType, {
    risk_level: number;
    base_yield: number;
    duration_hours: number;
    requires_criminal_employees: number;
}>;
export declare const BUSINESS_BASE_COSTS: Record<BusinessType, {
    startup: number;
    daily_operating: number;
}>;
export type ReputationAxis = 'BUSINESS' | 'CRIMINAL' | 'NEGOTIATION' | 'EMPLOYEE' | 'COMMUNITY' | 'RELIABILITY';
export interface ReputationProfile {
    id: string;
    player_id: string;
    axis: ReputationAxis;
    score: number;
    last_updated: string;
}
export interface ReputationEvent {
    id: string;
    player_id: string;
    event_type: string;
    axis: ReputationAxis;
    impact: number;
    description: string;
    created_at: string;
}
export interface Syndicate {
    id: string;
    name: string;
    leader_id: string;
    status: string;
    treasury: number;
    member_count: number;
    created_at: string;
}
export interface SyndicateMember {
    id: string;
    syndicate_id: string;
    player_id: string;
    role: string;
    joined_at: string;
}
export interface TrustLevel {
    id: string;
    player_a: string;
    player_b: string;
    trust_score: number;
    betrayal_count: number;
    last_updated: string;
}
export type RivalryState = 'NEUTRAL' | 'COMPETITIVE' | 'HOSTILE' | 'WAR' | 'BLOOD_FEUD';
export interface RivalryPoints {
    id: string;
    player_a: string;
    player_b: string;
    points: number;
    state: RivalryState;
    last_escalation: string;
}
export type SabotageType = 'ARSON' | 'THEFT' | 'POACH_EMPLOYEE' | 'SPREAD_RUMORS';
export interface SabotageRecord {
    id: string;
    attacker_id: string;
    target_id: string;
    sabotage_type: SabotageType;
    damage: number;
    success: boolean;
    created_at: string;
}
export type IntelligenceType = 'EMPLOYEE_COUNT' | 'PRODUCTION_LEVEL' | 'CASH_POSITION' | 'CRIME_OPS' | 'HEAT_LEVEL' | 'CONTRACTS' | 'LOCATION';
export type SpyStatus = 'ACTIVE' | 'DISCOVERED' | 'TURNED' | 'INACTIVE';
export interface Spy {
    id: string;
    owner_player_id: string;
    spy_employee_id: string;
    target_player_id: string;
    status: SpyStatus;
    discovery_risk: number;
    intel_gathered: Record<string, any>;
    placed_at: string;
}
export interface IntelligenceListing {
    id: string;
    seller_id: string;
    buyer_id: string;
    intel_type: IntelligenceType;
    target_player_id: string;
    data: Record<string, any>;
    accuracy: number;
    price: number;
    purchased_at: string;
}
export type ManagerTier = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
export interface ManagerAssignment {
    id: string;
    player_id: string;
    business_id: string;
    employee_id: string;
    manager_tier: ManagerTier;
    efficiency_bonus: number;
    embezzlement_risk: number;
    assigned_at: string;
}
export interface EmbezzlementLog {
    id: string;
    manager_id: string;
    amount: number;
    detected: boolean;
    created_at: string;
}
export type TransportType = 'LOCAL_COURIER' | 'REGIONAL' | 'SHIPPING' | 'BLACK_MARKET';
export interface TransportRoute {
    id: string;
    origin_city: string;
    destination_city: string;
    transport: TransportType;
    base_cost: number;
    risk_level: number;
    travel_time_hours: number;
}
export interface Shipment {
    id: string;
    player_id: string;
    route_id: string;
    items_json: Record<string, any>;
    status: string;
    loss_rate: number;
    departed_at: string;
    arrives_at: string;
}
export interface Blockade {
    id: string;
    player_id: string;
    route_id: string;
    strength: number;
    active: boolean;
    cost: number;
    created_at: string;
}
export type LocationZone = 'TOURIST_DISTRICT' | 'INDUSTRIAL' | 'PORT' | 'DOWNTOWN' | 'SUBURB' | 'REDLIGHT';
export interface GameLocation {
    id: string;
    player_id: string;
    name: string;
    zone: LocationZone;
    city: string;
    setup_cost: number;
    monthly_cost: number;
    traffic_level: number;
    status: string;
    created_at: string;
}
export type EventCategory = 'MARKET_CRASH' | 'SUPPLY_SURGE' | 'POLICE_CRACKDOWN' | 'EMPLOYEE_STRIKE' | 'RIVAL_COLLAPSE' | 'DISASTER' | 'POLITICAL' | 'INSIDER_LEAK' | 'ALLIANCE_COLLAPSE' | 'BOOM';
export interface SeasonalEvent {
    id: string;
    season_id: string;
    category: EventCategory;
    title: string;
    description: string;
    probability: number;
    triggered_at: string;
    impact_json: Record<string, any>;
    status: string;
    duration_hours: number;
}
export interface EventImpact {
    id: string;
    event_id: string;
    affected_player_id: string;
    impact_type: string;
    magnitude: number;
    resolved: boolean;
}
export interface EmployeeTrait {
    id: string;
    employee_id: string;
    trait_name: string;
    trait_value: number;
    discovered: boolean;
}
export interface EmployeeSkill {
    id: string;
    employee_id: string;
    skill_type: string;
    level: number;
    experience: number;
}
export interface PoachingOffer {
    id: string;
    source_player_id: string;
    target_employee_id: string;
    offer_amount: number;
    status: string;
    created_at: string;
}
export interface ProfitShare {
    id: string;
    player_a: string;
    player_b: string;
    business_id: string;
    share_percent: number;
    profit_total: number;
    last_settlement: string;
}
export declare const ZONE_BONUSES: Record<LocationZone, {
    revenue_modifier: number;
    detection_modifier: number;
    setup_cost_modifier: number;
    description: string;
}>;
export declare const SABOTAGE_CONFIG: Record<SabotageType, {
    cost: number;
    success_chance: number;
    rivalry_points: number;
    description: string;
}>;
export declare const MANAGER_TIER_CONFIG: Record<ManagerTier, {
    min_efficiency: number;
    efficiency_bonus: number;
    embezzlement_risk: number;
}>;
export declare const RIVALRY_THRESHOLDS: Record<RivalryState, {
    min: number;
    max: number;
}>;
//# sourceMappingURL=entities.d.ts.map