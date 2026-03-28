-- 003: Add auto_sell toggle to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS auto_sell BOOLEAN NOT NULL DEFAULT FALSE;
