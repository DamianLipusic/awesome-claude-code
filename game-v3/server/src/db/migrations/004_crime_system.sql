-- 004: Crime & Laundering system

CREATE TABLE IF NOT EXISTS crime_operations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id),
  type          TEXT NOT NULL CHECK (type IN ('theft','robbery','fraud','smuggling')),
  target_desc   TEXT NOT NULL,
  risk_level    INT NOT NULL DEFAULT 50,
  reward_min    NUMERIC(18,2) NOT NULL,
  reward_max    NUMERIC(18,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','success','failed','busted')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolves_at   TIMESTAMPTZ NOT NULL,
  resolved_at   TIMESTAMPTZ,
  result_amount NUMERIC(18,2),
  result_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_crime_ops_player ON crime_operations(player_id, status);
CREATE INDEX IF NOT EXISTS idx_crime_ops_resolve ON crime_operations(resolves_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS laundering_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id),
  business_id   UUID NOT NULL REFERENCES businesses(id),
  dirty_amount  NUMERIC(18,2) NOT NULL,
  clean_amount  NUMERIC(18,2),
  efficiency    NUMERIC(4,2) NOT NULL DEFAULT 0.80,
  risk_level    INT NOT NULL DEFAULT 30,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','detected')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolves_at   TIMESTAMPTZ NOT NULL,
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_laundering_player ON laundering_jobs(player_id, status);
CREATE INDEX IF NOT EXISTS idx_laundering_resolve ON laundering_jobs(resolves_at) WHERE status = 'active';
