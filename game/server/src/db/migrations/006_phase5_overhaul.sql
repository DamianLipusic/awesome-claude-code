-- Migration 006: Phase 5 Economy Overhaul
-- Districts, business listings, delivery orders, and new business columns

-- Districts table
CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  foot_traffic NUMERIC(6,4) NOT NULL DEFAULT 0.5,
  location_quality NUMERIC(6,4) NOT NULL DEFAULT 0.5,
  rent_multiplier NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  revenue_multiplier NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  max_businesses INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(city, name)
);

-- Business listings (random shops for sale)
CREATE TABLE IF NOT EXISTS business_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES season_profiles(id),
  city TEXT NOT NULL,
  district_id UUID REFERENCES districts(id),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  asking_price NUMERIC(16,2) NOT NULL,
  daily_operating_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  foot_traffic NUMERIC(6,4) NOT NULL DEFAULT 0.5,
  location_quality NUMERIC(6,4) NOT NULL DEFAULT 0.5,
  size_sqm INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_biz_listings_city ON business_listings(city, status);

-- Delivery orders
DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('PENDING','CLAIMED','IN_TRANSIT','DELIVERED','FAILED','AUTO_DELIVERED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES season_profiles(id),
  buyer_id UUID NOT NULL REFERENCES players(id),
  seller_id UUID REFERENCES players(id),
  listing_id UUID REFERENCES market_listings(id),
  resource_id UUID REFERENCES resources(id),
  resource_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  origin_city TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  standard_fee NUMERIC(12,2) NOT NULL,
  player_fee NUMERIC(12,2),
  carrier_id UUID REFERENCES players(id),
  carrier_business_id UUID REFERENCES businesses(id),
  status delivery_status NOT NULL DEFAULT 'PENDING',
  claimed_at TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  auto_deliver_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_orders(status, auto_deliver_at);
CREATE INDEX IF NOT EXISTS idx_delivery_buyer ON delivery_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_carrier ON delivery_orders(carrier_id);

-- Add columns to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS max_employees INTEGER NOT NULL DEFAULT 10;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS foot_traffic NUMERIC(6,4) NOT NULL DEFAULT 0.5;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS location_quality NUMERIC(6,4) NOT NULL DEFAULT 0.5;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS size_sqm INTEGER NOT NULL DEFAULT 100;

-- Add city_price_modifiers to resources
ALTER TABLE resources ADD COLUMN IF NOT EXISTS city_price_modifiers JSONB NOT NULL DEFAULT '{}';
