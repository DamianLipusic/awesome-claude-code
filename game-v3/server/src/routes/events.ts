import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { getPlayerAchievements, getAllAchievementDefs } from '../lib/achievements.js';

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  // GET /events — active game events (no auth needed)
  app.get('/events', async (_req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT type, title, description, icon, modifiers, affected_items, started_at, ends_at
       FROM game_events WHERE active = TRUE AND ends_at > NOW()
       ORDER BY started_at DESC`,
    );
    return reply.send({ data: res.rows });
  });

  // GET /achievements/me — player's unlocked achievements
  app.get('/achievements/me', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const achievements = await getPlayerAchievements(req.player.id);
    return reply.send({ data: achievements });
  });

  // GET /achievements/all — all achievement definitions (for showing locked ones)
  app.get('/achievements/all', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ data: getAllAchievementDefs() });
  });
}
