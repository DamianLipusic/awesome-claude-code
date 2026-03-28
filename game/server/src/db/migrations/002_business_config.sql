-- Add production config columns to businesses table
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS producing_resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_per_tick      INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS auto_sell              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_sell_price        NUMERIC(12, 2);

-- Ledger for per-day revenue tracking
CREATE TABLE IF NOT EXISTS business_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  revenue     NUMERIC(20, 2) NOT NULL DEFAULT 0,
  expenses    NUMERIC(20, 2) NOT NULL DEFAULT 0,
  UNIQUE (business_id, day)
);

CREATE INDEX IF NOT EXISTS idx_ledger_business_day ON business_ledger(business_id, day);
