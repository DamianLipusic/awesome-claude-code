-- ============================================================
-- Migration 004: Phase 3 — Advanced Game Mechanics
-- Adds tables for: Syndicate activity, wars, vote-kicks,
-- hostile takeovers, contract breaches, location enhancements
-- ============================================================

-- ─── SYNDICATE ACTIVITY LOG ──────────────────────────────────

CREATE TABLE IF NOT EXISTS syndicate_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id  UUID NOT NULL REFERENCES syndicates(id) ON DELETE CASCADE,
  player_id     UUID REFERENCES players(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  details       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_syndicate_activity_syndicate ON syndicate_activity_log(syndicate_id);
CREATE INDEX IF NOT EXISTS idx_syndicate_activity_created ON syndicate_activity_log(created_at);

-- ─── SYNDICATE WARS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS syndicate_wars (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id         UUID NOT NULL REFERENCES syndicates(id) ON DELETE CASCADE,
  defender_id         UUID NOT NULL REFERENCES syndicates(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  treasury_cost       NUMERIC(15,2) NOT NULL DEFAULT 0,
  attacker_score      INTEGER NOT NULL DEFAULT 0,
  defender_score      INTEGER NOT NULL DEFAULT 0,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_syndicate_wars_attacker ON syndicate_wars(attacker_id);
CREATE INDEX IF NOT EXISTS idx_syndicate_wars_defender ON syndicate_wars(defender_id);

-- ─── VOTE KICKS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS syndicate_vote_kicks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id    UUID NOT NULL REFERENCES syndicates(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  initiated_by    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  votes_for       INTEGER NOT NULL DEFAULT 1,
  votes_against   INTEGER NOT NULL DEFAULT 0,
  voters          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vote_kicks_syndicate ON syndicate_vote_kicks(syndicate_id);

-- ─── HOSTILE TAKEOVERS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS hostile_takeovers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bidder_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_owner_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  bid_amount      NUMERIC(15,2) NOT NULL,
  counter_amount  NUMERIC(15,2),
  status          TEXT NOT NULL DEFAULT 'PENDING',
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_hostile_takeovers_bidder ON hostile_takeovers(bidder_id);
CREATE INDEX IF NOT EXISTS idx_hostile_takeovers_target ON hostile_takeovers(target_owner_id);
CREATE INDEX IF NOT EXISTS idx_hostile_takeovers_business ON hostile_takeovers(business_id);

-- ─── CONTRACT BREACHES ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_breaches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID NOT NULL REFERENCES trade_contracts(id) ON DELETE CASCADE,
  reporter_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  breach_type     TEXT NOT NULL,
  penalty_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'REPORTED',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_contract_breaches_contract ON contract_breaches(contract_id);

-- ─── LOCATION BUSINESSES (join table) ────────────────────────

CREATE TABLE IF NOT EXISTS location_businesses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id)
);
CREATE INDEX IF NOT EXISTS idx_location_businesses_loc ON location_businesses(location_id);
CREATE INDEX IF NOT EXISTS idx_location_businesses_biz ON location_businesses(business_id);

-- ─── LOCATION ENHANCEMENTS ──────────────────────────────────

ALTER TABLE locations ADD COLUMN IF NOT EXISTS security_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS capacity_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS front_quality INTEGER NOT NULL DEFAULT 1;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS hidden_rooms JSONB;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS escape_routes JSONB;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS security_systems JSONB;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_dual_use BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS employee_efficiency_bonus NUMERIC(5,4) NOT NULL DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS revenue_bonus NUMERIC(5,4) NOT NULL DEFAULT 0;

-- ============================================================
-- Migration 004 complete
-- ============================================================
