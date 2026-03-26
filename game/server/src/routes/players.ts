import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { query } from '../db/client';
import { getCurrentSeason } from '../lib/season';
import { getPlayerAlerts, getUnreadAlertCount, markAlertRead, markAllAlertsRead } from '../lib/alerts';
import {
  BUSINESS_STARTUP_COSTS, BUSINESS_DAILY_COSTS, UPGRADE_COSTS,
  PRODUCTION_RECIPES, MAX_EMPLOYEES_PER_TIER, calculateHireCost,
} from '../lib/constants';
import type { BusinessType } from '../../../shared/src/types/entities';

export async function playerRoutes(app: FastifyInstance): Promise<void> {
  // GET /players/me
  app.get('/me', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT id, username, email, created_at, last_active, season_id, cash,
              net_worth, business_slots, reputation_score, alignment,
              meta_points, season_history, cosmetics, veteran_bonus_cash
         FROM players WHERE id = $1`,
      [request.player.id],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Player not found' });
    return reply.send({ data: res.rows[0] });
  });

  // GET /players/dashboard
  app.get('/dashboard', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const seasonId = request.player.season_id;

    const [playerRes, season, activeOps, activeLaundering, heatRes, dirtyRes] = await Promise.all([
      query(
        `SELECT id, username, email, cash, net_worth, business_slots, reputation_score,
                alignment, season_id, meta_points, cosmetics, veteran_bonus_cash,
                created_at, last_active, season_history
           FROM players WHERE id = $1`,
        [playerId],
      ),
      getCurrentSeason(),
      query(
        `SELECT * FROM criminal_operations WHERE player_id = $1 AND status = 'ACTIVE'`,
        [playerId],
      ),
      query(
        `SELECT * FROM laundering_processes WHERE player_id = $1 AND status = 'IN_PROGRESS'`,
        [playerId],
      ),
      query(
        `SELECT * FROM heat_scores WHERE player_id = $1 AND season_id = $2`,
        [playerId, seasonId],
      ),
      query(
        `SELECT * FROM dirty_money_balances WHERE player_id = $1 AND season_id = $2`,
        [playerId, seasonId],
      ),
    ]);

    if (playerRes.rows.length === 0) return reply.status(404).send({ error: 'Not found' });

    const [rankRes, competitionRes, totalPlayersRes] = await Promise.all([
      query<{ rank: string }>(
        `SELECT COUNT(*) + 1 AS rank FROM players
          WHERE season_id = $1 AND net_worth > $2`,
        [seasonId, playerRes.rows[0].net_worth],
      ),
      // Get the player just above us for competitive context
      query<{ username: string; net_worth: string }>(
        `SELECT username, net_worth::text FROM players
          WHERE season_id = $1 AND net_worth > $2
          ORDER BY net_worth ASC LIMIT 1`,
        [seasonId, playerRes.rows[0].net_worth],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM players WHERE season_id = $1`,
        [seasonId],
      ),
    ]);

    const alerts = await getPlayerAlerts(playerId, 10);

    // Get total salary costs
    const salaryRes = await query<{ total_salary: string }>(
      `SELECT COALESCE(SUM(e.salary), 0)::text AS total_salary
         FROM employees e
         JOIN businesses b ON b.id = e.business_id
        WHERE b.owner_id = $1 AND b.status != 'BANKRUPT'`,
      [playerId],
    );
    const totalDailySalary = parseFloat(salaryRes.rows[0]?.total_salary ?? '0');

    // Detailed business data with per-tick economics
    const bizDetailRes = await query<{
      id: string; name: string; type: string; tier: number; city: string;
      efficiency: string; daily_operating_cost: string; inventory: Record<string, number>;
      employee_count: string; total_revenue: string; total_expenses: string;
      auto_sell: boolean;
    }>(
      `SELECT b.id, b.name, b.type::text, b.tier, b.city,
              b.efficiency, b.daily_operating_cost, b.inventory,
              COALESCE(ec.cnt, 0)::text AS employee_count,
              b.total_revenue::text, b.total_expenses::text,
              b.auto_sell
         FROM businesses b
         LEFT JOIN (SELECT business_id, COUNT(*) AS cnt FROM employees GROUP BY business_id) ec ON ec.business_id = b.id
        WHERE b.owner_id = $1 AND b.status != 'BANKRUPT'
        ORDER BY b.established_at ASC`,
      [playerId],
    );

    // Fetch market prices for inventory valuation
    const priceRes = await query<{ name: string; current_ai_price: string }>(
      `SELECT name, current_ai_price::text FROM resources WHERE season_id = $1`,
      [seasonId],
    );
    const marketPrices: Record<string, number> = {};
    for (const r of priceRes.rows) {
      marketPrices[r.name] = parseFloat(r.current_ai_price);
    }

    const BASE_REVENUE = 1400;
    let totalDailyRev = 0;
    let totalDailyCost = 0;
    let totalEmployees = 0;
    let totalInventoryValue = 0;
    const byType: Record<string, number> = {};
    const businessDetails = bizDetailRes.rows.map((b) => {
      const eff = parseFloat(b.efficiency);
      const empCount = parseInt(b.employee_count);
      const dailyRev = b.tier * BASE_REVENUE * eff * (1 + empCount * 0.1);
      const dailyCost = parseFloat(b.daily_operating_cost);
      const dailyNet = dailyRev - dailyCost;
      totalDailyRev += dailyRev;
      totalDailyCost += dailyCost;
      totalEmployees += empCount;
      byType[b.type] = (byType[b.type] || 0) + 1;

      const inv = b.inventory as Record<string, number>;
      const invItems = Object.entries(inv).filter(([, v]) => v > 0);
      const totalInventory = invItems.reduce((a, [, v]) => a + v, 0);

      // Calculate inventory value at market prices (85% for quick-sell rate)
      const invValue = invItems.reduce((sum, [name, qty]) => {
        const price = marketPrices[name] ?? 0;
        return sum + price * qty * 0.85;
      }, 0);
      totalInventoryValue += invValue;

      return {
        id: b.id, name: b.name, type: b.type, tier: b.tier, city: b.city,
        efficiency: parseFloat((eff * 100).toFixed(1)),
        employees: empCount,
        daily_revenue: parseFloat(dailyRev.toFixed(2)),
        daily_cost: parseFloat(dailyCost.toFixed(2)),
        daily_net: parseFloat(dailyNet.toFixed(2)),
        profitable: dailyNet > 0,
        inventory_count: totalInventory,
        inventory_items: invItems.length > 0 ? Object.fromEntries(invItems) : {},
        inventory_value: parseFloat(invValue.toFixed(2)),
        auto_sell: b.auto_sell,
        lifetime_revenue: parseFloat(b.total_revenue),
        lifetime_expenses: parseFloat(b.total_expenses),
      };
    });

    const avgEff = bizDetailRes.rows.length > 0
      ? bizDetailRes.rows.reduce((a, b) => a + parseFloat(b.efficiency), 0) / bizDetailRes.rows.length
      : 0;

    // Cash trend: compare current cash to 1-hour-ago estimate from ledger
    const ledgerRes = await query<{ recent_net: string }>(
      `SELECT COALESCE(SUM(bl.revenue - bl.expenses), 0)::text AS recent_net
         FROM business_ledger bl
         JOIN businesses b ON b.id = bl.business_id
        WHERE b.owner_id = $1 AND bl.day = CURRENT_DATE`,
      [playerId],
    );
    const todayNet = parseFloat(ledgerRes.rows[0]?.recent_net ?? '0');

    // Upgrade info for cheapest next upgrade
    const upgradeTargets = bizDetailRes.rows
      .filter((b) => b.tier < 4)
      .map((b) => {
        const upgradeCosts: Record<string, Record<number, number>> = {
          RETAIL: { 2: 8000, 3: 20000, 4: 60000 },
          FACTORY: { 2: 30000, 3: 80000, 4: 200000 },
          MINE: { 2: 22000, 3: 60000, 4: 150000 },
          FARM: { 2: 12000, 3: 30000, 4: 80000 },
          LOGISTICS: { 2: 18000, 3: 50000, 4: 120000 },
          SECURITY_FIRM: { 2: 15000, 3: 40000, 4: 100000 },
          FRONT_COMPANY: { 2: 25000, 3: 70000, 4: 175000 },
        };
        const cost = upgradeCosts[b.type]?.[b.tier + 1] ?? 0;
        return { business_id: b.id, business_name: b.name, current_tier: b.tier, next_tier: b.tier + 1, cost };
      })
      .sort((a, b) => a.cost - b.cost);

    // ── Next Best Action recommendations ──
    const cash = parseFloat(playerRes.rows[0].cash);
    const actions: Array<{ priority: number; action: string; detail: string; category: string }> = [];

    if (bizDetailRes.rows.length === 0) {
      // No businesses — guide them to create one
      const cheapest = Object.entries(BUSINESS_STARTUP_COSTS)
        .filter(([t]) => t !== 'FRONT_COMPANY' && t !== 'LOGISTICS' && t !== 'SECURITY_FIRM')
        .sort((a, b) => a[1] - b[1]);
      const canAfford = cheapest.filter(([, c]) => cash >= c);
      if (canAfford.length > 0) {
        const [bestType, bestCost] = canAfford[0];
        actions.push({
          priority: 1,
          action: `Create your first business`,
          detail: `Start a ${bestType} in any city for $${bestCost.toLocaleString()}. This will begin generating revenue immediately.`,
          category: 'getting_started',
        });
      } else {
        actions.push({
          priority: 1,
          action: `Save up for your first business`,
          detail: `You need $${cheapest[0][1].toLocaleString()} for a ${cheapest[0][0]}. Current cash: $${cash.toLocaleString()}.`,
          category: 'getting_started',
        });
      }
    } else {
      // Has businesses — check for improvements
      const bizWithNoWorkers = businessDetails.filter(b => b.employees === 0);
      const bizWithWorkers = businessDetails.filter(b => b.employees > 0);

      if (bizWithNoWorkers.length > 0) {
        const biz = bizWithNoWorkers[0];
        const hireCost = calculateHireCost(bizDetailRes.rows.length, totalEmployees);
        actions.push({
          priority: 1,
          action: `Hire workers for ${biz.name}`,
          detail: `${biz.name} has no employees and can't produce goods. Hiring cost: $${hireCost.toLocaleString()}/worker.`,
          category: 'growth',
        });
      }

      // Check inventory that could be sold
      const bizWithInventory = businessDetails.filter(b => b.inventory_count > 0);
      if (bizWithInventory.length > 0) {
        const totalInv = bizWithInventory.reduce((sum, b) => sum + b.inventory_count, 0);
        const totalValue = bizWithInventory.reduce((sum, b) => sum + (b.inventory_value ?? 0), 0);
        actions.push({
          priority: 2,
          action: `Sell inventory (worth $${totalValue.toFixed(0)})`,
          detail: `${totalInv} items across ${bizWithInventory.length} business(es). Use Quick Sell for instant cash at 85% market rate.`,
          category: 'revenue',
        });
      }

      // Suggest enabling auto-sell for businesses that produce goods but don't have it enabled
      const bizCanAutoSell = businessDetails.filter(b =>
        b.production && b.production.status === 'producing' && !b.auto_sell
      );
      if (bizCanAutoSell.length > 0) {
        actions.push({
          priority: 3,
          action: `Enable auto-sell for ${bizCanAutoSell[0].name}`,
          detail: `Automatically sell produced goods each tick for passive income. No manual selling needed.`,
          category: 'optimization',
        });
      }

      // Check affordable upgrades
      if (upgradeTargets.length > 0 && cash >= upgradeTargets[0].cost) {
        const up = upgradeTargets[0];
        actions.push({
          priority: 3,
          action: `Upgrade ${up.business_name} to Tier ${up.next_tier}`,
          detail: `Cost: $${up.cost.toLocaleString()}. Higher tiers increase revenue and employee capacity.`,
          category: 'growth',
        });
      }

      // Check if can afford new business — with smart type recommendation
      const bizCount = bizDetailRes.rows.length;
      const slots = playerRes.rows[0].business_slots;
      if (bizCount < slots) {
        const existingTypes = new Set(businessDetails.map(b => b.type));
        const affordableTypes = Object.entries(BUSINESS_STARTUP_COSTS)
          .filter(([, c]) => cash >= c)
          .sort((a, b) => a[1] - b[1]);

        if (affordableTypes.length > 0 && bizWithNoWorkers.length === 0) {
          // Smart recommendation based on existing businesses
          let recommended = affordableTypes[0][0];
          let reason = 'cheapest option';

          if (existingTypes.has('MINE') && !existingTypes.has('FACTORY') && cash >= (BUSINESS_STARTUP_COSTS.FACTORY ?? 120000)) {
            recommended = 'FACTORY';
            reason = 'processes your Mine\'s raw materials into valuable goods';
          } else if (!existingTypes.has('FARM') && cash >= (BUSINESS_STARTUP_COSTS.FARM ?? 25000)) {
            recommended = 'FARM';
            reason = 'produces resources with no input costs';
          } else if (!existingTypes.has('MINE') && cash >= (BUSINESS_STARTUP_COSTS.MINE ?? 50000)) {
            recommended = 'MINE';
            reason = 'extracts raw materials for production';
          } else if (!existingTypes.has('RETAIL') && cash >= (BUSINESS_STARTUP_COSTS.RETAIL ?? 15000)) {
            recommended = 'RETAIL';
            reason = 'lowest startup cost, steady revenue';
          }

          const cost = BUSINESS_STARTUP_COSTS[recommended] ?? 0;
          actions.push({
            priority: 4,
            action: `Expand: open a ${recommended.replace(/_/g, ' ')}`,
            detail: `${bizCount}/${slots} slots used. ${recommended} ($${cost.toLocaleString()}) — ${reason}.`,
            category: 'expansion',
          });
        }
      }

      // Check employee capacity
      for (const b of businessDetails) {
        const maxEmp = MAX_EMPLOYEES_PER_TIER[b.tier] ?? 10;
        const rawBiz = bizDetailRes.rows.find(r => r.id === b.id);
        if (rawBiz && b.employees < maxEmp && b.employees > 0 && b.employees < 3) {
          const hireCost = calculateHireCost(bizDetailRes.rows.length, totalEmployees);
          if (cash >= hireCost) {
            actions.push({
              priority: 3,
              action: `Hire more workers for ${b.name}`,
              detail: `${b.employees}/${maxEmp} slots filled. Each worker boosts production by +10%. Cost: $${hireCost.toLocaleString()}.`,
              category: 'optimization',
            });
            break; // Only suggest for one business
          }
        }
      }

      // Unprofitable business warning
      const unprofitable = businessDetails.filter(b => !b.profitable && b.employees > 0);
      if (unprofitable.length > 0) {
        actions.push({
          priority: 2,
          action: `Fix unprofitable business: ${unprofitable[0].name}`,
          detail: `Losing $${Math.abs(unprofitable[0].daily_net).toFixed(0)}/day. Hire more workers or upgrade to increase revenue.`,
          category: 'warning',
        });
      }
    }

    // Sort by priority
    actions.sort((a, b) => a.priority - b.priority);

    // ── Performance rating per business (1-5 stars) ──
    function calcRating(b: typeof businessDetails[0]): number {
      let score = 0;
      // Profitability (0-2 points)
      if (b.daily_net > 0) score += 1;
      if (b.daily_net > 500) score += 1;
      // Employee utilization (0-1 point)
      const maxEmp = MAX_EMPLOYEES_PER_TIER[bizDetailRes.rows.find(r => r.id === b.id)?.tier ?? 1] ?? 10;
      if (b.employees >= maxEmp * 0.5) score += 1;
      // Efficiency (0-1 point)
      if (b.efficiency >= 70) score += 1;
      // Auto-sell enabled (0-1 point for optimization)
      if (b.auto_sell) score += 1;
      return Math.min(5, Math.max(1, score));
    }

    // ── Production info per business ──
    const businessDetailsWithProduction = businessDetails.map(b => {
      const recipe = PRODUCTION_RECIPES[b.type as BusinessType]?.[b.tier];
      let production = null;
      if (recipe && recipe.outputs.length > 0 && recipe.outputs[0].quantity > 0) {
        const workerCount = b.employees;
        production = {
          produces: recipe.outputs.map(o => ({
            resource: o.resource_name,
            per_tick: workerCount > 0
              ? parseFloat((o.quantity * workerCount * (b.efficiency / 100)).toFixed(1))
              : 0,
          })),
          requires: recipe.inputs.map(i => ({
            resource: i.resource_name,
            per_tick: workerCount > 0
              ? parseFloat((i.quantity * workerCount).toFixed(1))
              : 0,
          })),
          status: workerCount === 0 ? 'idle_no_workers' : 'producing',
        };
      }
      return { ...b, production, rating: calcRating(b) };
    });

    return reply.send({
      data: {
        player: playerRes.rows[0],
        season,
        rank: Number(rankRes.rows[0]?.rank ?? 1),
        total_players: Number(totalPlayersRes.rows[0]?.count ?? 1),
        next_rank: competitionRes.rows.length > 0 ? {
          username: competitionRes.rows[0].username,
          net_worth: parseFloat(competitionRes.rows[0].net_worth),
          gap: parseFloat(competitionRes.rows[0].net_worth) - parseFloat(playerRes.rows[0].net_worth),
        } : null,
        alerts,
        next_actions: actions.slice(0, 3),
        income: {
          daily_revenue: parseFloat(totalDailyRev.toFixed(2)),
          daily_expenses: parseFloat(totalDailyCost.toFixed(2)),
          daily_salaries: parseFloat(totalDailySalary.toFixed(2)),
          daily_total_costs: parseFloat((totalDailyCost + totalDailySalary).toFixed(2)),
          daily_net: parseFloat((totalDailyRev - totalDailyCost - totalDailySalary).toFixed(2)),
          per_tick_net: parseFloat(((totalDailyRev - totalDailyCost - totalDailySalary) / 288).toFixed(2)),
          today_net: parseFloat(todayNet.toFixed(2)),
          cash_trend: (totalDailyRev - totalDailyCost - totalDailySalary) > 0 ? 'growing' : (totalDailyRev - totalDailyCost - totalDailySalary) < -10 ? 'declining' : 'stable',
          inventory_value: parseFloat(totalInventoryValue.toFixed(2)),
        },
        businesses: {
          total: bizDetailRes.rows.length,
          total_employees: totalEmployees,
          avg_efficiency: parseFloat((avgEff * 100).toFixed(1)),
          list: businessDetailsWithProduction,
        },
        progression: {
          next_upgrade: upgradeTargets[0] || null,
          can_afford_upgrade: upgradeTargets.length > 0 && cash >= upgradeTargets[0].cost,
          upgrade_options: upgradeTargets.slice(0, 3),
        },
        // Supply chain analysis
        supply_chains: (() => {
          const chains: Array<{ from: string; to: string; resource: string; from_type: string; to_type: string; status: string }> = [];
          const bizByType: Record<string, typeof businessDetails[0][]> = {};
          for (const b of businessDetails) {
            if (!bizByType[b.type]) bizByType[b.type] = [];
            bizByType[b.type].push(b);
          }

          // Mine → Factory chain
          if (bizByType['MINE'] && bizByType['FACTORY']) {
            for (const mine of bizByType['MINE']) {
              for (const factory of bizByType['FACTORY']) {
                chains.push({
                  from: mine.name, to: factory.name,
                  resource: 'Coal + Metals',
                  from_type: 'MINE', to_type: 'FACTORY',
                  status: mine.employees > 0 && factory.employees > 0 ? 'active' : 'idle',
                });
              }
            }
          }

          // Farm → Factory chain (potential)
          if (bizByType['FARM'] && bizByType['FACTORY']) {
            for (const farm of bizByType['FARM']) {
              chains.push({
                from: farm.name, to: bizByType['FACTORY'][0].name,
                resource: 'Wheat (raw materials)',
                from_type: 'FARM', to_type: 'FACTORY',
                status: 'potential',
              });
            }
          }

          // Suggest chains the player could build
          const suggestions: string[] = [];
          if (bizByType['MINE'] && !bizByType['FACTORY']) {
            suggestions.push('Open a FACTORY to process your Mine\'s Coal and Metals into Steel (higher value)');
          }
          if (bizByType['FACTORY'] && !bizByType['MINE']) {
            suggestions.push('Open a MINE to supply your Factory with raw materials');
          }
          if (!bizByType['MINE'] && !bizByType['FACTORY'] && bizDetailRes.rows.length > 0) {
            suggestions.push('Build a Mine + Factory combo for a profitable production chain');
          }

          return { active: chains, suggestions };
        })(),
        empire_summary: {
          total_lifetime_revenue: parseFloat(businessDetails.reduce((s, b) => s + b.lifetime_revenue, 0).toFixed(2)),
          total_lifetime_expenses: parseFloat(businessDetails.reduce((s, b) => s + b.lifetime_expenses, 0).toFixed(2)),
          total_lifetime_profit: parseFloat(businessDetails.reduce((s, b) => s + (b.lifetime_revenue - b.lifetime_expenses), 0).toFixed(2)),
          total_businesses: bizDetailRes.rows.length,
          total_employees: totalEmployees,
          highest_tier: bizDetailRes.rows.length > 0 ? Math.max(...bizDetailRes.rows.map(b => b.tier)) : 0,
          total_inventory_value: parseFloat(totalInventoryValue.toFixed(2)),
        },
        crime: {
          heat: heatRes.rows[0] ?? null,
          dirty_money: dirtyRes.rows[0] ?? null,
          active_ops: activeOps.rows.length,
          active_laundering: activeLaundering.rows.length,
        },
      },
    });
  });

  // GET /players/activity — recent cash changes with reasons
  app.get('/activity', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { limit: limitStr = '20' } = request.query as { limit?: string };
    const limit = Math.min(parseInt(limitStr, 10) || 20, 50);

    // Combine multiple sources of cash activity into a unified timeline
    const [revenueRes, alertsRes, bizCreatedRes] = await Promise.all([
      // Business ledger entries (daily revenue/expense summaries)
      query<{
        business_name: string; day: string; revenue: string; expenses: string;
      }>(
        `SELECT b.name AS business_name, bl.day::text, bl.revenue::text, bl.expenses::text
           FROM business_ledger bl
           JOIN businesses b ON b.id = bl.business_id
          WHERE b.owner_id = $1
          ORDER BY bl.day DESC
          LIMIT $2`,
        [playerId, limit],
      ),
      // Recent alerts that represent cash changes
      query<{
        type: string; message: string; data: Record<string, unknown>; created_at: string;
      }>(
        `SELECT type, message, data, created_at::text
           FROM alerts
          WHERE player_id = $1
            AND type IN ('REVENUE_REPORT', 'CRIME_COMPLETED', 'CRIME_BUSTED',
                         'LAUNDERING_COMPLETE', 'LAUNDERING_SEIZED', 'SHIPMENT_ARRIVED',
                         'CONTRACT_SETTLED', 'CONTRACT_BREACHED')
          ORDER BY created_at DESC
          LIMIT $2`,
        [playerId, limit],
      ),
      // Recent businesses created
      query<{ name: string; type: string; established_at: string }>(
        `SELECT name, type::text, established_at::text
           FROM businesses
          WHERE owner_id = $1
          ORDER BY established_at DESC
          LIMIT 5`,
        [playerId],
      ),
    ]);

    const activity: Array<{
      type: string; description: string; amount?: number; timestamp: string;
    }> = [];

    for (const r of revenueRes.rows) {
      const rev = parseFloat(r.revenue);
      const exp = parseFloat(r.expenses);
      if (rev > 0 || exp > 0) {
        activity.push({
          type: 'revenue',
          description: `${r.business_name}: +$${rev.toFixed(0)} revenue, -$${exp.toFixed(0)} costs`,
          amount: rev - exp,
          timestamp: r.day,
        });
      }
    }

    for (const a of alertsRes.rows) {
      activity.push({
        type: a.type.toLowerCase(),
        description: a.message,
        amount: typeof a.data?.net === 'number' ? a.data.net as number
          : typeof a.data?.amount === 'number' ? a.data.amount as number
          : undefined,
        timestamp: a.created_at,
      });
    }

    for (const b of bizCreatedRes.rows) {
      const cost = BUSINESS_STARTUP_COSTS[b.type] ?? 0;
      activity.push({
        type: 'business_created',
        description: `Created ${b.name} (${b.type}) for $${cost.toLocaleString()}`,
        amount: -cost,
        timestamp: b.established_at,
      });
    }

    // Sort by timestamp descending
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return reply.send({ data: { activity: activity.slice(0, limit) } });
  });

  // GET /players/daily-goals — generate daily challenges based on player state
  app.get('/daily-goals', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;

    // Use the date as a seed for consistent goals per day per player
    const today = new Date().toISOString().split('T')[0];
    const seed = today + playerId;
    const hash = seed.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);

    // Get player state to scale goals appropriately
    const playerRes = await query<{ cash: string; net_worth: string }>(
      `SELECT cash::text, net_worth::text FROM players WHERE id = $1`, [playerId],
    );
    const bizRes = await query<{ count: string; total_rev: string }>(
      `SELECT COUNT(*)::text as count, COALESCE(SUM(total_revenue), 0)::text as total_rev
         FROM businesses WHERE owner_id = $1 AND status != 'BANKRUPT'`, [playerId],
    );
    const empRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM employees e
         JOIN businesses b ON b.id = e.business_id WHERE b.owner_id = $1`, [playerId],
    );

    const cash = parseFloat(playerRes.rows[0]?.cash ?? '0');
    const bizCount = parseInt(bizRes.rows[0]?.count ?? '0');
    const empCount = parseInt(empRes.rows[0]?.count ?? '0');

    // Define goal templates scaled by player progression
    const goalPool = [
      { id: 'earn_revenue', title: 'Earn Revenue', target: Math.max(500, Math.round(cash * 0.05)), unit: 'cash', reward: Math.round(cash * 0.02), desc: 'Earn from business revenue' },
      { id: 'produce_items', title: 'Produce Goods', target: Math.max(10, bizCount * 20), unit: 'items', reward: Math.round(200 + bizCount * 100), desc: 'Produce items across your businesses' },
      { id: 'sell_items', title: 'Sell Inventory', target: Math.max(5, bizCount * 10), unit: 'items', reward: Math.round(150 + bizCount * 75), desc: 'Sell goods on the market' },
      { id: 'hire_worker', title: 'Hire Workers', target: Math.max(1, Math.min(3, 5 - empCount)), unit: 'workers', reward: 500, desc: 'Hire new workers' },
      { id: 'upgrade_biz', title: 'Upgrade a Business', target: 1, unit: 'upgrades', reward: Math.round(1000 + bizCount * 500), desc: 'Upgrade any business to the next tier' },
      { id: 'reach_cash', title: 'Reach Cash Target', target: Math.round(cash * 1.1), unit: 'cash', reward: Math.round(cash * 0.03), desc: 'Grow your cash reserves' },
    ];

    // Select 3 goals using the hash as a seed
    const selected = [];
    const pool = [...goalPool];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.abs((hash + i * 7919) % pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }

    return reply.send({
      data: {
        date: today,
        goals: selected.map(g => ({
          ...g,
          reward_text: `+$${g.reward.toLocaleString()}`,
        })),
      },
    });
  });

  // GET /players/leaderboard
  app.get('/leaderboard', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', per_page = '100' } = request.query as { page?: string; per_page?: string };
    const limit = Math.min(parseInt(per_page, 10) || 100, 100);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

    const season = await getCurrentSeason();
    if (!season) return reply.send({ data: { items: [], total: 0, page: 1, per_page: limit } });

    const [res, countRes] = await Promise.all([
      query(
        `SELECT p.id, p.username, p.net_worth, p.alignment,
                (SELECT COUNT(*)::int FROM businesses b
                   WHERE b.owner_id = p.id AND b.status != 'BANKRUPT') AS business_count
           FROM players p
          WHERE p.season_id = $1
          ORDER BY p.net_worth DESC
          LIMIT $2 OFFSET $3`,
        [season.id, limit, offset],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM players WHERE season_id = $1`,
        [season.id],
      ),
    ]);

    const entries = res.rows.map((row, idx) => ({
      rank: offset + idx + 1,
      player_id: row.id,
      username: row.username,
      net_worth: Number(row.net_worth),
      alignment: row.alignment,
      business_count: Number(row.business_count),
    }));

    return reply.send({
      data: {
        items: entries,
        total: Number(countRes.rows[0]?.count ?? 0),
        page: parseInt(page, 10) || 1,
        per_page: limit,
      },
    });
  });

  // GET /players/:id/profile
  app.get('/:id/profile', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const res = await query(
      `SELECT id, username, net_worth, alignment, reputation_score, meta_points,
              season_history, cosmetics
         FROM players WHERE id = $1`,
      [id],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Player not found' });
    return reply.send({ data: res.rows[0] });
  });

  // ─── Notification Endpoints ──────────────────────────────────

  // GET /players/notifications — last 50 alerts, unread first
  app.get('/notifications', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const alerts = await getPlayerAlerts(playerId, 50);
    const unreadCount = await getUnreadAlertCount(playerId);
    return reply.send({ data: { alerts, unread_count: unreadCount } });
  });

  // POST /players/notifications/:id/read — mark single notification as read
  app.post('/notifications/:id/read', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const success = await markAlertRead(id, request.player.id);
    if (!success) return reply.status(404).send({ error: 'Notification not found' });
    return reply.send({ data: { success: true } });
  });

  // POST /players/notifications/read-all — mark all as read
  app.post('/notifications/read-all', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const count = await markAllAlertsRead(playerId);
    return reply.send({ data: { marked_read: count } });
  });
}
