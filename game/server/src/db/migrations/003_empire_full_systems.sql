-- ============================================================
-- Migration 003: Empire Full Systems
-- Adds tables for: Reputation, Alliance, Rivalry, Intelligence,
-- Manager, Logistics, Events, Contracts Enhancement, Employee Enhancement
-- ============================================================

-- ─── NEW ENUMS (idempotent) ──────────────────────────────────

DO $$ BEGIN CREATE TYPE reputation_axis AS ENUM ('BUSINESS', 'CRIMINAL', 'NEGOTIATION', 'EMPLOYEE', 'COMMUNITY', 'RELIABILITY'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE rivalry_state AS ENUM ('NEUTRAL', 'COMPETITIVE', 'HOSTILE', 'WAR', 'BLOOD_FEUD'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE manager_tier AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE location_zone AS ENUM ('TOURIST_DISTRICT', 'INDUSTRIAL', 'PORT', 'DOWNTOWN', 'SUBURB', 'REDLIGHT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE event_category AS ENUM ('MARKET_CRASH', 'SUPPLY_SURGE', 'POLICE_CRACKDOWN', 'EMPLOYEE_STRIKE', 'RIVAL_COLLAPSE', 'DISASTER', 'POLITICAL', 'INSIDER_LEAK', 'ALLIANCE_COLLAPSE', 'BOOM'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE intelligence_type AS ENUM ('EMPLOYEE_COUNT', 'PRODUCTION_LEVEL', 'CASH_POSITION', 'CRIME_OPS', 'HEAT_LEVEL', 'CONTRACTS', 'LOCATION'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE transport_type AS ENUM ('LOCAL_COURIER', 'REGIONAL', 'SHIPPING', 'BLACK_MARKET'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE spy_status AS ENUM ('ACTIVE', 'DISCOVERED', 'TURNED', 'INACTIVE'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── REPUTATION SYSTEM ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS reputation_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  axis          reputation_axis NOT NULL,
  score         INTEGER NOT NULL DEFAULT 50,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, axis)
);
CREATE INDEX IF NOT EXISTS idx_reputation_profiles_player ON reputation_profiles(player_id);

CREATE TABLE IF NOT EXISTS reputation_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  axis          reputation_axis NOT NULL,
  impact        INTEGER NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reputation_events_player ON reputation_events(player_id);

-- ─── ALLIANCE SYSTEM ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS syndicates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  leader_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  treasury      NUMERIC(15,2) NOT NULL DEFAULT 0,
  member_count  INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_syndicates_leader ON syndicates(leader_id);

CREATE TABLE IF NOT EXISTS syndicate_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id  UUID NOT NULL REFERENCES syndicates(id) ON DELETE CASCADE,
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'MEMBER',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(syndicate_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_syndicate_members_player ON syndicate_members(player_id);
CREATE INDEX IF NOT EXISTS idx_syndicate_members_syndicate ON syndicate_members(syndicate_id);

CREATE TABLE IF NOT EXISTS trust_levels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_b      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  trust_score   INTEGER NOT NULL DEFAULT 50,
  betrayal_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_a, player_b)
);
CREATE INDEX IF NOT EXISTS idx_trust_levels_a ON trust_levels(player_a);
CREATE INDEX IF NOT EXISTS idx_trust_levels_b ON trust_levels(player_b);

-- ─── RIVALRY SYSTEM ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rivalry_points (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_b      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  points        INTEGER NOT NULL DEFAULT 0,
  state         rivalry_state NOT NULL DEFAULT 'NEUTRAL',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_a, player_b)
);
CREATE INDEX IF NOT EXISTS idx_rivalry_points_a ON rivalry_points(player_a);
CREATE INDEX IF NOT EXISTS idx_rivalry_points_b ON rivalry_points(player_b);

CREATE TABLE IF NOT EXISTS sabotage_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sabotage_type TEXT NOT NULL,
  damage        NUMERIC(15,2) NOT NULL DEFAULT 0,
  success       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sabotage_attacker ON sabotage_history(attacker_id);
CREATE INDEX IF NOT EXISTS idx_sabotage_target ON sabotage_history(target_id);

-- ─── INTELLIGENCE SYSTEM ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS spies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  spy_employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  target_player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status            spy_status NOT NULL DEFAULT 'ACTIVE',
  discovery_risk    NUMERIC(5,4) NOT NULL DEFAULT 0.1000,
  intel_gathered    JSONB NOT NULL DEFAULT '[]'::jsonb,
  placed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spies_owner ON spies(owner_player_id);
CREATE INDEX IF NOT EXISTS idx_spies_target ON spies(target_player_id);

CREATE TABLE IF NOT EXISTS intelligence_market (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  buyer_id          UUID REFERENCES players(id) ON DELETE SET NULL,
  intel_type        intelligence_type NOT NULL,
  target_player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  data              JSONB NOT NULL DEFAULT '{}'::jsonb,
  accuracy          NUMERIC(5,4) NOT NULL DEFAULT 0.8000,
  price             NUMERIC(15,2) NOT NULL,
  purchased_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intel_market_seller ON intelligence_market(seller_id);
CREATE INDEX IF NOT EXISTS idx_intel_market_target ON intelligence_market(target_player_id);

-- ─── MANAGER SYSTEM ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS manager_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id         UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  manager_tier      manager_tier NOT NULL DEFAULT 'LEVEL_1',
  efficiency_bonus  NUMERIC(5,4) NOT NULL DEFAULT 0.0500,
  embezzlement_risk NUMERIC(5,4) NOT NULL DEFAULT 0.0100,
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id)
);
CREATE INDEX IF NOT EXISTS idx_manager_player ON manager_assignments(player_id);
CREATE INDEX IF NOT EXISTS idx_manager_employee ON manager_assignments(employee_id);

CREATE TABLE IF NOT EXISTS embezzlement_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id    UUID NOT NULL REFERENCES manager_assignments(id) ON DELETE CASCADE,
  amount        NUMERIC(15,2) NOT NULL,
  detected      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_embezzlement_manager ON embezzlement_logs(manager_id);

-- ─── LOGISTICS SYSTEM ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  zone          location_zone NOT NULL,
  city          TEXT NOT NULL,
  setup_cost    NUMERIC(15,2) NOT NULL DEFAULT 0,
  monthly_cost  NUMERIC(15,2) NOT NULL DEFAULT 0,
  traffic_level INTEGER NOT NULL DEFAULT 50,
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_locations_player ON locations(player_id);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);

CREATE TABLE IF NOT EXISTS transport_routes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_city       TEXT NOT NULL,
  destination_city  TEXT NOT NULL,
  transport         transport_type NOT NULL,
  base_cost         NUMERIC(15,2) NOT NULL,
  risk_level        NUMERIC(5,4) NOT NULL DEFAULT 0.0500,
  travel_time_hours INTEGER NOT NULL DEFAULT 24,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_routes_origin ON transport_routes(origin_city);
CREATE INDEX IF NOT EXISTS idx_routes_dest ON transport_routes(destination_city);

CREATE TABLE IF NOT EXISTS shipments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  route_id      UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  items_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT NOT NULL DEFAULT 'IN_TRANSIT',
  loss_rate     NUMERIC(5,4) NOT NULL DEFAULT 0,
  departed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  arrives_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shipments_player ON shipments(player_id);
CREATE INDEX IF NOT EXISTS idx_shipments_route ON shipments(route_id);

CREATE TABLE IF NOT EXISTS blockades (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  route_id      UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  strength      INTEGER NOT NULL DEFAULT 50,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  cost          NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blockades_route ON blockades(route_id);
CREATE INDEX IF NOT EXISTS idx_blockades_player ON blockades(player_id);

-- ─── EVENTS SYSTEM ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seasonal_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       UUID NOT NULL REFERENCES season_profiles(id) ON DELETE CASCADE,
  category        event_category NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  probability     NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  triggered_at    TIMESTAMPTZ,
  impact_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  duration_hours  INTEGER NOT NULL DEFAULT 24,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_season ON seasonal_events(season_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON seasonal_events(status);

CREATE TABLE IF NOT EXISTS event_impacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES seasonal_events(id) ON DELETE CASCADE,
  affected_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  impact_type       TEXT NOT NULL,
  magnitude         NUMERIC(10,4) NOT NULL DEFAULT 0,
  resolved          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_impacts_event ON event_impacts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_impacts_player ON event_impacts(affected_player_id);

-- ─── CONTRACTS ENHANCEMENT ───────────────────────────────────

CREATE TABLE IF NOT EXISTS profit_shares (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a        UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_b        UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  share_percent   NUMERIC(5,2) NOT NULL DEFAULT 50,
  profit_total    NUMERIC(15,2) NOT NULL DEFAULT 0,
  last_settlement TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profit_shares_a ON profit_shares(player_a);
CREATE INDEX IF NOT EXISTS idx_profit_shares_b ON profit_shares(player_b);
CREATE INDEX IF NOT EXISTS idx_profit_shares_biz ON profit_shares(business_id);

-- ─── EMPLOYEE ENHANCEMENT ────────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_traits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  trait_name    TEXT NOT NULL,
  trait_value   NUMERIC NOT NULL DEFAULT 0,
  discovered    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_traits_emp ON employee_traits(employee_id);

CREATE TABLE IF NOT EXISTS employee_skills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_type    TEXT NOT NULL,
  level         INTEGER NOT NULL DEFAULT 1,
  experience    NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, skill_type)
);
CREATE INDEX IF NOT EXISTS idx_employee_skills_emp ON employee_skills(employee_id);

CREATE TABLE IF NOT EXISTS poaching_offers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  offer_amount      NUMERIC(15,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_poaching_source ON poaching_offers(source_player_id);
CREATE INDEX IF NOT EXISTS idx_poaching_target ON poaching_offers(target_employee_id);

-- ============================================================
-- Migration 003 complete
-- ============================================================
