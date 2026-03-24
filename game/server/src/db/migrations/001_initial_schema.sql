-- ============================================================
-- Economy Game — Initial Schema Migration
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ───────────────────────────────────────────────────

CREATE TYPE business_type AS ENUM (
  'RETAIL', 'FACTORY', 'MINE', 'FARM', 'LOGISTICS', 'SECURITY_FIRM', 'FRONT_COMPANY'
);

CREATE TYPE business_status AS ENUM (
  'ACTIVE', 'IDLE', 'RAIDED', 'BANKRUPT', 'SUSPENDED'
);

CREATE TYPE employee_role AS ENUM (
  'WORKER', 'MANAGER', 'SECURITY', 'DRIVER', 'ENFORCER', 'ACCOUNTANT'
);

CREATE TYPE resource_category AS ENUM (
  'RAW_MATERIAL', 'PROCESSED_GOOD', 'LUXURY', 'ILLEGAL', 'SERVICE'
);

CREATE TYPE listing_type AS ENUM (
  'AI_SELL', 'AI_BUY', 'PLAYER_SELL', 'PLAYER_BUY'
);

CREATE TYPE listing_status AS ENUM (
  'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED'
);

CREATE TYPE contract_period AS ENUM ('DAILY', 'WEEKLY');

CREATE TYPE contract_status AS ENUM (
  'PENDING', 'ACTIVE', 'COMPLETED', 'BREACHED', 'CANCELLED'
);

CREATE TYPE crime_op_type AS ENUM (
  'SMUGGLING', 'THEFT', 'EXTORTION', 'FRAUD', 'DRUG_TRADE', 'BRIBERY', 'SABOTAGE'
);

CREATE TYPE crime_op_status AS ENUM (
  'PLANNING', 'ACTIVE', 'COMPLETED', 'BUSTED', 'ABORTED'
);

CREATE TYPE laundering_method AS ENUM (
  'BUSINESS_REVENUE', 'REAL_ESTATE', 'SHELL_COMPANY', 'CRYPTO_ANALOG'
);

CREATE TYPE laundering_status AS ENUM (
  'IN_PROGRESS', 'COMPLETED', 'SEIZED'
);

CREATE TYPE heat_level AS ENUM (
  'COLD', 'WARM', 'HOT', 'BURNING', 'FUGITIVE'
);

CREATE TYPE player_alignment AS ENUM (
  'LEGAL', 'MIXED', 'CRIMINAL'
);

CREATE TYPE season_status AS ENUM (
  'UPCOMING', 'ACTIVE', 'ENDING', 'COMPLETED'
);

CREATE TYPE city_size AS ENUM (
  'SMALL', 'MEDIUM', 'LARGE', 'CAPITAL'
);

CREATE TYPE alert_type AS ENUM (
  'CONTRACT_SETTLED', 'CONTRACT_BREACHED', 'EMPLOYEE_THEFT', 'DETECTION_WARNING',
  'CRIME_COMPLETED', 'CRIME_BUSTED', 'LAUNDERING_COMPLETE', 'LAUNDERING_SEIZED',
  'BUSINESS_RAIDED', 'SEASON_ENDING', 'EMPLOYEE_QUIT', 'MARKET_CONTRACT_OFFER'
);

-- ─── SEASON PROFILES ─────────────────────────────────────────

CREATE TABLE season_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_number      INTEGER NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  started_at         TIMESTAMPTZ NOT NULL,
  ends_at            TIMESTAMPTZ NOT NULL,
  status             season_status NOT NULL DEFAULT 'UPCOMING',
  starting_cash      NUMERIC(20, 2) NOT NULL DEFAULT 10000,
  tax_rate_brackets  JSONB NOT NULL DEFAULT '[]',
  crime_multiplier   NUMERIC(6, 4) NOT NULL DEFAULT 1.0,
  resource_set       TEXT[] NOT NULL DEFAULT '{}',
  special_rule       TEXT,
  total_players      INTEGER NOT NULL DEFAULT 0,
  top_players        JSONB NOT NULL DEFAULT '[]',
  winner_id          UUID
);

CREATE INDEX idx_season_profiles_status ON season_profiles(status);
CREATE INDEX idx_season_profiles_season_number ON season_profiles(season_number);

-- ─── PLAYERS ─────────────────────────────────────────────────

CREATE TABLE players (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username             TEXT NOT NULL UNIQUE,
  email                TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Season-scoped fields
  season_id            UUID REFERENCES season_profiles(id),
  cash                 NUMERIC(20, 2) NOT NULL DEFAULT 0,
  net_worth            NUMERIC(20, 2) NOT NULL DEFAULT 0,
  business_slots       INTEGER NOT NULL DEFAULT 3,
  reputation_score     INTEGER NOT NULL DEFAULT 0,
  alignment            player_alignment NOT NULL DEFAULT 'LEGAL',
  -- Cross-season persistent fields
  meta_points          INTEGER NOT NULL DEFAULT 0,
  season_history       JSONB NOT NULL DEFAULT '[]',
  cosmetics            TEXT[] NOT NULL DEFAULT '{}',
  veteran_bonus_cash   NUMERIC(20, 2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_players_season_id ON players(season_id);
CREATE INDEX idx_players_net_worth ON players(net_worth DESC);
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_email ON players(email);

-- ─── REFRESH TOKENS ──────────────────────────────────────────

CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_player_id ON refresh_tokens(player_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- ─── RESOURCES ───────────────────────────────────────────────

CREATE TABLE resources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  category         resource_category NOT NULL,
  tier             INTEGER NOT NULL DEFAULT 1,
  base_value       NUMERIC(12, 2) NOT NULL,
  weight           NUMERIC(8, 3) NOT NULL DEFAULT 1.0,
  perishable       BOOLEAN NOT NULL DEFAULT FALSE,
  perish_hours     INTEGER,
  illegal          BOOLEAN NOT NULL DEFAULT FALSE,
  season_id        UUID NOT NULL REFERENCES season_profiles(id),
  global_supply    NUMERIC(16, 2) NOT NULL DEFAULT 10000,
  global_demand    NUMERIC(16, 2) NOT NULL DEFAULT 10000,
  current_ai_price NUMERIC(12, 2) NOT NULL
);

CREATE INDEX idx_resources_season_id ON resources(season_id);
CREATE INDEX idx_resources_category ON resources(category);
CREATE INDEX idx_resources_name ON resources(name);

-- ─── BUSINESSES ──────────────────────────────────────────────

CREATE TABLE businesses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id           UUID NOT NULL REFERENCES season_profiles(id),
  name                TEXT NOT NULL,
  type                business_type NOT NULL,
  tier                INTEGER NOT NULL DEFAULT 1,
  city                TEXT NOT NULL,
  established_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status              business_status NOT NULL DEFAULT 'IDLE',
  capacity            INTEGER NOT NULL DEFAULT 100,
  efficiency          NUMERIC(6, 4) NOT NULL DEFAULT 1.0,
  inventory           JSONB NOT NULL DEFAULT '{}',
  storage_cap         INTEGER NOT NULL DEFAULT 500,
  daily_operating_cost NUMERIC(12, 2) NOT NULL,
  total_revenue       NUMERIC(20, 2) NOT NULL DEFAULT 0,
  total_expenses      NUMERIC(20, 2) NOT NULL DEFAULT 0,
  is_front            BOOLEAN NOT NULL DEFAULT FALSE,
  front_capacity      NUMERIC(16, 2) NOT NULL DEFAULT 0,
  suspicion_level     INTEGER NOT NULL DEFAULT 0,
  security_layer_id   UUID
);

CREATE INDEX idx_businesses_owner_season ON businesses(owner_id, season_id);
CREATE INDEX idx_businesses_season_id ON businesses(season_id);
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_city ON businesses(city);

-- ─── EMPLOYEES ───────────────────────────────────────────────

CREATE TABLE employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID REFERENCES businesses(id) ON DELETE SET NULL,
  season_id           UUID NOT NULL REFERENCES season_profiles(id),
  name                TEXT NOT NULL,
  hired_at            TIMESTAMPTZ,
  efficiency          NUMERIC(6, 4) NOT NULL DEFAULT 1.0,
  speed               NUMERIC(6, 4) NOT NULL DEFAULT 1.0,
  loyalty             NUMERIC(6, 4) NOT NULL DEFAULT 1.0,
  reliability         NUMERIC(6, 4) NOT NULL DEFAULT 1.0,
  corruption_risk     NUMERIC(6, 4) NOT NULL DEFAULT 0.05,
  salary              NUMERIC(12, 2) NOT NULL,
  role                employee_role NOT NULL DEFAULT 'WORKER',
  experience_points   INTEGER NOT NULL DEFAULT 0,
  morale              NUMERIC(6, 4) NOT NULL DEFAULT 1.0,
  criminal_capable    BOOLEAN NOT NULL DEFAULT FALSE,
  bribe_resistance    NUMERIC(6, 4) NOT NULL DEFAULT 0.5
);

CREATE INDEX idx_employees_business_id ON employees(business_id);
CREATE INDEX idx_employees_season_id ON employees(season_id);
CREATE INDEX idx_employees_business_season ON employees(business_id, season_id);

-- ─── MARKET LISTINGS ─────────────────────────────────────────

CREATE TABLE market_listings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id         UUID NOT NULL REFERENCES season_profiles(id),
  listing_type      listing_type NOT NULL,
  seller_id         UUID REFERENCES players(id) ON DELETE SET NULL,
  business_id       UUID REFERENCES businesses(id) ON DELETE SET NULL,
  resource_id       UUID NOT NULL REFERENCES resources(id),
  city              TEXT NOT NULL,
  quantity          NUMERIC(14, 2) NOT NULL,
  quantity_remaining NUMERIC(14, 2) NOT NULL,
  price_per_unit    NUMERIC(12, 2) NOT NULL,
  min_quantity      NUMERIC(14, 2) NOT NULL DEFAULT 1,
  expires_at        TIMESTAMPTZ,
  is_anonymous      BOOLEAN NOT NULL DEFAULT FALSE,
  status            listing_status NOT NULL DEFAULT 'OPEN',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filled_at         TIMESTAMPTZ
);

CREATE INDEX idx_market_listings_season_city ON market_listings(season_id, city);
CREATE INDEX idx_market_listings_resource ON market_listings(resource_id);
CREATE INDEX idx_market_listings_season_resource ON market_listings(season_id, resource_id);
CREATE INDEX idx_market_listings_status ON market_listings(status);
CREATE INDEX idx_market_listings_seller ON market_listings(seller_id);
CREATE INDEX idx_market_listings_season_city_resource ON market_listings(season_id, city, resource_id);

-- ─── TRADE CONTRACTS ─────────────────────────────────────────

CREATE TABLE trade_contracts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id            UUID NOT NULL REFERENCES season_profiles(id),
  initiator_id         UUID NOT NULL REFERENCES players(id),
  counterparty_id      UUID REFERENCES players(id),
  resource_id          UUID NOT NULL REFERENCES resources(id),
  quantity_per_period  NUMERIC(14, 2) NOT NULL,
  price_per_unit       NUMERIC(12, 2) NOT NULL,
  period               contract_period NOT NULL DEFAULT 'WEEKLY',
  duration_periods     INTEGER NOT NULL,
  periods_completed    INTEGER NOT NULL DEFAULT 0,
  status               contract_status NOT NULL DEFAULT 'PENDING',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_settlement      TIMESTAMPTZ NOT NULL,
  breach_penalty       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  auto_renew           BOOLEAN NOT NULL DEFAULT FALSE,
  price_locked         BOOLEAN NOT NULL DEFAULT TRUE,
  delivery_city        TEXT NOT NULL
);

CREATE INDEX idx_trade_contracts_initiator_season ON trade_contracts(initiator_id, season_id);
CREATE INDEX idx_trade_contracts_counterparty ON trade_contracts(counterparty_id);
CREATE INDEX idx_trade_contracts_season ON trade_contracts(season_id);
CREATE INDEX idx_trade_contracts_status ON trade_contracts(status);
CREATE INDEX idx_trade_contracts_next_settlement ON trade_contracts(next_settlement);

-- ─── CRIMINAL OPERATIONS ─────────────────────────────────────

CREATE TABLE criminal_operations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id             UUID NOT NULL REFERENCES players(id),
  business_id           UUID REFERENCES businesses(id) ON DELETE SET NULL,
  season_id             UUID NOT NULL REFERENCES season_profiles(id),
  op_type               crime_op_type NOT NULL,
  target_id             UUID REFERENCES players(id),
  status                crime_op_status NOT NULL DEFAULT 'PLANNING',
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completes_at          TIMESTAMPTZ NOT NULL,
  dirty_money_yield     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  risk_level            INTEGER NOT NULL,
  employees_assigned    UUID[] NOT NULL DEFAULT '{}',
  was_detected          BOOLEAN,
  penalty_applied       JSONB,
  detection_roll        NUMERIC(8, 6)
);

CREATE INDEX idx_criminal_ops_player_season ON criminal_operations(player_id, season_id);
CREATE INDEX idx_criminal_ops_status ON criminal_operations(status);
CREATE INDEX idx_criminal_ops_completes_at ON criminal_operations(completes_at);

-- ─── DIRTY MONEY BALANCES ────────────────────────────────────

CREATE TABLE dirty_money_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id       UUID NOT NULL REFERENCES season_profiles(id),
  total_dirty     NUMERIC(20, 2) NOT NULL DEFAULT 0,
  total_earned    NUMERIC(20, 2) NOT NULL DEFAULT 0,
  total_laundered NUMERIC(20, 2) NOT NULL DEFAULT 0,
  flagged         BOOLEAN NOT NULL DEFAULT FALSE,
  flagged_since   TIMESTAMPTZ,
  UNIQUE(player_id, season_id)
);

CREATE INDEX idx_dirty_money_player_season ON dirty_money_balances(player_id, season_id);

-- ─── LAUNDERING PROCESSES ────────────────────────────────────

CREATE TABLE laundering_processes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        UUID NOT NULL REFERENCES players(id),
  business_id      UUID NOT NULL REFERENCES businesses(id),
  season_id        UUID NOT NULL REFERENCES season_profiles(id),
  dirty_amount     NUMERIC(16, 2) NOT NULL,
  fee_percent      NUMERIC(6, 4) NOT NULL,
  clean_amount     NUMERIC(16, 2) NOT NULL,
  method           laundering_method NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completes_at     TIMESTAMPTZ NOT NULL,
  status           laundering_status NOT NULL DEFAULT 'IN_PROGRESS',
  detection_risk   NUMERIC(6, 4) NOT NULL
);

CREATE INDEX idx_laundering_player_season ON laundering_processes(player_id, season_id);
CREATE INDEX idx_laundering_status ON laundering_processes(status);
CREATE INDEX idx_laundering_completes_at ON laundering_processes(completes_at);

-- ─── SECURITY LAYERS ─────────────────────────────────────────

CREATE TABLE security_layers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  player_id           UUID NOT NULL REFERENCES players(id),
  season_id           UUID NOT NULL REFERENCES season_profiles(id),
  tier                INTEGER NOT NULL DEFAULT 1,
  daily_cost          NUMERIC(12, 2) NOT NULL,
  protection_rating   NUMERIC(6, 4) NOT NULL DEFAULT 0.1,
  employee_watch      NUMERIC(6, 4) NOT NULL DEFAULT 0.1,
  anti_infiltration   NUMERIC(6, 4) NOT NULL DEFAULT 0.1,
  purchased_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_upgraded       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  security_staff_ids  UUID[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_security_layers_player_season ON security_layers(player_id, season_id);
CREATE INDEX idx_security_layers_business ON security_layers(business_id);

-- ─── HEAT SCORES ─────────────────────────────────────────────

CREATE TABLE heat_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id             UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id             UUID NOT NULL REFERENCES season_profiles(id),
  score                 NUMERIC(8, 2) NOT NULL DEFAULT 0,
  level                 heat_level NOT NULL DEFAULT 'COLD',
  last_criminal_act     TIMESTAMPTZ,
  decay_rate            NUMERIC(8, 4) NOT NULL DEFAULT 2.0,
  bribe_cooldown        TIMESTAMPTZ,
  informant_active      BOOLEAN NOT NULL DEFAULT FALSE,
  under_investigation   BOOLEAN NOT NULL DEFAULT FALSE,
  investigation_ends    TIMESTAMPTZ,
  UNIQUE(player_id, season_id)
);

CREATE INDEX idx_heat_scores_player_season ON heat_scores(player_id, season_id);

-- ─── ALERTS ──────────────────────────────────────────────────

CREATE TABLE alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id  UUID NOT NULL REFERENCES season_profiles(id),
  type       alert_type NOT NULL,
  message    TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_player_season ON alerts(player_id, season_id);
CREATE INDEX idx_alerts_player_read ON alerts(player_id, read);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

-- ─── PRICE HISTORY ───────────────────────────────────────────

CREATE TABLE price_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id),
  season_id   UUID NOT NULL REFERENCES season_profiles(id),
  price       NUMERIC(12, 2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_history_resource_season ON price_history(resource_id, season_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at DESC);

-- ─── ADD SECURITY LAYER FK TO BUSINESSES ─────────────────────

ALTER TABLE businesses ADD CONSTRAINT fk_businesses_security_layer
  FOREIGN KEY (security_layer_id) REFERENCES security_layers(id) ON DELETE SET NULL;
