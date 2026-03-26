-- 007: Add missing indexes identified in performance audit
-- All CREATE INDEX IF NOT EXISTS — safe to re-run

-- Business ledger: revenue history queries ORDER BY day DESC
CREATE INDEX IF NOT EXISTS idx_business_ledger_biz_day
  ON business_ledger (business_id, day DESC);

-- Criminal operations: common filter pattern (player + season + status)
CREATE INDEX IF NOT EXISTS idx_criminal_ops_player_season_status
  ON criminal_operations (player_id, season_id, status);

-- Laundering processes: active laundering lookup
CREATE INDEX IF NOT EXISTS idx_laundering_player_status
  ON laundering_processes (player_id, status);

-- Market listings: price fluctuation window query
CREATE INDEX IF NOT EXISTS idx_market_listings_season_created
  ON market_listings (season_id, created_at DESC);

-- Manager assignments: per-business lookup
CREATE INDEX IF NOT EXISTS idx_manager_assignments_business
  ON manager_assignments (business_id);

-- Spies: placement check by employee + status
CREATE INDEX IF NOT EXISTS idx_spies_employee_status
  ON spies (spy_employee_id, status);

-- Employees: business + role filter for worker counts
CREATE INDEX IF NOT EXISTS idx_employees_business_role
  ON employees (business_id, role);

-- Price history: resource price lookups with season filter
CREATE INDEX IF NOT EXISTS idx_price_history_resource_season
  ON price_history (resource_id, season_id, recorded_at DESC);

-- Delivery orders: status + scheduled delivery
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status_deliver
  ON delivery_orders (status, auto_deliver_at)
  WHERE status = 'PENDING';

-- Employees: hired_at for ordering
CREATE INDEX IF NOT EXISTS idx_employees_hired_at
  ON employees (hired_at DESC);
