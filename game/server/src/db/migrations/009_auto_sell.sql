-- Add auto_sell flag to businesses for automatic inventory selling after production
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS auto_sell BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS max_employees INTEGER NOT NULL DEFAULT 10;
