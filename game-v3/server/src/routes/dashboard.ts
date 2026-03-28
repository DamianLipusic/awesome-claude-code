import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import {
  BUSINESS_TYPES,
  ITEMS,
  type BusinessType,
  storageCap,
  maxEmployees,
  calcProduction,
  calculateLevel,
} from '../config/game.config.js';

async function getActiveEvents() {
  const res = await query(
    `SELECT type, title, description, icon, ends_at FROM game_events
     WHERE active = TRUE AND ends_at > NOW() ORDER BY started_at DESC`,
  );
  return res.rows;
}

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const playerId = req.player.id;

    const [playerRes, businessesRes, activityRes, earningsRes, dailyCostsRes] = await Promise.all([
      // Player info with net worth
      query<{
        cash: string; bank_balance: string; dirty_money: string;
        heat_police: number; heat_rival: number;
        rep_street: number; rep_business: number; rep_underworld: number;
        xp: number; level: number;
        unlock_phase: number; net_worth: string;
      }>(
        `SELECT p.cash, p.bank_balance, p.dirty_money, p.heat_police, p.heat_rival,
                p.rep_street, p.rep_business, p.rep_underworld,
                p.xp, p.level, p.unlock_phase,
          (p.cash + p.bank_balance +
            COALESCE((SELECT SUM(inv.amount * i.base_price)
              FROM inventory inv JOIN businesses b ON b.id = inv.business_id
              JOIN items i ON i.id = inv.item_id
              WHERE b.owner_id = p.id AND b.status != 'shutdown'), 0) +
            COALESCE((SELECT SUM(
              CASE b.type WHEN 'MINE' THEN 12000 WHEN 'FACTORY' THEN 15000 WHEN 'SHOP' THEN 8000 ELSE 10000 END * b.tier
            ) FROM businesses b WHERE b.owner_id = p.id AND b.status != 'shutdown'), 0)
          )::numeric(18,2) AS net_worth
         FROM players p WHERE p.id = $1`,
        [playerId],
      ),

      // Businesses with full stats including location costs and recipe info
      query(
        `SELECT b.id, b.name, b.type, b.tier, b.status, b.efficiency,
                b.recipe_id, b.location_id,
                l.name AS location_name, l.daily_cost AS location_daily_cost, l.traffic AS location_traffic,
                r.base_rate, r.output_item_id,
                i.key AS output_item_key, i.name AS output_item_name, i.base_price AS output_base_price,
                (SELECT COUNT(*) FROM employees e WHERE e.business_id = b.id AND e.status IN ('active','training'))::int AS employee_count,
                (SELECT COALESCE(SUM(e.salary), 0) FROM employees e WHERE e.business_id = b.id AND e.status IN ('active','training'))::numeric AS salary_total,
                (SELECT COALESCE(SUM(inv.amount), 0) FROM inventory inv WHERE inv.business_id = b.id)::numeric AS total_inventory,
                (SELECT COALESCE(AVG(e.efficiency), 0) FROM employees e WHERE e.business_id = b.id AND e.status = 'active')::numeric AS avg_efficiency,
                (SELECT COALESCE(AVG(e.stress), 0) FROM employees e WHERE e.business_id = b.id AND e.status = 'active')::numeric AS avg_stress
         FROM businesses b
         LEFT JOIN locations l ON l.id = b.location_id
         LEFT JOIN recipes r ON r.id = b.recipe_id
         LEFT JOIN items i ON i.id = r.output_item_id
         WHERE b.owner_id = $1 AND b.status != 'shutdown'
         ORDER BY b.created_at`,
        [playerId],
      ),

      // Last 15 activity entries
      query(
        `SELECT type, message, amount, created_at AS time
         FROM activity_log WHERE player_id = $1
         ORDER BY created_at DESC LIMIT 15`,
        [playerId],
      ),

      // Earnings: last 1 hour
      query<{ income: string; expenses: string }>(
        `SELECT
           COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::numeric AS income,
           COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::numeric AS expenses
         FROM activity_log
         WHERE player_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [playerId],
      ),

      // Total daily costs estimate
      query<{ total_location_costs: string; total_salary_costs: string }>(
        `SELECT
           COALESCE(SUM(l.daily_cost), 0)::numeric AS total_location_costs,
           COALESCE((SELECT SUM(e.salary) FROM employees e
             JOIN businesses b2 ON b2.id = e.business_id
             WHERE b2.owner_id = $1 AND b2.status != 'shutdown'
             AND e.status IN ('active','training')), 0)::numeric AS total_salary_costs
         FROM businesses b
         JOIN locations l ON l.id = b.location_id
         WHERE b.owner_id = $1 AND b.status != 'shutdown'`,
        [playerId],
      ),
    ]);

    if (!playerRes.rows.length) {
      return reply.status(404).send({ error: 'Player not found' });
    }

    const player = playerRes.rows[0];
    const xpInfo = calculateLevel(player.xp);
    const income = Number(earningsRes.rows[0]?.income ?? 0);
    const expenses = Number(earningsRes.rows[0]?.expenses ?? 0);
    const locationCosts = Number(dailyCostsRes.rows[0]?.total_location_costs ?? 0);
    const salaryCosts = Number(dailyCostsRes.rows[0]?.total_salary_costs ?? 0);

    // Build business summaries with profit estimates
    const businesses = businessesRes.rows.map((b: Record<string, unknown>) => {
      const tier = Number(b.tier);
      const baseRate = b.base_rate ? Number(b.base_rate) : 0;
      const avgEff = Number(b.avg_efficiency);
      const avgStr = Number(b.avg_stress);
      const empCount = Number(b.employee_count);
      const productionPerTick = empCount > 0
        ? calcProduction(baseRate, avgEff, Number(b.efficiency), avgStr)
        : 0;
      const bizType = b.type as BusinessType;
      const emoji = BUSINESS_TYPES[bizType]?.emoji ?? '';
      const outputPrice = b.output_base_price ? Number(b.output_base_price) : 0;
      const dailyRevenue = productionPerTick * outputPrice * 60; // ~60 ticks/hour assumed
      const dailyCost = Number(b.location_daily_cost ?? 0) + Number(b.salary_total ?? 0);

      return {
        id: b.id,
        name: b.name,
        type: b.type,
        tier,
        status: b.status,
        employee_count: empCount,
        max_employees: maxEmployees(tier),
        total_inventory: Number(b.total_inventory),
        storage_cap: storageCap(tier),
        production_per_tick: Math.round(productionPerTick * 100) / 100,
        location_name: b.location_name,
        emoji,
        output_item: b.output_item_name ?? null,
        output_price: outputPrice,
        daily_cost: Math.round(dailyCost * 100) / 100,
        estimated_daily_revenue: Math.round(dailyRevenue * 100) / 100,
        estimated_daily_profit: Math.round((dailyRevenue - dailyCost) * 100) / 100,
      };
    });

    // Stats
    const totalEmployees = businesses.reduce((s: number, b: { employee_count: number }) => s + b.employee_count, 0);
    const totalInventoryValue = businesses.reduce((s: number, b: { total_inventory: number }) => s + b.total_inventory, 0);

    // Compute rank
    const rankNames = ['Rookie', 'Hustler', 'Entrepreneur', 'Mogul', 'Tycoon', 'Baron', 'Kingpin', 'Legend', 'Titan', 'Overlord'];
    const rank = rankNames[Math.min(xpInfo.level - 1, rankNames.length - 1)] ?? 'Rookie';

    // Generate next-action suggestions
    const suggestions: string[] = [];
    const cash = Number(player.cash);

    if (businesses.length === 0) {
      suggestions.push('Build your first business! A Mine is the cheapest way to start.');
    } else {
      const noWorkerBiz = businesses.find((b: { employee_count: number }) => b.employee_count === 0);
      if (noWorkerBiz) {
        suggestions.push(`Hire a worker for "${(noWorkerBiz as { name: string }).name}" — it can't produce without employees.`);
      }

      const fullStorage = businesses.find((b: { total_inventory: number; storage_cap: number }) =>
        b.total_inventory >= b.storage_cap * 0.8);
      if (fullStorage) {
        suggestions.push(`"${(fullStorage as { name: string }).name}" storage is almost full — sell inventory or upgrade.`);
      }

      const canUpgrade = businesses.find((b: { employee_count: number; max_employees: number }) =>
        b.employee_count >= b.max_employees);
      if (canUpgrade) {
        suggestions.push(`"${(canUpgrade as { name: string }).name}" is at max employees — upgrade to grow.`);
      }

      if (businesses.length === 1 && cash >= 15000) {
        suggestions.push('You can afford a second business — diversify your empire!');
      }

      const hasOnlyMines = businesses.every((b: { type: unknown }) => b.type === 'MINE');
      if (hasOnlyMines && businesses.length >= 1) {
        suggestions.push('Build a Factory to process raw materials into more valuable goods.');
      }

      if (suggestions.length === 0) {
        suggestions.push('Keep producing and selling. Upgrade businesses or hire more workers to grow.');
      }
    }

    return reply.send({
      data: {
        player: {
          cash,
          bank_balance: Number(player.bank_balance),
          level: xpInfo.level,
          xp: player.xp,
          xpCurrent: xpInfo.xpCurrent,
          xpForNext: xpInfo.xpForNext,
          unlock_phase: player.unlock_phase,
          rank,
          net_worth: Number(player.net_worth),
          dirty_money: Number(player.dirty_money),
          heat_police: player.heat_police,
          heat_rival: player.heat_rival,
          rep_street: Number(player.rep_street ?? 50),
          rep_business: Number(player.rep_business ?? 50),
          rep_underworld: Number(player.rep_underworld ?? 50),
        },
        businesses,
        activity: activityRes.rows,
        earnings: {
          income,
          expenses,
          profit: income - expenses,
        },
        dailyCosts: {
          locations: locationCosts,
          salaries: salaryCosts,
          total: locationCosts + salaryCosts,
        },
        suggestions,
        tick: {
          interval_ms: 60000,
          last_tick_at: await query("SELECT completed_at FROM game_ticks WHERE tick_type = 'production' ORDER BY completed_at DESC LIMIT 1").then(r => r.rows[0]?.completed_at ?? null),
        },
        stats: {
          total_businesses: businesses.length,
          total_employees: totalEmployees,
          total_inventory_value: totalInventoryValue,
        },
        events: await getActiveEvents(),
        season: await query("SELECT number, config_json->>'name' AS name, ends_at FROM seasons WHERE status = 'active' LIMIT 1").then(r => r.rows[0] ?? null),
      },
    });
  });
}
