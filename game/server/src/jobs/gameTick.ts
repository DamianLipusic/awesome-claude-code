import { processNPCTick } from './npcAI';
import { query, withTransaction } from '../db/client';
import type { PoolClient } from 'pg';
import { getHeatLevel } from '../lib/detection';
import { emitToPlayer } from '../websocket/handler';
import {
  ZONE_BONUSES,
  BUSINESS_BASE_COSTS,
} from '../../../shared/src/types/entities';
import type { LocationZone, BusinessType } from '../../../shared/src/types/entities';
import { rollRandomEvents, getActiveEventModifiers, expireOldEvents } from '../lib/events';
import type { EventModifiers } from '../lib/events';
import { GAME_BALANCE } from '../lib/constants';

// Tick counter for periodic alerts (resets on server restart)
let tickCount = 0;
const REVENUE_ALERT_INTERVAL = 12; // Alert every 12 ticks (1 hour)

// ─── Master Game Tick ─────────────────────────────────────────
// Runs every 5 minutes via BullMQ. Processes all periodic systems
// in a single pass per tick for consistency.

export async function runGameTick(): Promise<void> {
  const tickStart = Date.now();

  try {
    // ── START OF TICK: Roll for random events ──
    await runSafe('RandomEvents', rollRandomEvents);

    // Each sub-system runs in its own transaction for isolation.
    // A failure in one system should not block the others.
    await runSafe('BusinessRevenue', processBusinessRevenue);
    await runSafe('EmployeeMorale', processEmployeeMorale);
    await runSafe('HeatDecay', processHeatDecay);
    await runSafe('MarketPrices', processMarketPrices);
    await runSafe('CrimeOperations', processCrimeOperations);
    await runSafe('Laundering', processLaundering);
    await runSafe('Shipments', processShipments);
    await runSafe('Deliveries', processDeliveries);
    await runSafe('SpyDiscovery', processSpyDiscovery);
    await runSafe('Embezzlement', processEmbezzlement);
    await runSafe('BlockadeCosts', processBlockadeCosts);
    await runSafe('LocationCosts', processLocationCosts);

    // ── Periodic Alerts ──
    await runSafe('RevenueAlerts', processRevenueAlerts);
    await runSafe('HeatWarnings', processHeatWarnings);
    await runSafe('EventAlerts', processEventAlerts);
    tickCount++;

    // ── END OF TICK: Expire old events + check cascades ──
    await runSafe('EventExpiry', processEventExpiry);

    // ── NPC AI Competitors ──
    let npcActions = 0;
    try {
      npcActions = await processNPCTick();
    } catch (err) {
      console.error('[GameTick:NPC] Error:', err);
    }

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
    // Fetch all active businesses with their location zone (if any)
    const businesses = await client.query<{
      id: string; owner_id: string; season_id: string; type: string;
      tier: number; efficiency: string; daily_operating_cost: string;
      total_revenue: string; total_expenses: string;
      zone: string | null; city: string;
    }>(
      `SELECT b.id, b.owner_id, b.season_id, b.type, b.tier,
              b.efficiency, b.daily_operating_cost,
              b.total_revenue, b.total_expenses,
              gl.zone, b.city
         FROM businesses b
         LEFT JOIN locations gl ON gl.player_id = b.owner_id AND gl.city = b.city AND gl.status = 'ACTIVE'
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

      // Count employees for this business
      const empRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM employees WHERE business_id = $1`,
        [biz.id],
      );
      const employeeCount = parseInt(empRes.rows[0].count);

      // Base revenue = tier * 500 * efficiency * (1 + employeeCount * 0.1)
      const efficiency = parseFloat(biz.efficiency) / 100;
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

      // Check for manager efficiency bonus
      const mgrRes = await client.query<{ efficiency_bonus: string }>(
        `SELECT efficiency_bonus FROM manager_assignments
          WHERE business_id = $1 LIMIT 1`,
        [biz.id],
      );
      if (mgrRes.rows.length > 0) {
        revenue *= (1 + parseFloat(mgrRes.rows[0].efficiency_bonus));
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

// ─── 2. Employee Morale & Loyalty Decay ───────────────────────

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
      loyalty: number;
    }>(
      `SELECT e.id, e.business_id, e.name, e.loyalty
         FROM employees e
         JOIN businesses b ON b.id = e.business_id
        WHERE e.loyalty < 20
          AND b.status = 'ACTIVE'`,
    );

    for (const emp of lowLoyalty.rows) {
      if (Math.random() < 0.02) {
        // Employee quits
        const bizRes = await client.query<{ owner_id: string; season_id: string }>(
          `SELECT owner_id, season_id FROM businesses WHERE id = $1`,
          [emp.business_id],
        );
        if (bizRes.rows.length > 0) {
          const { owner_id, season_id } = bizRes.rows[0];

          await client.query(
            `DELETE FROM employees WHERE id = $1`,
            [emp.id],
          );

          await createAlert(client, owner_id, season_id, 'EMPLOYEE_QUIT',
            `${emp.name} quit due to low morale (loyalty: ${emp.loyalty}).`,
            { employee_id: emp.id, business_id: emp.business_id },
          );
          emitToPlayer(owner_id, 'employee_quit', {
            employee_id: emp.id, name: emp.name,
          });
        }
      }
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
      const eventMods = await getActiveEventModifiers(hs.season_id);
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

    for (const res of resources.rows) {
      const currentPrice = parseFloat(res.current_ai_price);
      const baseValue = parseFloat(res.base_value);
      const globalSupply = parseFloat(res.global_supply);

      // 1. Base random fluctuation (-3% to +3%)
      let fluctuation = 1 + (Math.random() * 0.06 - 0.03);

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

      // 5. Event-based supply reduction
      const eventMods = await getActiveEventModifiers(res.season_id);
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
    }>(
      `SELECT co.id, co.player_id, co.season_id, co.op_type, co.risk_level,
              co.dirty_money_yield, co.business_id
         FROM criminal_operations co
        WHERE co.status = 'ACTIVE' AND co.completes_at <= NOW()`,
    );

    for (const op of ops.rows) {
      // Get event modifiers for crime success rate
      let cityName: string | undefined;
      if (op.business_id) {
        const bizCityRes = await client.query<{ city: string }>(
          `SELECT city FROM businesses WHERE id = $1`,
          [op.business_id],
        );
        cityName = bizCityRes.rows[0]?.city;
      }
      const eventMods = await getActiveEventModifiers(op.season_id, cityName);

      // Success chance inversely proportional to risk (risk 1-10 maps to 90%-10%)
      let successChance = Math.max(0.1, 1 - op.risk_level * 0.09);
      // Apply event modifier to crime success rate
      successChance = Math.max(0.05, Math.min(0.95, successChance + eventMods.crime_success_rate_modifier));

      const roll = Math.random();

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
    }>(
      `SELECT s.id, s.player_id, s.items_json, s.loss_rate, s.route_id, p.season_id
         FROM shipments s
         JOIN players p ON p.id = s.player_id
        WHERE s.status = 'IN_TRANSIT' AND s.arrives_at <= NOW()`,
    );

    for (const ship of arrivals.rows) {
      const items = ship.items_json as Record<string, number>;
      const delivered: Record<string, number> = {};
      const lost: Record<string, number> = {};

      // Get event modifiers for logistics cost
      const routeRes = await client.query<{ destination_city: string; origin_city: string }>(
        `SELECT destination_city, origin_city FROM transport_routes WHERE id = $1`,
        [ship.route_id],
      );
      const destCity = routeRes.rows[0]?.destination_city ?? 'Unknown';
      const eventMods = await getActiveEventModifiers(ship.season_id, destCity);

      // Roll loss for each item type (event supply reduction increases loss)
      for (const [itemName, quantity] of Object.entries(items)) {
        const lossRoll = Math.random();
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

      // Get season_id for alerts
      const playerRes = await client.query<{ season_id: string }>(
        `SELECT season_id FROM players WHERE id = $1`,
        [ship.player_id],
      );
      const seasonId = playerRes.rows[0]?.season_id ?? '';

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
      const roll = Math.random();

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
      const roll = Math.random();
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
      const stealPercent = 0.05 + Math.random() * 0.10;
      const stolenAmount = lastRevenue * stealPercent;

      // Deduct from player
      await client.query(
        `UPDATE players SET cash = GREATEST(cash - $1, 0) WHERE id = $2`,
        [stolenAmount, mgr.player_id],
      );

      // Detection chance (50%)
      const detected = Math.random() < 0.5;

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

      console.log(`[GameTick:EventExpiry] Event "${evt.title}" (${evt.id}) resolved.`);
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

// ─── Revenue Report Alerts (every 12 ticks = ~1 hour) ─────────

async function processRevenueAlerts(): Promise<void> {
  if (tickCount % REVENUE_ALERT_INTERVAL !== 0) return;

  await withTransaction(async (client) => {
    const players = await client.query<{
      owner_id: string; season_id: string;
      total_rev: string; total_exp: string; biz_count: string;
    }>(
      `SELECT b.owner_id, p.season_id,
              COALESCE(SUM(b.tier * 500 * (b.efficiency / 100.0)
                * (1 + (SELECT COUNT(*) FROM employees e WHERE e.business_id = b.id) * 0.1)
                / 288 * $1), 0) AS total_rev,
              COALESCE(SUM(b.daily_operating_cost / 288 * $1), 0) AS total_exp,
              COUNT(*)::int AS biz_count
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
      await createAlert(client, row.owner_id, row.season_id, 'REVENUE_REPORT',
        `Hourly report: ${row.biz_count} businesses earned $${rev.toFixed(0)} revenue, $${exp.toFixed(0)} expenses (${sign}$${net.toFixed(0)} net).`,
        { revenue: rev, expenses: exp, net, businesses: Number(row.biz_count) },
      );
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
