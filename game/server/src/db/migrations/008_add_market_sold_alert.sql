-- Add MARKET_SOLD alert type for AI buy order fills
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'MARKET_SOLD';
