import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, withTransaction } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { awardXP, XP_REWARDS } from '../lib/xp.js';

export async function discoveryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // ─── GET / — active discovery hints for current player ──────────
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const playerId = req.player.id;

    const res = await query(
      `SELECT dr.id, dr.key, dr.ui_surface, dr.reward_type, dr.reward_payload
       FROM discovery_rules dr
       JOIN discovery_progress dp ON dp.rule_id = dr.id
       WHERE dp.player_id = $1 AND dp.completed = FALSE AND dp.shown_count > 0
       ORDER BY dr.sort_order`,
      [playerId],
    );

    return reply.send({ data: res.rows });
  });

  // ─── POST /:ruleId/seen — mark discovery as seen ───────────────
  app.post('/:ruleId/seen', async (req: FastifyRequest, reply: FastifyReply) => {
    const { ruleId } = req.params as { ruleId: string };
    const playerId = req.player.id;

    // Verify rule exists
    const ruleRes = await query<{ id: string }>(
      `SELECT id FROM discovery_rules WHERE id = $1`,
      [ruleId],
    );
    if (!ruleRes.rows.length) {
      return reply.status(404).send({ error: 'Discovery rule not found' });
    }

    await query(
      `INSERT INTO discovery_progress (player_id, rule_id, shown_count, last_shown_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (player_id, rule_id)
       DO UPDATE SET shown_count = discovery_progress.shown_count + 1,
                     last_shown_at = NOW()`,
      [playerId, ruleId],
    );

    return reply.send({ data: { message: 'Marked as seen' } });
  });

  // ─── POST /:ruleId/done — complete discovery, award XP ─────────
  app.post('/:ruleId/done', async (req: FastifyRequest, reply: FastifyReply) => {
    const { ruleId } = req.params as { ruleId: string };
    const playerId = req.player.id;

    // Verify rule exists
    const ruleRes = await query<{ id: string; key: string; reward_type: string; reward_payload: Record<string, unknown>; unlock_effect: Record<string, unknown> }>(
      `SELECT id, key, reward_type, reward_payload, unlock_effect
       FROM discovery_rules WHERE id = $1`,
      [ruleId],
    );
    if (!ruleRes.rows.length) {
      return reply.status(404).send({ error: 'Discovery rule not found' });
    }
    const rule = ruleRes.rows[0];

    // Check if already completed
    const progressRes = await query<{ completed: boolean }>(
      `SELECT completed FROM discovery_progress
       WHERE player_id = $1 AND rule_id = $2`,
      [playerId, ruleId],
    );
    if (progressRes.rows.length > 0 && progressRes.rows[0].completed) {
      return reply.status(400).send({ error: 'Discovery already completed' });
    }

    let xpResult = { newXp: 0, newLevel: 1, leveledUp: false };

    await withTransaction(async (client) => {
      // Mark completed
      await client.query(
        `INSERT INTO discovery_progress (player_id, rule_id, shown_count, last_shown_at, completed, completed_at)
         VALUES ($1, $2, 1, NOW(), TRUE, NOW())
         ON CONFLICT (player_id, rule_id)
         DO UPDATE SET completed = TRUE, completed_at = NOW()`,
        [playerId, ruleId],
      );

      // Award XP
      xpResult = await awardXP(client, playerId, XP_REWARDS.DISCOVERY);

      // Activity log
      await client.query(
        `INSERT INTO activity_log (player_id, type, message, amount)
         VALUES ($1, 'DISCOVERY', $2, 0)`,
        [playerId, `Discovered: ${rule.key}`],
      );
    });

    return reply.send({
      data: {
        message: `Discovery completed: ${rule.key}`,
        xp_awarded: XP_REWARDS.DISCOVERY,
        new_xp: xpResult.newXp,
        new_level: xpResult.newLevel,
        leveled_up: xpResult.leveledUp,
      },
    });
  });
}
