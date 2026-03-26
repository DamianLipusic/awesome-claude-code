import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';

// ─── Constants ────────────────────────────────────────────────

const EVENT_CATEGORIES = [
  'MARKET_CRASH', 'SUPPLY_SURGE', 'POLICE_CRACKDOWN', 'EMPLOYEE_STRIKE',
  'RIVAL_COLLAPSE', 'DISASTER', 'POLITICAL', 'BOOM',
] as const;

type EventCategory = (typeof EVENT_CATEGORIES)[number];

const CATEGORY_DESCRIPTIONS: Record<EventCategory, string> = {
  MARKET_CRASH: 'All resource prices drop 20-40% for the duration',
  SUPPLY_SURGE: 'Specific resource supply increases 50%',
  POLICE_CRACKDOWN: 'All crime detection rates doubled',
  EMPLOYEE_STRIKE: 'Random businesses lose 50% efficiency',
  RIVAL_COLLAPSE: "Random player's businesses shut down",
  DISASTER: "Specific city's businesses take damage",
  POLITICAL: 'Tax rates change',
  BOOM: 'All businesses get +30% revenue',
};

// ─── Input schemas ────────────────────────────────────────────

const TriggerEventSchema = z.object({
  category: z.enum(EVENT_CATEGORIES),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  duration_hours: z.number().positive().max(168),
  impact_json: z.object({
    magnitude: z.number().min(0.1).max(5.0),
    target_city: z.string().optional(),
    target_resource: z.string().optional(),
    modifier: z.number().optional(),
  }),
});

// ─── Route plugin ─────────────────────────────────────────────

export async function eventRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /events — List current season's events (active + upcoming)
  fastify.get(
    '/',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const seasonId = request.player.season_id;
      const result = await query(
        `SELECT * FROM seasonal_events
          WHERE season_id = $1
            AND (status = 'ACTIVE' OR status = 'UPCOMING')
          ORDER BY triggered_at ASC`,
        [seasonId],
      );
      return reply.send({ data: result.rows });
    },
  );

  // GET /events/active — Currently active events affecting the player
  fastify.get(
    '/active',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const seasonId = request.player.season_id;

      const result = await query(
        `SELECT ge.*
           FROM seasonal_events ge
          WHERE ge.season_id = $1
            AND ge.status = 'ACTIVE'
            AND ge.triggered_at <= NOW()
            AND (ge.duration_hours IS NULL OR (ge.triggered_at + (ge.duration_hours || ' hours')::interval) > NOW())
          ORDER BY ge.triggered_at ASC`,
        [seasonId],
      );
      return reply.send({ data: result.rows });
    },
  );

  // GET /events/:id — Event details with impacts
  fastify.get(
    '/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const seasonId = request.player.season_id;

      const result = await query(
        `SELECT * FROM seasonal_events WHERE id = $1 AND season_id = $2`,
        [id, seasonId],
      );
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const event = result.rows[0] as Record<string, unknown>;
      const categoryKey = event.category as EventCategory;
      const categoryDesc = CATEGORY_DESCRIPTIONS[categoryKey] ?? 'Unknown effect';

      return reply.send({
        data: {
          ...event,
          category_description: categoryDesc,
        },
      });
    },
  );

  // POST /events/trigger — Admin/system trigger an event
  fastify.post(
    '/trigger',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;

      // Check if player is admin
      const adminCheck = await query<{ is_admin: boolean }>(
        `SELECT is_admin FROM players WHERE id = $1`,
        [playerId],
      );
      if (!adminCheck.rows.length || !adminCheck.rows[0].is_admin) {
        return reply.status(403).send({ error: 'Only admins can trigger events' });
      }

      const parsed = TriggerEventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }

      const { category, title, description, duration_hours, impact_json } = parsed.data;
      const seasonId = request.player.season_id;
      const startsAt = new Date();

      const result = await query(
        `INSERT INTO seasonal_events
         (season_id, category, title, description, impact_json, triggered_at, status, duration_hours)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7)
         RETURNING *`,
        [seasonId, category, title, description, JSON.stringify(impact_json),
         startsAt.toISOString(), duration_hours],
      );

      return reply.status(201).send({ data: result.rows[0] });
    },
  );

  // GET /events/history — Past events this season
  fastify.get(
    '/history',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const seasonId = request.player.season_id;
      const result = await query(
        `SELECT * FROM seasonal_events
          WHERE season_id = $1
            AND (status = 'RESOLVED' OR (duration_hours IS NOT NULL AND (triggered_at + (duration_hours || ' hours')::interval) <= NOW()))
          ORDER BY triggered_at DESC
          LIMIT 50`,
        [seasonId],
      );
      return reply.send({ data: result.rows });
    },
  );

  // POST /events/:id/resolve — Mark event impact as resolved for player
  fastify.post(
    '/:id/resolve',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const seasonId = request.player.season_id;
      const { id } = request.params as { id: string };

      const result = await query(
        `UPDATE seasonal_events SET status = 'RESOLVED'
          WHERE id = $1 AND season_id = $2 AND status = 'ACTIVE'
          RETURNING *`,
        [id, seasonId],
      );
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'Active event not found' });
      }
      return reply.send({ data: result.rows[0], message: 'Event resolved' });
    },
  );
}

export default eventRoutes;
