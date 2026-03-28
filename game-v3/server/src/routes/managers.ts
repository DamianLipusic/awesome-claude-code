import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

// Manager automation config schema
const ManagerConfigSchema = z.object({
  auto_buy_inputs: z.boolean().default(false),       // Auto-buy recipe inputs from market
  auto_sell_output: z.boolean().default(false),       // Auto-sell produced items
  auto_train_workers: z.boolean().default(false),     // Auto-train idle workers (basic training)
  target_input_stock: z.number().min(0).default(20),  // Keep this many input units in stock
  min_sell_price_pct: z.number().min(50).max(200).default(90), // Min sell price as % of market
  max_buy_price_pct: z.number().min(50).max(200).default(110), // Max buy price as % of market
  risk_mode: z.enum(['conservative', 'balanced', 'aggressive']).default('balanced'),
});

export type ManagerConfig = z.infer<typeof ManagerConfigSchema>;

const MANAGER_COST_PER_DAY = 500; // $500/day for a manager

export async function managerRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /businesses/:id/manager — get manager config
  app.get('/businesses/:id/manager', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const res = await query(
      `SELECT b.automation_json, b.name, b.type
       FROM businesses b WHERE b.id = $1 AND b.owner_id = $2 AND b.status != 'shutdown'`,
      [id, req.player.id],
    );
    if (!res.rows.length) return reply.status(404).send({ error: 'Business not found' });

    const config = res.rows[0].automation_json as ManagerConfig | Record<string, never>;
    const hasManager = config && Object.keys(config).length > 0 && config.auto_buy_inputs !== undefined;

    return reply.send({
      data: {
        business_id: id,
        business_name: res.rows[0].name,
        business_type: res.rows[0].type,
        has_manager: hasManager,
        config: hasManager ? config : null,
        cost_per_day: MANAGER_COST_PER_DAY,
      },
    });
  });

  // POST /businesses/:id/manager — assign/update manager config
  app.post('/businesses/:id/manager', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const config = ManagerConfigSchema.parse(req.body);
    const playerId = req.player.id;

    // Check phase >= 2
    const playerRes = await query<{ unlock_phase: number }>(
      'SELECT unlock_phase FROM players WHERE id = $1', [playerId],
    );
    if ((playerRes.rows[0]?.unlock_phase ?? 1) < 2) {
      return reply.status(400).send({ error: 'Managers unlock at Phase 2.' });
    }

    // Check business ownership
    const bizRes = await query(
      "SELECT id, name FROM businesses WHERE id = $1 AND owner_id = $2 AND status != 'shutdown'",
      [id, playerId],
    );
    if (!bizRes.rows.length) return reply.status(404).send({ error: 'Business not found' });

    // Save config
    await query(
      'UPDATE businesses SET automation_json = $1 WHERE id = $2',
      [JSON.stringify(config), id],
    );

    await query(
      "INSERT INTO activity_log (player_id, business_id, type, message, amount) VALUES ($1, $2, 'MANAGER_ASSIGNED', $3, 0)",
      [playerId, id, `Manager assigned to "${bizRes.rows[0].name}" (${config.risk_mode} mode)`],
    );

    return reply.send({
      data: {
        business_id: id,
        config,
        message: `Manager configured for "${bizRes.rows[0].name}"`,
      },
    });
  });

  // DELETE /businesses/:id/manager — remove manager
  app.delete('/businesses/:id/manager', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const res = await query(
      "UPDATE businesses SET automation_json = '{}'::jsonb WHERE id = $1 AND owner_id = $2 AND status != 'shutdown' RETURNING name",
      [id, req.player.id],
    );
    if (!res.rows.length) return reply.status(404).send({ error: 'Business not found' });

    return reply.send({ data: { business_id: id, message: `Manager removed from "${res.rows[0].name}"` } });
  });
}

// ─── Manager Action Engine (called during production tick) ────────

export async function executeManagerActions(dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>): Promise<number> {
  let actionsExecuted = 0;

  // Find businesses with active managers
  const managedBiz = await dbQuery(`
    SELECT b.id, b.owner_id, b.type, b.name, b.automation_json, b.recipe_id,
           r.output_item_id,
           (SELECT p.cash FROM players p WHERE p.id = b.owner_id)::numeric AS owner_cash
    FROM businesses b
    LEFT JOIN recipes r ON r.id = b.recipe_id
    WHERE b.status = 'active'
      AND b.automation_json != '{}'::jsonb
      AND b.automation_json ? 'auto_buy_inputs'
  `);

  for (const biz of managedBiz.rows) {
    const config = biz.automation_json as ManagerConfig;
    if (!config) continue;

    const bizId = biz.id as string;
    const ownerId = biz.owner_id as string;
    const cash = Number(biz.owner_cash ?? 0);
    const recipeId = biz.recipe_id as string | null;

    // ─── Auto-buy inputs ────────────────────────────────────
    if (config.auto_buy_inputs && recipeId) {
      const inputsRes = await dbQuery(
        `SELECT ri.item_id, ri.quantity_per_unit, i.key, i.name, i.base_price,
                COALESCE((SELECT inv.amount FROM inventory inv WHERE inv.business_id = $1 AND inv.item_id = ri.item_id), 0)::numeric AS current_stock
         FROM recipe_inputs ri JOIN items i ON i.id = ri.item_id WHERE ri.recipe_id = $2`,
        [bizId, recipeId],
      );

      for (const input of inputsRes.rows) {
        const currentStock = Number(input.current_stock);
        const target = config.target_input_stock;
        if (currentStock >= target) continue;

        const needed = target - currentStock;
        const maxPrice = Number(input.base_price) * (config.max_buy_price_pct / 100);

        // Find cheapest AI listing
        const listingRes = await dbQuery(
          `SELECT id, quantity, price_per_unit FROM market_listings
           WHERE item_id = $1 AND status = 'open' AND price_per_unit <= $2
           ORDER BY price_per_unit ASC LIMIT 1`,
          [input.item_id, maxPrice],
        );
        if (!listingRes.rows.length) continue;

        const listing = listingRes.rows[0];
        const buyQty = Math.min(needed, Number(listing.quantity));
        const totalCost = buyQty * Number(listing.price_per_unit);
        if (totalCost > cash || totalCost <= 0) continue;

        // Execute purchase
        await dbQuery('UPDATE players SET cash = cash - $1 WHERE id = $2', [totalCost, ownerId]);
        await dbQuery('UPDATE market_listings SET quantity = quantity - $1 WHERE id = $2', [buyQty, listing.id]);
        if (Number(listing.quantity) - buyQty <= 0) {
          await dbQuery("UPDATE market_listings SET status = 'sold' WHERE id = $1", [listing.id]);
        }
        await dbQuery(
          `INSERT INTO inventory (business_id, item_id, amount) VALUES ($1, $2, $3)
           ON CONFLICT (business_id, item_id) DO UPDATE SET amount = inventory.amount + $3, updated_at = NOW()`,
          [bizId, input.item_id, buyQty],
        );
        await dbQuery(
          "INSERT INTO activity_log (player_id, business_id, type, message, amount) VALUES ($1, $2, 'MANAGER_BUY', $3, $4)",
          [ownerId, bizId, `Manager bought ${buyQty} ${input.name} for $${totalCost.toFixed(2)}`, -totalCost],
        );
        actionsExecuted++;
      }
    }

    // ─── Auto-sell output ───────────────────────────────────
    if (config.auto_sell_output && biz.output_item_id) {
      const invRes = await dbQuery(
        'SELECT amount, reserved FROM inventory WHERE business_id = $1 AND item_id = $2',
        [bizId, biz.output_item_id],
      );
      if (invRes.rows.length) {
        const sellable = Number(invRes.rows[0].amount) - Number(invRes.rows[0].reserved);
        if (sellable > 0) {
          // Get market price
          const priceRes = await dbQuery(
            `SELECT COALESCE(
              (SELECT AVG(price_per_unit) FROM market_listings WHERE item_id = $1 AND status = 'open' AND created_at > NOW() - INTERVAL '24 hours'),
              (SELECT base_price FROM items WHERE id = $1)
            )::numeric(18,2) AS price`,
            [biz.output_item_id],
          );
          const marketPrice = Number(priceRes.rows[0]?.price ?? 0);
          const minPrice = marketPrice * (config.min_sell_price_pct / 100);
          const sellPrice = Math.max(minPrice, marketPrice * 0.95);
          const revenue = Math.round(sellable * sellPrice * 100) / 100;

          await dbQuery('UPDATE inventory SET amount = amount - $1, updated_at = NOW() WHERE business_id = $2 AND item_id = $3', [sellable, bizId, biz.output_item_id]);
          await dbQuery('UPDATE players SET cash = cash + $1 WHERE id = $2', [revenue, ownerId]);
          await dbQuery(
            "INSERT INTO activity_log (player_id, business_id, type, message, amount) VALUES ($1, $2, 'MANAGER_SELL', $3, $4)",
            [ownerId, bizId, `Manager sold ${sellable} units for $${revenue.toFixed(2)}`, revenue],
          );
          actionsExecuted++;
        }
      }
    }
  }

  return actionsExecuted;
}
