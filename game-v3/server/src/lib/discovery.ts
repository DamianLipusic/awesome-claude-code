// Discovery evaluator — checks player state against discovery rules
// and creates/updates discovery_progress entries for matching rules.

import type { PoolClient } from 'pg';

// ─── Types ──────────────────────────────────────────────────────────

interface DiscoveryRule {
  id: string;
  key: string;
  trigger_condition: Record<string, unknown>;
  cooldown_minutes: number;
  max_shows: number;
  ui_surface: string;
  reward_type: string;
}

interface PlayerState {
  playerId: string;
  cash: number;
  businessCount: number;
  employeeCount: number;
  totalInventory: number;
  hasMine: boolean;
  hasFactory: boolean;
  hasShop: boolean;
  anyStoragePct: number;
  hasNeverSold: boolean;
  hasNeverTrained: boolean;
  anyBusinessAtMaxEmployees: boolean;
  dailyCostsExceedIncome: boolean;
  anyConverterMissingInput: boolean;
}

interface ProgressRow {
  rule_id: string;
  shown_count: number;
  last_shown_at: string | null;
  completed: boolean;
}

// ─── Trigger evaluator ─────────────────────────────────────────────

function matchesTrigger(
  trigger: Record<string, unknown>,
  state: PlayerState,
): boolean {
  for (const [key, value] of Object.entries(trigger)) {
    switch (key) {
      case 'cash_gte':
        if (state.cash < (value as number)) return false;
        break;
      case 'business_count_eq':
        if (state.businessCount !== (value as number)) return false;
        break;
      case 'business_count_gte':
        if (state.businessCount < (value as number)) return false;
        break;
      case 'employee_count_eq':
        if (state.employeeCount !== (value as number)) return false;
        break;
      case 'employee_count_gte':
        if (state.employeeCount < (value as number)) return false;
        break;
      case 'total_inventory_gte':
        if (state.totalInventory < (value as number)) return false;
        break;
      case 'has_mine':
        if (state.hasMine !== (value as boolean)) return false;
        break;
      case 'has_factory':
        if (state.hasFactory !== (value as boolean)) return false;
        break;
      case 'has_shop':
        if (state.hasShop !== (value as boolean)) return false;
        break;
      case 'has_no_factory':
        if (value === true && state.hasFactory) return false;
        break;
      case 'has_no_shop':
        if (value === true && state.hasShop) return false;
        break;
      case 'any_storage_pct_gte':
        if (state.anyStoragePct < (value as number)) return false;
        break;
      case 'has_never_sold':
        if (value === true && !state.hasNeverSold) return false;
        break;
      case 'has_never_trained':
        if (value === true && !state.hasNeverTrained) return false;
        break;
      case 'any_business_at_max_employees':
        if (value === true && !state.anyBusinessAtMaxEmployees) return false;
        break;
      case 'daily_costs_exceed_income':
        if (value === true && !state.dailyCostsExceedIncome) return false;
        break;
      case 'any_converter_missing_input':
        if (value === true && !state.anyConverterMissingInput) return false;
        break;
      default:
        // Unknown trigger key — skip (don't fail)
        break;
    }
  }
  return true;
}

// ─── Build player state ─────────────────────────────────────────────

async function buildPlayerState(
  client: PoolClient,
  playerId: string,
): Promise<PlayerState> {
  // Parallel queries for player state
  const [
    playerRes,
    businessRes,
    employeeRes,
    inventoryRes,
    storageRes,
    soldRes,
    trainedRes,
    maxEmpRes,
    costsRes,
    converterRes,
  ] = await Promise.all([
    // Cash
    client.query<{ cash: string }>(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId],
    ),
    // Businesses by type
    client.query<{ type: string; count: number }>(
      `SELECT type, COUNT(*)::int AS count
       FROM businesses WHERE owner_id = $1 AND status != 'shutdown'
       GROUP BY type`,
      [playerId],
    ),
    // Employee count
    client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM employees e
       JOIN businesses b ON b.id = e.business_id
       WHERE b.owner_id = $1 AND e.status IN ('active', 'training')`,
      [playerId],
    ),
    // Total inventory
    client.query<{ total: string }>(
      `SELECT COALESCE(SUM(inv.amount), 0)::numeric AS total
       FROM inventory inv
       JOIN businesses b ON b.id = inv.business_id
       WHERE b.owner_id = $1 AND b.status != 'shutdown'`,
      [playerId],
    ),
    // Max storage percentage across all businesses
    client.query<{ pct: number }>(
      `SELECT COALESCE(MAX(
         CASE WHEN b.tier > 0 THEN
           (SELECT COALESCE(SUM(inv.amount), 0) FROM inventory inv WHERE inv.business_id = b.id)::numeric
           / (100.0 * b.tier * b.tier) * 100
         ELSE 0 END
       ), 0)::numeric AS pct
       FROM businesses b
       WHERE b.owner_id = $1 AND b.status != 'shutdown'`,
      [playerId],
    ),
    // Has ever sold (check for SALE or AUTOSELL in activity_log)
    client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM activity_log
       WHERE player_id = $1 AND type IN ('SALE', 'AUTOSELL', 'sale')
       LIMIT 1`,
      [playerId],
    ),
    // Has ever trained
    client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM training t
       JOIN employees e ON e.id = t.employee_id
       JOIN businesses b ON b.id = e.business_id
       WHERE b.owner_id = $1
       LIMIT 1`,
      [playerId],
    ),
    // Any business at max employees (employees >= maxEmployees(tier))
    client.query<{ at_max: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM businesses b
         WHERE b.owner_id = $1 AND b.status != 'shutdown'
         AND (
           SELECT COUNT(*)::int FROM employees e
           WHERE e.business_id = b.id AND e.status IN ('active', 'training')
         ) >= (b.tier * 4)
       ) AS at_max`,
      [playerId],
    ),
    // Daily costs exceed income (compare last 24h costs vs income)
    client.query<{ exceeds: boolean }>(
      `SELECT (
         COALESCE((SELECT SUM(ABS(amount)) FROM activity_log
           WHERE player_id = $1 AND type = 'DAILY_COST'
           AND created_at > NOW() - INTERVAL '24 hours'), 0)
         >
         COALESCE((SELECT SUM(amount) FROM activity_log
           WHERE player_id = $1 AND type IN ('SALE', 'AUTOSELL', 'sale')
           AND created_at > NOW() - INTERVAL '24 hours' AND amount > 0), 0)
       ) AS exceeds`,
      [playerId],
    ),
    // Any converter (FACTORY/SHOP) missing input inventory
    client.query<{ missing: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM businesses b
         JOIN recipes r ON r.id = b.recipe_id
         JOIN recipe_inputs ri ON ri.recipe_id = r.id
         LEFT JOIN inventory inv ON inv.business_id = b.id AND inv.item_id = ri.item_id
         WHERE b.owner_id = $1 AND b.status != 'shutdown'
           AND b.type IN ('FACTORY', 'SHOP')
           AND (inv.amount IS NULL OR inv.amount <= 0)
       ) AS missing`,
      [playerId],
    ),
  ]);

  const bizTypes: Record<string, number> = {};
  for (const row of businessRes.rows) {
    bizTypes[row.type] = row.count;
  }

  return {
    playerId,
    cash: Number(playerRes.rows[0]?.cash ?? 0),
    businessCount: Object.values(bizTypes).reduce((a, b) => a + b, 0),
    employeeCount: employeeRes.rows[0]?.count ?? 0,
    totalInventory: Number(inventoryRes.rows[0]?.total ?? 0),
    hasMine: (bizTypes['MINE'] ?? 0) > 0,
    hasFactory: (bizTypes['FACTORY'] ?? 0) > 0,
    hasShop: (bizTypes['SHOP'] ?? 0) > 0,
    anyStoragePct: Number(storageRes.rows[0]?.pct ?? 0),
    hasNeverSold: (soldRes.rows[0]?.count ?? 0) === 0,
    hasNeverTrained: (trainedRes.rows[0]?.count ?? 0) === 0,
    anyBusinessAtMaxEmployees: maxEmpRes.rows[0]?.at_max ?? false,
    dailyCostsExceedIncome: costsRes.rows[0]?.exceeds ?? false,
    anyConverterMissingInput: converterRes.rows[0]?.missing ?? false,
  };
}

// ─── Main evaluator ─────────────────────────────────────────────────

export async function evaluateDiscovery(client: PoolClient): Promise<number> {
  // 1. Load all active discovery rules
  const rulesRes = await client.query<DiscoveryRule>(
    `SELECT id, key, trigger_condition, cooldown_minutes, max_shows, ui_surface, reward_type
     FROM discovery_rules
     WHERE active = TRUE
     ORDER BY sort_order`,
  );
  const rules = rulesRes.rows;
  if (rules.length === 0) return 0;

  // 2. Load active players (active in last 30 minutes)
  const playersRes = await client.query<{ id: string }>(
    `SELECT id FROM players
     WHERE last_active > NOW() - INTERVAL '30 minutes'`,
  );
  if (playersRes.rows.length === 0) return 0;

  let progressCount = 0;

  // 3. For each player, build state and evaluate rules
  for (const player of playersRes.rows) {
    const state = await buildPlayerState(client, player.id);

    // Load existing progress for this player
    const progressRes = await client.query<ProgressRow>(
      `SELECT rule_id, shown_count, last_shown_at::text, completed
       FROM discovery_progress
       WHERE player_id = $1`,
      [player.id],
    );
    const progressMap = new Map<string, ProgressRow>();
    for (const row of progressRes.rows) {
      progressMap.set(row.rule_id, row);
    }

    for (const rule of rules) {
      const progress = progressMap.get(rule.id);

      // Skip if already completed
      if (progress?.completed) continue;

      // Skip if shown max_shows times
      if (progress && progress.shown_count >= rule.max_shows) continue;

      // Skip if cooldown not passed
      if (progress?.last_shown_at && rule.cooldown_minutes > 0) {
        const lastShown = new Date(progress.last_shown_at).getTime();
        const cooldownMs = rule.cooldown_minutes * 60 * 1000;
        if (Date.now() - lastShown < cooldownMs) continue;
      }

      // Check trigger conditions
      if (!matchesTrigger(rule.trigger_condition as Record<string, unknown>, state)) {
        continue;
      }

      // Match! Upsert discovery_progress
      await client.query(
        `INSERT INTO discovery_progress (player_id, rule_id, shown_count, last_shown_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (player_id, rule_id)
         DO UPDATE SET shown_count = discovery_progress.shown_count + 1,
                       last_shown_at = NOW()`,
        [player.id, rule.id],
      );
      progressCount++;
    }
  }

  return progressCount;
}
