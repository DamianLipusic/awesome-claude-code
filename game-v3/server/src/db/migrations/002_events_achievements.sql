-- 002: Events & Achievements system

-- ─── Events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     UUID REFERENCES seasons(id),
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '📰',
  modifiers     JSONB NOT NULL DEFAULT '{}'::jsonb,
  affected_items TEXT[],
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at       TIMESTAMPTZ NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_events_active ON game_events(active, ends_at) WHERE active = TRUE;

-- ─── Achievements ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '🏆',
  xp_reward     INT NOT NULL DEFAULT 0,
  unlocked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, key)
);

CREATE INDEX IF NOT EXISTS idx_achievements_player ON achievements(player_id);
