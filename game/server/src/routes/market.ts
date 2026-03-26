import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { LISTING_FEE_PERCENT } from '../lib/constants';
import { emitToMarket } from '../websocket/handler';
import { recalculateNetWorth } from '../lib/networth';

// ─── Input schemas ────────────────────────────────────────────

const CreateListingSchema = z.object({
  resource_id: z.string().uuid(),
  city: z.string().min(1),
  listing_type: z.enum(['PLAYER_SELL', 'PLAYER_BUY']),
  quantity: z.number().int().positive(),
  price_per_unit: z.number().positive(),
  min_quantity: z.number().int().positive().optional(),
  duration_hours: z.union([z.literal(24), z.literal(72), z.literal(168)]),
  is_anonymous: z.boolean().optional().default(false),
  business_id: z.string().uuid().optional(),
});

const BuyListingSchema = z.object({
  quantity: z.number().int().positive(),
});

// ─── Route plugin ─────────────────────────────────────────────

export async function marketRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /market/ai-prices — AI baseline prices
  fastify.get(
    '/ai-prices',
    { preHandler: [requireAuth] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await query(
        `SELECT id, name AS resource_type, category, base_value, current_ai_price FROM resources ORDER BY category, name`,
      );
      return reply.send({ data: result.rows });
    },
  );

  // GET /market/resources
  fastify.get(
    '/resources',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerSeasonId = request.player.season_id;
      const result = await query<{
        id: string;
        name: string;
        category: string;
        tier: number;
        illegal: boolean;
        current_ai_price: number;
      }>(
        `SELECT id, name, category, tier, illegal, current_ai_price
         FROM resources
         WHERE season_id = $1
         ORDER BY category, tier, name`,
        [playerSeasonId],
      );
      return reply.send({ data: result.rows });
    },
  );

  // GET /market/stats — Market statistics per city (24h volume, price change, high/low)
  fastify.get(
    '/stats',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerSeasonId = request.player.season_id;
      const { city } = request.query as { city?: string };

      if (!city) {
        return reply.status(400).send({ error: 'city query param is required' });
      }

      const result = await query(
        `SELECT
           r.id,
           r.name AS resource_name,
           r.base_value,
           r.current_ai_price,
           r.category,
           COALESCE(SUM(
             CASE WHEN ml.filled_at > NOW() - INTERVAL '24 hours'
               THEN ml.quantity - ml.quantity_remaining
               ELSE 0
             END
           ), 0)::int AS volume_24h,
           (SELECT price FROM price_history WHERE resource_id = r.id ORDER BY recorded_at DESC LIMIT 1) AS current_price,
           (SELECT price FROM price_history WHERE resource_id = r.id AND recorded_at < NOW() - INTERVAL '24 hours' ORDER BY recorded_at DESC LIMIT 1) AS price_24h_ago,
           (SELECT MAX(price) FROM price_history WHERE resource_id = r.id AND recorded_at > NOW() - INTERVAL '24 hours') AS high_24h,
           (SELECT MIN(price) FROM price_history WHERE resource_id = r.id AND recorded_at > NOW() - INTERVAL '24 hours') AS low_24h
         FROM resources r
         LEFT JOIN market_listings ml ON ml.resource_id = r.id AND ml.city = $1
         WHERE r.season_id = $2
         GROUP BY r.id, r.name, r.base_value, r.current_ai_price, r.category
         ORDER BY r.category, r.name`,
        [city, playerSeasonId],
      );

      const stats = result.rows.map((row: any) => {
        const currentPrice = row.current_price ?? row.current_ai_price;
        const price24hAgo = row.price_24h_ago ?? row.current_ai_price;
        const priceChangePercent = price24hAgo > 0
          ? ((currentPrice - price24hAgo) / price24hAgo) * 100
          : 0;

        return {
          resource_id: row.id,
          resource_name: row.resource_name,
          category: row.category,
          base_value: row.base_value,
          current_price: currentPrice,
          volume_24h: row.volume_24h,
          price_change_percent: Math.round(priceChangePercent * 10) / 10,
          high_24h: row.high_24h ?? currentPrice,
          low_24h: row.low_24h ?? currentPrice,
        };
      });

      return reply.send({ data: stats });
    },
  );

  // GET /market/recent-trades — Recent trade activity for a city
  fastify.get(
    '/recent-trades',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerSeasonId = request.player.season_id;
      const { city, limit: limitStr } = request.query as { city?: string; limit?: string };

      if (!city) {
        return reply.status(400).send({ error: 'city query param is required' });
      }

      const tradeLimit = Math.min(Math.max(parseInt(limitStr ?? '10', 10) || 10, 1), 50);

      const result = await query(
        `SELECT
           ml.id,
           r.name AS resource_name,
           (ml.quantity - ml.quantity_remaining)::int AS traded_quantity,
           ml.price_per_unit,
           ml.listing_type,
           ml.filled_at,
           ml.city,
           CASE WHEN ml.is_anonymous THEN 'Anonymous' ELSE p.username END AS trader
         FROM market_listings ml
         JOIN resources r ON ml.resource_id = r.id
         LEFT JOIN players p ON ml.seller_id = p.id
         WHERE ml.city = $1
           AND ml.season_id = $2
           AND ml.status IN ('FILLED', 'PARTIALLY_FILLED')
           AND ml.filled_at IS NOT NULL
         ORDER BY ml.filled_at DESC
         LIMIT $3`,
        [city, playerSeasonId, tradeLimit],
      );

      return reply.send({ data: result.rows });
    },
  );

  // GET /market/listings
  fastify.get(
    '/listings',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerSeasonId = request.player.season_id;
      const { city, resource_id, listing_type, limit, offset } = request.query as {
        city?: string;
        resource_id?: string;
        listing_type?: string;
        limit?: string;
        offset?: string;
      };
      const limitVal = Math.min(Math.max(parseInt(limit ?? '100', 10) || 100, 1), 200);
      const offsetVal = Math.max(parseInt(offset ?? '0', 10) || 0, 0);

      if (!city) {
        return reply.status(400).send({ error: 'city query param is required' });
      }

      const params: unknown[] = [playerSeasonId, city];
      let paramIndex = 3;
      const conditions: string[] = [
        'ml.season_id = $1',
        'ml.city = $2',
        "ml.status = 'OPEN'",
        'ml.quantity_remaining > 0',
      ];

      if (resource_id) {
        conditions.push(`ml.resource_id = $${paramIndex++}`);
        params.push(resource_id);
      }
      if (listing_type) {
        conditions.push(`ml.listing_type = $${paramIndex++}`);
        params.push(listing_type);
      }

      const where = conditions.join(' AND ');

      const result = await query(
        `SELECT
           ml.id,
           ml.listing_type,
           ml.seller_id,
           CASE
             WHEN ml.is_anonymous THEN 'Anonymous'
             ELSE p.username
           END AS seller_username,
           ml.business_id,
           ml.resource_id,
           r.name AS resource_name,
           r.category AS resource_category,
           ml.city,
           ml.quantity,
           ml.quantity_remaining,
           ml.price_per_unit,
           ml.min_quantity,
           ml.expires_at,
           ml.is_anonymous,
           ml.status,
           ml.created_at
         FROM market_listings ml
         JOIN resources r ON r.id = ml.resource_id
         LEFT JOIN players p ON p.id = ml.seller_id
         WHERE ${where}
         ORDER BY
           CASE WHEN ml.listing_type IN ('AI_SELL', 'AI_BUY') THEN 0 ELSE 1 END,
           CASE
             WHEN ml.listing_type IN ('PLAYER_BUY', 'AI_BUY') THEN ml.price_per_unit END DESC,
           CASE
             WHEN ml.listing_type IN ('PLAYER_SELL', 'AI_SELL') THEN ml.price_per_unit END ASC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limitVal, offsetVal],
      );

      return reply.send({ data: result.rows });
    },
  );

  // POST /market/listings
  fastify.post(
    '/listings',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id; const playerSeasonId = request.player.season_id;
      const parsed = CreateListingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0].message });
      }
      const body = parsed.data;

      const {
        resource_id,
        city,
        listing_type,
        quantity,
        price_per_unit,
        min_quantity,
        duration_hours,
        is_anonymous,
        business_id,
      } = body;

      const total_value = quantity * price_per_unit;
      const anonymousSurcharge = is_anonymous ? 0.01 : 0;
      const listing_fee = total_value * (LISTING_FEE_PERCENT + anonymousSurcharge);

      try {
        const listing = await withTransaction(async (client) => {
          // Resolve resource name (inventory uses name as key)
          const resourceRow = await client.query<{ name: string }>(
            `SELECT name FROM resources WHERE id = $1`,
            [resource_id],
          );
          if (!resourceRow.rows.length) {
            throw Object.assign(new Error('Resource not found'), { statusCode: 404 });
          }
          const resourceName = resourceRow.rows[0].name;

          // Lock player row
          const playerRow = await client.query<{ cash: number }>(
            `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
            [playerId],
          );
          if (!playerRow.rows.length) {
            throw Object.assign(new Error('Player not found'), { statusCode: 404 });
          }
          const playerCash = playerRow.rows[0].cash;

          if (listing_type === 'PLAYER_SELL') {
            // Requires a business_id
            if (!business_id) {
              throw Object.assign(
                new Error('business_id is required for PLAYER_SELL listings'),
                { statusCode: 400 },
              );
            }
            // Validate business ownership
            const bizRow = await client.query<{ id: string; inventory: Record<string, number> }>(
              `SELECT id, inventory FROM businesses WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
              [business_id, playerId],
            );
            if (!bizRow.rows.length) {
              throw Object.assign(new Error('Business not found or not owned by player'), { statusCode: 403 });
            }
            const biz = bizRow.rows[0];
            // Inventory keyed by resource name
            const inventoryQty: number = (biz.inventory as Record<string, number>)[resourceName] ?? 0;
            if (inventoryQty < quantity) {
              throw Object.assign(
                new Error(`Insufficient inventory: have ${inventoryQty}, need ${quantity}`),
                { statusCode: 400 },
              );
            }
            // Deduct from business inventory using resource name as key
            await client.query(
              `UPDATE businesses
               SET inventory = jsonb_set(
                 inventory,
                 $1,
                 to_jsonb((COALESCE((inventory->$2)::int, 0) - $3)::int)
               )
               WHERE id = $4`,
              [`{${resourceName}}`, resourceName, quantity, business_id],
            );
          } else {
            // PLAYER_BUY: reserve cash = total_value + listing_fee
            const required = total_value + listing_fee;
            if (playerCash < required) {
              throw Object.assign(
                new Error(`Insufficient cash: need ${required.toFixed(2)}, have ${playerCash}`),
                { statusCode: 400 },
              );
            }
          }

          // Deduct listing fee from player cash
          if (playerCash < listing_fee) {
            throw Object.assign(
              new Error(`Insufficient cash to cover listing fee of ${listing_fee.toFixed(2)}`),
              { statusCode: 400 },
            );
          }
          await client.query(
            `UPDATE players SET cash = cash - $1 WHERE id = $2`,
            [listing_fee, playerId],
          );

          // Insert listing
          const insertResult = await client.query(
            `INSERT INTO market_listings
               (season_id, listing_type, seller_id, business_id, resource_id, city,
                quantity, quantity_remaining, price_per_unit, min_quantity,
                expires_at, is_anonymous, status)
             VALUES
               ($1, $2, $3, $4, $5, $6,
                $7, $7, $8, $9,
                NOW() + ($10 || ' hours')::interval, $11, 'OPEN')
             RETURNING *`,
            [
              playerSeasonId,
              listing_type,
              playerId,
              business_id ?? null,
              resource_id,
              city,
              quantity,
              price_per_unit,
              min_quantity ?? 1,
              duration_hours,
              is_anonymous,
            ],
          );

          return insertResult.rows[0];
        });

        return reply.status(201).send({ data: listing });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // POST /market/listings/:id/buy
  fastify.post(
    '/listings/:id/buy',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id; const playerSeasonId = request.player.season_id;
      const { id: listingId } = request.params as { id: string };

      const parsed = BuyListingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0].message });
      }
      const { quantity } = parsed.data;

      try {
        const result = await withTransaction(async (client) => {
          // Lock and fetch listing
          const listingRow = await client.query<{
            id: string;
            listing_type: string;
            seller_id: string | null;
            business_id: string | null;
            resource_id: string;
            quantity_remaining: number;
            min_quantity: number;
            price_per_unit: number;
            status: string;
            season_id: string;
            city: string;
          }>(
            `SELECT * FROM market_listings WHERE id = $1 AND season_id = $2 FOR UPDATE`,
            [listingId, playerSeasonId],
          );
          if (!listingRow.rows.length) {
            throw Object.assign(new Error('Listing not found'), { statusCode: 404 });
          }
          const listing = listingRow.rows[0];

          if (listing.status !== 'OPEN' && listing.status !== 'PARTIALLY_FILLED') {
            throw Object.assign(new Error('Listing is no longer open'), { statusCode: 400 });
          }
          if (listing.listing_type === 'AI_BUY' || listing.listing_type === 'PLAYER_BUY') {
            throw Object.assign(new Error('Cannot purchase a buy listing'), { statusCode: 400 });
          }
          if (listing.seller_id && listing.seller_id === playerId) {
            throw Object.assign(new Error('Cannot buy your own listing'), { statusCode: 400 });
          }
          if (quantity < listing.min_quantity) {
            throw Object.assign(
              new Error(`Quantity must be at least min_quantity (${listing.min_quantity})`),
              { statusCode: 400 },
            );
          }
          if (quantity > listing.quantity_remaining) {
            throw Object.assign(
              new Error(`Quantity exceeds available (${listing.quantity_remaining})`),
              { statusCode: 400 },
            );
          }

          const totalCost = quantity * listing.price_per_unit;

          // Lock and validate buyer cash
          const buyerRow = await client.query<{ cash: number }>(
            `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
            [playerId],
          );
          if (!buyerRow.rows.length) {
            throw Object.assign(new Error('Buyer not found'), { statusCode: 404 });
          }
          if (buyerRow.rows[0].cash < totalCost) {
            throw Object.assign(
              new Error(`Insufficient cash: need ${totalCost}, have ${buyerRow.rows[0].cash}`),
              { statusCode: 400 },
            );
          }

          // Deduct from buyer
          await client.query(
            `UPDATE players SET cash = cash - $1 WHERE id = $2`,
            [totalCost, playerId],
          );

          // Resolve resource name for inventory key
          const resRow = await client.query<{ name: string }>(
            `SELECT name FROM resources WHERE id = $1`,
            [listing.resource_id],
          );
          const resName = resRow.rows[0]?.name ?? listing.resource_id;

          // Credit resource to buyer's primary active business
          const bizRow = await client.query<{ id: string }>(
            `SELECT id FROM businesses
               WHERE owner_id = $1 AND season_id = $2 AND status = 'ACTIVE'
               ORDER BY established_at ASC
               LIMIT 1
               FOR UPDATE`,
            [playerId, playerSeasonId],
          );
          if (!bizRow.rows.length) {
            throw Object.assign(
              new Error('Buyer has no active business to receive inventory'),
              { statusCode: 400 },
            );
          }
          const buyerBizId = bizRow.rows[0].id;
          await client.query(
            `UPDATE businesses
               SET inventory = jsonb_set(
                 inventory,
                 $1,
                 to_jsonb((COALESCE((inventory->$2)::int, 0) + $3)::int)
               )
             WHERE id = $4`,
            [`{${resName}}`, resName, quantity, buyerBizId],
          );

          // Update listing quantity_remaining
          const newRemaining = listing.quantity_remaining - quantity;
          const newStatus = newRemaining === 0 ? 'FILLED' : 'PARTIALLY_FILLED';
          const filledAt = newRemaining === 0 ? new Date() : null;
          await client.query(
            `UPDATE market_listings
             SET quantity_remaining = $1,
                 status = $2,
                 filled_at = $3
             WHERE id = $4`,
            [newRemaining, newStatus, filledAt, listingId],
          );

          // Credit seller for PLAYER_SELL (listing fee already paid upfront, 0% deduction on sale)
          if (listing.listing_type === 'PLAYER_SELL' && listing.seller_id) {
            await client.query(
              `UPDATE players SET cash = cash + $1 WHERE id = $2`,
              [totalCost, listing.seller_id],
            );
          }

          // Insert price_history record
          await client.query(
            `INSERT INTO price_history (resource_id, season_id, price)
             VALUES ($1, $2, $3)`,
            [listing.resource_id, listing.season_id, listing.price_per_unit],
          );

          // Recalculate net worth for buyer (uses proper formula with inventory value)
          await recalculateNetWorth(playerId);

          // Recalculate net worth for seller if player listing
          if (listing.listing_type === 'PLAYER_SELL' && listing.seller_id) {
            await recalculateNetWorth(listing.seller_id);
          }

          // Emit WebSocket update to market channel
          try {
            emitToMarket(listing.city, listing.resource_id, {
              event: 'listing_updated',
              listing_id: listingId,
              quantity_remaining: newRemaining,
              status: newStatus,
            });
          } catch {
            // WebSocket emit is non-critical
          }

          return {
            listing_id: listingId,
            quantity_bought: quantity,
            total_cost: totalCost,
            listing_status: newStatus,
          };
        });

        return reply.send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // DELETE /market/listings/:id
  fastify.delete(
    '/listings/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id; const playerSeasonId = request.player.season_id;
      const { id: listingId } = request.params as { id: string };

      try {
        await withTransaction(async (client) => {
          const listingRow = await client.query<{
            id: string;
            seller_id: string | null;
            listing_type: string;
            business_id: string | null;
            resource_id: string;
            quantity_remaining: number;
            status: string;
          }>(
            `SELECT * FROM market_listings WHERE id = $1 AND season_id = $2 FOR UPDATE`,
            [listingId, playerSeasonId],
          );
          if (!listingRow.rows.length) {
            throw Object.assign(new Error('Listing not found'), { statusCode: 404 });
          }
          const listing = listingRow.rows[0];

          if (listing.seller_id !== playerId) {
            throw Object.assign(new Error('Not the listing owner'), { statusCode: 403 });
          }
          if (listing.status !== 'OPEN' && listing.status !== 'PARTIALLY_FILLED') {
            throw Object.assign(
              new Error(`Cannot cancel a listing with status '${listing.status}'`),
              { statusCode: 400 },
            );
          }

          // Return inventory to business for PLAYER_SELL (use resource name as key)
          if (listing.listing_type === 'PLAYER_SELL' && listing.business_id) {
            const resLookup = await client.query<{ name: string }>(
              `SELECT name FROM resources WHERE id = $1`,
              [listing.resource_id],
            );
            const rName = resLookup.rows[0]?.name ?? listing.resource_id;
            await client.query(
              `UPDATE businesses
               SET inventory = jsonb_set(
                 inventory,
                 $1,
                 to_jsonb((COALESCE((inventory->$2)::int, 0) + $3)::int)
               )
               WHERE id = $4 AND owner_id = $5`,
              [`{${rName}}`, rName, listing.quantity_remaining, listing.business_id, playerId],
            );
          }

          // Refund listing fee (proportional to remaining quantity)
          const listingFull = listingRow.rows[0] as Record<string, unknown>;
          const originalQty = Number(listingFull.quantity) || 0;
          const remainingQty = Number(listingFull.quantity_remaining) || 0;
          const pricePerUnit = Number(listingFull.price_per_unit) || 0;
          const isAnon = Boolean(listingFull.is_anonymous);
          if (remainingQty > 0 && pricePerUnit > 0) {
            const surcharge = isAnon ? 0.01 : 0;
            const refundFee = remainingQty * pricePerUnit * (LISTING_FEE_PERCENT + surcharge);
            await client.query(
              `UPDATE players SET cash = cash + $1 WHERE id = $2`,
              [refundFee, playerId],
            );
          }

          await client.query(
            `UPDATE market_listings SET status = 'CANCELLED' WHERE id = $1`,
            [listingId],
          );
        });

        return reply.send({ data: { cancelled: true } });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // GET /market/price-history/:resource_id
  fastify.get(
    '/price-history/:resource_id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerSeasonId = request.player.season_id;
      const { resource_id } = request.params as { resource_id: string };

      const result = await query(
        `SELECT id, resource_id, season_id, price, recorded_at
           FROM price_history
          WHERE resource_id = $1 AND season_id = $2
          ORDER BY recorded_at DESC
          LIMIT 288`,
        [resource_id, playerSeasonId],
      );

      return reply.send({ data: result.rows });
    },
  );

  // POST /market/quick-sell — Instantly sell inventory at AI buy price (discounted)
  // Removes friction from the core loop: produce → quick-sell → profit
  const QuickSellSchema = z.object({
    business_id: z.string().uuid(),
    resource_name: z.string().min(1).optional(), // If omitted, sell ALL inventory
    quantity: z.number().int().positive().optional(), // If omitted, sell all of that resource
  });

  fastify.post(
    '/quick-sell',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = QuickSellSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }

      const { business_id, resource_name, quantity } = parsed.data;
      const playerId = request.player.id;
      const seasonId = request.player.season_id;

      try {
        const result = await withTransaction(async (client) => {
          // Verify business ownership
          const bizRes = await client.query<{
            id: string; inventory: Record<string, number>; city: string;
          }>(
            `SELECT id, inventory, city FROM businesses
              WHERE id = $1 AND owner_id = $2 AND status = 'ACTIVE'
              FOR UPDATE`,
            [business_id, playerId],
          );
          if (bizRes.rows.length === 0) {
            throw Object.assign(new Error('Business not found or not active'), { statusCode: 404 });
          }

          const biz = bizRes.rows[0];
          const inventory = biz.inventory as Record<string, number>;

          // Determine what to sell
          const toSell: Array<{ name: string; qty: number }> = [];
          if (resource_name) {
            const available = inventory[resource_name] ?? 0;
            if (available <= 0) {
              throw Object.assign(new Error(`No ${resource_name} in inventory`), { statusCode: 400 });
            }
            const sellQty = quantity ? Math.min(quantity, available) : available;
            toSell.push({ name: resource_name, qty: sellQty });
          } else {
            // Sell all inventory
            for (const [name, qty] of Object.entries(inventory)) {
              if (qty > 0) {
                toSell.push({ name, qty: quantity ? Math.min(quantity, qty) : qty });
              }
            }
          }

          if (toSell.length === 0) {
            throw Object.assign(new Error('No inventory to sell'), { statusCode: 400 });
          }

          // Look up AI prices for each resource (sell at 85% of AI price for instant sale)
          const QUICK_SELL_DISCOUNT = 0.85;
          let totalEarned = 0;
          const soldItems: Array<{ resource: string; quantity: number; price_per_unit: number; total: number }> = [];

          for (const item of toSell) {
            const priceRes = await client.query<{ current_ai_price: string; id: string }>(
              `SELECT id, current_ai_price FROM resources
                WHERE name = $1 AND season_id = $2`,
              [item.name, seasonId],
            );
            if (priceRes.rows.length === 0) continue; // Skip unknown resources

            const aiPrice = parseFloat(priceRes.rows[0].current_ai_price);
            const sellPrice = parseFloat((aiPrice * QUICK_SELL_DISCOUNT).toFixed(2));
            const itemTotal = parseFloat((sellPrice * item.qty).toFixed(2));
            totalEarned += itemTotal;

            soldItems.push({
              resource: item.name,
              quantity: item.qty,
              price_per_unit: sellPrice,
              total: itemTotal,
            });

            // Deduct from inventory
            inventory[item.name] = (inventory[item.name] ?? 0) - item.qty;
            if (inventory[item.name] <= 0) delete inventory[item.name];

            // Record price history
            await client.query(
              `INSERT INTO price_history (resource_id, season_id, price)
               VALUES ($1, $2, $3)`,
              [priceRes.rows[0].id, seasonId, sellPrice],
            );
          }

          if (soldItems.length === 0) {
            throw Object.assign(new Error('Could not find market prices for inventory'), { statusCode: 400 });
          }

          // Update inventory
          await client.query(
            `UPDATE businesses SET inventory = $1 WHERE id = $2`,
            [JSON.stringify(inventory), business_id],
          );

          // Add cash to player
          await client.query(
            `UPDATE players SET cash = cash + $1 WHERE id = $2`,
            [totalEarned, playerId],
          );

          // Update business revenue tracking
          await client.query(
            `UPDATE businesses SET total_revenue = total_revenue + $1 WHERE id = $2`,
            [totalEarned, business_id],
          );

          // Create alert
          const itemSummary = soldItems.map(s => `${s.quantity}x ${s.resource}`).join(', ');
          await client.query(
            `INSERT INTO alerts (player_id, season_id, type, message, data)
             VALUES ($1, $2, 'REVENUE_REPORT', $3, $4)`,
            [
              playerId, seasonId,
              `Quick sale: sold ${itemSummary} for $${totalEarned.toFixed(0)} (85% market rate).`,
              JSON.stringify({ sold: soldItems, total: totalEarned, type: 'quick_sell' }),
            ],
          );

          return { total_earned: totalEarned, items_sold: soldItems };
        });

        await recalculateNetWorth(playerId);

        return reply.status(200).send({
          data: result,
          message: `Sold ${result.items_sold.length} item(s) for $${result.total_earned.toFixed(2)}!`,
        });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );
}
