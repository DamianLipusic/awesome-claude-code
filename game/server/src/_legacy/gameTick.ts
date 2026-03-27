import { processNPCTick } from './npcAI';
import { query, withTransaction } from '../db/client';
import type { PoolClient } from 'pg';
import { getHeatLevel } from '../lib/detection';
import { secureRandom } from '../lib/random';
import { emitToPlayer } from '../websocket/handler';
import {
  ZONE_BONUSES,
  BUSINESS_BASE_COSTS,
} from '../../../shared/src/types/entities';
import type { LocationZone, BusinessType } from '../../../shared/src/types/entities';
import { rollRandomEvents, getActiveEventModifiers, expireOldEvents, clearEventModifierCache } from '../lib/events';
import type { EventModifiers } from '../lib/events';
import { GAME_BALANCE, PRODUCTION_RECIPES } from '../lib/constants';
import { employee_production } from './simulation';

// Tick counter for periodic alerts (resets on server restart)
let tickCount = 0;
const REVENUE_ALERT_INTERVAL = 3; // Alert every 3 ticks (15 minutes) for fast feedback

// ─── Master Game Tick ─────────────────────────────────────────
// Runs every 5 minutes via BullMQ. Processes all periodic systems
// in a single pass per tick for consistency.

export async function runGameTick(): Promise<void> {
  const tickStart = Date.now();

  try {
    // ── START OF TICK: Clear caches, roll events ──
    clearEventModifierCache();
    await runSafe('RandomEvents', rollRandomEvents);

    // Each sub-system runs in its own transaction for isolation.
    // ── Core economy (runs every tick) ──
    await runSafe('BusinessRevenue', processBusinessRevenue);
    await runSafe('EfficiencyDecay', processEfficiencyDecay);
    await runSafe('Production', processProduction);
    await runSafe('SupplyChainTransfer', processSupplyChainTransfer);
    await runSafe('AutoSell', processAutoSell);
    await runSafe('EmployeeMorale', processEmployeeMorale);
    await runSafe('EmployeeXP', processEmployeeXP);
    await runSafe('MarketPrices', processMarketPrices);
    await runSafe('AIBuyOrders', processAIBuyOrders);
    await runSafe('ExpiredListings', processExpiredListings);

    // ── Crime & underworld ──
    await runSafe('HeatDecay', processHeatDecay);
    await runSafe('CrimeOperations', processCrimeOperations);
    await runSafe('Laundering', processLaundering);

    // ── Logistics ──
    await runSafe('Shipments', processShipments);
    await runSafe('Deliveries', processDeliveries);
    await runSafe('ContractSettlement', processContractSettlement);

    // ── Periodic alerts ──
    await runSafe('RevenueAlerts', processRevenueAlerts);
    await runSafe('HeatWarnings', processHeatWarnings);
    await runSafe('Milestones', processMilestones);
    tickCount++;

    // ── Events: alerts to players + expiry ──
    await runSafe('EventAlerts', processEventAlerts);
    await runSafe('EventExpiry', processEventExpiry);

    // ── Disabled: systems not yet connected to core loop ──
    // await runSafe('SpyDiscovery', processSpyDiscovery);
    // await runSafe('Embezzlement', processEmbezzlement);
    // await runSafe('BlockadeCosts', processBlockadeCosts);
    // await runSafe('LocationCosts', processLocationCosts);

    // ── NPC AI Competitors ──
    let npcActions = 0;
    try {
      npcActions = await processNPCTick();
    } catch (err) {
      console.error('[GameTick:NPC] Error:', err);
    }

    // Worker recruitment runs AFTER NPCs so new workers are available for players
    await runSafe('WorkerRecruitment', processWorkerRecruitment);

    const elapsed = Date.now() - tickStart;

    // ── Record tick in game_ticks table ──
    try {
      const seasonRes = await query<{ id: string }>(
        "SELECT id FROM season_profiles WHERE status = 'ACTIVE' LIMIT 1"
      );
      const seasonId = seasonRes.rows[0]?.id ?? null;
      await query(
        `INSERT INTO game_ticks (season_id, started_at, completed_at, duration_ms, npc_actions_count)
         VALUES ($1, $2, NOW(), $3, $4)`,
        [seasonId, new Date(tickStart), elapsed, npcActions]
      );
    } catch (err) {
      console.error('[GameTick] Failed to record tick:', err);
    }

    // ── Push tick update to connected players via WebSocket ──
    try {
      const playerSummaries = await query<{
        id: string; cash: string; net_worth: string;
        biz_count: string; emp_count: string; rank: string;
      }>(
        `SELECT p.id, p.cash::text, p.net_worth::text,
                COALESCE(bc.cnt, 0)::text AS biz_count,
                COALESCE(ec.cnt, 0)::text AS emp_count,
                (ROW_NUMBER() OVER (ORDER BY p.net_worth DESC))::text AS rank
           FROM players p
           LEFT JOIN (SELECT owner_id, COUNT(*) AS cnt FROM businesses WHERE status = 'ACTIVE' GROUP BY owner_id) bc ON bc.owner_id = p.id
           LEFT JOIN (SELECT b.owner_id, COUNT(*) AS cnt FROM employees e JOIN businesses b ON b.id = e.business_id GROUP BY b.owner_id) ec ON ec.owner_id = p.id
          WHERE p.last_active > NOW() - INTERVAL '30 minutes'`,
      );
      for (const p of playerSummaries.rows) {
        emitToPlayer(p.id, 'tick_update', {
          cash: parseFloat(p.cash),
          net_worth: parseFloat(p.net_worth),
          rank: parseInt(p.rank),
          businesses: parseInt(p.biz_count),
          employees: parseInt(p.emp_count),
          tick_time: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Non-critical — don't fail the tick
    }

    console.log(`[GameTick] Completed in ${elapsed}ms (NPC actions: ${npcActions}) at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('[GameTick] Fatal error:', err);
  }
}

async function runSafe(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[GameTick:${name}] Error:`, err);
  }
}

// ─── Helper: create alert ─────────────────────────────────────

async function createAlert(
  client: PoolClient,
  playerId: string,
  seasonId: string,
  type: string,
  message: string,
  data: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO alerts (player_id, season_id, type, message, data)
     VALUES ($1,$2,$3,$4,$5)`,
    [playerId, seasonId, type, message, JSON.stringify(data)],
  );
}

// ─── Helper: get active season ID ─────────────────────────────

async function getActiveSeasonId(): Promise<string | null> {
  const res = await query<{ id: string }>(
    "SELECT id FROM season_profiles WHERE status = 'ACTIVE' LIMIT 1",
  );
  return res.rows[0]?.id ?? null;
}

// ─── 1. Business Revenue ──────────────────────────────────────

async function processBusinessRevenue(): Promise<void> {
  await withTransaction(async (client) => {
    // Fetch all active businesses with employee count, manager bonus, and location zone in one query
    const businesses = await client.query<{
      id: string; owner_id: string; season_id: string; type: string;
      tier: number; efficiency: string; daily_operating_cost: string;
      total_revenue: string; total_expenses: string;
      zone: string | null; city: string;
      employee_count: string; mgr_efficiency_bonus: string | null;
    }>(
      `SELECT b.id, b.owner_id, b.season_id, b.type, b.tier,
              b.efficiency, b.daily_operating_cost,
              b.total_revenue, b.total_expenses,
              gl.zone, b.city,
              COALESCE(ec.cnt, 0) AS employee_count,
              ma.efficiency_bonus AS mgr_efficiency_bonus
         FROM businesses b
         LEFT JOIN locations gl ON gl.player_id = b.owner_id AND gl.city = b.city AND gl.status = 'ACTIVE'
         LEFT JOIN (
           SELECT business_id, COUNT(*)::int AS cnt FROM employees GROUP BY business_id
         ) ec ON ec.business_id = b.id
         LEFT JOIN manager_assignments ma ON ma.business_id = b.id
        WHERE b.status = 'ACTIVE'`,
    );

    // Cache event modifiers per city to avoid repeated queries
    const modCache: Record<string, EventModifiers> = {};

    for (const biz of businesses.rows) {
      // Get event modifiers for this city (cached)
      if (!modCache[biz.city]) {
        modCache[biz.city] = await getActiveEventModifiers(biz.season_id, biz.city);
      }
      const eventMods = modCache[biz.city];

      const employeeCount = parseInt(biz.employee_count);

      // Base revenue = tier * BASE_REVENUE * efficiency * (1 + employeeCount * 0.1)
      const efficiency = parseFloat(biz.efficiency);
      let revenue = biz.tier * GAME_BALANCE.BUSINESS_BASE_REVENUE * efficiency * (1 + employeeCount * 0.1);

      // Apply event efficiency bonus
      if (eventMods.efficiency_bonus > 0) {
        revenue *= (1 + eventMods.efficiency_bonus);
      }

      // Apply zone bonus if location exists
      if (biz.zone) {
        const zoneConfig = ZONE_BONUSES[biz.zone as LocationZone];
        if (zoneConfig) {
          revenue *= (1 + zoneConfig.revenue_modifier);
        }
      }

      // Apply manager efficiency bonus
      if (biz.mgr_efficiency_bonus !== null) {
        revenue *= (1 + parseFloat(biz.mgr_efficiency_bonus));
      }

      // Apply event revenue multiplier
      revenue *= eventMods.revenue_multiplier;

      // Per-tick revenue (5-minute tick = 1/288 of a day)
      const tickRevenue = revenue / 288;
      const tickCost = parseFloat(biz.daily_operating_cost) / 288;
      const netProfit = tickRevenue - tickCost;

      // Update player cash
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [netProfit, biz.owner_id],
      );

      // Update business totals
      await client.query(
        `UPDATE businesses
            SET total_revenue = total_revenue + $1,
                total_expenses = total_expenses + $2
          WHERE id = $3`,
        [Math.max(tickRevenue, 0), tickCost, biz.id],
      );

      // Write to business_ledger (upsert per business per day)
      await client.query(
        `INSERT INTO business_ledger (business_id, day, revenue, expenses)
         VALUES ($1, CURRENT_DATE, $2, $3)
         ON CONFLICT (business_id, day)
         DO UPDATE SET revenue = business_ledger.revenue + EXCLUDED.revenue,
                       expenses = business_ledger.expenses + EXCLUDED.expenses`,
        [biz.id, Math.max(tickRevenue, 0), tickCost],
      );
    }
  });
}

// ─── 1a-2. Efficiency Decay ──────────────────────────────────
// Businesses slowly lose efficiency without maintenance (~5% per day)
// Maintenance button in UI restores to 100%

async function processEfficiencyDecay(): Promise<void> {
  // Decay all businesses by 0.0002 per tick (~5.8%/day)
  await query(
    `UPDATE businesses SET efficiency = GREATEST(efficiency - 0.0002, 0.3)
     WHERE status = 'ACTIVE' AND efficiency > 0.3`,
  );
}

// ─── 1b. Automatic Production ─────────────────────────────────

async function processProduction(): Promise<void> {
  // Find all active businesses that have production recipes and at least one WORKER
  const eligible = await query<{ id: string; type: string }>(
    `SELECT b.id, b.type::text
       FROM businesses b
      WHERE b.status = 'ACTIVE'
        AND EXISTS (
          SELECT 1 FROM employees e
          WHERE e.business_id = b.id AND e.role = 'WORKER'
        )`,
  );

  // Filter to types that have production recipes
  const producible = eligible.rows.filter(
    (b) => PRODUCTION_RECIPES[b.type as keyof typeof PRODUCTION_RECIPES],
  );

  let produced = 0;
  for (const biz of producible) {
    try {
      await employee_production(biz.id);
      produced++;
    } catch (err) {
      console.error(`[GameTick:Production] Error for business ${biz.id}:`, err);
    }
  }

  if (produced > 0) {
    console.log(`[GameTick:Production] ${produced}/${producible.length} businesses produced goods`);
  }
}

// ─── 1c. Auto-Sell — sell inventory from businesses with auto_sell enabled ──

async function processAutoSell(): Promise<void> {
  await withTransaction(async (client) => {
    const businesses = await client.query<{
      id: string; owner_id: string; season_id: string; inventory: Record<string, number>; name: string;
    }>(
      `SELECT id, owner_id, season_id, inventory, name
         FROM businesses
        WHERE auto_sell = true AND status = 'ACTIVE'
          AND inventory != '{}'::jsonb
          AND inventory != 'null'::jsonb`,
    );

    if (businesses.rows.length === 0) return;

    const priceRes = await client.query<{ name: string; current_ai_price: string; id: string }>(
      `SELECT name, current_ai_price::text, id FROM resources`,
    );
    const prices: Record<string, { price: number; id: string }> = {};
    for (const r of priceRes.rows) {
      prices[r.name] = { price: parseFloat(r.current_ai_price), id: r.id };
    }

    const QUICK_SELL_DISCOUNT = 0.85;
    let totalSold = 0;

    for (const biz of businesses.rows) {
      const inventory = biz.inventory as Record<string, number>;
      const items = Object.entries(inventory).filter(([, qty]) => qty > 0);
      if (items.length === 0) continue;

      let bizEarned = 0;

      for (const [name, qty] of items) {
        const resource = prices[name];
        if (!resource) continue;
        const sellPrice = resource.price * QUICK_SELL_DISCOUNT;
        bizEarned += sellPrice * qty;
        inventory[name] = 0;
      }

      if (bizEarned > 0) {
        const cleanInv: Record<string, number> = {};
        for (const [k, v] of Object.entries(inventory)) {
          if (v > 0) cleanInv[k] = v;
        }

        await client.query(
          `UPDATE businesses SET inventory = $1, total_revenue = total_revenue + $2 WHERE id = $3`,
          [JSON.stringify(cleanInv), bizEarned, biz.id],
        );
        await client.query(
          `UPDATE players SET cash = cash + $1 WHERE id = $2`,
          [bizEarned, biz.owner_id],
        );

        // Push real-time profit notification
        emitToPlayer(biz.owner_id, 'auto_sell', {
          business: biz.name,
          earned: parseFloat(bizEarned.toFixed(2)),
        });

        totalSold++;
      }
    }

    if (totalSold > 0) {
      console.log(`[GameTick:AutoSell] ${totalSold} businesses auto-sold inventory`);
    }
  });
}

// ─── 1d. Supply Chain Auto-Transfer ──────────────────────────
// Transfers raw materials from producer businesses (Mine/Farm) to
// consumer businesses (Factory) when both are owned by the same player
// and in the same city.

async function processSupplyChainTransfer(): Promise<void> {
  await withTransaction(async (client) => {
    // Find all players who have both producers (MINE/FARM) and consumers (FACTORY) in the same city
    const chains = await client.query<{
      owner_id: string; city: string;
      producer_id: string; producer_type: string; producer_inventory: Record<string, number>;
      consumer_id: string; consumer_inventory: Record<string, number>; consumer_storage_cap: number;
    }>(
      `SELECT p.owner_id, p.city,
              p.id AS producer_id, p.type::text AS producer_type, p.inventory AS producer_inventory,
              c.id AS consumer_id, c.inventory AS consumer_inventory, c.storage_cap AS consumer_storage_cap
         FROM businesses p
         JOIN businesses c ON c.owner_id = p.owner_id AND c.city = p.city
                           AND c.type = 'FACTORY' AND c.status = 'ACTIVE'
        WHERE p.type IN ('MINE', 'FARM') AND p.status = 'ACTIVE'
          AND p.inventory != '{}'::jsonb`,
    );

    if (chains.rows.length === 0) return;

    // Resources that factories consume
    const factoryInputs = new Set(['Coal', 'Metals', 'Fuel']);
    let transfers = 0;

    for (const chain of chains.rows) {
      const prodInv = chain.producer_inventory as Record<string, number>;
      const consInv = chain.consumer_inventory as Record<string, number>;
      const consSpace = chain.consumer_storage_cap - Object.values(consInv).reduce((a, b) => a + b, 0);

      if (consSpace <= 0) continue;

      let transferred = false;
      let spaceLeft = consSpace;

      for (const [resource, qty] of Object.entries(prodInv)) {
        if (qty <= 0 || !factoryInputs.has(resource)) continue;
        const transferQty = Math.min(qty, spaceLeft);
        if (transferQty <= 0) continue;

        prodInv[resource] = (prodInv[resource] ?? 0) - transferQty;
        if (prodInv[resource] <= 0) delete prodInv[resource];
        consInv[resource] = (consInv[resource] ?? 0) + transferQty;
        spaceLeft -= transferQty;
        transferred = true;
      }

      if (transferred) {
        await client.query(
          `UPDATE businesses SET inventory = $1 WHERE id = $2`,
          [JSON.stringify(prodInv), chain.producer_id],
        );
        await client.query(
          `UPDATE businesses SET inventory = $1 WHERE id = $2`,
          [JSON.stringify(consInv), chain.consumer_id],
        );
        transfers++;
      }
    }

    if (transfers > 0) {
      console.log(`[GameTick:SupplyChain] ${transfers} transfers between producers and factories`);
    }
  });
}

// ─── 2. Employee Morale & Loyalty Decay ──────────────────────

async function processEmployeeMorale(): Promise<void> {
  await withTransaction(async (client) => {
    // Get average salary across all employees as market benchmark
    const avgRes = await client.query<{ avg_salary: string }>(
      `SELECT AVG(salary) as avg_salary FROM employees`,
    );
    const marketAvgSalary = parseFloat(avgRes.rows[0]?.avg_salary ?? '500');

    // Natural loyalty decay per tick
    await client.query(
      `UPDATE employees
          SET loyalty = GREATEST(loyalty - $1, 0)`,
      [GAME_BALANCE.LOYALTY_DECAY_PER_TICK * 100],
    );

    // Employees with below-market salary lose additional loyalty
    await client.query(
      `UPDATE employees
          SET loyalty = GREATEST(loyalty - 1, 0)
        WHERE salary < $1`,
      [marketAvgSalary],
    );

    // Apply event-based loyalty modifiers per city
    const seasonId = await getActiveSeasonId();
    if (seasonId) {
      const cityEvents = await query<{ impact_json: Record<string, any> }>(
        `SELECT impact_json FROM seasonal_events
          WHERE season_id = $1 AND status = 'ACTIVE'
            AND triggered_at <= NOW()
            AND (duration_hours IS NULL OR (triggered_at + (duration_hours || ' hours')::interval) > NOW())`,
        [seasonId],
      );

      for (const evt of cityEvents.rows) {
        const impact = evt.impact_json;
        if (impact.employee_loyalty_penalty && impact.target_city) {
          const penalty = Math.abs(impact.employee_loyalty_penalty) * ((impact.magnitude as number) ?? 1.0);
          await client.query(
            `UPDATE employees e
                SET loyalty = GREATEST(e.loyalty - $1, 0)
              FROM businesses b
              WHERE e.business_id = b.id AND b.city = $2 AND b.status = 'ACTIVE'`,
            [penalty, impact.target_city],
          );
        }
      }
    }

    // Random chance of quitting if loyalty < 20 (2% per tick)
    const lowLoyalty = await client.query<{
      id: string; business_id: string; name: string;
      loyalty: number; owner_id: string; season_id: string;
    }>(
      `SELECT e.id, e.business_id, e.name, e.loyalty,
              b.owner_id, b.season_id
         FROM employees e
         JOIN businesses b ON b.id = e.business_id
        WHERE e.loyalty < 20
          AND b.status = 'ACTIVE'`,
    );

    for (const emp of lowLoyalty.rows) {
      if (secureRandom() < 0.02) {
        await client.query(
          `DELETE FROM employees WHERE id = $1`,
          [emp.id],
        );

        await createAlert(client, emp.owner_id, emp.season_id, 'EMPLOYEE_QUIT',
          `${emp.name} quit due to low morale (loyalty: ${emp.loyalty}).`,
          { employee_id: emp.id, business_id: emp.business_id },
        );
        emitToPlayer(emp.owner_id, 'employee_quit', {
          employee_id: emp.id, name: emp.name,
        });
      }
    }
  });
}

// ─── 2b. Employee XP & Level-Up ──────────────────────────────
// Employees gain 1 XP per tick worked. Level thresholds grant skill boosts.
// Levels: Rookie(0) → Experienced(100) → Veteran(500) → Expert(2000) → Master(5000)

const XP_LEVEL_THRESHOLDS = [
  { min: 0, title: 'Rookie' },
  { min: 100, title: 'Experienced' },
  { min: 500, title: 'Veteran' },
  { min: 2000, title: 'Expert' },
  { min: 5000, title: 'Master' },
];

export function getEmployeeLevel(xp: number): { level: number; title: string } {
  let level = 0;
  let title = 'Rookie';
  for (let i = XP_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVEL_THRESHOLDS[i].min) {
      level = i;
      title = XP_LEVEL_THRESHOLDS[i].title;
      break;
    }
  }
  return { level, title };
}

async function processEmployeeXP(): Promise<void> {
  await withTransaction(async (client) => {
    // Grant 1 XP to all employed workers/managers each tick
    await client.query(
      `UPDATE employees SET experience_points = experience_points + 1
       WHERE business_id IS NOT NULL`,
    );

    // Level-up skill boosts: when crossing a threshold, boost efficiency by 2%
    // Check employees who just crossed a threshold this tick
    for (const threshold of XP_LEVEL_THRESHOLDS) {
      if (threshold.min === 0) continue;
      await client.query(
        `UPDATE employees
            SET efficiency = LEAST(efficiency + 0.02, 2.0)
          WHERE experience_points = $1
            AND business_id IS NOT NULL`,
        [threshold.min],
      );
    }
  });
}

// ─── 3. Heat Decay ────────────────────────────────────────────

async function processHeatDecay(): Promise<void> {
  await withTransaction(async (client) => {
    // Fetch all heat scores from active seasons
    const scores = await client.query<{
      id: string; player_id: string; season_id: string;
      score: string; decay_rate: string;
      under_investigation: boolean; investigation_ends: string | null;
    }>(
      `SELECT hs.id, hs.player_id, hs.season_id, hs.score,
              hs.decay_rate, hs.under_investigation, hs.investigation_ends
         FROM heat_scores hs
         JOIN season_profiles sp ON sp.id = hs.season_id
        WHERE sp.status = 'ACTIVE'`,
    );

    // Cache event modifiers per season to avoid N+1
    const heatEventCache: Record<string, EventModifiers> = {};

    for (const hs of scores.rows) {
      let score = parseFloat(hs.score);
      if (score <= 0) continue;

      const decayRate = parseFloat(hs.decay_rate);
      // 5-min tick decay = hourly rate / 12
      let decay = decayRate / 12;

      // End investigation if time has passed
      if (hs.under_investigation) {
        const ends = hs.investigation_ends ? new Date(hs.investigation_ends) : null;
        if (ends && ends <= new Date()) {
          await client.query(
            `UPDATE heat_scores
                SET under_investigation = false, investigation_ends = NULL
              WHERE id = $1`,
            [hs.id],
          );
        } else {
          // Investigation still active - no decay
          decay = 0;
        }
      }

      // Apply event heat multiplier (slows decay when crackdown active)
      if (!heatEventCache[hs.season_id]) {
        heatEventCache[hs.season_id] = await getActiveEventModifiers(hs.season_id);
      }
      const eventMods = heatEventCache[hs.season_id];
      if (eventMods.heat_multiplier > 1.0) {
        // During crackdowns, decay is reduced
        decay /= eventMods.heat_multiplier;
      }

      score = Math.max(0, score - decay);
      const newLevel = getHeatLevel(score);

      await client.query(
        `UPDATE heat_scores SET score = $1, level = $2 WHERE id = $3`,
        [score, newLevel, hs.id],
      );
    }
  });
}

// ─── 4. Market Price Fluctuation ──────────────────────────────

async function processMarketPrices(): Promise<void> {
  await withTransaction(async (client) => {
    const seasonId = await getActiveSeasonId();
    if (!seasonId) return;

    const resources = await client.query<{
      id: string; season_id: string; current_ai_price: string; base_value: string;
      global_supply: string; global_demand: string; name: string;
    }>(
      `SELECT r.id, r.season_id, r.current_ai_price, r.base_value,
              r.global_supply, r.global_demand, r.name
         FROM resources r
         JOIN season_profiles sp ON sp.id = r.season_id
        WHERE sp.status = 'ACTIVE'`,
    );

    // Get recent trade volume for supply/demand price adjustment
    const recentTrades = await client.query<{
      resource_id: string; total_bought: string; total_sold: string;
    }>(
      `SELECT
         ml.resource_id,
         COALESCE(SUM(CASE WHEN ml.listing_type IN ('PLAYER_SELL','AI_SELL') THEN ml.quantity - ml.quantity_remaining ELSE 0 END), 0) as total_sold,
         COALESCE(SUM(CASE WHEN ml.listing_type IN ('PLAYER_BUY','AI_BUY') THEN ml.quantity - ml.quantity_remaining ELSE 0 END), 0) as total_bought
       FROM market_listings ml
       WHERE ml.season_id = $1
         AND ml.created_at > NOW() - interval '30 minutes'
       GROUP BY ml.resource_id`,
      [seasonId],
    );
    const tradeMap: Record<string, { bought: number; sold: number }> = {};
    for (const t of recentTrades.rows) {
      tradeMap[t.resource_id] = {
        bought: parseInt(t.total_bought),
        sold: parseInt(t.total_sold),
      };
    }

    // Determine current "season" (every 288 ticks = 1 day cycle, 4 seasons)
    // Use hour of day as proxy: 0-5=winter, 6-11=spring, 12-17=summer, 18-23=autumn
    const hour = new Date().getUTCHours();
    const gameSeason = hour < 6 ? 'WINTER' : hour < 12 ? 'SPRING' : hour < 18 ? 'SUMMER' : 'AUTUMN';

    // Seasonal demand modifiers by resource name pattern
    const SEASONAL_DEMAND: Record<string, Record<string, number>> = {
      WINTER: { Fuel: 1.2, Clothing: 1.2, Coal: 1.2 },
      SPRING: { Wheat: 1.2, Lumber: 1.2 },
      SUMMER: { Electronics: 1.2, Medicine: 1.2 },
      AUTUMN: { Steel: 1.2, Metals: 1.2 },
    };

    // Cache event modifiers per season (global, no city)
    const seasonEventCache: Record<string, EventModifiers> = {};

    for (const res of resources.rows) {
      const currentPrice = parseFloat(res.current_ai_price);
      const baseValue = parseFloat(res.base_value);
      const globalSupply = parseFloat(res.global_supply);

      // 1. Base random fluctuation (-3% to +3%)
      let fluctuation = 1 + (secureRandom() * 0.06 - 0.03);

      // 2. Supply/demand volume adjustment (±2-5%)
      const trades = tradeMap[res.id];
      if (trades) {
        const netDemand = trades.bought - trades.sold;
        // Positive netDemand = more buying than selling = price up
        const volumeEffect = Math.max(-0.05, Math.min(0.05, netDemand * 0.001));
        fluctuation += volumeEffect;
      }

      // 3. Resource scarcity: if supply < 20% of baseline, +50% price pressure
      if (globalSupply < baseValue * 0.2) {
        fluctuation += 0.05; // 5% upward pressure per tick toward scarcity premium
      }

      // 4. Seasonal demand modifier
      const seasonalMod = SEASONAL_DEMAND[gameSeason]?.[res.name] ?? 1.0;
      if (seasonalMod > 1.0) {
        fluctuation += (seasonalMod - 1.0) * 0.01; // Gentle seasonal push
      }

      // 5. Event-based supply reduction (cached per season)
      if (!seasonEventCache[res.season_id]) {
        seasonEventCache[res.season_id] = await getActiveEventModifiers(res.season_id);
      }
      const eventMods = seasonEventCache[res.season_id];
      if (eventMods.supply_reduction > 0) {
        // Supply reduction drives prices up
        fluctuation += eventMods.supply_reduction * 0.03;
      }

      // Clamp price between 0.5x and 3x base value
      let newPrice = Math.max(
        baseValue * 0.5,
        Math.min(baseValue * 3, currentPrice * fluctuation),
      );

      // 6. AI Market Maker: stabilize prices that deviate too far from base
      // If price > 2x base, AI sells aggressively (price pressure down)
      // If price < 0.7x base, AI buys aggressively (price pressure up)
      const priceRatio = newPrice / baseValue;
      if (priceRatio > 2.0) {
        // Mean reversion: pull 2% toward base
        newPrice = newPrice * 0.98 + baseValue * 0.02;
      } else if (priceRatio < 0.7) {
        // Mean reversion: pull 2% toward base
        newPrice = newPrice * 0.98 + baseValue * 0.02;
      }

      await client.query(
        `UPDATE resources SET current_ai_price = $1 WHERE id = $2`,
        [newPrice, res.id],
      );

      // Record in price_history
      await client.query(
        `INSERT INTO price_history (resource_id, season_id, price)
         VALUES ($1, $2, $3)`,
        [res.id, res.season_id, newPrice],
      );
    }

    // Supply regeneration per tick (markets recover slowly)
    if (seasonId) {
      await client.query(
        `UPDATE resources
            SET global_supply = LEAST(global_supply * 1.005, base_value * 2000)
          WHERE season_id = $1`,
        [seasonId],
      );
    }
  });
}

// ─── 4b. AI Buy Orders — fill PLAYER_SELL listings against AI demand ──

async function processAIBuyOrders(): Promise<void> {
  await withTransaction(async (client) => {
    // Step 1: Get all open PLAYER_SELL listings
    const playerSells = await client.query<{
      id: string; seller_id: string; resource_id: string;
      quantity_remaining: number; price_per_unit: string;
      city: string; season_id: string;
    }>(
      `SELECT id, seller_id, resource_id, quantity_remaining::int,
              price_per_unit::text, city, season_id
         FROM market_listings
        WHERE listing_type = 'PLAYER_SELL'
          AND (status = 'OPEN' OR status = 'PARTIALLY_FILLED')
          AND quantity_remaining > 0
        ORDER BY created_at ASC
        FOR UPDATE`,
    );

    let filled = 0;

    for (const sell of playerSells.rows) {
      const sellPrice = parseFloat(sell.price_per_unit);
      // Step 2: Find matching AI_BUY listing in same city+resource with price >= seller's price
      const buyRow = await client.query<{
        id: string; quantity_remaining: number; price_per_unit: string;
      }>(
        `SELECT id, quantity_remaining::int, price_per_unit::text
           FROM market_listings
          WHERE listing_type = 'AI_BUY'
            AND status = 'OPEN'
            AND resource_id = $1
            AND city = $2
            AND season_id = $3
            AND quantity_remaining > 0
            AND price_per_unit >= $4::numeric
          LIMIT 1`,
        [sell.resource_id, sell.city, sell.season_id, sellPrice],
      );

      if (!buyRow.rows.length) continue;
      const aiBuy = buyRow.rows[0];

      const fillQty = Math.min(sell.quantity_remaining, aiBuy.quantity_remaining);
      if (fillQty <= 0) continue;

      const totalPayment = fillQty * sellPrice;

      // Credit seller cash
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [totalPayment, sell.seller_id],
      );

      // Update player sell listing
      const newSellerRemaining = sell.quantity_remaining - fillQty;
      const sellerStatus = newSellerRemaining === 0 ? 'FILLED' : 'PARTIALLY_FILLED';
      await client.query(
        `UPDATE market_listings
         SET quantity_remaining = $1::int,
             status = $2::listing_status,
             filled_at = CASE WHEN $4 THEN NOW() ELSE filled_at END
         WHERE id = $3`,
        [newSellerRemaining, sellerStatus, sell.id, newSellerRemaining === 0],
      );

      // Reduce AI_BUY listing quantity (AI absorbs the goods)
      const newBuyRemaining = aiBuy.quantity_remaining - fillQty;
      await client.query(
        `UPDATE market_listings SET quantity_remaining = $1 WHERE id = $2`,
        [newBuyRemaining, aiBuy.id],
      );

      // Record price history
      await client.query(
        `INSERT INTO price_history (resource_id, season_id, price)
         VALUES ($1, $2, $3)`,
        [sell.resource_id, sell.season_id, sellPrice],
      );

      // Alert seller
      const resRow = await client.query<{ name: string }>(
        `SELECT name FROM resources WHERE id = $1`,
        [sell.resource_id],
      );
      const resName = resRow.rows[0]?.name ?? 'goods';

      await createAlert(client, sell.seller_id, sell.season_id, 'MARKET_SOLD',
        `Sold ${fillQty} ${resName} at $${sellPrice.toFixed(2)}/unit for $${totalPayment.toFixed(2)} to AI market.`,
        { listing_id: sell.id, quantity: fillQty, total: totalPayment },
      );

      filled++;
    }

    if (filled > 0) {
      console.log(`[GameTick:AIBuyOrders] Filled ${filled} player sell listings`);
    }
  });
}

// ─── 5. Crime Operation Progress ──────────────────────────────

async function processCrimeOperations(): Promise<void> {
  await withTransaction(async (client) => {
    // Find operations that have completed their timer
    const ops = await client.query<{
      id: string; player_id: string; season_id: string;
      op_type: string; risk_level: number;
      dirty_money_yield: string;
      business_id: string | null;
      biz_city: string | null;
    }>(
      `SELECT co.id, co.player_id, co.season_id, co.op_type, co.risk_level,
              co.dirty_money_yield, co.business_id, b.city AS biz_city
         FROM criminal_operations co
         LEFT JOIN businesses b ON b.id = co.business_id
        WHERE co.status = 'ACTIVE' AND co.completes_at <= NOW()`,
    );

    for (const op of ops.rows) {
      // Get event modifiers for crime success rate
      const eventMods = await getActiveEventModifiers(op.season_id, op.biz_city ?? undefined);

      // Success chance inversely proportional to risk (risk 1-10 maps to 90%-10%)
      let successChance = Math.max(0.1, 1 - op.risk_level * 0.09);
      // Apply event modifier to crime success rate
      successChance = Math.max(0.05, Math.min(0.95, successChance + eventMods.crime_success_rate_modifier));

      const roll = secureRandom();

      if (roll < successChance) {
        // Success: add dirty money, moderate heat
        const yieldAmount = parseFloat(op.dirty_money_yield);

        await client.query(
          `UPDATE criminal_operations
              SET status = 'COMPLETED', was_detected = false, detection_roll = $1
            WHERE id = $2`,
          [roll, op.id],
        );

        await client.query(
          `UPDATE dirty_money_balances
              SET total_dirty = total_dirty + $1, total_earned = total_earned + $1
            WHERE player_id = $2 AND season_id = $3`,
          [yieldAmount, op.player_id, op.season_id],
        );

        // Add moderate heat (scaled by event heat multiplier)
        const heatGain = op.risk_level * 10 * eventMods.heat_multiplier;
        await client.query(
          `UPDATE heat_scores
              SET score = LEAST(score + $1, 1000), last_criminal_act = NOW()
            WHERE player_id = $2 AND season_id = $3`,
          [heatGain, op.player_id, op.season_id],
        );

        await createAlert(client, op.player_id, op.season_id, 'CRIME_COMPLETED',
          `Your ${op.op_type} operation succeeded! Earned $${yieldAmount.toFixed(2)} dirty money.`,
          { operation_id: op.id, yield_amount: yieldAmount },
        );
        emitToPlayer(op.player_id, 'crime_completed', { operation_id: op.id, yield_amount: yieldAmount });
      } else {
        // Failure: more heat, possible arrest
        await client.query(
          `UPDATE criminal_operations
              SET status = 'BUSTED', was_detected = true, detection_roll = $1
            WHERE id = $2`,
          [roll, op.id],
        );

        // Heat gain on failure also scaled by event multiplier
        const heatGain = op.risk_level * 30 * eventMods.heat_multiplier;
        await client.query(
          `UPDATE heat_scores
              SET score = LEAST(score + $1, 1000), last_criminal_act = NOW()
            WHERE player_id = $2 AND season_id = $3`,
          [heatGain, op.player_id, op.season_id],
        );

        // Fine proportional to risk
        const fineAmount = op.risk_level * 1000;
        await client.query(
          `UPDATE players SET cash = GREATEST(cash - $1, 0) WHERE id = $2`,
          [fineAmount, op.player_id],
        );

        await createAlert(client, op.player_id, op.season_id, 'CRIME_BUSTED',
          `Your ${op.op_type} operation was busted! Fined $${fineAmount}.`,
          { operation_id: op.id, fine: fineAmount },
        );
        emitToPlayer(op.player_id, 'crime_busted', { operation_id: op.id, fine: fineAmount });
      }
    }
  });
}

// ─── 6. Laundering Progress ───────────────────────────────────

async function processLaundering(): Promise<void> {
  await withTransaction(async (client) => {
    const due = await client.query<{
      id: string; player_id: string; season_id: string;
      dirty_amount: string; clean_amount: string;
    }>(
      `SELECT id, player_id, season_id, dirty_amount, clean_amount
         FROM laundering_processes
        WHERE status = 'IN_PROGRESS' AND completes_at <= NOW()`,
    );

    for (const proc of due.rows) {
      const cleanAmount = parseFloat(proc.clean_amount);
      const dirtyAmount = parseFloat(proc.dirty_amount);

      // Mark as completed
      await client.query(
        `UPDATE laundering_processes SET status = 'COMPLETED' WHERE id = $1`,
        [proc.id],
      );

      // Move money: subtract dirty, add clean cash
      await client.query(
        `UPDATE dirty_money_balances
            SET total_dirty = GREATEST(total_dirty - $1, 0),
                total_laundered = total_laundered + $1
          WHERE player_id = $2 AND season_id = $3`,
        [dirtyAmount, proc.player_id, proc.season_id],
      );

      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [cleanAmount, proc.player_id],
      );

      await createAlert(client, proc.player_id, proc.season_id, 'LAUNDERING_COMPLETE',
        `Laundering complete! $${cleanAmount.toFixed(2)} clean cash added.`,
        { process_id: proc.id, clean_amount: cleanAmount },
      );
      emitToPlayer(proc.player_id, 'laundering_complete', {
        process_id: proc.id, clean_amount: cleanAmount,
      });
    }
  });
}

// ─── 7. Shipment Arrivals ─────────────────────────────────────

async function processShipments(): Promise<void> {
  await withTransaction(async (client) => {
    const arrivals = await client.query<{
      id: string; player_id: string; items_json: Record<string, any>;
      loss_rate: number; route_id: string; season_id: string;
      destination_city: string;
    }>(
      `SELECT s.id, s.player_id, s.items_json, s.loss_rate, s.route_id, p.season_id,
              tr.destination_city
         FROM shipments s
         JOIN players p ON p.id = s.player_id
         LEFT JOIN transport_routes tr ON tr.id = s.route_id
        WHERE s.status = 'IN_TRANSIT' AND s.arrives_at <= NOW()`,
    );

    for (const ship of arrivals.rows) {
      const items = ship.items_json as Record<string, number>;
      const delivered: Record<string, number> = {};
      const lost: Record<string, number> = {};

      const destCity = ship.destination_city ?? 'Unknown';
      const eventMods = await getActiveEventModifiers(ship.season_id, destCity);

      // Roll loss for each item type (event supply reduction increases loss)
      for (const [itemName, quantity] of Object.entries(items)) {
        const lossRoll = secureRandom();
        let effectiveLossRate = ship.loss_rate;
        // Event logistics disruption increases loss rate
        if (eventMods.logistics_cost_multiplier > 1.0) {
          effectiveLossRate = Math.min(0.8, effectiveLossRate * eventMods.logistics_cost_multiplier * 0.5);
        }
        const actualLossRate = lossRoll < effectiveLossRate ? effectiveLossRate : 0;
        const lostQty = Math.floor(quantity * actualLossRate);
        const deliveredQty = quantity - lostQty;

        delivered[itemName] = deliveredQty;
        if (lostQty > 0) lost[itemName] = lostQty;
      }

      // Find a business in destination city to deposit inventory
      const bizRes = await client.query<{ id: string; inventory: Record<string, number> }>(
        `SELECT id, inventory FROM businesses
          WHERE owner_id = $1 AND city = $2 AND status = 'ACTIVE'
          LIMIT 1`,
        [ship.player_id, destCity],
      );

      if (bizRes.rows.length > 0) {
        const biz = bizRes.rows[0];
        const inv = biz.inventory as Record<string, number>;
        for (const [item, qty] of Object.entries(delivered)) {
          inv[item] = (inv[item] ?? 0) + qty;
        }
        await client.query(
          `UPDATE businesses SET inventory = $1 WHERE id = $2`,
          [JSON.stringify(inv), biz.id],
        );
      }

      // Mark shipment as delivered
      await client.query(
        `UPDATE shipments SET status = 'DELIVERED' WHERE id = $1`,
        [ship.id],
      );

      // season_id already available from main query join
      const seasonId = ship.season_id;

      const lostSummary = Object.keys(lost).length > 0
        ? ` Lost in transit: ${Object.entries(lost).map(([k, v]) => `${v} ${k}`).join(', ')}.`
        : '';

      await createAlert(client, ship.player_id, seasonId, 'SHIPMENT_ARRIVED',
        `Shipment arrived at ${destCity}.${lostSummary}`,
        { shipment_id: ship.id, delivered, lost },
      );
      emitToPlayer(ship.player_id, 'shipment_arrived', {
        shipment_id: ship.id, destination: destCity, delivered, lost,
      });
    }
  });
}

// ─── 8. Spy Discovery Checks ─────────────────────────────────


async function processSpyDiscovery(): Promise<void> {
  await withTransaction(async (client) => {
    const spies = await client.query<{
      id: string; owner_player_id: string; target_player_id: string;
      discovery_risk: number; spy_employee_id: string;
    }>(
      `SELECT id, owner_player_id, target_player_id, discovery_risk, spy_employee_id
         FROM spies WHERE status = 'ACTIVE'`,
    );

    for (const spy of spies.rows) {
      const roll = secureRandom();

      if (roll < spy.discovery_risk) {
        // Spy discovered
        await client.query(
          `UPDATE spies SET status = 'DISCOVERED' WHERE id = $1`,
          [spy.id],
        );

        // Reduce trust between the two players
        await client.query(
          `UPDATE trust_levels
              SET trust_score = GREATEST(trust_score - 20, 0),
                  betrayal_count = betrayal_count + 1,
                  last_updated = NOW()
            WHERE (player_a = $1 AND player_b = $2)
               OR (player_a = $2 AND player_b = $1)`,
          [spy.owner_player_id, spy.target_player_id],
        );

        // Notify target player
        const targetSeasonRes = await client.query<{ season_id: string }>(
          `SELECT season_id FROM players WHERE id = $1`,
          [spy.target_player_id],
        );
        const tSeasonId = targetSeasonRes.rows[0]?.season_id ?? '';

        await createAlert(client, spy.target_player_id, tSeasonId, 'SPY_DISCOVERED',
          `You discovered an enemy spy in your organization!`,
          { spy_id: spy.id, owner_id: spy.owner_player_id },
        );
        emitToPlayer(spy.target_player_id, 'spy_discovered', {
          spy_id: spy.id,
        });

        // Notify spy owner
        const ownerSeasonRes = await client.query<{ season_id: string }>(
          `SELECT season_id FROM players WHERE id = $1`,
          [spy.owner_player_id],
        );
        const oSeasonId = ownerSeasonRes.rows[0]?.season_id ?? '';

        await createAlert(client, spy.owner_player_id, oSeasonId, 'SPY_LOST',
          `Your spy was discovered and removed!`,
          { spy_id: spy.id, target_id: spy.target_player_id },
        );
        emitToPlayer(spy.owner_player_id, 'spy_lost', { spy_id: spy.id });
      } else {
        // Increase discovery risk by 0.02 per tick
        await client.query(
          `UPDATE spies SET discovery_risk = LEAST(discovery_risk + 0.02, 0.95) WHERE id = $1`,
          [spy.id],
        );
      }
    }
  });
}

// ─── 9. Manager Embezzlement Checks ───────────────────────────

async function processEmbezzlement(): Promise<void> {
  await withTransaction(async (client) => {
    const managers = await client.query<{
      id: string; player_id: string; business_id: string;
      employee_id: string; embezzlement_risk: number;
    }>(
      `SELECT id, player_id, business_id, employee_id, embezzlement_risk
         FROM manager_assignments`,
    );

    for (const mgr of managers.rows) {
      const roll = secureRandom();
      if (roll >= mgr.embezzlement_risk) continue;

      // Get last day's revenue from business_ledger
      const ledgerRes = await client.query<{ revenue: string }>(
        `SELECT revenue FROM business_ledger
          WHERE business_id = $1
          ORDER BY day DESC LIMIT 1`,
        [mgr.business_id],
      );
      const lastRevenue = ledgerRes.rows.length > 0 ? parseFloat(ledgerRes.rows[0].revenue) : 0;
      if (lastRevenue <= 0) continue;

      // Steal 5-15% of last tick's revenue
      const stealPercent = 0.05 + secureRandom() * 0.10;
      const stolenAmount = lastRevenue * stealPercent;

      // Deduct from player
      await client.query(
        `UPDATE players SET cash = GREATEST(cash - $1, 0) WHERE id = $2`,
        [stolenAmount, mgr.player_id],
      );

      // Detection chance (50%)
      const detected = secureRandom() < 0.5;

      // Log embezzlement
      await client.query(
        `INSERT INTO embezzlement_logs (manager_id, amount, detected)
         VALUES ($1, $2, $3)`,
        [mgr.id, stolenAmount, detected],
      );

      if (detected) {
        const seasonRes = await client.query<{ season_id: string }>(
          `SELECT season_id FROM players WHERE id = $1`,
          [mgr.player_id],
        );
        const seasonId = seasonRes.rows[0]?.season_id ?? '';

        await createAlert(client, mgr.player_id, seasonId, 'EMBEZZLEMENT_DETECTED',
          `A manager at your business embezzled $${stolenAmount.toFixed(2)}!`,
          { manager_id: mgr.id, amount: stolenAmount, business_id: mgr.business_id },
        );
        emitToPlayer(mgr.player_id, 'embezzlement_detected', {
          manager_id: mgr.id, amount: stolenAmount,
        });
      }
    }
  });
}

// ─── 10. Event Expiry ─────────────────────────────────────────

async function processEventExpiry(): Promise<void> {
  await withTransaction(async (client) => {
    // Find events that have expired: triggered_at + duration_hours has passed
    const expired = await client.query<{
      id: string; season_id: string; category: string; title: string;
    }>(
      `SELECT id, season_id, category, title
         FROM seasonal_events
        WHERE status = 'ACTIVE'
          AND triggered_at + (duration_hours || ' hours')::interval <= NOW()`,
    );

    for (const evt of expired.rows) {
      // Mark event as resolved
      await client.query(
        `UPDATE seasonal_events SET status = 'RESOLVED' WHERE id = $1`,
        [evt.id],
      );

      // Resolve all impacts for this event
      await client.query(
        `UPDATE event_impacts SET resolved = true WHERE event_id = $1`,
        [evt.id],
      );

      // Alert all players in this season that the event ended
      const players = await client.query<{ id: string }>(
        `SELECT id FROM players WHERE season_id = $1`,
        [evt.season_id],
      );
      for (const p of players.rows) {
        await createAlert(client, p.id, evt.season_id, 'EVENT_ENDED',
          `Event ended: ${evt.title}`,
          { event_id: evt.id, category: evt.category },
        );
      }

      console.log(`[GameTick:EventExpiry] Event "${evt.title}" (${evt.id}) resolved.`);
    }
  });
}

// ─── Expired Market Listings ──────────────────────────────────

async function processExpiredListings(): Promise<void> {
  await withTransaction(async (client) => {
    // Find expired OPEN or PARTIALLY_FILLED listings
    const expired = await client.query<{
      id: string; listing_type: string; seller_id: string | null;
      business_id: string | null; resource_id: string;
      quantity_remaining: number; season_id: string;
    }>(
      `SELECT id, listing_type, seller_id, business_id, resource_id,
              quantity_remaining, season_id
         FROM market_listings
        WHERE status IN ('OPEN', 'PARTIALLY_FILLED')
          AND expires_at <= NOW()
        FOR UPDATE`,
    );

    for (const listing of expired.rows) {
      // Mark as EXPIRED
      await client.query(
        `UPDATE market_listings SET status = 'EXPIRED' WHERE id = $1`,
        [listing.id],
      );

      // Return unsold inventory to seller's business for PLAYER_SELL listings
      if (
        (listing.listing_type === 'PLAYER_SELL') &&
        listing.business_id &&
        listing.quantity_remaining > 0
      ) {
        const resRow = await client.query<{ name: string }>(
          `SELECT name FROM resources WHERE id = $1`,
          [listing.resource_id],
        );
        const resName = resRow.rows[0]?.name ?? listing.resource_id;
        await client.query(
          `UPDATE businesses
           SET inventory = jsonb_set(
             inventory,
             $1,
             to_jsonb((COALESCE((inventory->$2)::int, 0) + $3)::int)
           )
           WHERE id = $4`,
          [`{${resName}}`, resName, listing.quantity_remaining, listing.business_id],
        );
      }
    }

    if (expired.rows.length > 0) {
      console.log(`[GameTick:ExpiredListings] Expired ${expired.rows.length} listings`);
    }
  });
}

// ─── 11. Blockade Maintenance Costs ───────────────────────────

async function processBlockadeCosts(): Promise<void> {
  await withTransaction(async (client) => {
    const blockades = await client.query<{
      id: string; player_id: string; cost: number;
    }>(
      `SELECT id, player_id, cost FROM blockades WHERE active = true`,
    );

    for (const blk of blockades.rows) {
      // $500 per tick per blockade
      const maintenanceCost = 500;

      // Check if player can afford
      const playerRes = await client.query<{ cash: string }>(
        `SELECT cash FROM players WHERE id = $1`,
        [blk.player_id],
      );
      const cash = parseFloat(playerRes.rows[0]?.cash ?? '0');

      if (cash < maintenanceCost) {
        // Can't afford - deactivate blockade
        await client.query(
          `UPDATE blockades SET active = false WHERE id = $1`,
          [blk.id],
        );

        const seasonRes = await client.query<{ season_id: string }>(
          `SELECT season_id FROM players WHERE id = $1`,
          [blk.player_id],
        );
        const seasonId = seasonRes.rows[0]?.season_id ?? '';

        await createAlert(client, blk.player_id, seasonId, 'BLOCKADE_COLLAPSED',
          'A blockade was deactivated due to insufficient funds.',
          { blockade_id: blk.id },
        );
        emitToPlayer(blk.player_id, 'blockade_collapsed', { blockade_id: blk.id });
      } else {
        // Deduct maintenance
        await client.query(
          `UPDATE players SET cash = cash - $1 WHERE id = $2`,
          [maintenanceCost, blk.player_id],
        );
      }
    }
  });
}

// ─── 12. Location Monthly Costs ───────────────────────────────

async function processLocationCosts(): Promise<void> {
  await withTransaction(async (client) => {
    // Monthly cost / 8640 ticks per month (30 days * 24h * 12 ticks/h)
    const locations = await client.query<{
      id: string; player_id: string; monthly_cost: number;
    }>(
      `SELECT id, player_id, monthly_cost FROM locations WHERE status = 'ACTIVE'`,
    );

    for (const loc of locations.rows) {
      const tickCost = loc.monthly_cost / 8640;

      await client.query(
        `UPDATE players SET cash = GREATEST(cash - $1, 0) WHERE id = $2`,
        [tickCost, loc.player_id],
      );
    }
  });
}

// ─── Worker Recruitment (replenish employee pool) ─────────────

const FIRST_NAMES = ['Alex','Sam','Jordan','Morgan','Riley','Quinn','Blake','Casey','Dana','Drew','Eli','Finn','Gray','Harper','Kai','Lane','Max','Noel','Pat','Reese','Robin','Sage','Sky','Taylor','Val'];
const LAST_NAMES = ['Smith','Jones','Chen','Patel','Kim','Lee','Garcia','Wilson','Brown','Singh','Costa','Volkov','Murphy','Novak','Berg','Torres','Nash','Reed','Stone','Wells'];

async function processWorkerRecruitment(): Promise<void> {
  const seasonRes = await query<{ id: string }>(
    "SELECT id FROM season_profiles WHERE status = 'ACTIVE' LIMIT 1",
  );
  const seasonId = seasonRes.rows[0]?.id;
  if (!seasonId) return;

  // Count available (unhired) employees
  const poolRes = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM employees WHERE business_id IS NULL AND season_id = $1",
    [seasonId],
  );
  const poolSize = parseInt(poolRes.rows[0].count);

  // Target: maintain 30+ workers in the pool. Spawn up to 8 per tick if low.
  const TARGET_MIN = 30;
  if (poolSize >= TARGET_MIN) return;

  const toSpawn = Math.min(8, TARGET_MIN - poolSize);
  const roles = ['WORKER','WORKER','WORKER','WORKER','WORKER','WORKER','DRIVER','ACCOUNTANT','MANAGER','SECURITY'];

  for (let i = 0; i < toSpawn; i++) {
    const role = roles[Math.floor(secureRandom() * roles.length)];
    const eff = 0.30 + secureRandom() * 0.60; // 0.30-0.90
    const isCriminal = role === 'ENFORCER' || (role === 'DRIVER' && secureRandom() < 0.5);
    const corr = role === 'ENFORCER' ? 0.4 + secureRandom() * 0.4 : 0.05 + secureRandom() * 0.55;
    const baseSalary = role === 'WORKER' ? 150 : role === 'MANAGER' ? 400 : role === 'DRIVER' ? 200 : role === 'SECURITY' ? 250 : 180;
    const salary = Math.round(baseSalary + eff * 200);
    const name = FIRST_NAMES[Math.floor(secureRandom() * FIRST_NAMES.length)] + ' ' +
                 LAST_NAMES[Math.floor(secureRandom() * LAST_NAMES.length)];

    await query(
      `INSERT INTO employees
         (season_id, name, role, efficiency, speed, loyalty, reliability,
          corruption_risk, criminal_capable, salary, experience_points,
          morale, bribe_resistance, business_id, hired_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,NULL,NULL)`,
      [
        seasonId, name, role,
        parseFloat(eff.toFixed(4)),
        parseFloat((0.30 + secureRandom() * 0.60).toFixed(4)),
        parseFloat((0.20 + secureRandom() * 0.65).toFixed(4)),
        parseFloat((0.40 + secureRandom() * 0.55).toFixed(4)),
        parseFloat(corr.toFixed(4)),
        isCriminal,
        salary,
        parseFloat((0.60 + secureRandom() * 0.40).toFixed(4)),
        parseFloat((0.20 + secureRandom() * 0.70).toFixed(4)),
      ],
    );
  }

  if (toSpawn > 0) {
    console.log(`[GameTick:Recruitment] Spawned ${toSpawn} new employees (pool was ${poolSize})`);
  }
}

// ─── Revenue Report Alerts (every 3 ticks = ~15 min) ─────────

async function processRevenueAlerts(): Promise<void> {
  if (tickCount % REVENUE_ALERT_INTERVAL !== 0) return;

  await withTransaction(async (client) => {
    const players = await client.query<{
      owner_id: string; season_id: string;
      total_rev: string; total_exp: string; biz_count: string;
      total_inv: string;
    }>(
      `SELECT b.owner_id, p.season_id,
              COALESCE(SUM(b.tier * ${GAME_BALANCE.BUSINESS_BASE_REVENUE} * b.efficiency
                * (1 + (SELECT COUNT(*) FROM employees e WHERE e.business_id = b.id) * 0.1)
                / 288 * $1), 0) AS total_rev,
              COALESCE(SUM(b.daily_operating_cost / 288 * $1), 0) AS total_exp,
              COUNT(*)::int AS biz_count,
              COALESCE(SUM(
                (SELECT COALESCE(SUM(v::int), 0) FROM jsonb_each_text(b.inventory) AS t(k, v))
              ), 0)::text AS total_inv
       FROM businesses b
       JOIN players p ON p.id = b.owner_id
       WHERE b.status = 'ACTIVE'
       GROUP BY b.owner_id, p.season_id
       HAVING COUNT(*) > 0`,
      [REVENUE_ALERT_INTERVAL],
    );

    for (const row of players.rows) {
      const rev = parseFloat(row.total_rev);
      const exp = parseFloat(row.total_exp);
      const net = rev - exp;
      const sign = net >= 0 ? '+' : '';
      const totalInv = parseInt(row.total_inv ?? '0', 10);
      const invNote = totalInv > 0 ? ` ${totalInv} items in storage.` : '';
      await createAlert(client, row.owner_id, row.season_id, 'REVENUE_REPORT',
        `${row.biz_count} businesses: ${sign}$${net.toFixed(0)} net ($${rev.toFixed(0)} rev, $${exp.toFixed(0)} costs).${invNote}`,
        { revenue: rev, expenses: exp, net, businesses: Number(row.biz_count), inventory: totalInv },
      );
    }
  });
}

// ─── Milestone Achievements ──────────────────────────────────

const MILESTONES = [
  { key: 'cash_10k', check: (d: MilestoneData) => d.cash >= 10000, msg: 'Cash reached $10,000!', reward: 1000 },
  { key: 'cash_100k', check: (d: MilestoneData) => d.cash >= 100000, msg: 'Cash reached $100,000!', reward: 5000 },
  { key: 'cash_500k', check: (d: MilestoneData) => d.cash >= 500000, msg: 'Half a million in cash!', reward: 15000 },
  { key: 'cash_1m', check: (d: MilestoneData) => d.cash >= 1000000, msg: 'MILLIONAIRE! Cash hit $1,000,000!', reward: 50000 },
  { key: 'biz_1', check: (d: MilestoneData) => d.bizCount >= 1, msg: 'First business opened!', reward: 2000 },
  { key: 'biz_3', check: (d: MilestoneData) => d.bizCount >= 3, msg: 'Business mogul! 3 businesses.', reward: 8000 },
  { key: 'biz_5', check: (d: MilestoneData) => d.bizCount >= 5, msg: 'Empire expanding! 5 businesses.', reward: 20000 },
  { key: 'emp_5', check: (d: MilestoneData) => d.empCount >= 5, msg: 'Growing workforce! 5 employees.', reward: 3000 },
  { key: 'emp_20', check: (d: MilestoneData) => d.empCount >= 20, msg: 'Major employer! 20 workers.', reward: 10000 },
  { key: 'tier2', check: (d: MilestoneData) => d.maxTier >= 2, msg: 'A business reached Tier 2!', reward: 5000 },
  { key: 'tier3', check: (d: MilestoneData) => d.maxTier >= 3, msg: 'A business reached Tier 3!', reward: 15000 },
  { key: 'tier4', check: (d: MilestoneData) => d.maxTier >= 4, msg: 'Maximum power! Tier 4!', reward: 50000 },
  { key: 'nw_200k', check: (d: MilestoneData) => d.netWorth >= 200000, msg: 'Net worth passed $200,000!', reward: 5000 },
  { key: 'nw_1m', check: (d: MilestoneData) => d.netWorth >= 1000000, msg: 'Net worth hit $1M!', reward: 25000 },
  { key: 'rank_top10', check: (d: MilestoneData) => d.rank <= 10 && d.rank > 0, msg: 'TOP 10! One of the most powerful.', reward: 10000 },
  { key: 'rank_1', check: (d: MilestoneData) => d.rank === 1, msg: '#1 RANKED! The most powerful player!', reward: 50000 },
];

interface MilestoneData {
  cash: number; bizCount: number; empCount: number; maxTier: number;
  netWorth: number; rank: number;
}

async function processMilestones(): Promise<void> {
  // Check milestones every 6 ticks (~30 minutes)
  if (tickCount % 6 !== 0) return;

  await withTransaction(async (client) => {
    const players = await client.query<{
      id: string; season_id: string; cash: string; net_worth: string;
      biz_count: string; emp_count: string; max_tier: string;
    }>(
      `SELECT p.id, p.season_id, p.cash::text, p.net_worth::text,
              COALESCE(bc.cnt, 0)::text AS biz_count,
              COALESCE(ec.cnt, 0)::text AS emp_count,
              COALESCE(bt.max_tier, 1)::text AS max_tier
         FROM players p
         LEFT JOIN (SELECT owner_id, COUNT(*) AS cnt FROM businesses WHERE status != 'BANKRUPT' GROUP BY owner_id) bc ON bc.owner_id = p.id
         LEFT JOIN (SELECT b.owner_id, COUNT(*) AS cnt FROM employees e JOIN businesses b ON b.id = e.business_id GROUP BY b.owner_id) ec ON ec.owner_id = p.id
         LEFT JOIN (SELECT owner_id, MAX(tier) AS max_tier FROM businesses WHERE status != 'BANKRUPT' GROUP BY owner_id) bt ON bt.owner_id = p.id
         JOIN season_profiles sp ON sp.id = p.season_id AND sp.status = 'ACTIVE'`,
    );

    for (const p of players.rows) {
      // Get player's rank
      const rankRes = await client.query<{ rank: string }>(
        `SELECT COUNT(*) + 1 AS rank FROM players WHERE season_id = $1 AND net_worth > $2`,
        [p.season_id, p.net_worth],
      );

      const data: MilestoneData = {
        cash: parseFloat(p.cash),
        bizCount: parseInt(p.biz_count),
        empCount: parseInt(p.emp_count),
        maxTier: parseInt(p.max_tier),
        netWorth: parseFloat(p.net_worth),
        rank: parseInt(rankRes.rows[0]?.rank ?? '999'),
      };

      for (const milestone of MILESTONES) {
        if (!milestone.check(data)) continue;

        // Check if this milestone was already awarded
        const existing = await client.query(
          `SELECT 1 FROM alerts
            WHERE player_id = $1 AND type = 'REVENUE_REPORT'
              AND data->>'milestone' = $2
            LIMIT 1`,
          [p.id, milestone.key],
        );
        if (existing.rows.length > 0) continue;

        // Grant cash reward
        if (milestone.reward > 0) {
          await client.query(
            'UPDATE players SET cash = cash + $1 WHERE id = $2',
            [milestone.reward, p.id],
          );
        }

        await createAlert(client, p.id, p.season_id, 'REVENUE_REPORT',
          `Achievement: ${milestone.msg} Bonus: +$${milestone.reward.toLocaleString()}!`,
          { milestone: milestone.key, type: 'achievement', reward: milestone.reward },
        );
      }
    }
  });
}

// ─── Heat Warning Alerts ──────────────────────────────────────

async function processHeatWarnings(): Promise<void> {
  await withTransaction(async (client) => {
    const dangerousHeat = await client.query<{
      player_id: string; season_id: string; score: string; level: string;
      under_investigation: boolean;
    }>(
      `SELECT hs.player_id, hs.season_id, hs.score, hs.level, hs.under_investigation
       FROM heat_scores hs
       JOIN season_profiles sp ON sp.id = hs.season_id
       WHERE sp.status = 'ACTIVE'
         AND (hs.level IN ('HOT', 'BURNING', 'FUGITIVE')
              OR hs.under_investigation = true)`,
    );

    for (const hs of dangerousHeat.rows) {
      const score = parseFloat(hs.score);
      const thresholds = [
        { level: 'HOT', min: 300, max: 310 },
        { level: 'BURNING', min: 600, max: 615 },
        { level: 'FUGITIVE', min: 900, max: 920 },
      ];

      for (const t of thresholds) {
        if (hs.level === t.level && score >= t.min && score <= t.max) {
          const existing = await client.query(
            `SELECT 1 FROM alerts
             WHERE player_id = $1 AND type = 'HEAT_WARNING'
               AND created_at > NOW() - INTERVAL '1 hour'
             LIMIT 1`,
            [hs.player_id],
          );
          if (existing.rows.length === 0) {
            const msg = hs.level === 'FUGITIVE'
              ? 'CRITICAL: Heat level reached FUGITIVE! Law enforcement is actively hunting you.'
              : hs.level === 'BURNING'
              ? 'WARNING: Heat level is BURNING. High-risk operations are now restricted.'
              : 'CAUTION: Heat level is HOT. Consider laying low.';
            await createAlert(client, hs.player_id, hs.season_id, 'HEAT_WARNING',
              msg,
              { heat_level: hs.level, score },
            );
          }
          break;
        }
      }

      if (hs.under_investigation) {
        const existing = await client.query(
          `SELECT 1 FROM alerts
           WHERE player_id = $1 AND type = 'DETECTION_WARNING'
             AND created_at > NOW() - INTERVAL '30 minutes'
           LIMIT 1`,
          [hs.player_id],
        );
        if (existing.rows.length === 0) {
          await createAlert(client, hs.player_id, hs.season_id, 'DETECTION_WARNING',
            'You are under active investigation! Heat decay is paused.',
            { heat_level: hs.level, score },
          );
        }
      }
    }
  });
}

// ─── Event Start Alerts ───────────────────────────────────────

async function processEventAlerts(): Promise<void> {
  await withTransaction(async (client) => {
    const newEvents = await client.query<{
      id: string; season_id: string; category: string;
      title: string; description: string;
    }>(
      `SELECT id, season_id, category, title, description
       FROM seasonal_events
       WHERE status = 'ACTIVE'
         AND triggered_at > NOW() - INTERVAL '6 minutes'
         AND triggered_at <= NOW()`,
    );

    if (newEvents.rows.length === 0) return;

    for (const evt of newEvents.rows) {
      const players = await client.query<{ id: string }>(
        `SELECT id FROM players WHERE season_id = $1`,
        [evt.season_id],
      );

      for (const p of players.rows) {
        await createAlert(client, p.id, evt.season_id, 'EVENT_STARTED',
          `New event: ${evt.title} - ${evt.description}`,
          { event_id: evt.id, category: evt.category },
        );
      }
    }
  });
}



// ─── Delivery Order Processing ────────────────────────────────
// Processes delivery orders every tick (5 min).
// 1. Auto-delivers expired PENDING orders (auto_deliver_at < NOW())
// 2. Completes CLAIMED deliveries past estimated_delivery

async function processDeliveries(): Promise<void> {
  await withTransaction(async (client) => {
    // 1. Auto-deliver expired PENDING orders
    const expired = await client.query<{
      id: string; buyer_id: string; resource_name: string; quantity: number;
      destination_city: string; standard_fee: number; season_id: string;
    }>(
      `SELECT d.*, d.season_id FROM delivery_orders d
       WHERE d.status = 'PENDING' AND d.auto_deliver_at < NOW()`,
    );

    for (const order of expired.rows) {
      // Find buyer's business in destination city
      const bizRow = await client.query<{ id: string; inventory: Record<string, number> }>(
        `SELECT id, inventory FROM businesses
         WHERE owner_id = $1 AND city = $2 AND status = 'ACTIVE'
         LIMIT 1`,
        [order.buyer_id, order.destination_city],
      );

      if (bizRow.rows.length > 0) {
        const biz = bizRow.rows[0];
        const inv = biz.inventory as Record<string, number>;
        inv[order.resource_name] = (inv[order.resource_name] ?? 0) + order.quantity;
        await client.query(
          `UPDATE businesses SET inventory = $1 WHERE id = $2`,
          [JSON.stringify(inv), biz.id],
        );
      } else {
        // Fallback: find any active business of the buyer
        const fallbackBiz = await client.query<{ id: string; inventory: Record<string, number> }>(
          `SELECT id, inventory FROM businesses
           WHERE owner_id = $1 AND status = 'ACTIVE'
           ORDER BY established_at ASC LIMIT 1`,
          [order.buyer_id],
        );
        if (fallbackBiz.rows.length > 0) {
          const biz = fallbackBiz.rows[0];
          const inv = biz.inventory as Record<string, number>;
          inv[order.resource_name] = (inv[order.resource_name] ?? 0) + order.quantity;
          await client.query(
            `UPDATE businesses SET inventory = $1 WHERE id = $2`,
            [JSON.stringify(inv), biz.id],
          );
        }
      }

      // Deduct standard_fee from buyer for auto-delivery service
      await client.query(
        `UPDATE players SET cash = cash - LEAST(cash, $1) WHERE id = $2`,
        [order.standard_fee, order.buyer_id],
      );

      // Mark as AUTO_DELIVERED
      await client.query(
        `UPDATE delivery_orders SET status = 'AUTO_DELIVERED', delivered_at = NOW() WHERE id = $1`,
        [order.id],
      );

      // Alert buyer
      const seasonId = order.season_id;
      if (seasonId) {
        await createAlert(client, order.buyer_id, seasonId, 'DELIVERY_AUTO',
          `Your order of ${order.quantity} ${order.resource_name} was auto-delivered to ${order.destination_city}. Delivery fee: $${Number(order.standard_fee).toFixed(2)}`,
          { delivery_id: order.id, resource: order.resource_name, quantity: order.quantity },
        );
      }

      try {
        emitToPlayer(order.buyer_id, 'delivery_completed', {
          delivery_id: order.id, type: 'auto', destination: order.destination_city,
          resource: order.resource_name, quantity: order.quantity,
        });
      } catch {
        // Non-critical
      }
    }

    // 2. Complete CLAIMED deliveries past estimated_delivery
    const completed = await client.query<{
      id: string; buyer_id: string; carrier_id: string; resource_name: string;
      quantity: number; destination_city: string; player_fee: number; season_id: string;
    }>(
      `SELECT d.*, d.season_id FROM delivery_orders d
       WHERE d.status = 'CLAIMED' AND d.estimated_delivery < NOW()`,
    );

    for (const order of completed.rows) {
      // Credit inventory to buyer's business in destination city
      const bizRow = await client.query<{ id: string; inventory: Record<string, number> }>(
        `SELECT id, inventory FROM businesses
         WHERE owner_id = $1 AND city = $2 AND status = 'ACTIVE'
         LIMIT 1`,
        [order.buyer_id, order.destination_city],
      );

      if (bizRow.rows.length > 0) {
        const biz = bizRow.rows[0];
        const inv = biz.inventory as Record<string, number>;
        inv[order.resource_name] = (inv[order.resource_name] ?? 0) + order.quantity;
        await client.query(
          `UPDATE businesses SET inventory = $1 WHERE id = $2`,
          [JSON.stringify(inv), biz.id],
        );
      } else {
        // Fallback: any active business
        const fallbackBiz = await client.query<{ id: string; inventory: Record<string, number> }>(
          `SELECT id, inventory FROM businesses
           WHERE owner_id = $1 AND status = 'ACTIVE'
           ORDER BY established_at ASC LIMIT 1`,
          [order.buyer_id],
        );
        if (fallbackBiz.rows.length > 0) {
          const biz = fallbackBiz.rows[0];
          const inv = biz.inventory as Record<string, number>;
          inv[order.resource_name] = (inv[order.resource_name] ?? 0) + order.quantity;
          await client.query(
            `UPDATE businesses SET inventory = $1 WHERE id = $2`,
            [JSON.stringify(inv), biz.id],
          );
        }
      }

      // Pay carrier the player_fee
      const fee = Number(order.player_fee) || 0;
      if (fee > 0 && order.carrier_id) {
        await client.query(
          `UPDATE players SET cash = cash + $1 WHERE id = $2`,
          [fee, order.carrier_id],
        );
      }

      // Mark as DELIVERED
      await client.query(
        `UPDATE delivery_orders SET status = 'DELIVERED', delivered_at = NOW() WHERE id = $1`,
        [order.id],
      );

      const seasonId = order.season_id;
      if (seasonId) {
        // Alert buyer
        await createAlert(client, order.buyer_id, seasonId, 'DELIVERY_COMPLETE',
          `${order.quantity} ${order.resource_name} delivered to ${order.destination_city} by carrier.`,
          { delivery_id: order.id, resource: order.resource_name, quantity: order.quantity },
        );

        // Alert carrier
        if (order.carrier_id) {
          await createAlert(client, order.carrier_id, seasonId, 'DELIVERY_EARNED',
            `Delivery completed! Earned $${fee.toFixed(2)} for delivering ${order.quantity} ${order.resource_name} to ${order.destination_city}.`,
            { delivery_id: order.id, earned: fee },
          );
        }
      }

      try {
        emitToPlayer(order.buyer_id, 'delivery_completed', {
          delivery_id: order.id, type: 'carrier', destination: order.destination_city,
          resource: order.resource_name, quantity: order.quantity,
        });
        if (order.carrier_id) {
          emitToPlayer(order.carrier_id, 'delivery_earned', {
            delivery_id: order.id, earned: fee,
          });
        }
      } catch {
        // Non-critical
      }
    }
  });
}

// ─── Contract Settlement ──────────────────────────────────────

async function processContractSettlement(): Promise<void> {
  await withTransaction(async (client) => {
    // Find ACTIVE contracts due for settlement
    const contracts = await client.query<{
      id: string; season_id: string; initiator_id: string; counterparty_id: string;
      resource_id: string; quantity_per_period: number; price_per_unit: number;
      period: string; duration_periods: number; periods_completed: number;
      breach_penalty: number; delivery_city: string; auto_renew: boolean;
    }>(
      `SELECT * FROM trade_contracts
        WHERE status = 'ACTIVE'
          AND next_settlement <= NOW()
        FOR UPDATE`,
    );

    for (const ct of contracts.rows) {
      const totalCost = ct.quantity_per_period * ct.price_per_unit;

      // Resolve resource name for inventory operations
      const resRow = await client.query<{ name: string }>(
        `SELECT name FROM resources WHERE id = $1`,
        [ct.resource_id],
      );
      const resName = resRow.rows[0]?.name ?? ct.resource_id;

      // Check initiator has inventory to fulfill
      const sellerBizRow = await client.query<{ id: string; inventory: Record<string, number> }>(
        `SELECT id, inventory FROM businesses
          WHERE owner_id = $1 AND city = $2 AND status = 'ACTIVE'
          ORDER BY established_at ASC LIMIT 1 FOR UPDATE`,
        [ct.initiator_id, ct.delivery_city],
      );

      const sellerHasInventory = sellerBizRow.rows.length > 0 &&
        ((sellerBizRow.rows[0].inventory as Record<string, number>)[resName] ?? 0) >= ct.quantity_per_period;

      // Check counterparty has cash
      const buyerRow = await client.query<{ cash: string }>(
        `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
        [ct.counterparty_id],
      );
      const buyerHasCash = buyerRow.rows.length > 0 && Number(buyerRow.rows[0].cash) >= totalCost;

      if (!sellerHasInventory || !buyerHasCash) {
        // Breach: apply penalty to the breaching party
        const breacherId = !sellerHasInventory ? ct.initiator_id : ct.counterparty_id;
        const penalty = ct.breach_penalty;

        if (penalty > 0) {
          await client.query(
            `UPDATE players SET cash = GREATEST(cash - $1, 0) WHERE id = $2`,
            [penalty, breacherId],
          );
        }

        await client.query(
          `UPDATE trade_contracts SET status = 'BREACHED' WHERE id = $1`,
          [ct.id],
        );

        // Alert both parties
        const reason = !sellerHasInventory ? 'seller lacked inventory' : 'buyer lacked funds';
        await createAlert(client, ct.initiator_id, ct.season_id, 'CONTRACT_BREACHED',
          `Contract breached: ${reason}. Penalty: $${penalty.toFixed(2)}`,
          { contract_id: ct.id, reason },
        );
        await createAlert(client, ct.counterparty_id, ct.season_id, 'CONTRACT_BREACHED',
          `Contract breached: ${reason}. Penalty: $${penalty.toFixed(2)}`,
          { contract_id: ct.id, reason },
        );
        continue;
      }

      // Execute settlement: deduct buyer cash, credit seller
      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [totalCost, ct.counterparty_id],
      );
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [totalCost, ct.initiator_id],
      );

      // Transfer inventory: deduct from seller, credit buyer's business in delivery city
      const sellerBiz = sellerBizRow.rows[0];
      const sellerInv = sellerBiz.inventory as Record<string, number>;
      sellerInv[resName] = (sellerInv[resName] ?? 0) - ct.quantity_per_period;
      await client.query(
        `UPDATE businesses SET inventory = $1 WHERE id = $2`,
        [JSON.stringify(sellerInv), sellerBiz.id],
      );

      // Credit buyer's business in delivery city
      const buyerBizRow = await client.query<{ id: string; inventory: Record<string, number> }>(
        `SELECT id, inventory FROM businesses
          WHERE owner_id = $1 AND city = $2 AND status = 'ACTIVE'
          ORDER BY established_at ASC LIMIT 1 FOR UPDATE`,
        [ct.counterparty_id, ct.delivery_city],
      );
      if (buyerBizRow.rows.length > 0) {
        const buyerBiz = buyerBizRow.rows[0];
        const buyerInv = buyerBiz.inventory as Record<string, number>;
        buyerInv[resName] = (buyerInv[resName] ?? 0) + ct.quantity_per_period;
        await client.query(
          `UPDATE businesses SET inventory = $1 WHERE id = $2`,
          [JSON.stringify(buyerInv), buyerBiz.id],
        );
      }

      // Advance contract
      const newPeriods = ct.periods_completed + 1;
      const settlementInterval = ct.period === 'DAILY' ? '1 day' : '7 days';

      if (newPeriods >= ct.duration_periods) {
        // Contract complete
        if (ct.auto_renew) {
          await client.query(
            `UPDATE trade_contracts
                SET periods_completed = 0,
                    next_settlement = NOW() + $1::interval
              WHERE id = $2`,
            [settlementInterval, ct.id],
          );
        } else {
          await client.query(
            `UPDATE trade_contracts SET status = 'COMPLETED', periods_completed = $1 WHERE id = $2`,
            [newPeriods, ct.id],
          );
        }
      } else {
        await client.query(
          `UPDATE trade_contracts
              SET periods_completed = $1,
                  next_settlement = NOW() + $2::interval
            WHERE id = $3`,
          [newPeriods, settlementInterval, ct.id],
        );
      }

      // Alert both parties
      await createAlert(client, ct.initiator_id, ct.season_id, 'CONTRACT_SETTLED',
        `Contract settlement: sold ${ct.quantity_per_period} ${resName} for $${totalCost.toFixed(2)}. Period ${newPeriods}/${ct.duration_periods}.`,
        { contract_id: ct.id, period: newPeriods },
      );
      await createAlert(client, ct.counterparty_id, ct.season_id, 'CONTRACT_SETTLED',
        `Contract settlement: received ${ct.quantity_per_period} ${resName} for $${totalCost.toFixed(2)}. Period ${newPeriods}/${ct.duration_periods}.`,
        { contract_id: ct.id, period: newPeriods },
      );
    }
  });
}
