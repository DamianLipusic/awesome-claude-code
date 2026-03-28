import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export async function locationRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth
  app.addHook('preHandler', requireAuth);

  // GET / — all available locations for current season
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT l.id, l.name, l.type, l.zone, l.price, l.daily_cost, l.traffic,
              l.visibility, l.laundering_potential, l.storage_capacity,
              l.security_modifier, l.expansion_slots, l.available
       FROM locations l
       JOIN players p ON p.id = $1
       WHERE (l.season_id = p.season_id OR l.season_id IS NULL)
         AND l.available = TRUE
       ORDER BY l.zone, l.name`,
      [req.player.id],
    );
    return reply.send({ data: res.rows });
  });

  // GET /:id — location detail
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const res = await query(
      `SELECT l.id, l.name, l.type, l.zone, l.price, l.daily_cost, l.traffic,
              l.visibility, l.laundering_potential, l.storage_capacity,
              l.security_modifier, l.expansion_slots, l.available,
              (SELECT COUNT(*)::int FROM businesses b WHERE b.location_id = l.id AND b.status != 'shutdown') AS business_count
       FROM locations l
       WHERE l.id = $1`,
      [id],
    );
    if (!res.rows.length) {
      return reply.status(404).send({ error: 'Location not found' });
    }
    return reply.send({ data: res.rows[0] });
  });
}
