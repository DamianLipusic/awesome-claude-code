-- 005: Add NPC support and game_ticks tracking table

-- Add is_npc flag to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_npc BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_players_is_npc ON players (is_npc) WHERE is_npc = true;

-- Add npc_personality to players (stores AI behavior config as JSONB)
ALTER TABLE players ADD COLUMN IF NOT EXISTS npc_personality JSONB;

-- Game ticks tracking table - records every tick for monitoring
CREATE TABLE IF NOT EXISTS game_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES season_profiles(id),
  tick_number SERIAL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  subsystems_run TEXT[] DEFAULT ARRAY[]::TEXT[],
  errors TEXT[] DEFAULT ARRAY[]::TEXT[],
  npc_actions_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_game_ticks_season ON game_ticks (season_id);
CREATE INDEX IF NOT EXISTS idx_game_ticks_created ON game_ticks (started_at DESC);
