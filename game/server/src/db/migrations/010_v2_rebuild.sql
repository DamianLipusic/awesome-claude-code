-- ================================================================
-- EmpireOS V2 — Clean Rebuild
-- Only the tables needed for the core game loop
-- ================================================================

-- Drop all legacy tables (order matters for FK constraints)
DROP TABLE IF EXISTS syndicate_wars CASCADE;
DROP TABLE IF EXISTS syndicate_vote_kicks CASCADE;
DROP TABLE IF EXISTS syndicate_activity_log CASCADE;
DROP TABLE IF EXISTS syndicate_members CASCADE;
DROP TABLE IF EXISTS syndicates CASCADE;
DROP TABLE IF EXISTS trust_levels CASCADE;
DROP TABLE IF EXISTS spies CASCADE;
DROP TABLE IF EXISTS intelligence_market CASCADE;
DROP TABLE IF EXISTS sabotage_history CASCADE;
DROP TABLE IF EXISTS rivalry_points CASCADE;
DROP TABLE IF EXISTS hostile_takeovers CASCADE;
DROP TABLE IF EXISTS reputation_events CASCADE;
DROP TABLE IF EXISTS reputation_profiles CASCADE;
DROP TABLE IF EXISTS profit_shares CASCADE;
DROP TABLE IF EXISTS poaching_offers CASCADE;
DROP TABLE IF EXISTS location_businesses CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS districts CASCADE;
DROP TABLE IF EXISTS event_impacts CASCADE;
DROP TABLE IF EXISTS seasonal_events CASCADE;
DROP TABLE IF EXISTS manager_assignments CASCADE;
DROP TABLE IF EXISTS transport_routes CASCADE;
DROP TABLE IF EXISTS delivery_orders CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS contract_breaches CASCADE;
DROP TABLE IF EXISTS trade_contracts CASCADE;
DROP TABLE IF EXISTS business_listings CASCADE;
DROP TABLE IF EXISTS business_ledger CASCADE;
DROP TABLE IF EXISTS embezzlement_logs CASCADE;
DROP TABLE IF EXISTS blockades CASCADE;
DROP TABLE IF EXISTS employee_skills CASCADE;
DROP TABLE IF EXISTS employee_traits CASCADE;
DROP TABLE IF EXISTS security_layers CASCADE;
DROP TABLE IF EXISTS laundering_processes CASCADE;
DROP TABLE IF EXISTS dirty_money_balances CASCADE;
DROP TABLE IF EXISTS heat_scores CASCADE;
DROP TABLE IF EXISTS criminal_operations CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS market_listings CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS game_ticks CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS season_profiles CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- ================================================================
-- V2 SCHEMA — Minimal, clean, focused
-- ================================================================

-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  cash NUMERIC(15,2) NOT NULL DEFAULT 50000,
  net_worth NUMERIC(15,2) NOT NULL DEFAULT 50000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auth tokens
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_player ON refresh_tokens(player_id);

-- Business types: FARM, MINE, RETAIL
-- Drop old enum types first, then recreate
DROP TYPE IF EXISTS business_type CASCADE;
DROP TYPE IF EXISTS business_status CASCADE;
DROP TYPE IF EXISTS employee_role CASCADE;
DROP TYPE IF EXISTS resource_category CASCADE;
DROP TYPE IF EXISTS listing_type CASCADE;
DROP TYPE IF EXISTS listing_status CASCADE;
DROP TYPE IF EXISTS contract_status CASCADE;
DROP TYPE IF EXISTS contract_frequency CASCADE;
DROP TYPE IF EXISTS crime_op_type CASCADE;
DROP TYPE IF EXISTS crime_op_status CASCADE;
DROP TYPE IF EXISTS heat_level CASCADE;
DROP TYPE IF EXISTS player_alignment CASCADE;
DROP TYPE IF EXISTS laundering_method CASCADE;
DROP TYPE IF EXISTS alert_type CASCADE;
DROP TYPE IF EXISTS shipment_status CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS event_rarity CASCADE;
DROP TYPE IF EXISTS spy_mission_type CASCADE;
DROP TYPE IF EXISTS spy_status CASCADE;
DROP TYPE IF EXISTS rivalry_action CASCADE;
DROP TYPE IF EXISTS syndicate_role CASCADE;
DROP TYPE IF EXISTS syndicate_war_status CASCADE;

CREATE TYPE business_type AS ENUM ('FARM', 'MINE', 'RETAIL');

CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type business_type NOT NULL,
  tier INT NOT NULL DEFAULT 1,
  inventory INT NOT NULL DEFAULT 0,
  efficiency NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_businesses_owner ON businesses(owner_id);

-- Workers (simple: just count and assignment)
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  skill INT NOT NULL DEFAULT 50,
  hired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workers_business ON workers(business_id);

-- Activity log (production, sales, events)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL, -- PRODUCTION, SALE, HIRE, CREATE_BIZ, UPGRADE, TICK
  message TEXT NOT NULL,
  amount NUMERIC(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_activity_player ON activity_log(player_id, created_at DESC);

-- Game tick log
CREATE TABLE game_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tick_number SERIAL,
  duration_ms INT,
  businesses_processed INT DEFAULT 0,
  goods_produced INT DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
