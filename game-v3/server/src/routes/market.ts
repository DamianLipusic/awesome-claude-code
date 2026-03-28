import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { awardXP, XP_REWARDS } from '../lib/xp.js';
import { checkAchievements } from '../lib/achievements.js';
import type { PoolClient } from 'pg';

const BuySchema = z.object({
  listing_id: z.string().uuid(),
  quantity: z.number().positive().int(),
  business_id: z.string().uuid(),
});

const SellSchema = z.object({
  business_id: z.string().uuid(),
  item_id: z.string().uuid(),
  quantity: z.number().positive().int(),
});

const ListSchema = z.object({
  business_id: z.string().uuid(),
  item_id: z.string().uuid(),
  quantity: z.number().positive().int(),
  price_per_unit: z.number().positive(),
});

/** Get current market price for an item (avg of recent listings or fallback to base_price) */
async function getCurrentPrice(client: PoolClient, itemId: string): Promise<number> {
  const res = await client.query<{ current_price: string }>(
    `SELECT COALESCE(
       (SELECT AVG(ml.price_per_unit) FROM market_listings ml
        WHERE ml.item_id = $1 AND ml.status IN ('open','sold')
        AND ml.created_at > NOW() - INTERVAL '1 day'),
       (SELECT base_price FROM items WHERE id = $1)
     )::numeric(10,2) AS current_price`,
    [itemId],
  );
  return Number(res.rows[0]?.current_price ?? 0);
}

export async function marketRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // ─── GET / — list all open market listings ────────────────────
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    // Get active season
    const seasonRes = await query<{ id: string }>(
      `SELECT id FROM seasons WHERE status = 'active' LIMIT 1`,
    );
    if (!seasonRes.rows.length) {
      return reply.send({ data: [] });
    }
    const seasonId = seasonRes.rows[0].id;

    const res = await query(
      `SELECT ml.id, ml.seller_type, ml.quantity, ml.price_per_unit, ml.created_at,
              i.key AS item_key, i.name AS item_name, i.category, i.base_price, i.production_stage
       FROM market_listings ml
       JOIN items i ON i.id = ml.item_id
       WHERE ml.status = 'open' AND ml.season_id = $1
       ORDER BY i.production_stage, ml.price_per_unit`,
      [seasonId],
    );

    return reply.send({ data: res.rows });
  });

  // ─── GET /prices — current price index per item ───────────────
  app.get('/prices', async (_req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT i.key, i.name, i.base_price, i.category, i.production_stage,
              COALESCE(
                (SELECT AVG(ml.price_per_unit) FROM market_listings ml
                 WHERE ml.item_id = i.id AND ml.status IN ('open','sold')
                 AND ml.created_at > NOW() - INTERVAL '1 day'),
                i.base_price
              )::numeric(10,2) AS current_price
       FROM items i ORDER BY i.production_stage, i.key`,
    );

    return reply.send({ data: res.rows });
  });

  // ─── POST /buy — buy from a market listing ────────────────────
  app.post('/buy', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = BuySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { listing_id, quantity, business_id } = parsed.data;

    const result = await withTransaction(async (client) => {
      // Check listing exists and is open
      const listingRes = await client.query<{
        id: string;
        item_id: string;
        quantity: number;
        price_per_unit: string;
        season_id: string;
      }>(
        `SELECT id, item_id, quantity::int AS quantity, price_per_unit, season_id
         FROM market_listings WHERE id = $1 AND status = 'open' FOR UPDATE`,
        [listing_id],
      );
      if (!listingRes.rows.length) {
        throw new Error('Listing not found or no longer open');
      }
      const listing = listingRes.rows[0];

      if (quantity > listing.quantity) {
        throw { statusCode: 400, message: `Only ${listing.quantity} available on this listing` };
      }

      // Check business ownership
      const bizRes = await client.query<{ id: string }>(
        `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2 AND status != 'shutdown'`,
        [business_id, req.player.id],
      );
      if (!bizRes.rows.length) {
        throw new Error('Business not found or not owned by you');
      }

      const pricePerUnit = Number(listing.price_per_unit);
      const totalCost = quantity * pricePerUnit;

      // Check player cash
      const playerRes = await client.query<{ cash: string }>(
        `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
        [req.player.id],
      );
      const playerCash = Number(playerRes.rows[0].cash);
      if (playerCash < totalCost) {
        throw new Error(`Not enough cash. Need $${totalCost.toFixed(2)}, have $${playerCash.toFixed(2)}`);
      }

      // Deduct cash
      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [totalCost, req.player.id],
      );

      // Reduce listing quantity (or fill it)
      const newQty = listing.quantity - quantity;
      if (newQty <= 0) {
        await client.query(
          `UPDATE market_listings SET quantity = 0, status = 'sold' WHERE id = $1`,
          [listing_id],
        );
      } else {
        await client.query(
          `UPDATE market_listings SET quantity = $1 WHERE id = $2`,
          [newQty, listing_id],
        );
      }

      // Upsert inventory
      await client.query(
        `INSERT INTO inventory (business_id, item_id, amount, reserved, dirty_amount)
         VALUES ($1, $2, $3, 0, 0)
         ON CONFLICT (business_id, item_id) DO UPDATE SET amount = inventory.amount + $3, updated_at = NOW()`,
        [business_id, listing.item_id, quantity],
      );

      // Inventory log
      await client.query(
        `INSERT INTO inventory_log (business_id, item_id, delta, reason)
         VALUES ($1, $2, $3, 'purchase')`,
        [business_id, listing.item_id, quantity],
      );

      // Get item name for response
      const itemRes = await client.query<{ name: string }>(
        `SELECT name FROM items WHERE id = $1`,
        [listing.item_id],
      );
      const itemName = itemRes.rows[0]?.name ?? 'Unknown';

      // Activity log
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount)
         VALUES ($1, $2, 'PURCHASE', $3, $4)`,
        [req.player.id, business_id, `Bought ${quantity} ${itemName} for $${totalCost.toFixed(2)}`, -totalCost],
      );

      return { bought: quantity, total_cost: totalCost, item_name: itemName };
    });

    return reply.send({ data: result });
  });

  // ─── POST /sell — sell inventory at market price ──────────────
  app.post('/sell', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = SellSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { business_id, item_id, quantity } = parsed.data;

    const result = await withTransaction(async (client) => {
      // Check business ownership
      const bizRes = await client.query<{ id: string }>(
        `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2 AND status != 'shutdown'`,
        [business_id, req.player.id],
      );
      if (!bizRes.rows.length) {
        throw new Error('Business not found or not owned by you');
      }

      // Check inventory
      const invRes = await client.query<{ amount: string; reserved: string }>(
        `SELECT amount, reserved FROM inventory WHERE business_id = $1 AND item_id = $2 FOR UPDATE`,
        [business_id, item_id],
      );
      if (!invRes.rows.length) {
        throw new Error('Item not found in inventory');
      }
      const available = Number(invRes.rows[0].amount) - Number(invRes.rows[0].reserved);
      if (available < quantity) {
        throw new Error(`Not enough available. Have ${available}, need ${quantity}`);
      }

      // Get current price + apply 95% modifier for player direct sell
      const currentPrice = await getCurrentPrice(client, item_id);
      const sellPrice = Math.round(currentPrice * 0.95 * 100) / 100;
      const revenue = Math.round(quantity * sellPrice * 100) / 100;

      // Add revenue to player cash
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [revenue, req.player.id],
      );

      // Deduct inventory
      await client.query(
        `UPDATE inventory SET amount = amount - $1, updated_at = NOW() WHERE business_id = $2 AND item_id = $3`,
        [quantity, business_id, item_id],
      );

      // Inventory log
      await client.query(
        `INSERT INTO inventory_log (business_id, item_id, delta, reason)
         VALUES ($1, $2, $3, 'sale')`,
        [business_id, item_id, -quantity],
      );

      // Get item name
      const itemRes = await client.query<{ name: string }>(
        `SELECT name FROM items WHERE id = $1`,
        [item_id],
      );
      const itemName = itemRes.rows[0]?.name ?? 'Unknown';

      // Activity log
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount)
         VALUES ($1, $2, 'SALE', $3, $4)`,
        [req.player.id, business_id, `Sold ${quantity} ${itemName} for $${revenue.toFixed(2)}`, revenue],
      );

      // Award XP (handles level-up detection + logging)
      const xpGain = XP_REWARDS.SELL_PER_1000 * Math.floor(revenue / 1000);
      if (xpGain > 0) {
        await awardXP(client, req.player.id, xpGain);
      }
      await checkAchievements(client, req.player.id);

      // Reputation: business rep +1 per $1000 sold
      const repGain = Math.floor(revenue / 1000);
      if (repGain > 0) {
        await client.query('UPDATE players SET rep_business = LEAST(100, rep_business + $1) WHERE id = $2', [repGain, req.player.id]);
      }

      return { sold: quantity, revenue, price_per_unit: sellPrice };
    });

    return reply.send({ data: result });
  });

  // ─── Bulk Orders ──────────────────────────────────────────────

  const BulkOrderSchema = z.object({
    business_id: z.string().uuid(),
    item_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    max_price_per_unit: z.number().positive(),
  });

  // POST /bulk-order — place a standing buy order
  app.post('/bulk-order', async (req: FastifyRequest, reply: FastifyReply) => {
    const { business_id, item_id, quantity, max_price_per_unit } = BulkOrderSchema.parse(req.body);
    const playerId = req.player.id;

    // Verify business
    const bizRes = await query("SELECT id FROM businesses WHERE id = $1 AND owner_id = $2 AND status = 'active'", [business_id, playerId]);
    if (!bizRes.rows.length) return reply.status(404).send({ error: 'Business not found' });

    // Verify item
    const itemRes = await query<{ name: string }>('SELECT name FROM items WHERE id = $1', [item_id]);
    if (!itemRes.rows.length) return reply.status(404).send({ error: 'Item not found' });

    const res = await query(
      `INSERT INTO bulk_orders (player_id, business_id, item_id, quantity_wanted, max_price_per_unit)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [playerId, business_id, item_id, quantity, max_price_per_unit],
    );

    await query("INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'BULK_ORDER', $2, 0)",
      [playerId, `Placed bulk order: ${quantity} ${itemRes.rows[0].name} at max $${max_price_per_unit}/unit`]);

    return reply.send({ data: { order_id: res.rows[0].id, message: `Bulk order placed for ${quantity} ${itemRes.rows[0].name}` } });
  });

  // GET /bulk-orders — active bulk orders (all players, for sellers to fill)
  app.get('/bulk-orders', async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(`
      SELECT bo.id, bo.quantity_wanted, bo.quantity_filled, bo.max_price_per_unit, bo.status, bo.created_at, bo.expires_at,
             i.key AS item_key, i.name AS item_name, p.username AS buyer_name
      FROM bulk_orders bo
      JOIN items i ON i.id = bo.item_id
      JOIN players p ON p.id = bo.player_id
      WHERE bo.status = 'open' AND bo.expires_at > NOW()
      ORDER BY bo.max_price_per_unit DESC
    `);
    return reply.send({ data: res.rows });
  });

  // GET /my-bulk-orders — my own bulk orders
  app.get('/my-bulk-orders', async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(`
      SELECT bo.*, i.name AS item_name
      FROM bulk_orders bo JOIN items i ON i.id = bo.item_id
      WHERE bo.player_id = $1 ORDER BY bo.created_at DESC LIMIT 20
    `, [req.player.id]);
    return reply.send({ data: res.rows });
  });

  // POST /bulk-orders/:id/fill — fill someone's bulk order
  app.post('/bulk-orders/:id/fill', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { business_id, quantity } = z.object({ business_id: z.string().uuid(), quantity: z.number().int().positive() }).parse(req.body);
    const playerId = req.player.id;

    const result = await withTransaction(async (client) => {
      const orderRes = await client.query("SELECT * FROM bulk_orders WHERE id = $1 AND status = 'open' FOR UPDATE", [id]);
      if (!orderRes.rows.length) throw { statusCode: 404, message: 'Order not found or closed' };
      const order = orderRes.rows[0];

      if (order.player_id === playerId) throw { statusCode: 400, message: "Can't fill your own order" };

      const remaining = Number(order.quantity_wanted) - Number(order.quantity_filled);
      const fillQty = Math.min(quantity, remaining);
      if (fillQty <= 0) throw { statusCode: 400, message: 'Order already filled' };

      // Check seller inventory
      const invRes = await client.query('SELECT amount, reserved FROM inventory WHERE business_id = $1 AND item_id = $2 FOR UPDATE', [business_id, order.item_id]);
      const available = invRes.rows.length ? Number(invRes.rows[0].amount) - Number(invRes.rows[0].reserved) : 0;
      if (available < fillQty) throw { statusCode: 400, message: `Only ${available} available` };

      const totalPayment = fillQty * Number(order.max_price_per_unit);

      // Check buyer cash
      const buyerCash = await client.query('SELECT cash FROM players WHERE id = $1 FOR UPDATE', [order.player_id]);
      if (Number(buyerCash.rows[0]?.cash ?? 0) < totalPayment) throw { statusCode: 400, message: 'Buyer lacks funds' };

      // Transfer: seller inventory → buyer business, buyer cash → seller
      await client.query('UPDATE inventory SET amount = amount - $1, updated_at = NOW() WHERE business_id = $2 AND item_id = $3', [fillQty, business_id, order.item_id]);
      await client.query(`INSERT INTO inventory (business_id, item_id, amount) VALUES ($1, $2, $3)
        ON CONFLICT (business_id, item_id) DO UPDATE SET amount = inventory.amount + $3, updated_at = NOW()`, [order.business_id, order.item_id, fillQty]);
      await client.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [totalPayment, order.player_id]);
      await client.query('UPDATE players SET cash = cash + $1 WHERE id = $2', [totalPayment, playerId]);

      // Update order
      const newFilled = Number(order.quantity_filled) + fillQty;
      const done = newFilled >= Number(order.quantity_wanted);
      await client.query('UPDATE bulk_orders SET quantity_filled = $1, status = $2 WHERE id = $3',
        [newFilled, done ? 'filled' : 'open', id]);

      return { filled: fillQty, total_payment: totalPayment, order_complete: done };
    });

    return reply.send({ data: result });
  });

  // DELETE /bulk-orders/:id — cancel own order
  app.delete('/bulk-orders/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const res = await query(
      "UPDATE bulk_orders SET status = 'cancelled' WHERE id = $1 AND player_id = $2 AND status = 'open' RETURNING id",
      [id, req.player.id],
    );
    if (!res.rows.length) return reply.status(404).send({ error: 'Order not found' });
    return reply.send({ data: { message: 'Bulk order cancelled' } });
  });

  // ─── GET /history/:itemKey — price history (24h) ──────────────
  app.get('/history/:itemKey', async (req: FastifyRequest, reply: FastifyReply) => {
    const { itemKey } = req.params as { itemKey: string };
    const res = await query(
      `SELECT price, recorded_at FROM price_history
       WHERE item_key = $1 AND recorded_at > NOW() - INTERVAL '24 hours'
       ORDER BY recorded_at ASC`,
      [itemKey],
    );
    return reply.send({ data: res.rows });
  });

  // ─── POST /list — create a player market listing ──────────────
  app.post('/list', async (req: FastifyRequest, reply: FastifyReply) => {
    const { business_id, item_id, quantity, price_per_unit } = ListSchema.parse(req.body);
    const playerId = req.player.id;

    const result = await withTransaction(async (client) => {
      // Verify business ownership
      const bizRes = await client.query(
        'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2 AND status != $3',
        [business_id, playerId, 'shutdown'],
      );
      if (!bizRes.rows.length) throw { statusCode: 404, message: 'Business not found' };

      // Check inventory
      const invRes = await client.query<{ amount: string; reserved: string }>(
        'SELECT amount, reserved FROM inventory WHERE business_id = $1 AND item_id = $2 FOR UPDATE',
        [business_id, item_id],
      );
      if (!invRes.rows.length) throw { statusCode: 400, message: 'No inventory of this item' };
      const available = Number(invRes.rows[0].amount) - Number(invRes.rows[0].reserved);
      if (available < quantity) throw { statusCode: 400, message: `Not enough inventory. Available: ${available}` };

      // Reserve the quantity
      await client.query(
        'UPDATE inventory SET reserved = reserved + $1, updated_at = NOW() WHERE business_id = $2 AND item_id = $3',
        [quantity, business_id, item_id],
      );

      // Get season
      const seasonRes = await client.query<{ id: string }>("SELECT id FROM seasons WHERE status = 'active' LIMIT 1");
      const seasonId = seasonRes.rows[0]?.id ?? null;

      // Create listing
      const listRes = await client.query(
        `INSERT INTO market_listings (season_id, seller_type, seller_id, item_id, quantity, price_per_unit, expires_at)
         VALUES ($1, 'player', $2, $3, $4, $5, NOW() + INTERVAL '7 days') RETURNING id`,
        [seasonId, playerId, item_id, quantity, price_per_unit],
      );

      // Get item name
      const itemRes = await client.query<{ name: string }>('SELECT name FROM items WHERE id = $1', [item_id]);
      const itemName = itemRes.rows[0]?.name ?? 'Unknown';

      // Activity log
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount) VALUES ($1, $2, 'MARKET_LIST', $3, 0)`,
        [playerId, business_id, `Listed ${quantity} ${itemName} at $${price_per_unit}/unit`],
      );

      // Inventory log
      await client.query(
        `INSERT INTO inventory_log (business_id, item_id, delta, reason) VALUES ($1, $2, $3, 'market_list_reserved')`,
        [business_id, item_id, -quantity],
      );

      return { listing_id: listRes.rows[0].id, item: itemName, quantity, price_per_unit };
    });

    return reply.send({ data: result });
  });

  // ─── GET /my-listings — player's own listings ─────────────────
  app.get('/my-listings', async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT ml.id, ml.quantity, ml.price_per_unit, ml.status, ml.created_at, ml.expires_at,
              i.key AS item_key, i.name AS item_name, i.category
       FROM market_listings ml
       JOIN items i ON i.id = ml.item_id
       WHERE ml.seller_id = $1 AND ml.seller_type = 'player'
       ORDER BY ml.created_at DESC
       LIMIT 50`,
      [req.player.id],
    );
    return reply.send({ data: res.rows });
  });

  // ─── DELETE /listings/:id — cancel own listing ────────────────
  app.delete('/listings/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const playerId = req.player.id;

    const result = await withTransaction(async (client) => {
      // Find listing
      const listRes = await client.query(
        `SELECT ml.id, ml.item_id, ml.quantity, ml.seller_id, ml.status,
                (SELECT b.id FROM businesses b
                 JOIN inventory inv ON inv.business_id = b.id AND inv.item_id = ml.item_id
                 WHERE b.owner_id = $2 AND b.status != 'shutdown' LIMIT 1) AS return_biz_id
         FROM market_listings ml WHERE ml.id = $1 FOR UPDATE`,
        [id, playerId],
      );
      if (!listRes.rows.length) throw { statusCode: 404, message: 'Listing not found' };
      const listing = listRes.rows[0];
      if (listing.seller_id !== playerId) throw { statusCode: 403, message: 'Not your listing' };
      if (listing.status !== 'open') throw { statusCode: 400, message: 'Listing already ' + listing.status };

      // Cancel listing
      await client.query("UPDATE market_listings SET status = 'cancelled' WHERE id = $1", [id]);

      // Return reserved inventory
      if (listing.return_biz_id) {
        await client.query(
          `UPDATE inventory SET reserved = GREATEST(0, reserved - $1), amount = amount, updated_at = NOW()
           WHERE business_id = $2 AND item_id = $3`,
          [listing.quantity, listing.return_biz_id, listing.item_id],
        );
      }

      return { cancelled: true, quantity_returned: Number(listing.quantity) };
    });

    return reply.send({ data: result });
  });
}
