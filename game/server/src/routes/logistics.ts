import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';

// ─── Constants ────────────────────────────────────────────────

const TRANSPORT_TYPES = {
  LOCAL_COURIER: { speed_multiplier: 0.5, cost_multiplier: 0.8, capacity: 50, hidden: false },
  REGIONAL:      { speed_multiplier: 1.0, cost_multiplier: 1.0, capacity: 200, hidden: false },
  SHIPPING:      { speed_multiplier: 2.0, cost_multiplier: 0.6, capacity: 1000, hidden: false },
  BLACK_MARKET:  { speed_multiplier: 1.5, cost_multiplier: 3.0, capacity: 100, hidden: true },
} as const;

const BLOCKADE_SETUP_COST = 5000;
const BLOCKADE_DAILY_COST = 500;
const BLOCKADE_LOSS_RATE = 0.30;

// Logistics tier concurrent delivery limits
const LOGISTICS_TIER_LIMITS: Record<number, number> = {
  1: 2,
  2: 5,
  3: 10,
  4: 20,
};

// ─── Input schemas ────────────────────────────────────────────

const ShipItemSchema = z.object({
  resource_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const CreateShipmentSchema = z.object({
  route_id: z.string().uuid(),
  items: z.array(ShipItemSchema).min(1),
});

const CreateBlockadeSchema = z.object({
  route_id: z.string().uuid(),
});

const ShipmentsQuerySchema = z.object({
  status: z.enum(['PENDING', 'IN_TRANSIT', 'DELIVERED', 'LOST']).optional(),
});

const RoutesQuerySchema = z.object({
  city: z.string().optional(),
});

const DeliveriesQuerySchema = z.object({
  status: z.enum(['PENDING', 'CLAIMED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'AUTO_DELIVERED']).optional(),
});

const NegotiateSchema = z.object({
  player_fee: z.number().positive(),
});

// ─── Route plugin ─────────────────────────────────────────────

export async function logisticsRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /logistics/routes — List all transport routes
  fastify.get(
    '/routes',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = RoutesQuerySchema.safeParse(request.query ?? {});
      const city = parsed.success ? parsed.data.city : undefined;
      let sql = `SELECT * FROM transport_routes WHERE 1=1`;
      const params: unknown[] = [];

      if (city) {
        params.push(city);
        sql += ` AND (origin_city = $${params.length} OR destination_city = $${params.length})`;
      }
      sql += ` ORDER BY origin_city, destination_city`;

      const result = await query(sql, params);
      return reply.send({ data: result.rows });
    },
  );

  // GET /logistics/routes/:id — Route details
  fastify.get(
    '/routes/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT * FROM transport_routes WHERE id = $1`, [id]);
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'Route not found' });
      }

      const blockades = await query(
        `SELECT id, player_id, created_at FROM blockades
          WHERE route_id = $1 AND active = true`,
        [id],
      );

      return reply.send({
        data: {
          ...result.rows[0],
          active_blockades: blockades.rows.length,
        },
      });
    },
  );

  // POST /logistics/ship — Create a shipment
  fastify.post(
    '/ship',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = CreateShipmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }
      const { route_id, items } = parsed.data;
      const playerId = request.player.id;

      const result = await withTransaction(async (client) => {
        // Get route details
        const routeRow = await client.query<{
          id: string; transport_type: string; base_cost: number;
          risk_level: number; travel_time_hours: number;
          origin_city: string; destination_city: string;
        }>(
          `SELECT * FROM transport_routes WHERE id = $1`,
          [route_id],
        );
        if (!routeRow.rows.length) {
          throw Object.assign(new Error('Route not found'), { statusCode: 404 });
        }
        const route = routeRow.rows[0];
        const transportConfig = TRANSPORT_TYPES[route.transport_type as keyof typeof TRANSPORT_TYPES];
        if (!transportConfig) {
          throw Object.assign(new Error('Invalid transport type on route'), { statusCode: 400 });
        }

        // Calculate total quantity and check capacity
        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
        if (totalQty > transportConfig.capacity) {
          throw Object.assign(
            new Error(`Shipment quantity ${totalQty} exceeds capacity ${transportConfig.capacity}`),
            { statusCode: 400 },
          );
        }

        // Calculate cost
        const quantityFactor = 1 + (totalQty / transportConfig.capacity) * 0.5;
        const totalCost = Math.ceil(route.base_cost * transportConfig.cost_multiplier * quantityFactor);

        // Check player funds
        const playerRow = await client.query<{ cash: string }>(
          `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
          [playerId],
        );
        if (Number(playerRow.rows[0].cash) < totalCost) {
          throw Object.assign(new Error(`Insufficient funds. Shipment costs $${totalCost}`), { statusCode: 400 });
        }

        // Verify items exist in player's business inventory in origin city
        for (const item of items) {
          const invRow = await client.query<{ quantity: number }>(
            `SELECT bi.quantity
               FROM business_inventory bi
               JOIN businesses b ON b.id = bi.business_id
              WHERE bi.resource_id = $1
                AND b.owner_id = $2
                AND b.city = $3
              ORDER BY bi.quantity DESC
              LIMIT 1`,
            [item.resource_id, playerId, route.origin_city],
          );
          if (!invRow.rows.length || invRow.rows[0].quantity < item.quantity) {
            throw Object.assign(
              new Error(`Insufficient inventory for resource ${item.resource_id}`),
              { statusCode: 400 },
            );
          }

          // Deduct from inventory
          await client.query(
            `UPDATE business_inventory bi
                SET quantity = quantity - $1
               FROM businesses b
              WHERE bi.business_id = b.id
                AND bi.resource_id = $2
                AND b.owner_id = $3
                AND b.city = $4
                AND bi.quantity >= $1`,
            [item.quantity, item.resource_id, playerId, route.origin_city],
          );
        }

        // Deduct cost
        await client.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [totalCost, playerId]);

        // Check for blockades (adds loss rate for non-BLACK_MARKET)
        const blockadeRow = await client.query<{ cnt: string }>(
          `SELECT COUNT(*) AS cnt FROM blockades WHERE route_id = $1 AND active = true`,
          [route_id],
        );
        const hasBlockade = Number(blockadeRow.rows[0].cnt) > 0;
        const baseLossRate = route.risk_level / 100;
        const effectiveLossRate = hasBlockade && !transportConfig.hidden
          ? Math.min(baseLossRate + BLOCKADE_LOSS_RATE, 0.95)
          : baseLossRate;

        // Calculate arrival time
        const travelHours = route.travel_time_hours * transportConfig.speed_multiplier;
        const departedAt = new Date();
        const arrivalAt = new Date(departedAt.getTime() + travelHours * 3600000);

        // Create shipment
        const shipmentRow = await client.query(
          `INSERT INTO shipments
           (player_id, route_id, transport_type, total_cost, loss_rate, departed_at, arrival_at, status, items)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN_TRANSIT', $8)
           RETURNING *`,
          [playerId, route_id, route.transport_type, totalCost, effectiveLossRate,
           departedAt.toISOString(), arrivalAt.toISOString(), JSON.stringify(items)],
        );

        return shipmentRow.rows[0];
      });

      return reply.status(201).send({ data: result });
    },
  );

  // GET /logistics/shipments — List player's shipments
  fastify.get(
    '/shipments',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = ShipmentsQuerySchema.safeParse(request.query ?? {});
      const status = parsed.success ? parsed.data.status : undefined;
      const playerId = request.player.id;
      let sql = `SELECT s.*, tr.origin_city, tr.destination_city
                   FROM shipments s
                   JOIN transport_routes tr ON tr.id = s.route_id
                  WHERE s.player_id = $1`;
      const params: unknown[] = [playerId];

      if (status) {
        params.push(status);
        sql += ` AND s.status = $${params.length}`;
      }
      sql += ` ORDER BY s.departed_at DESC`;

      const result = await query(sql, params);
      return reply.send({ data: result.rows });
    },
  );

  // GET /logistics/shipments/:id — Shipment details with ETA
  fastify.get(
    '/shipments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { id } = request.params as { id: string };

      const result = await query(
        `SELECT s.*, tr.origin_city, tr.destination_city, tr.transport_type AS route_transport_type
           FROM shipments s
           JOIN transport_routes tr ON tr.id = s.route_id
          WHERE s.id = $1 AND s.player_id = $2`,
        [id, playerId],
      );
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'Shipment not found' });
      }

      const shipment = result.rows[0] as Record<string, unknown>;
      const arrival = new Date(shipment.arrival_at as string);
      const now = new Date();
      const etaMs = Math.max(0, arrival.getTime() - now.getTime());
      const etaMinutes = Math.ceil(etaMs / 60000);

      return reply.send({
        data: {
          ...shipment,
          eta_minutes: etaMinutes,
          eta_arrived: etaMs <= 0,
        },
      });
    },
  );

  // POST /logistics/blockades — Set up blockade on a route
  fastify.post(
    '/blockades',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = CreateBlockadeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }
      const { route_id } = parsed.data;
      const playerId = request.player.id;

      const result = await withTransaction(async (client) => {
        // Verify route exists
        const routeRow = await client.query(
          `SELECT id FROM transport_routes WHERE id = $1`,
          [route_id],
        );
        if (!routeRow.rows.length) {
          throw Object.assign(new Error('Route not found'), { statusCode: 404 });
        }

        // Check player doesn't already have a blockade on this route
        const existing = await client.query(
          `SELECT id FROM blockades WHERE route_id = $1 AND player_id = $2 AND active = true`,
          [route_id, playerId],
        );
        if (existing.rows.length) {
          throw Object.assign(new Error('You already have an active blockade on this route'), { statusCode: 409 });
        }

        // Check funds
        const playerRow = await client.query<{ cash: string }>(
          `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
          [playerId],
        );
        if (Number(playerRow.rows[0].cash) < BLOCKADE_SETUP_COST) {
          throw Object.assign(new Error(`Insufficient funds. Blockade setup costs $${BLOCKADE_SETUP_COST}`), { statusCode: 400 });
        }

        // Deduct setup cost
        await client.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [BLOCKADE_SETUP_COST, playerId]);

        // Create blockade
        const blockadeRow = await client.query(
          `INSERT INTO blockades (route_id, player_id, strength, active, cost, created_at)
           VALUES ($1, $2, $3, $4, true, NOW())
           RETURNING *`,
          [route_id, playerId, BLOCKADE_SETUP_COST],
        );

        return blockadeRow.rows[0];
      });

      return reply.status(201).send({ data: result });
    },
  );

  // GET /logistics/blockades — List active blockades
  fastify.get(
    '/blockades',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const result = await query(
        `SELECT rb.*, tr.origin_city, tr.destination_city
           FROM blockades rb
           JOIN transport_routes tr ON tr.id = rb.route_id
          WHERE rb.player_id = $1 AND rb.active = true
          ORDER BY rb.created_at DESC`,
        [playerId],
      );
      return reply.send({ data: result.rows });
    },
  );

  // DELETE /logistics/blockades/:id — Remove own blockade
  fastify.delete(
    '/blockades/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { id } = request.params as { id: string };

      const result = await query(
        `UPDATE blockades SET active = false
          WHERE id = $1 AND player_id = $2 AND active = true
          RETURNING *`,
        [id, playerId],
      );
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'Blockade not found or already inactive' });
      }
      return reply.send({ data: result.rows[0], message: 'Blockade removed' });
    },
  );

  // ═══════════════════════════════════════════════════════════════
  // ─── Delivery System Endpoints ──────────────────────────────
  // ═══════════════════════════════════════════════════════════════

  // GET /logistics/deliveries/available — List PENDING delivery orders that the player can claim
  fastify.get(
    '/deliveries/available',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const playerSeasonId = request.player.season_id;

      // Verify player owns a LOGISTICS business
      const logBiz = await query(
        `SELECT id, city, tier FROM businesses
         WHERE owner_id = $1 AND season_id = $2 AND type = 'LOGISTICS' AND status = 'ACTIVE'`,
        [playerId, playerSeasonId],
      );
      if (!logBiz.rows.length) {
        return reply.status(403).send({ error: 'You need a LOGISTICS business to view delivery jobs' });
      }

      // Tier 1: only orders from your city. Tier 2+: all cities.
      const maxTier = Math.max(...logBiz.rows.map((b: any) => b.tier));
      const logCities = logBiz.rows.map((b: any) => b.city);

      let sql: string;
      let params: unknown[];

      if (maxTier >= 2) {
        // Regional access: all pending deliveries
        sql = `SELECT d.id, d.resource_name, d.quantity, d.origin_city, d.destination_city,
                      d.standard_fee, d.created_at, d.auto_deliver_at
               FROM delivery_orders d
               WHERE d.status = 'PENDING' AND d.season_id = $1
               ORDER BY d.created_at DESC`;
        params = [playerSeasonId];
      } else {
        // Tier 1: only origin_city matches one of their logistics business cities
        sql = `SELECT d.id, d.resource_name, d.quantity, d.origin_city, d.destination_city,
                      d.standard_fee, d.created_at, d.auto_deliver_at
               FROM delivery_orders d
               WHERE d.status = 'PENDING' AND d.season_id = $1
                 AND d.origin_city = ANY($2)
               ORDER BY d.created_at DESC`;
        params = [playerSeasonId, logCities];
      }

      const result = await query(sql, params);
      return reply.send({ data: result.rows });
    },
  );

  // GET /logistics/deliveries/mine — Player's deliveries (as carrier)
  fastify.get(
    '/deliveries/mine',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const parsed = DeliveriesQuerySchema.safeParse(request.query ?? {});
      const statusFilter = parsed.success ? parsed.data.status : undefined;

      let sql = `SELECT d.* FROM delivery_orders d WHERE d.carrier_id = $1`;
      const params: unknown[] = [playerId];

      if (statusFilter) {
        params.push(statusFilter);
        sql += ` AND d.status = $${params.length}`;
      }
      sql += ` ORDER BY d.created_at DESC`;

      const result = await query(sql, params);
      return reply.send({ data: result.rows });
    },
  );

  // POST /logistics/deliveries/:id/claim — Claim a delivery job
  fastify.post(
    '/deliveries/:id/claim',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const playerSeasonId = request.player.season_id;
      const { id: deliveryId } = request.params as { id: string };

      try {
        const result = await withTransaction(async (client) => {
          // Lock and fetch the delivery order
          const delRow = await client.query<{
            id: string; status: string; origin_city: string; destination_city: string;
            standard_fee: number; season_id: string;
          }>(
            `SELECT * FROM delivery_orders WHERE id = $1 FOR UPDATE`,
            [deliveryId],
          );
          if (!delRow.rows.length) {
            throw Object.assign(new Error('Delivery order not found'), { statusCode: 404 });
          }
          const order = delRow.rows[0];

          if (order.status !== 'PENDING') {
            throw Object.assign(new Error('Delivery order is no longer available'), { statusCode: 400 });
          }

          // Check player owns LOGISTICS business in origin_city (or tier 2+ for any city)
          const logBiz = await client.query<{ id: string; city: string; tier: number }>(
            `SELECT id, city, tier FROM businesses
             WHERE owner_id = $1 AND season_id = $2 AND type = 'LOGISTICS' AND status = 'ACTIVE'
             ORDER BY tier DESC`,
            [playerId, playerSeasonId],
          );
          if (!logBiz.rows.length) {
            throw Object.assign(new Error('You need a LOGISTICS business to claim deliveries'), { statusCode: 403 });
          }

          const maxTier = Math.max(...logBiz.rows.map((b: any) => b.tier));
          const hasOriginCity = logBiz.rows.some((b: any) => b.city === order.origin_city);

          if (maxTier < 2 && !hasOriginCity) {
            throw Object.assign(
              new Error('Tier 1 logistics can only claim deliveries from their city. Upgrade to tier 2 for regional access.'),
              { statusCode: 403 },
            );
          }

          // Pick the best logistics business to assign (prefer origin city, then highest tier)
          const carrierBiz = logBiz.rows.find((b: any) => b.city === order.origin_city) || logBiz.rows[0];

          // Check concurrent delivery limit based on logistics tier
          const concurrentLimit = LOGISTICS_TIER_LIMITS[maxTier] ?? LOGISTICS_TIER_LIMITS[4];
          const activeCount = await client.query<{ cnt: string }>(
            `SELECT COUNT(*) as cnt FROM delivery_orders
             WHERE carrier_id = $1 AND status IN ('CLAIMED', 'IN_TRANSIT')`,
            [playerId],
          );
          if (Number(activeCount.rows[0].cnt) >= concurrentLimit) {
            throw Object.assign(
              new Error(`Concurrent delivery limit reached (${concurrentLimit} for tier ${maxTier}). Complete existing deliveries first.`),
              { statusCode: 400 },
            );
          }

          // Calculate player_fee = standard_fee * 0.80 (20% platform cut)
          const playerFee = Math.round(Number(order.standard_fee) * 0.80 * 100) / 100;

          // Calculate estimated_delivery based on route travel_time
          const routeRow = await client.query<{ travel_time_hours: number }>(
            `SELECT travel_time_hours FROM transport_routes
             WHERE origin_city = $1 AND destination_city = $2
             LIMIT 1`,
            [order.origin_city, order.destination_city],
          );
          const travelHours = routeRow.rows[0]?.travel_time_hours ?? 2;
          const estimatedDelivery = new Date(Date.now() + travelHours * 3600000);

          // Update the delivery order
          await client.query(
            `UPDATE delivery_orders
             SET carrier_id = $1, carrier_business_id = $2, player_fee = $3,
                 status = 'CLAIMED', claimed_at = NOW(), estimated_delivery = $4
             WHERE id = $5`,
            [playerId, carrierBiz.id, playerFee, estimatedDelivery.toISOString(), deliveryId],
          );

          return {
            delivery_id: deliveryId,
            player_fee: playerFee,
            estimated_delivery: estimatedDelivery.toISOString(),
            carrier_business_id: carrierBiz.id,
          };
        });

        return reply.send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // POST /logistics/deliveries/:id/negotiate — Counter-offer on price
  fastify.post(
    '/deliveries/:id/negotiate',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { id: deliveryId } = request.params as { id: string };

      const parsed = NegotiateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0].message });
      }
      const { player_fee: proposedFee } = parsed.data;

      try {
        const result = await withTransaction(async (client) => {
          const delRow = await client.query<{
            id: string; status: string; standard_fee: number; carrier_id: string | null;
          }>(
            `SELECT * FROM delivery_orders WHERE id = $1 FOR UPDATE`,
            [deliveryId],
          );
          if (!delRow.rows.length) {
            throw Object.assign(new Error('Delivery order not found'), { statusCode: 404 });
          }
          const order = delRow.rows[0];

          // Can negotiate on PENDING or CLAIMED (if carrier is the player)
          if (order.status === 'CLAIMED' && order.carrier_id !== playerId) {
            throw Object.assign(new Error('Only the assigned carrier can negotiate'), { statusCode: 403 });
          }
          if (order.status !== 'PENDING' && order.status !== 'CLAIMED') {
            throw Object.assign(new Error('Cannot negotiate on this delivery'), { statusCode: 400 });
          }

          const standardFee = Number(order.standard_fee);
          const minFee = standardFee * 0.5;
          const maxFee = standardFee * 1.0;

          if (proposedFee < minFee || proposedFee > maxFee) {
            throw Object.assign(
              new Error(`Proposed fee must be between ${minFee.toFixed(2)} and ${maxFee.toFixed(2)}`),
              { statusCode: 400 },
            );
          }

          await client.query(
            `UPDATE delivery_orders SET player_fee = $1 WHERE id = $2`,
            [proposedFee, deliveryId],
          );

          return {
            delivery_id: deliveryId,
            player_fee: proposedFee,
            standard_fee: standardFee,
          };
        });

        return reply.send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // GET /logistics/fleet — Player's logistics businesses with delivery stats
  fastify.get(
    '/fleet',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const playerSeasonId = request.player.season_id;

      const result = await query(
        `SELECT
           b.id, b.name, b.city, b.tier, b.status,
           (SELECT COUNT(*) FROM delivery_orders d WHERE d.carrier_business_id = b.id AND d.status IN ('CLAIMED', 'IN_TRANSIT')) AS active_deliveries,
           (SELECT COUNT(*) FROM delivery_orders d WHERE d.carrier_business_id = b.id AND d.status IN ('DELIVERED', 'AUTO_DELIVERED')) AS completed_deliveries,
           (SELECT COALESCE(SUM(d.player_fee), 0) FROM delivery_orders d WHERE d.carrier_business_id = b.id AND d.status = 'DELIVERED') AS total_earned
         FROM businesses b
         WHERE b.owner_id = $1 AND b.season_id = $2 AND b.type = 'LOGISTICS' AND b.status = 'ACTIVE'
         ORDER BY b.tier DESC, b.established_at ASC`,
        [playerId, playerSeasonId],
      );

      // Calculate concurrent limit based on max tier
      const maxTier = result.rows.length > 0
        ? Math.max(...result.rows.map((b: any) => b.tier))
        : 0;
      const concurrentLimit = LOGISTICS_TIER_LIMITS[maxTier] ?? 0;

      return reply.send({
        data: {
          businesses: result.rows,
          max_tier: maxTier,
          concurrent_delivery_limit: concurrentLimit,
        },
      });
    },
  );

  // GET /logistics/career — Logistics career progress
  fastify.get(
    '/career',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const playerSeasonId = request.player.season_id;

      // Count LOGISTICS businesses for tier
      const bizCount = await query<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM businesses
         WHERE owner_id = $1 AND season_id = $2 AND type = 'LOGISTICS' AND status = 'ACTIVE'`,
        [playerId, playerSeasonId],
      );
      const logisticsCount = Number(bizCount.rows[0].cnt);
      const currentTier = Math.min(logisticsCount, 4);

      // Delivery stats
      const stats = await query<{
        total_delivered: string; total_earned: string;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'DELIVERED') AS total_delivered,
           COALESCE(SUM(player_fee) FILTER (WHERE status = 'DELIVERED'), 0) AS total_earned
         FROM delivery_orders
         WHERE carrier_id = $1`,
        [playerId],
      );

      const totalDelivered = Number(stats.rows[0]?.total_delivered ?? 0);
      const totalEarned = Number(stats.rows[0]?.total_earned ?? 0);

      // Next tier requirements
      const nextTier = currentTier < 4 ? currentTier + 1 : null;
      const nextTierRequirement = nextTier
        ? { tier: nextTier, logistics_businesses_needed: nextTier, concurrent_limit: LOGISTICS_TIER_LIMITS[nextTier] }
        : null;

      return reply.send({
        data: {
          logistics_businesses: logisticsCount,
          current_tier: currentTier,
          concurrent_delivery_limit: LOGISTICS_TIER_LIMITS[currentTier] ?? 0,
          total_deliveries_completed: totalDelivered,
          total_earned: totalEarned,
          next_tier: nextTierRequirement,
        },
      });
    },
  );
}

export default logisticsRoutes;
