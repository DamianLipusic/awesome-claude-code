import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { checkAchievements } from '../lib/achievements.js';
import {
  BUSINESS_TYPES,
  type BusinessType,
  upgradeCost,
  storageCap,
  maxEmployees,
  calcProduction,
} from '../config/game.config.js';
import { awardXP, XP_REWARDS } from '../lib/xp.js';

const CreateBusinessSchema = z.object({
  type: z.enum(['SHOP', 'FACTORY', 'MINE']),
  name: z.string().min(2).max(50),
  location_id: z.string().uuid(),
  recipe_id: z.string().uuid().optional(),
});

export async function businessRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth
  app.addHook('preHandler', requireAuth);

  // GET /recipes — list available recipes (for FACTORY creation wizard)
  app.get('/recipes', async (_req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT r.id, r.business_type, r.base_rate, r.cycle_minutes,
              i_out.key AS output_item_key, i_out.name AS output_item_name
       FROM recipes r
       JOIN items i_out ON i_out.id = r.output_item_id
       ORDER BY r.business_type, i_out.name`,
    );
    return reply.send({ data: res.rows });
  });

  // GET / — list player's businesses
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT b.id, b.name, b.type, b.tier, b.status, b.efficiency, b.recipe_id, b.location_id, b.created_at,
        l.name AS location_name, l.traffic AS location_traffic,
        r.output_item_id, r.base_rate,
        i_out.key AS output_item_key, i_out.name AS output_item_name,
        (SELECT COUNT(*) FROM employees e WHERE e.business_id = b.id AND e.status IN ('active','training'))::int AS employee_count,
        (SELECT COALESCE(SUM(inv.amount), 0) FROM inventory inv WHERE inv.business_id = b.id)::numeric AS total_inventory
      FROM businesses b
      LEFT JOIN locations l ON l.id = b.location_id
      LEFT JOIN recipes r ON r.id = b.recipe_id
      LEFT JOIN items i_out ON i_out.id = r.output_item_id
      WHERE b.owner_id = $1 AND b.status != 'shutdown'
      ORDER BY b.created_at`,
      [req.player.id],
    );
    return reply.send({ data: res.rows });
  });

  // POST / — create business
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateBusinessSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { type, name, location_id, recipe_id: inputRecipeId } = parsed.data;
    const bizType = BUSINESS_TYPES[type as BusinessType];

    // Validate location exists and is available
    const locRes = await query<{ id: string; price: string; available: boolean }>(
      `SELECT id, price, available FROM locations WHERE id = $1`,
      [location_id],
    );
    if (!locRes.rows.length) {
      return reply.status(400).send({ error: 'Location not found' });
    }
    if (!locRes.rows[0].available) {
      return reply.status(400).send({ error: 'Location not available' });
    }
    const locationPrice = Number(locRes.rows[0].price);
    const totalCost = bizType.cost + locationPrice;

    // Check player cash
    const playerRes = await query<{ cash: string; season_id: string | null }>(
      `SELECT cash, season_id FROM players WHERE id = $1`,
      [req.player.id],
    );
    if (!playerRes.rows.length) {
      return reply.status(404).send({ error: 'Player not found' });
    }
    const playerCash = Number(playerRes.rows[0].cash);
    const seasonId = playerRes.rows[0].season_id;

    if (playerCash < totalCost) {
      return reply.status(400).send({
        error: `Not enough cash. Need $${totalCost.toLocaleString()}, have $${playerCash.toLocaleString()}`,
      });
    }

    // Resolve recipe_id
    let recipeId: string | null = null;

    if (type === 'FACTORY') {
      if (!inputRecipeId) {
        return reply.status(400).send({ error: 'FACTORY requires a recipe_id' });
      }
      const recipeRes = await query<{ id: string; business_type: string }>(
        `SELECT id, business_type FROM recipes WHERE id = $1`,
        [inputRecipeId],
      );
      if (!recipeRes.rows.length) {
        return reply.status(400).send({ error: 'Recipe not found' });
      }
      if (recipeRes.rows[0].business_type !== 'FACTORY') {
        return reply.status(400).send({ error: 'Recipe is not a FACTORY recipe' });
      }
      recipeId = recipeRes.rows[0].id;
    } else if (type === 'MINE') {
      // Auto-assign the ore recipe
      const oreRecipeRes = await query<{ id: string }>(
        `SELECT r.id FROM recipes r JOIN items i ON i.id = r.output_item_id WHERE r.business_type = 'MINE' AND i.key = 'ore' LIMIT 1`,
      );
      if (!oreRecipeRes.rows.length) {
        return reply.status(500).send({ error: 'Mine recipe not found in database' });
      }
      recipeId = oreRecipeRes.rows[0].id;
    }
    // SHOP: no recipe (null)

    // Create business in transaction
    const result = await withTransaction(async (client) => {
      // Deduct cash
      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [totalCost, req.player.id],
      );

      // Create business
      const bizRes = await client.query<{ id: string }>(
        `INSERT INTO businesses (owner_id, season_id, location_id, type, name, recipe_id, status, tier, efficiency)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', 1, 100)
         RETURNING id`,
        [req.player.id, seasonId, location_id, type, name, recipeId],
      );
      const businessId = bizRes.rows[0].id;

      // Create initial empty inventory row for recipe output item (if recipe exists)
      if (recipeId) {
        const outputRes = await client.query<{ output_item_id: string }>(
          `SELECT output_item_id FROM recipes WHERE id = $1`,
          [recipeId],
        );
        if (outputRes.rows.length) {
          await client.query(
            `INSERT INTO inventory (business_id, item_id, amount, reserved, dirty_amount)
             VALUES ($1, $2, 0, 0, 0)
             ON CONFLICT (business_id, item_id) DO NOTHING`,
            [businessId, outputRes.rows[0].output_item_id],
          );
        }
      }

      // Award XP (handles level-up detection + logging)
      await awardXP(client, req.player.id, XP_REWARDS.CREATE_BIZ);
      await checkAchievements(client, req.player.id);

      // Log activity
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount)
         VALUES ($1, $2, 'business_created', $3, $4)`,
        [req.player.id, businessId, `Created ${type} "${name}"`, -totalCost],
      );

      return { businessId };
    });

    return reply.status(201).send({
      data: {
        id: result.businessId,
        type,
        name,
        message: `${type} "${name}" created successfully`,
      },
    });
  });

  // GET /:id — business detail
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    // Business with location and recipe info
    const bizRes = await query(
      `SELECT b.id, b.name, b.type, b.tier, b.status, b.efficiency, b.recipe_id,
              b.location_id, b.security_physical, b.security_cyber, b.security_legal,
              b.created_at,
              l.name AS location_name, l.type AS location_type, l.zone AS location_zone,
              l.traffic AS location_traffic, l.daily_cost AS location_daily_cost,
              r.output_item_id, r.base_rate, r.cycle_minutes,
              i_out.key AS output_item_key, i_out.name AS output_item_name
       FROM businesses b
       LEFT JOIN locations l ON l.id = b.location_id
       LEFT JOIN recipes r ON r.id = b.recipe_id
       LEFT JOIN items i_out ON i_out.id = r.output_item_id
       WHERE b.id = $1 AND b.owner_id = $2`,
      [id, req.player.id],
    );
    if (!bizRes.rows.length) {
      return reply.status(404).send({ error: 'Business not found' });
    }
    const biz = bizRes.rows[0];

    // Inventory
    const invRes = await query(
      `SELECT inv.item_id, inv.amount, inv.reserved, inv.dirty_amount,
              i.key AS item_key, i.name AS item_name, i.base_price
       FROM inventory inv
       JOIN items i ON i.id = inv.item_id
       WHERE inv.business_id = $1
       ORDER BY i.name`,
      [id],
    );

    // Employees (visible stats only — never hidden_*)
    const empRes = await query(
      `SELECT e.id, e.name, e.role, e.salary, e.efficiency, e.speed, e.loyalty,
              e.discretion, e.learning_rate, e.stress, e.xp, e.level, e.status,
              e.hired_at
       FROM employees e
       WHERE e.business_id = $1 AND e.status IN ('active', 'training')
       ORDER BY e.name`,
      [id],
    );

    // Recipe inputs with names and prices
    let recipeInputs: { item_id: string; item_key: string; item_name: string; base_price: number; qty_per_unit: number; source_business_type: string | null }[] = [];
    if (biz.recipe_id) {
      const inputsRes = await query(
        `SELECT ri.item_id, ri.quantity_per_unit, i.key AS item_key, i.name AS item_name, i.base_price,
                (SELECT r2.business_type FROM recipes r2 WHERE r2.output_item_id = ri.item_id LIMIT 1) AS source_business_type
         FROM recipe_inputs ri
         JOIN items i ON i.id = ri.item_id
         WHERE ri.recipe_id = $1`,
        [biz.recipe_id],
      );
      recipeInputs = inputsRes.rows.map((r: Record<string, unknown>) => ({
        item_id: r.item_id as string,
        item_key: r.item_key as string,
        item_name: r.item_name as string,
        base_price: Number(r.base_price),
        qty_per_unit: Number(r.quantity_per_unit),
        source_business_type: (r.source_business_type as string) ?? null,
      }));
    }

    // Get current market price for output
    let outputMarketPrice = biz.output_item_key ? Number(biz.base_rate ?? 0) : 0;
    if (biz.output_item_id) {
      const priceRes = await query<{ current_price: string }>(
        `SELECT COALESCE(
           (SELECT AVG(ml.price_per_unit) FROM market_listings ml
            WHERE ml.item_id = $1 AND ml.status = 'open'
            AND ml.created_at > NOW() - INTERVAL '24 hours'),
           i.base_price
         )::numeric(18,2) AS current_price
         FROM items i WHERE i.id = $1`,
        [biz.output_item_id],
      );
      outputMarketPrice = Number(priceRes.rows[0]?.current_price ?? 0);
    }

    // Production forecast
    const tier = Number(biz.tier);
    const baseRate = biz.base_rate ? Number(biz.base_rate) : 0;
    const avgEfficiency =
      empRes.rows.length > 0
        ? empRes.rows.reduce((sum: number, e: Record<string, unknown>) => sum + Number(e.efficiency), 0) / empRes.rows.length
        : 0;
    const avgStress =
      empRes.rows.length > 0
        ? empRes.rows.reduce((sum: number, e: Record<string, unknown>) => sum + Number(e.stress), 0) / empRes.rows.length
        : 0;
    const productionPerTick = empRes.rows.length > 0
      ? calcProduction(baseRate, avgEfficiency, Number(biz.efficiency), avgStress)
      : 0;

    // Profit calculation
    const inputCostPerUnit = recipeInputs.reduce((sum, inp) => sum + inp.base_price * inp.qty_per_unit, 0);
    const profitPerUnit = outputMarketPrice - inputCostPerUnit;
    const dailyCost = Number(biz.location_daily_cost ?? 0) +
      empRes.rows.reduce((sum: number, e: Record<string, unknown>) => sum + Number(e.salary ?? 0), 0);

    return reply.send({
      data: {
        ...biz,
        storage_cap: storageCap(tier),
        max_employees: maxEmployees(tier),
        inventory: invRes.rows,
        employees: empRes.rows,
        production_per_tick: Math.round(productionPerTick * 100) / 100,
        recipe_info: biz.recipe_id ? {
          inputs: recipeInputs,
          output_market_price: outputMarketPrice,
          input_cost_per_unit: Math.round(inputCostPerUnit * 100) / 100,
          profit_per_unit: Math.round(profitPerUnit * 100) / 100,
          estimated_daily_production: Math.round(productionPerTick * 60 * 100) / 100,
          estimated_daily_revenue: Math.round(productionPerTick * 60 * outputMarketPrice * 100) / 100,
        } : null,
        costs: {
          location_rent: Number(biz.location_daily_cost ?? 0),
          salaries: empRes.rows.reduce((sum: number, e: Record<string, unknown>) => sum + Number(e.salary ?? 0), 0),
          total_daily: Math.round(dailyCost * 100) / 100,
        },
      },
    });
  });

  // POST /:id/upgrade — tier up
  app.post('/:id/upgrade', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const bizRes = await query<{ id: string; type: string; tier: number; owner_id: string }>(
      `SELECT id, type, tier, owner_id FROM businesses WHERE id = $1 AND owner_id = $2 AND status != 'shutdown'`,
      [id, req.player.id],
    );
    if (!bizRes.rows.length) {
      return reply.status(404).send({ error: 'Business not found' });
    }

    const biz = bizRes.rows[0];
    const cost = upgradeCost(biz.type as BusinessType, biz.tier);

    const playerRes = await query<{ cash: string }>(
      `SELECT cash FROM players WHERE id = $1`,
      [req.player.id],
    );
    if (Number(playerRes.rows[0].cash) < cost) {
      return reply.status(400).send({
        error: `Not enough cash. Need $${cost.toLocaleString()}, have $${Number(playerRes.rows[0].cash).toLocaleString()}`,
      });
    }

    const newTier = biz.tier + 1;
    await withTransaction(async (client) => {
      // Deduct cash
      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [cost, req.player.id],
      );
      // Award XP (handles level-up detection + logging)
      await awardXP(client, req.player.id, XP_REWARDS.UPGRADE);
      await checkAchievements(client, req.player.id);
      // Upgrade tier
      await client.query(
        `UPDATE businesses SET tier = $1 WHERE id = $2`,
        [newTier, id],
      );
      // Log activity
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount)
         VALUES ($1, $2, 'business_upgraded', $3, $4)`,
        [req.player.id, id, `Upgraded to Tier ${newTier}`, -cost],
      );
    });

    return reply.send({
      data: {
        id,
        new_tier: newTier,
        cost,
        storage_cap: storageCap(newTier),
        max_employees: maxEmployees(newTier),
        message: `Upgraded to Tier ${newTier}`,
      },
    });
  });

  // PATCH /:id/rename — rename business
  app.patch('/:id/rename', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { name } = z.object({ name: z.string().min(2).max(50) }).parse(req.body);

    const res = await query(
      `UPDATE businesses SET name = $1 WHERE id = $2 AND owner_id = $3 AND status != 'shutdown' RETURNING id, name`,
      [name, id, req.player.id],
    );
    if (!res.rows.length) return reply.status(404).send({ error: 'Business not found' });

    return reply.send({ data: { id, name, message: `Renamed to "${name}"` } });
  });

  // PATCH /:id/auto-sell — toggle auto-sell
  app.patch('/:id/auto-sell', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

    const res = await query(
      `UPDATE businesses SET auto_sell = $1 WHERE id = $2 AND owner_id = $3 AND status != 'shutdown' RETURNING id, auto_sell`,
      [enabled, id, req.player.id],
    );
    if (!res.rows.length) return reply.status(404).send({ error: 'Business not found' });

    return reply.send({ data: { id, auto_sell: res.rows[0].auto_sell, message: enabled ? 'Auto-sell enabled' : 'Auto-sell disabled' } });
  });

  // DELETE /:id — sell/close business
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const bizRes = await query<{ id: string; type: string; name: string; owner_id: string }>(
      `SELECT id, type, name, owner_id FROM businesses WHERE id = $1 AND owner_id = $2 AND status != 'shutdown'`,
      [id, req.player.id],
    );
    if (!bizRes.rows.length) {
      return reply.status(404).send({ error: 'Business not found' });
    }

    const biz = bizRes.rows[0];
    const refund = Math.floor(BUSINESS_TYPES[biz.type as BusinessType].cost * 0.5);

    await withTransaction(async (client) => {
      // Refund 50% of base cost
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [refund, req.player.id],
      );
      // Shut down business
      await client.query(
        `UPDATE businesses SET status = 'shutdown' WHERE id = $1`,
        [id],
      );
      // Return employees to pool
      await client.query(
        `UPDATE employees SET status = 'available', business_id = NULL WHERE business_id = $1 AND status IN ('active', 'training')`,
        [id],
      );
      // Log activity
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount)
         VALUES ($1, $2, 'business_closed', $3, $4)`,
        [req.player.id, id, `Closed "${biz.name}" (${biz.type})`, refund],
      );
    });

    return reply.send({
      data: {
        id,
        refund,
        message: `Business "${biz.name}" closed. Refunded $${refund.toLocaleString()}`,
      },
    });
  });
}
