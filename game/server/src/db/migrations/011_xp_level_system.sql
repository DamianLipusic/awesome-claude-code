-- 011: XP/Level progression system
-- Adds XP and level tracking to players

ALTER TABLE players ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;
