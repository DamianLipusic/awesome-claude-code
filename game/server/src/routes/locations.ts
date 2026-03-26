import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';

// ─── Constants ────────────────────────────────────────────────

const ZONE_CONFIGS = {
  TOURIST_DISTRICT: {
    retail_revenue_bonus: 0.20,
    detection_risk_bonus: 0.10,
    factory_output_bonus: 0,
    shipping_cost_bonus: 0,
    logistics_bonus: 0,
    all_revenue_bonus: 0,
    setup_cost_modifier: 0,
    crime_revenue_bonus: 0,
    heat_bonus: 0,
    traffic_bonus: 0,
    base_setup_cost: 12000,
    monthly_cost: 500,
  },
  INDUSTRIAL: {
    retail_revenue_bonus: -0.10,
    detection_risk_bonus: 0,
    factory_output_bonus: 0.30,
    shipping_cost_bonus: 0,
    logistics_bonus: 0,
    all_revenue_bonus: 0,
    setup_cost_modifier: 0,
    crime_revenue_bonus: 0,
    heat_bonus: 0,
    traffic_bonus: 0,
    base_setup_cost: 10000,
    monthly_cost: 400,
  },
  PORT: {
    retail_revenue_bonus: 0,
    detection_risk_bonus: 0,
    factory_output_bonus: 0,
    shipping_cost_bonus: -0.20,
    logistics_bonus: 0.15,
    all_revenue_bonus: 0,
    setup_cost_modifier: 0,
    crime_revenue_bonus: 0,
    heat_bonus: 0,
    traffic_bonus: 0,
    base_setup_cost: 15000,
    monthly_cost: 600,
  },
  DOWNTOWN: {
    retail_revenue_bonus: 0,
    detection_risk_bonus: 0,
    factory_output_bonus: 0,
    shipping_cost_bonus: 0,
    logistics_bonus: 0,
    all_revenue_bonus: 0.15,
    setup_cost_modifier: 0.25,
    crime_revenue_bonus: 0,
    heat_bonus: 0,
    traffic_bonus: 0,
    base_setup_cost: 20000,
    monthly_cost: 800,
  },
  SUBURB: {
    retail_revenue_bonus: 0,
    detection_risk_bonus: 0,
    factory_output_bonus: 0,
    shipping_cost_bonus: 0,
    logistics_bonus: 0,
    all_revenue_bonus: 0,
    setup_cost_modifier: -0.30,
    crime_revenue_bonus: 0,
    heat_bonus: 0,
    traffic_bonus: -0.10,
    base_setup_cost: 5000,
    monthly_cost: 200,
  },
  REDLIGHT: {
    retail_revenue_bonus: 0,
    detection_risk_bonus: 0,
    factory_output_bonus: 0,
    shipping_cost_bonus: 0,
    logistics_bonus: 0,
    all_revenue_bonus: 0,
    setup_cost_modifier: 0,
    crime_revenue_bonus: 0.40,
    heat_bonus: 0.30,
    traffic_bonus: 0,
    base_setup_cost: 8000,
    monthly_cost: 350,
  },
} as const;

type ZoneType = keyof typeof ZONE_CONFIGS;
const ZONE_TYPES = Object.keys(ZONE_CONFIGS) as ZoneType[];
const MAX_LOCATIONS_PER_CITY = 3;
const UPGRADE_BASE_COST = 5000;
const TRANSFORM_COST = 10000;

// ─── Input schemas ────────────────────────────────────────────

const CreateLocationSchema = z.object({
  name: z.string().min(1).max(50),
  zone: z.enum(ZONE_TYPES as [string, ...string[]]),
  city: z.string().min(1).max(50),
});

const UpdateLocationSchema = z.object({
  name: z.string().min(1).max(50).optional(),
}).refine(d => d.name !== undefined, {
  message: 'At least one updatable field must be provided',
});

const AssignBusinessSchema = z.object({
  business_id: z.string().uuid(),
});

const UpgradeSchema = z.object({
  upgrade_type: z.enum(['security', 'capacity', 'front_quality']),
});

const CustomizeSchema = z.object({
  employee_efficiency: z.number().min(0).max(0.5).optional(),
  revenue_bonus: z.number().min(0).max(0.5).optional(),
});

// ─── Route plugin ─────────────────────────────────────────────

export async function locationRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /locations — List player's locations
  fastify.get(
    '/',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const result = await query(
        `SELECT l.*
           FROM locations l
          WHERE l.player_id = $1
          ORDER BY l.city, l.zone`,
        [playerId],
      );
      return reply.send({ data: result.rows });
    },
  );

  // POST /locations — Buy/setup a new location
  fastify.post(
    '/',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = CreateLocationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }
      const { name, zone, city } = parsed.data;
      const playerId = request.player.id;
      const zoneConfig = ZONE_CONFIGS[zone as ZoneType];

      const result = await withTransaction(async (client) => {
        // Check max locations per city
        const countRow = await client.query<{ cnt: string }>(
          `SELECT COUNT(*) AS cnt FROM locations WHERE player_id = $1 AND city = $2`,
          [playerId, city],
        );
        if (Number(countRow.rows[0].cnt) >= MAX_LOCATIONS_PER_CITY) {
          throw Object.assign(
            new Error(`Maximum ${MAX_LOCATIONS_PER_CITY} locations per city reached`),
            { statusCode: 400 },
          );
        }

        // Calculate setup cost with zone modifier
        const setupCost = Math.ceil(zoneConfig.base_setup_cost * (1 + zoneConfig.setup_cost_modifier));

        // Check player funds
        const playerRow = await client.query<{ cash: string }>(
          `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
          [playerId],
        );
        if (Number(playerRow.rows[0].cash) < setupCost) {
          throw Object.assign(new Error(`Insufficient funds. Setup costs $${setupCost}`), { statusCode: 400 });
        }

        // Deduct cost
        await client.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [setupCost, playerId]);

        // Assign a random traffic level 1-10
        const trafficLevel = Math.floor(Math.random() * 10) + 1;

        // Create location
        const locRow = await client.query(
          `INSERT INTO locations (player_id, name, zone, city, setup_cost, monthly_cost, traffic_level, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING *`,
          [playerId, name, zone, city, setupCost, zoneConfig.monthly_cost, trafficLevel],
        );

        return locRow.rows[0];
      });

      return reply.status(201).send({ data: result });
    },
  );

  // GET /locations/:id — Location details
  fastify.get(
    '/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { id } = request.params as { id: string };

      const result = await query(
        `SELECT l.*
           FROM locations l
          WHERE l.id = $1 AND l.player_id = $2`,
        [id, playerId],
      );
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'Location not found' });
      }

      const location = result.rows[0] as Record<string, unknown>;
      const zoneConfig = ZONE_CONFIGS[(location.zone as string) as ZoneType];

      return reply.send({
        data: {
          ...location,
          zone_bonuses: zoneConfig ?? null,
        },
      });
    },
  );

  // PUT /locations/:id — Update location (rename)
  fastify.put(
    '/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = UpdateLocationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }
      const { name } = parsed.data;
      const playerId = request.player.id;
      const { id } = request.params as { id: string };

      const result = await query(
        `UPDATE locations SET name = COALESCE($1, name)
          WHERE id = $2 AND player_id = $3
          RETURNING *`,
        [name, id, playerId],
      );
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'Location not found' });
      }
      return reply.send({ data: result.rows[0] });
    },
  );

  // DELETE /locations/:id — Sell/abandon location (get back 50%)
  fastify.delete(
    '/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { id } = request.params as { id: string };

      const result = await withTransaction(async (client) => {
        const locRow = await client.query<{ id: string; setup_cost: number }>(
          `SELECT id, setup_cost FROM locations WHERE id = $1 AND player_id = $2`,
          [id, playerId],
        );
        if (!locRow.rows.length) {
          throw Object.assign(new Error('Location not found'), { statusCode: 404 });
        }

        const refund = Math.floor(locRow.rows[0].setup_cost * 0.5);

        // Delete location
        await client.query(`DELETE FROM locations WHERE id = $1`, [id]);

        // Refund 50%
        await client.query(`UPDATE players SET cash = cash + $1 WHERE id = $2`, [refund, playerId]);

        return { refund, message: 'Location sold' };
      });

      return reply.send({ data: result });
    },
  );

  // GET /locations/available/:city — List available locations in a city
  fastify.get(
    '/available/:city',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { city } = request.params as { city: string };
      const playerId = request.player.id;

      // Return zone types with their configs for this city
      const zones = ZONE_TYPES.map((zone) => {
        const config = ZONE_CONFIGS[zone];
        const setupCost = Math.ceil(config.base_setup_cost * (1 + config.setup_cost_modifier));
        return {
          zone,
          setup_cost: setupCost,
          monthly_cost: config.monthly_cost,
          bonuses: config,
        };
      });

      // Count existing locations in city for this player
      const countRow = await query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM locations WHERE player_id = $1 AND city = $2`,
        [playerId, city],
      );
      const currentCount = Number(countRow.rows[0].cnt);

      return reply.send({
        data: {
          city,
          available_zones: zones,
          current_locations: currentCount,
          max_locations: MAX_LOCATIONS_PER_CITY,
          slots_remaining: MAX_LOCATIONS_PER_CITY - currentCount,
        },
      });
    },
  );

  // POST /locations/:id/assign-business — Assign a business to this location
  fastify.post(
    '/:id/assign-business',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = AssignBusinessSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }
      const { business_id } = parsed.data;
      const playerId = request.player.id;
      const { id: locationId } = request.params as { id: string };

      const result = await withTransaction(async (client) => {
        // Verify location ownership
        const locRow = await client.query<{ id: string; zone: string }>(
          `SELECT id, zone FROM locations WHERE id = $1 AND player_id = $2`,
          [locationId, playerId],
        );
        if (!locRow.rows.length) {
          throw Object.assign(new Error('Location not found'), { statusCode: 404 });
        }

        // Verify business ownership
        const bizRow = await client.query(
          `SELECT id FROM businesses WHERE id = $1 AND player_id = $2 AND status != 'BANKRUPT'`,
          [business_id, playerId],
        );
        if (!bizRow.rows.length) {
          throw Object.assign(new Error('Business not found or not owned by you'), { statusCode: 404 });
        }

        // Check if business is already assigned to another location
        const existingAssignment = await client.query(
          `SELECT id FROM location_businesses WHERE business_id = $1`,
          [business_id],
        );
        if (existingAssignment.rows.length) {
          throw Object.assign(new Error('Business is already assigned to a location'), { statusCode: 409 });
        }

        // Assign business to location
        const assignRow = await client.query(
          `INSERT INTO location_businesses (location_id, business_id, assigned_at)
           VALUES ($1, $2, NOW())
           RETURNING *`,
          [locationId, business_id],
        );

        return assignRow.rows[0];
      });

      return reply.status(201).send({ data: result });
    },
  );

  // GET /locations/zones — List all zone types with bonuses
  fastify.get(
    '/zones',
    { preHandler: [requireAuth] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const zones = ZONE_TYPES.map((zone) => ({
        zone,
        ...ZONE_CONFIGS[zone],
        effective_setup_cost: Math.ceil(
          ZONE_CONFIGS[zone].base_setup_cost * (1 + ZONE_CONFIGS[zone].setup_cost_modifier),
        ),
      }));
      return reply.send({ data: zones });
    },
  );

  // ─── Phase 3: Location System Enhancement ─────────────────

  // POST /locations/:id/upgrade — Upgrade location (security, capacity, front quality)
  fastify.post(
    '/:id/upgrade',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { id } = request.params as { id: string };
      const parsed = UpgradeSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
      const { upgrade_type } = parsed.data;
      try {
        const result = await withTransaction(async (client) => {
          const locRow = await client.query<{ id: string; security_level: number; capacity_level: number; front_quality: number }>(
            "SELECT id, security_level, capacity_level, front_quality FROM locations WHERE id = $1 AND player_id = $2 FOR UPDATE",
            [id, playerId]
          );
          if (!locRow.rows.length) throw Object.assign(new Error("Location not found"), { statusCode: 404 });
          const loc = locRow.rows[0];
          const columnMap: Record<string, string> = { security: 'security_level', capacity: 'capacity_level', front_quality: 'front_quality' };
          const column = columnMap[upgrade_type];
          const currentLevel = Number(loc[column as keyof typeof loc]);
          if (currentLevel >= 10) throw Object.assign(new Error("Already at max level"), { statusCode: 400 });
          const cost = UPGRADE_BASE_COST * (currentLevel + 1);
          const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
          if (Number(playerRow.rows[0].cash) < cost) throw Object.assign(new Error("Insufficient cash. Upgrade costs " + cost), { statusCode: 400 });
          await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [cost, playerId]);
          await client.query(
            `UPDATE locations SET ${column} = ${column} + 1 WHERE id = $1`,
            [id]
          );
          return { location_id: id, upgrade_type, new_level: currentLevel + 1, cost };
        });
        return reply.send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // POST /locations/:id/transform — Transform location to dual-use (legit + criminal)
  fastify.post(
    '/:id/transform',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { id } = request.params as { id: string };
      try {
        const result = await withTransaction(async (client) => {
          const locRow = await client.query<{ id: string; is_dual_use: boolean }>(
            "SELECT id, is_dual_use FROM locations WHERE id = $1 AND player_id = $2 FOR UPDATE",
            [id, playerId]
          );
          if (!locRow.rows.length) throw Object.assign(new Error("Location not found"), { statusCode: 404 });
          if (locRow.rows[0].is_dual_use) throw Object.assign(new Error("Location is already dual-use"), { statusCode: 400 });
          // Requires: business at location
          const bizCheck = await client.query("SELECT id FROM location_businesses WHERE location_id = $1", [id]);
          if (!bizCheck.rows.length) throw Object.assign(new Error("Must have a business assigned to this location"), { statusCode: 400 });
          // Requires: 10k cash
          const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
          if (Number(playerRow.rows[0].cash) < TRANSFORM_COST) {
            throw Object.assign(new Error("Insufficient cash. Transform costs " + TRANSFORM_COST), { statusCode: 400 });
          }
          await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [TRANSFORM_COST, playerId]);
          const defaultHiddenRooms = JSON.stringify({ count: 1, type: 'storage' });
          const defaultEscapeRoutes = JSON.stringify({ routes: ['back_alley'] });
          const defaultSecuritySystems = JSON.stringify({ cameras: true, alarm: false, guards: 0 });
          await client.query(
            `UPDATE locations SET is_dual_use = TRUE, hidden_rooms = $1, escape_routes = $2, security_systems = $3 WHERE id = $4`,
            [defaultHiddenRooms, defaultEscapeRoutes, defaultSecuritySystems, id]
          );
          return { location_id: id, is_dual_use: true, cost: TRANSFORM_COST, hidden_rooms: JSON.parse(defaultHiddenRooms), escape_routes: JSON.parse(defaultEscapeRoutes), security_systems: JSON.parse(defaultSecuritySystems) };
        });
        return reply.send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // GET /locations/portfolio — Get all player's locations with ROI calculations
  fastify.get(
    '/portfolio',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const result = await query(
        `SELECT l.*,
                COALESCE(biz_agg.business_count, 0) AS business_count,
                COALESCE(biz_agg.total_revenue, 0) AS total_business_revenue,
                COALESCE(biz_agg.total_expenses, 0) AS total_business_expenses
           FROM locations l
           LEFT JOIN (
             SELECT lb.location_id,
                    COUNT(b.id) AS business_count,
                    SUM(b.total_revenue) AS total_revenue,
                    SUM(b.total_expenses) AS total_expenses
               FROM location_businesses lb
               JOIN businesses b ON b.id = lb.business_id
              GROUP BY lb.location_id
           ) biz_agg ON biz_agg.location_id = l.id
          WHERE l.player_id = $1
          ORDER BY l.city, l.zone`,
        [playerId]
      );
      const portfolio = result.rows.map((loc: Record<string, unknown>) => {
        const setupCost = Number(loc.setup_cost);
        const totalRevenue = Number(loc.total_business_revenue);
        const totalExpenses = Number(loc.total_business_expenses);
        const monthlyCost = Number(loc.monthly_cost);
        const netProfit = totalRevenue - totalExpenses - monthlyCost;
        const roi = setupCost > 0 ? Math.round((netProfit / setupCost) * 10000) / 100 : 0;
        return { ...loc, net_profit: netProfit, roi_percent: roi };
      });
      return reply.send({ data: portfolio });
    },
  );

  // POST /locations/:id/customize — Set custom bonuses (employee_efficiency, revenue_bonus)
  fastify.post(
    '/:id/customize',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { id } = request.params as { id: string };
      const parsed = CustomizeSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
      const { employee_efficiency, revenue_bonus } = parsed.data;
      if (employee_efficiency === undefined && revenue_bonus === undefined) {
        return reply.status(400).send({ error: "At least one of employee_efficiency or revenue_bonus must be provided" });
      }
      const locRow = await query(
        "SELECT id FROM locations WHERE id = $1 AND player_id = $2",
        [id, playerId]
      );
      if (!locRow.rows.length) return reply.status(404).send({ error: "Location not found" });
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;
      if (employee_efficiency !== undefined) {
        updates.push(`employee_efficiency_bonus = $${paramIdx++}`);
        params.push(employee_efficiency);
      }
      if (revenue_bonus !== undefined) {
        updates.push(`revenue_bonus = $${paramIdx++}`);
        params.push(revenue_bonus);
      }
      params.push(id);
      const result = await query(
        `UPDATE locations SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        params
      );
      return reply.send({ data: result.rows[0] });
    },
  );
}

export default locationRoutes;
