import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { query, withTransaction } from '../db/client';
import { recalculateNetWorth } from '../lib/networth';
import { UPGRADE_COSTS, TIER_CAPACITY_MULTIPLIER, BUSINESS_STARTUP_COSTS, BUSINESS_DAILY_COSTS, MAX_EMPLOYEES_PER_TIER, PRODUCTION_RECIPES, GAME_BALANCE, calculateHireCost } from '../lib/constants';
import { BUSINESS_BASE_COSTS } from '../../../shared/src/types/entities';
import type { BusinessType } from '../../../shared/src/types/entities';
import { employee_production } from '../jobs/simulation';

const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['RETAIL', 'FACTORY', 'MINE', 'FARM', 'LOGISTICS', 'SECURITY_FIRM', 'FRONT_COMPANY']),
  city: z.enum(['Ironport', 'Duskfield', 'Ashvale', 'Coldmarsh', 'Farrow']),
});

const UpdateBusinessSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  status: z.enum(['ACTIVE', 'IDLE']).optional(),
}).refine(d => d.name !== undefined || d.status !== undefined, {
  message: 'At least one of name or status must be provided',
});

const BASE_CAPACITY: Record<BusinessType, number> = {
  RETAIL: 200,
  FACTORY: 500,
  MINE: 400,
  FARM: 600,
  LOGISTICS: 300,
  SECURITY_FIRM: 100,
  FRONT_COMPANY: 300,
};

export async function businessRoutes(app: FastifyInstance): Promise<void> {
  // POST /businesses/batch-produce — trigger production across all owned businesses
  app.post('/batch-produce', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const bizRes = await query<{ id: string; name: string }>(
      `SELECT id, name FROM businesses WHERE owner_id = $1 AND status = 'ACTIVE'`,
      [playerId],
    );

    let produced = 0;
    const results: Array<{ name: string; inventory: Record<string, number> }> = [];

    for (const biz of bizRes.rows) {
      try {
        await employee_production(biz.id);
        const invRes = await query(`SELECT inventory FROM businesses WHERE id = $1`, [biz.id]);
        results.push({ name: biz.name, inventory: invRes.rows[0]?.inventory ?? {} });
        produced++;
      } catch {
        // Skip failed production
      }
    }

    return reply.send({
      data: { produced, total: bizRes.rows.length, results },
      message: `Production triggered for ${produced}/${bizRes.rows.length} businesses.`,
    });
  });

  // POST /businesses/batch-maintain — maintain all businesses at once
  app.post('/batch-maintain', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;

    try {
      const result = await withTransaction(async (client) => {
        const bizRes = await client.query<{
          id: string; name: string; efficiency: string; daily_operating_cost: string;
        }>(
          `SELECT id, name, efficiency, daily_operating_cost
             FROM businesses WHERE owner_id = $1 AND status = 'ACTIVE'`,
          [playerId],
        );

        let totalCost = 0;
        const maintained: Array<{ name: string; boost: number }> = [];

        for (const biz of bizRes.rows) {
          const cost = Math.max(200, parseFloat(biz.daily_operating_cost) * 0.1);
          totalCost += cost;
        }

        const playerRow = await client.query<{ cash: string }>(
          `SELECT cash FROM players WHERE id = $1 FOR UPDATE`, [playerId],
        );
        if (parseFloat(playerRow.rows[0]?.cash ?? '0') < totalCost) {
          throw Object.assign(new Error(`Need $${totalCost.toFixed(0)} for all maintenance`), { statusCode: 400 });
        }

        await client.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [totalCost, playerId]);

        for (const biz of bizRes.rows) {
          const cost = Math.max(200, parseFloat(biz.daily_operating_cost) * 0.1);
          const currentEff = parseFloat(biz.efficiency);
          const boost = 0.02 + Math.random() * 0.03;
          const newEff = Math.min(1.0, currentEff + boost);

          await client.query(
            `UPDATE businesses SET efficiency = $1, total_expenses = total_expenses + $2 WHERE id = $3`,
            [newEff.toFixed(4), cost, biz.id],
          );
          maintained.push({ name: biz.name, boost: parseFloat((boost * 100).toFixed(1)) });
        }

        return { total_cost: totalCost, maintained };
      });

      return reply.send({
        data: result,
        message: `All ${result.maintained.length} businesses maintained for $${result.total_cost.toFixed(0)}.`,
      });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /businesses/types — available business types with costs and production info
  app.get('/types', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const types = Object.entries(BUSINESS_STARTUP_COSTS).map(([type, startupCost]) => {
      const dailyCost = BUSINESS_DAILY_COSTS[type] ?? 800;
      const recipe = PRODUCTION_RECIPES[type as BusinessType]?.[1];
      const baseRev = 1 * GAME_BALANCE.BUSINESS_BASE_REVENUE * 1.0; // tier 1, eff 1.0, 0 workers
      const revWith1Worker = 1 * GAME_BALANCE.BUSINESS_BASE_REVENUE * 1.0 * 1.1;
      const capacity = BASE_CAPACITY[type as BusinessType] ?? 200;

      return {
        type,
        startup_cost: startupCost,
        daily_cost: dailyCost,
        daily_revenue_base: parseFloat(baseRev.toFixed(2)),
        daily_revenue_with_worker: parseFloat(revWith1Worker.toFixed(2)),
        daily_net_base: parseFloat((baseRev - dailyCost).toFixed(2)),
        daily_net_with_worker: parseFloat((revWith1Worker - dailyCost).toFixed(2)),
        capacity,
        max_employees_tier_1: MAX_EMPLOYEES_PER_TIER[1] ?? 10,
        produces: recipe?.outputs.filter(o => o.quantity > 0).map(o => o.resource_name) ?? [],
        requires_inputs: recipe?.inputs && recipe.inputs.length > 0,
        description: {
          RETAIL: 'Steady revenue, no production. Great starter business.',
          FACTORY: 'Converts raw materials into valuable goods. Needs inputs.',
          MINE: 'Extracts Coal and Metals. No input costs.',
          FARM: 'Produces Wheat and Lumber. No input costs.',
          LOGISTICS: 'Enables shipping between cities.',
          SECURITY_FIRM: 'Protects businesses from raids and theft.',
          FRONT_COMPANY: 'Launders dirty money. Criminal alignment required.',
        }[type] ?? '',
      };
    });

    // City bonuses info
    const cityBonuses = [
      { city: 'Ironport', bonus: 'Capital city — largest market, highest prices', specialization: 'MINE (+10% output)' },
      { city: 'Duskfield', bonus: 'Industrial hub — Factory production bonus', specialization: 'FACTORY (+10% output)' },
      { city: 'Ashvale', bonus: 'Agricultural region — Farm production bonus', specialization: 'FARM (+15% output)' },
      { city: 'Coldmarsh', bonus: 'Low cost region — reduced operating expenses', specialization: 'All (-10% operating costs)' },
      { city: 'Farrow', bonus: 'Frontier town — high risk, high reward', specialization: 'Crime (+20% rewards)' },
    ];

    return reply.send({ data: types, cities: cityBonuses });
  });

  // GET /businesses
  app.get('/', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT b.*,
              (SELECT COUNT(*)::int FROM employees e WHERE e.business_id = b.id) AS employee_count
         FROM businesses b
        WHERE b.owner_id = $1 AND b.status != 'BANKRUPT'
        ORDER BY b.established_at ASC`,
      [request.player.id],
    );
    return reply.send({ data: res.rows });
  });

  // POST /businesses
  app.post('/', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateBusinessSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { name, type, city } = parsed.data;

    const playerId = request.player.id;
    const seasonId = request.player.season_id;

    try {
      const biz = await withTransaction(async (client) => {
        const playerRow = await client.query<{ cash: string; business_slots: number }>(
          `SELECT cash, business_slots FROM players WHERE id = $1 FOR UPDATE`,
          [playerId],
        );
        if (!playerRow.rows.length) throw Object.assign(new Error('Player not found'), { statusCode: 404 });
        const player = playerRow.rows[0];

        const countRes = await client.query<{ cnt: string }>(
          `SELECT COUNT(*) AS cnt FROM businesses WHERE owner_id = $1 AND status != 'BANKRUPT'`,
          [playerId],
        );
        if (Number(countRes.rows[0].cnt) >= player.business_slots) {
          throw Object.assign(new Error('Business slot limit reached'), { statusCode: 400 });
        }

        const startupCost = BUSINESS_STARTUP_COSTS[type] ?? 25000;
        const dailyCost = BUSINESS_DAILY_COSTS[type] ?? 800;

        if (Number(player.cash) < startupCost) {
          throw Object.assign(new Error('Insufficient funds'), { statusCode: 400 });
        }

        const isFront = type === 'FRONT_COMPANY';
        const baseCapacity = BASE_CAPACITY[type as BusinessType] ?? 200;

        const maxEmps = MAX_EMPLOYEES_PER_TIER[1] ?? 10;
        const bizRes = await client.query<{ id: string }>(
          `INSERT INTO businesses
             (owner_id, season_id, name, type, tier, city, status, capacity,
              efficiency, inventory, storage_cap, daily_operating_cost, is_front, front_capacity, max_employees)
           VALUES ($1,$2,$3,$4,1,$5,'ACTIVE',$6,1.0,'{}',1000,$7,$8,$9,$10)
           RETURNING id`,
          [
            playerId, seasonId, name, type, city,
            baseCapacity, dailyCost, isFront, isFront ? 50000 : 0, maxEmps,
          ],
        );
        const businessId = bizRes.rows[0].id;

        await client.query(
          `UPDATE players SET cash = cash - $1 WHERE id = $2`,
          [startupCost, playerId],
        );

        return businessId;
      });

      // Auto-hire first worker for first business so production starts immediately
      const bizCountRes = await query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM businesses WHERE owner_id = $1 AND status != 'BANKRUPT'`,
        [playerId],
      );
      const isFirstBusiness = parseInt(bizCountRes.rows[0]?.cnt ?? '0') === 1;
      let autoHired = false;

      if (isFirstBusiness) {
        // Find an available worker
        const availWorker = await query<{ id: string }>(
          `SELECT id FROM employees WHERE business_id IS NULL AND season_id = $1 LIMIT 1`,
          [seasonId],
        );
        if (availWorker.rows.length > 0) {
          await query(
            `UPDATE employees SET business_id = $1, hired_at = NOW() WHERE id = $2`,
            [biz, availWorker.rows[0].id],
          );
          autoHired = true;
        }
      }

      await recalculateNetWorth(playerId);
      const res = await query(`SELECT * FROM businesses WHERE id = $1`, [biz]);
      const business = res.rows[0];

      // Calculate projected economics for the new business
      const dailyRevBase = 1 * GAME_BALANCE.BUSINESS_BASE_REVENUE * 1.0; // tier 1, efficiency 1.0, 0 employees
      const dailyCost = BUSINESS_DAILY_COSTS[type] ?? 800;
      const recipe = PRODUCTION_RECIPES[type as BusinessType]?.[1];
      const hireCost = calculateHireCost(
        Number((await query(`SELECT COUNT(*)::int AS cnt FROM businesses WHERE owner_id = $1 AND status != 'BANKRUPT'`, [playerId])).rows[0]?.cnt ?? 1),
        0,
      );

      const projections = {
        daily_revenue_now: parseFloat(dailyRevBase.toFixed(2)),
        daily_cost: parseFloat(dailyCost.toFixed(2)),
        daily_net_now: parseFloat((dailyRevBase - dailyCost).toFixed(2)),
        daily_revenue_with_1_worker: parseFloat((1 * GAME_BALANCE.BUSINESS_BASE_REVENUE * 1.0 * (1 + 1 * 0.1)).toFixed(2)),
        daily_net_with_1_worker: parseFloat((1 * GAME_BALANCE.BUSINESS_BASE_REVENUE * 1.0 * (1 + 1 * 0.1) - dailyCost).toFixed(2)),
        hire_cost: hireCost,
        produces: recipe?.outputs.filter(o => o.quantity > 0).map(o => o.resource_name) ?? [],
        max_employees_tier_1: MAX_EMPLOYEES_PER_TIER[1] ?? 10,
      };

      const nextSteps = [
        `Hire workers to start production (cost: $${hireCost}/worker)`,
        `Each worker boosts revenue by 10% and produces goods`,
        recipe && recipe.outputs.length > 0 && recipe.outputs[0].quantity > 0
          ? `Workers will produce: ${recipe.outputs.map(o => o.resource_name).join(', ')}`
          : `This business earns passive revenue each tick`,
      ].filter(Boolean);

      return reply.status(201).send({
        data: business,
        projections,
        next_steps: nextSteps,
        auto_hired: autoHired,
        message: autoHired
          ? `${name} is open and a worker has been hired! Production will start next tick.`
          : `${name} is now open for business! Hire workers to maximize your profits.`,
      });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /businesses/:id
  app.get('/:id', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const res = await query(
      `SELECT b.*,
              sl.tier AS security_tier, sl.protection_rating, sl.daily_cost AS security_daily_cost
         FROM businesses b
         LEFT JOIN security_layers sl ON sl.id = b.security_layer_id
        WHERE b.id = $1 AND b.owner_id = $2`,
      [id, request.player.id],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Business not found' });

    const empRes = await query(
      `SELECT * FROM employees WHERE business_id = $1 ORDER BY hired_at ASC`,
      [id],
    );
    return reply.send({ data: { ...res.rows[0], employees: empRes.rows } });
  });

  // PUT /businesses/:id
  app.put('/:id', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateBusinessSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let pi = 1;

    if (parsed.data.name !== undefined) { setClauses.push(`name = $${pi++}`); values.push(parsed.data.name); }
    if (parsed.data.status !== undefined) { setClauses.push(`status = $${pi++}`); values.push(parsed.data.status); }

    values.push(id, request.player.id);
    await query(
      `UPDATE businesses SET ${setClauses.join(', ')} WHERE id = $${pi++} AND owner_id = $${pi++}`,
      values,
    );
    const res = await query(`SELECT * FROM businesses WHERE id = $1`, [id]);
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Business not found' });
    return reply.send({ data: res.rows[0] });
  });

  // POST /businesses/:id/upgrade
  app.post('/:id/upgrade', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const playerId = request.player.id;

    try {
      await withTransaction(async (client) => {
        const bizRow = await client.query<{ type: string; tier: number }>(
          `SELECT type, tier FROM businesses WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
          [id, playerId],
        );
        if (!bizRow.rows.length) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
        const biz = bizRow.rows[0];

        if (biz.tier >= 4) throw Object.assign(new Error('Already max tier'), { statusCode: 400 });

        const nextTier = biz.tier + 1;
        const upgradeCosts = UPGRADE_COSTS[biz.type as BusinessType];
        const cost = upgradeCosts?.[nextTier] ?? 999999;

        const playerRow = await client.query<{ cash: string }>(
          `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
          [playerId],
        );
        if (Number(playerRow.rows[0].cash) < cost) {
          throw Object.assign(new Error(`Insufficient funds (need $${cost})`), { statusCode: 400 });
        }

        const tierMultiplier = TIER_CAPACITY_MULTIPLIER[nextTier] ?? 1.0;
        const baseCapacity = BASE_CAPACITY[biz.type as BusinessType] ?? 200;
        const newCapacity = Math.round(baseCapacity * tierMultiplier);

        await client.query(
          `UPDATE businesses SET tier = $1, capacity = $2 WHERE id = $3`,
          [nextTier, newCapacity, id],
        );
        await client.query(
          `UPDATE players SET cash = cash - $1 WHERE id = $2`,
          [cost, playerId],
        );
      });

      await recalculateNetWorth(playerId);
      const res = await query(`SELECT * FROM businesses WHERE id = $1`, [id]);
      return reply.send({ data: res.rows[0] });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /businesses/:id/employees
  app.get('/:id/employees', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const ownerCheck = await query(
      `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2`,
      [id, request.player.id],
    );
    if (!ownerCheck.rows.length) return reply.status(404).send({ error: 'Business not found' });

    const res = await query(`SELECT * FROM employees WHERE business_id = $1`, [id]);
    return reply.send({ data: res.rows });
  });

  // POST /businesses/:id/maintain — invest in business maintenance for efficiency boost
  app.post('/:id/maintain', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const playerId = request.player.id;

    try {
      const result = await withTransaction(async (client) => {
        const bizRes = await client.query<{
          tier: number; efficiency: string; daily_operating_cost: string; name: string;
        }>(
          `SELECT tier, efficiency, daily_operating_cost, name FROM businesses
            WHERE id = $1 AND owner_id = $2 AND status = 'ACTIVE' FOR UPDATE`,
          [id, playerId],
        );
        if (!bizRes.rows.length) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
        const biz = bizRes.rows[0];

        // Maintenance cost = 10% of daily operating cost, min $200
        const maintenanceCost = Math.max(200, parseFloat(biz.daily_operating_cost) * 0.1);

        const playerRes = await client.query<{ cash: string }>(
          `SELECT cash FROM players WHERE id = $1 FOR UPDATE`, [playerId],
        );
        if (parseFloat(playerRes.rows[0]?.cash ?? '0') < maintenanceCost) {
          throw Object.assign(new Error(`Insufficient funds: need $${maintenanceCost.toFixed(0)}`), { statusCode: 400 });
        }

        // Boost efficiency by 2-5% (up to 1.0 max)
        const currentEff = parseFloat(biz.efficiency);
        const boost = 0.02 + Math.random() * 0.03;
        const newEff = Math.min(1.0, currentEff + boost);

        await client.query(
          `UPDATE players SET cash = cash - $1 WHERE id = $2`,
          [maintenanceCost, playerId],
        );
        await client.query(
          `UPDATE businesses SET efficiency = $1, total_expenses = total_expenses + $2 WHERE id = $3`,
          [newEff.toFixed(4), maintenanceCost, id],
        );

        return {
          cost: parseFloat(maintenanceCost.toFixed(2)),
          efficiency_before: parseFloat((currentEff * 100).toFixed(1)),
          efficiency_after: parseFloat((newEff * 100).toFixed(1)),
          boost: parseFloat((boost * 100).toFixed(1)),
        };
      });

      return reply.send({
        data: result,
        message: `Maintenance complete! Efficiency boosted by ${result.boost}% (${result.efficiency_before}% → ${result.efficiency_after}%).`,
      });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // POST /businesses/:id/auto-sell — toggle auto-sell for a business
  app.post('/:id/auto-sell', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { enabled } = (request.body as { enabled?: boolean }) ?? {};
    const check = await query<{ auto_sell: boolean }>(
      `SELECT auto_sell FROM businesses WHERE id = $1 AND owner_id = $2`,
      [id, request.player.id],
    );
    if (!check.rows.length) return reply.status(404).send({ error: 'Business not found' });

    const newVal = enabled !== undefined ? enabled : !check.rows[0].auto_sell;
    await query(`UPDATE businesses SET auto_sell = $1 WHERE id = $2`, [newVal, id]);
    return reply.send({
      data: { auto_sell: newVal },
      message: newVal
        ? 'Auto-sell enabled! Produced goods will be sold automatically each tick at 85% market rate.'
        : 'Auto-sell disabled. Produced goods will be stored in inventory.',
    });
  });

  // POST /businesses/:id/produce — manual production trigger
  app.post('/:id/produce', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const check = await query(
      `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2`,
      [id, request.player.id],
    );
    if (!check.rows.length) return reply.status(404).send({ error: 'Business not found' });

    await employee_production(id);
    await recalculateNetWorth(request.player.id);

    const res = await query(`SELECT inventory FROM businesses WHERE id = $1`, [id]);
    return reply.send({ data: { inventory: res.rows[0]?.inventory ?? {} } });
  });

  // GET /businesses/:id/upgrade-info — with before/after economic preview
  app.get('/:id/upgrade-info', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const res = await query<{
      type: string; tier: number; storage_cap: number; efficiency: string;
      daily_operating_cost: string; name: string;
    }>(
      `SELECT type, tier, storage_cap, efficiency, daily_operating_cost, name
         FROM businesses WHERE id = $1 AND owner_id = $2`,
      [id, request.player.id],
    );
    if (!res.rows.length) return reply.status(404).send({ error: 'Business not found' });
    const biz = res.rows[0];

    // Get current employee count
    const empRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM employees WHERE business_id = $1`, [id],
    );
    const empCount = parseInt(empRes.rows[0]?.count ?? '0', 10);

    const nextTier = biz.tier < 4 ? biz.tier + 1 : null;
    const upgradeCosts = UPGRADE_COSTS[biz.type as BusinessType];
    const upgrade_cost = nextTier ? (upgradeCosts?.[nextTier] ?? 0) : 0;
    const baseCapacity = BASE_CAPACITY[biz.type as BusinessType] ?? 200;
    const nextCapacity = nextTier ? Math.round(baseCapacity * (TIER_CAPACITY_MULTIPLIER[nextTier] ?? 1)) : 0;

    // Current economics
    const eff = parseFloat(biz.efficiency);
    const currentDailyRev = biz.tier * GAME_BALANCE.BUSINESS_BASE_REVENUE * eff * (1 + empCount * 0.1);
    const currentDailyCost = parseFloat(biz.daily_operating_cost);
    const currentDailyNet = currentDailyRev - currentDailyCost;

    // Next tier economics (estimate: tier increases, cost stays same)
    const nextDailyCost = nextTier ? (BUSINESS_DAILY_COSTS[biz.type] ?? currentDailyCost) : 0;
    const nextDailyRev = nextTier ? nextTier * GAME_BALANCE.BUSINESS_BASE_REVENUE * eff * (1 + empCount * 0.1) : 0;
    const nextDailyNet = nextDailyRev - nextDailyCost;

    // Production comparison
    const currentRecipe = PRODUCTION_RECIPES[biz.type as BusinessType]?.[biz.tier];
    const nextRecipe = nextTier ? PRODUCTION_RECIPES[biz.type as BusinessType]?.[nextTier] : null;

    const nextMaxEmp = nextTier ? (MAX_EMPLOYEES_PER_TIER[nextTier] ?? 10) : 0;

    // Time to pay off the upgrade
    const profitIncrease = nextDailyNet - currentDailyNet;
    const payoffDays = profitIncrease > 0 ? Math.ceil(upgrade_cost / profitIncrease) : null;

    return reply.send({
      data: {
        business_name: biz.name,
        current_tier: biz.tier,
        next_tier: nextTier,
        upgrade_cost,
        current: {
          daily_revenue: parseFloat(currentDailyRev.toFixed(2)),
          daily_cost: parseFloat(currentDailyCost.toFixed(2)),
          daily_net: parseFloat(currentDailyNet.toFixed(2)),
          max_employees: MAX_EMPLOYEES_PER_TIER[biz.tier] ?? 10,
          capacity: biz.storage_cap,
          produces: currentRecipe?.outputs.filter(o => o.quantity > 0).map(o => o.resource_name) ?? [],
        },
        after_upgrade: nextTier ? {
          daily_revenue: parseFloat(nextDailyRev.toFixed(2)),
          daily_cost: parseFloat(nextDailyCost.toFixed(2)),
          daily_net: parseFloat(nextDailyNet.toFixed(2)),
          revenue_increase: parseFloat((nextDailyRev - currentDailyRev).toFixed(2)),
          profit_increase: parseFloat(profitIncrease.toFixed(2)),
          max_employees: nextMaxEmp,
          capacity: nextCapacity,
          produces: nextRecipe?.outputs.filter(o => o.quantity > 0).map(o => o.resource_name) ?? [],
          payoff_days: payoffDays,
        } : null,
      },
    });
  });

  // GET /businesses/:id/revenue
  app.get('/:id/revenue', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { days = '7' } = request.query as { days?: string };
    const ownerCheck = await query(
      `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2`,
      [id, request.player.id],
    );
    if (!ownerCheck.rows.length) return reply.status(404).send({ error: 'Business not found' });

    const numDays = Math.min(parseInt(days, 10) || 7, 30);
    const res = await query<{ day: string; revenue: string; expenses: string }>(
      `SELECT day::text, revenue, expenses
         FROM business_ledger
        WHERE business_id = $1
          AND day >= CURRENT_DATE - make_interval(days => $2)
        ORDER BY day ASC`,
      [id, numDays],
    );

    // Build a full array covering the last N days (fill gaps with 0)
    const dates: string[] = [];
    const revenues: number[] = [];
    const expenses: number[] = [];
    const rowMap = new Map(res.rows.map((r) => [r.day, r]));

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const row = rowMap.get(key);
      dates.push(key);
      revenues.push(row ? Number(row.revenue) : 0);
      expenses.push(row ? Number(row.expenses) : 0);
    }

    return reply.send({ data: { dates, revenues, expenses } });
  });

  // GET /businesses/:id/config
  app.get('/:id/config', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const res = await query(
      `SELECT producing_resource_id AS resource_id,
              quantity_per_tick,
              auto_sell,
              auto_sell_price
         FROM businesses
        WHERE id = $1 AND owner_id = $2`,
      [id, request.player.id],
    );
    if (!res.rows.length) return reply.status(404).send({ error: 'Business not found' });
    return reply.send({ data: res.rows[0] });
  });

  // PUT /businesses/:id/config
  const ConfigSchema = z.object({
    resource_id: z.string().uuid().nullable().optional(),
    auto_sell: z.boolean().optional(),
    auto_sell_price: z.number().positive().nullable().optional(),
  });

  app.put('/:id/config', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parsed = ConfigSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });

    const ownerCheck = await query(
      `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2`,
      [id, request.player.id],
    );
    if (!ownerCheck.rows.length) return reply.status(404).send({ error: 'Business not found' });

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let pi = 1;

    if (parsed.data.resource_id !== undefined) {
      setClauses.push(`producing_resource_id = $${pi++}`);
      values.push(parsed.data.resource_id);
    }
    if (parsed.data.auto_sell !== undefined) {
      setClauses.push(`auto_sell = $${pi++}`);
      values.push(parsed.data.auto_sell);
    }
    if (parsed.data.auto_sell_price !== undefined) {
      setClauses.push(`auto_sell_price = $${pi++}`);
      values.push(parsed.data.auto_sell_price);
    }

    if (!setClauses.length) return reply.status(400).send({ error: 'Nothing to update' });

    values.push(id);
    await query(`UPDATE businesses SET ${setClauses.join(', ')} WHERE id = $${pi}`, values);
    return reply.send({ data: { success: true } });
  });

  // DELETE /businesses/:id/employees/:employeeId
  app.delete('/:id/employees/:employeeId', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: businessId, employeeId } = request.params as { id: string; employeeId: string };
    const playerId = request.player.id;

    const empRow = await query(
      `SELECT e.id FROM employees e
         JOIN businesses b ON b.id = e.business_id
        WHERE e.id = $1 AND b.id = $2 AND b.owner_id = $3`,
      [employeeId, businessId, playerId],
    );
    if (!empRow.rows.length) return reply.status(403).send({ error: 'Employee not found or not owned by player' });

    await query(`UPDATE employees SET business_id = NULL, hired_at = NULL WHERE id = $1`, [employeeId]);
    return reply.status(204).send();
  });
}
