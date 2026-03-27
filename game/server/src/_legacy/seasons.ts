import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client';
import { requireAuth } from '../middleware/auth';

// ─── Route plugin ─────────────────────────────────────────────

export async function seasonRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /seasons/current
  fastify.get(
    '/current',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await query(
        `SELECT
           id, season_number, name, started_at, ends_at, status, starting_cash,
           tax_rate_brackets, crime_multiplier, resource_set, special_rule,
           total_players, top_players, winner_id,
           EXTRACT(EPOCH FROM (ends_at - NOW()))::int AS time_remaining_seconds
         FROM season_profiles
         WHERE status IN ('ACTIVE', 'ENDING')
         ORDER BY started_at DESC
         LIMIT 1`,
      );

      if (!result.rows.length) {
        return reply.status(404).send({ error: 'No active season found' });
      }

      return reply.send({ data: result.rows[0] });
    },
  );

  // GET /seasons/history
  fastify.get(
    '/history',
    { preHandler: [requireAuth] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await query(
        `SELECT
           id, season_number, name, started_at, ends_at, status, starting_cash,
           tax_rate_brackets, crime_multiplier, resource_set, special_rule,
           total_players, top_players, winner_id
         FROM season_profiles
         WHERE status = 'COMPLETED'
         ORDER BY started_at DESC
         LIMIT 10`,
      );

      return reply.send({ data: result.rows });
    },
  );
}
