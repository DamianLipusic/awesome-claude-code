-- EmpireOS V3 — Core schema (17 tables)
-- Idempotent: all CREATE statements use IF NOT EXISTS

-- ─── 1. seasons ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seasons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number        INT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','paused')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at       TIMESTAMPTZ,
  config_json   JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 2. players ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       UUID REFERENCES seasons(id),
  username        TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  cash            NUMERIC(18,2) NOT NULL DEFAULT 50000,
  bank_balance    NUMERIC(18,2) NOT NULL DEFAULT 0,
  dirty_money     NUMERIC(18,2) NOT NULL DEFAULT 0,
  rep_street      INT NOT NULL DEFAULT 50,
  rep_business    INT NOT NULL DEFAULT 50,
  rep_underworld  INT NOT NULL DEFAULT 50,
  heat_police     INT NOT NULL DEFAULT 0,
  heat_rival      INT NOT NULL DEFAULT 0,
  heat_fed        INT NOT NULL DEFAULT 0,
  skill_management  INT NOT NULL DEFAULT 1,
  skill_negotiation INT NOT NULL DEFAULT 1,
  skill_operations  INT NOT NULL DEFAULT 1,
  skill_intimidation INT NOT NULL DEFAULT 1,
  unlock_phase    INT NOT NULL DEFAULT 1,
  xp              INT NOT NULL DEFAULT 0,
  level           INT NOT NULL DEFAULT 1,
  last_active     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. refresh_tokens ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. locations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id             UUID REFERENCES seasons(id),
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL,
  zone                  TEXT NOT NULL,
  price                 NUMERIC(18,2) NOT NULL,
  daily_cost            NUMERIC(18,2) NOT NULL,
  traffic               INT NOT NULL DEFAULT 50,
  visibility            INT NOT NULL DEFAULT 50,
  laundering_potential  INT NOT NULL DEFAULT 0,
  storage_capacity      INT NOT NULL DEFAULT 500,
  security_modifier     NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  expansion_slots       INT NOT NULL DEFAULT 2,
  available             BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── 5. items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key               TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN ('raw','intermediate','finished','contraband','service')),
  legal             BOOLEAN NOT NULL DEFAULT TRUE,
  base_price        NUMERIC(18,2) NOT NULL,
  spoilage_rate     NUMERIC(6,4) NOT NULL DEFAULT 0,
  traceability      NUMERIC(6,4) NOT NULL DEFAULT 0,
  production_stage  INT NOT NULL DEFAULT 1
);

-- ─── 6. recipes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type   TEXT NOT NULL,
  output_item_id  UUID NOT NULL REFERENCES items(id),
  base_rate       NUMERIC(10,4) NOT NULL,
  cycle_minutes   INT NOT NULL DEFAULT 1
);

-- ─── 7. recipe_inputs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_inputs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id         UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  item_id           UUID NOT NULL REFERENCES items(id),
  quantity_per_unit NUMERIC(10,4) NOT NULL
);

-- ─── 8. businesses ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id         UUID REFERENCES seasons(id),
  owner_id          UUID NOT NULL REFERENCES players(id),
  location_id       UUID NOT NULL REFERENCES locations(id),
  type              TEXT NOT NULL CHECK (type IN ('SHOP','FACTORY','MINE')),
  name              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','idle','raided','shutdown')),
  tier              INT NOT NULL DEFAULT 1,
  efficiency        INT NOT NULL DEFAULT 100,
  recipe_id         UUID REFERENCES recipes(id),
  security_physical INT NOT NULL DEFAULT 0,
  security_cyber    INT NOT NULL DEFAULT 0,
  security_legal    INT NOT NULL DEFAULT 0,
  manager_id        UUID,
  automation_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 9. inventory ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES items(id),
  amount        NUMERIC(18,4) NOT NULL DEFAULT 0,
  reserved      NUMERIC(18,4) NOT NULL DEFAULT 0,
  dirty_amount  NUMERIC(18,4) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, item_id)
);

-- ─── 10. inventory_log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id),
  item_id       UUID NOT NULL REFERENCES items(id),
  delta         NUMERIC(18,4) NOT NULL,
  reason        TEXT NOT NULL,
  reference_id  UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 11. employees ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       UUID REFERENCES seasons(id),
  business_id     UUID REFERENCES businesses(id),
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'WORKER',
  salary          NUMERIC(18,2) NOT NULL,
  efficiency      INT NOT NULL DEFAULT 50,
  speed           INT NOT NULL DEFAULT 50,
  loyalty         INT NOT NULL DEFAULT 50,
  discretion      INT NOT NULL DEFAULT 50,
  learning_rate   INT NOT NULL DEFAULT 50,
  corruption_risk INT NOT NULL DEFAULT 10,
  stress          INT NOT NULL DEFAULT 0,
  xp              INT NOT NULL DEFAULT 0,
  level           INT NOT NULL DEFAULT 1,
  hidden_agenda   TEXT,
  hidden_trait     TEXT,
  hidden_loyalty  INT,
  status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','active','training','fired','arrested','dead')),
  pool_batch      INT,
  hired_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 12. training ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('basic','advanced','elite')),
  stat_targets  JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost          NUMERIC(18,2) NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at       TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled'))
);

-- ─── 13. discovery_rules ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovery_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key               TEXT NOT NULL UNIQUE,
  trigger_condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  player_segment    TEXT,
  cooldown_minutes  INT NOT NULL DEFAULT 0,
  max_shows         INT NOT NULL DEFAULT 1,
  ui_surface        TEXT NOT NULL,
  reward_type       TEXT NOT NULL,
  reward_payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  unlock_effect     JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order        INT NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── 14. discovery_progress ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovery_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id),
  rule_id         UUID NOT NULL REFERENCES discovery_rules(id),
  shown_count     INT NOT NULL DEFAULT 0,
  last_shown_at   TIMESTAMPTZ,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  UNIQUE(player_id, rule_id)
);

-- ─── 15. activity_log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id),
  business_id   UUID REFERENCES businesses(id),
  type          TEXT NOT NULL,
  message       TEXT NOT NULL,
  amount        NUMERIC(18,2),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 16. game_ticks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_ticks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tick_type     TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  duration_ms   INT,
  stats         JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 17. market_listings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       UUID REFERENCES seasons(id),
  seller_type     TEXT NOT NULL CHECK (seller_type IN ('ai','player')),
  seller_id       UUID,
  item_id         UUID NOT NULL REFERENCES items(id),
  quantity        NUMERIC(18,4) NOT NULL,
  price_per_unit  NUMERIC(18,2) NOT NULL,
  min_bulk        INT NOT NULL DEFAULT 1,
  expires_at      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','sold','expired','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_businesses_season ON businesses(season_id);
CREATE INDEX IF NOT EXISTS idx_inventory_business ON inventory(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_business ON employees(business_id) WHERE status IN ('active','training');
CREATE INDEX IF NOT EXISTS idx_employees_pool ON employees(season_id) WHERE business_id IS NULL AND status = 'available';
CREATE INDEX IF NOT EXISTS idx_activity_player ON activity_log(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_log_business ON inventory_log(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_listings_item ON market_listings(item_id, status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_discovery_progress_player ON discovery_progress(player_id) WHERE completed = FALSE;
CREATE INDEX IF NOT EXISTS idx_game_ticks_type ON game_ticks(tick_type, completed_at DESC);
