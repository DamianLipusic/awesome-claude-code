-- 012: Production Chains — Food Chain
-- Adds MILL and BAKERY business types, input_inventory for conversion businesses

ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'MILL';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'BAKERY';

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS input_inventory INTEGER NOT NULL DEFAULT 0;
