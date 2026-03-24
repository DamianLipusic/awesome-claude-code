import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { LISTING_FEE_PERCENT } from '../lib/constants';

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

  // GET /market/listings
  fastify.get(
    '/listings',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerSeasonId = request.player.season_id;
      const { city, resource_id, listing_type } = request.query as {
        city?: string;
        resource_id?: string;
        listing_type?: string;
      };

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
             WHEN ml.listing_type IN ('PLAYER_SELL', 'AI_SELL') THEN ml.price_per_unit END ASC`,
        params,
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
          // Lock player row
          const playerRow = await client.query<{ cash: number }>(
            `SELECT cash FROM players WHERE id = $1 AND season_id = $2 FOR UPDATE`,
            [playerId, playerSeasonId],
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
              `SELECT id, inventory FROM businesses WHERE id = $1 AND owner_id = $2 AND season_id = $3 FOR UPDATE`,
              [business_id, playerId, playerSeasonId],
            );
            if (!bizRow.rows.length) {
              throw Object.assign(new Error('Business not found or not owned by player'), { statusCode: 403 });
            }
            const biz = bizRow.rows[0];
            const inventoryQty: number = (biz.inventory as Record<string, number>)[resource_id] ?? 0;
            if (inventoryQty < quantity) {
              throw Object.assign(
                new Error(`Insufficient inventory: have ${inventoryQty}, need ${quantity}`),
                { statusCode: 400 },
              );
            }
            // Deduct from business inventory
            await client.query(
              `UPDATE businesses
               SET inventory = jsonb_set(
                 inventory,
                 $1,
                 to_jsonb((COALESCE((inventory->$2)::int, 0) - $3)::int)
               )
               WHERE id = $4`,
              [
                `{${resource_id}}`,
                resource_id,
                quantity,
                business_id,
              ],
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

          if (listing.status !== 'OPEN') {
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

          // Credit resource to buyer's primary business (or create inventory entry)
          const bizRow = await client.query<{ id: string; inventory: Record<string, number> }>(
            `SELECT id, inventory FROM businesses
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
          const buyerBiz = bizRow.rows[0];
          await client.query(
            `UPDATE businesses
             SET inventory = jsonb_set(
               inventory,
               $1,
               to_jsonb((COALESCE((inventory->$2)::int, 0) + $3)::int)
             )
             WHERE id = $4`,
            [`{${listing.resource_id}}`, listing.resource_id, quantity, buyerBiz.id],
          );

          // Update listing quantity_remaining
          const newRemaining = listing.quantity_remaining - quantity;
          const newStatus = newRemaining === 0 ? 'FILLED' : 'OPEN';
          await client.query(
            `UPDATE market_listings
             SET quantity_remaining = $1,
                 status = $2,
                 filled_at = CASE WHEN $2 = 'FILLED' THEN NOW() ELSE NULL END
             WHERE id = $3`,
            [newRemaining, newStatus, listingId],
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

          // Recalculate net worth for buyer
          await client.query(
            `UPDATE players
             SET net_worth = cash + (
               SELECT COALESCE(SUM(
                 CASE b.type
                   WHEN 'RETAIL'        THEN 5000
                   WHEN 'FACTORY'       THEN 20000
                   WHEN 'MINE'          THEN 15000
                   WHEN 'FARM'          THEN 8000
                   WHEN 'LOGISTICS'     THEN 12000
                   WHEN 'SECURITY_FIRM' THEN 10000
                   WHEN 'FRONT_COMPANY' THEN 18000
                   ELSE 5000
                 END * CASE b.tier WHEN 1 THEN 1.0 WHEN 2 THEN 1.5 WHEN 3 THEN 2.5 WHEN 4 THEN 4.0 ELSE 1.0 END * 0.7
               ), 0)
               FROM businesses b WHERE b.owner_id = $1 AND b.season_id = $2
             )
             WHERE id = $1`,
            [playerId, playerSeasonId],
          );

          // Recalculate net worth for seller if player listing
          if (listing.listing_type === 'PLAYER_SELL' && listing.seller_id) {
            await client.query(
              `UPDATE players
               SET net_worth = cash + (
                 SELECT COALESCE(SUM(
                   CASE b.type
                     WHEN 'RETAIL'        THEN 5000
                     WHEN 'FACTORY'       THEN 20000
                     WHEN 'MINE'          THEN 15000
                     WHEN 'FARM'          THEN 8000
                     WHEN 'LOGISTICS'     THEN 12000
                     WHEN 'SECURITY_FIRM' THEN 10000
                     WHEN 'FRONT_COMPANY' THEN 18000
                     ELSE 5000
                   END * CASE b.tier WHEN 1 THEN 1.0 WHEN 2 THEN 1.5 WHEN 3 THEN 2.5 WHEN 4 THEN 4.0 ELSE 1.0 END * 0.7
                 ), 0)
                 FROM businesses b WHERE b.owner_id = $1 AND b.season_id = $2
               )
               WHERE id = $1`,
              [listing.seller_id, playerSeasonId],
            );
          }

          // Emit WebSocket update to market channel
          try {
            (fastify as FastifyInstance & { io?: { to: (ch: string) => { emit: (ev: string, data: unknown) => void } } })
              .io?.to(`market:${listing.city}:${listing.resource_id}`)
              .emit('listing_updated', {
                listing_id: listingId,
                quantity_remaining: newRemaining,
                status: newStatus,
                city: listing.city,
                resource_id: listing.resource_id,
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
          if (listing.status !== 'OPEN') {
            throw Object.assign(
              new Error(`Cannot cancel a listing with status '${listing.status}'`),
              { statusCode: 400 },
            );
          }

          // Return inventory to business for PLAYER_SELL
          if (listing.listing_type === 'PLAYER_SELL' && listing.business_id) {
            await client.query(
              `UPDATE businesses
               SET inventory = jsonb_set(
                 inventory,
                 $1,
                 to_jsonb((COALESCE((inventory->$2)::int, 0) + $3)::int)
               )
               WHERE id = $4 AND owner_id = $5`,
              [
                `{${listing.resource_id}}`,
                listing.resource_id,
                listing.quantity_remaining,
                listing.business_id,
                playerId,
              ],
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
}
