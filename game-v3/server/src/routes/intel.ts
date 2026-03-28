import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const SPY_COST = 2000;

export async function intelRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /players — list other players (for targeting)
  app.get('/players', async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT id, username, level,
        (SELECT COUNT(*) FROM businesses b WHERE b.owner_id = p.id AND b.status != 'shutdown')::int AS business_count
       FROM players p WHERE p.id != $1
       ORDER BY level DESC LIMIT 50`,
      [req.player.id],
    );
    return reply.send({ data: res.rows });
  });

  // POST /spy — spy on a player
  app.post('/spy', async (req: FastifyRequest, reply: FastifyReply) => {
    const { target_id } = z.object({ target_id: z.string().uuid() }).parse(req.body);
    const playerId = req.player.id;

    if (target_id === playerId) return reply.status(400).send({ error: "Can't spy on yourself" });

    // Check cash
    const playerRes = await query<{ cash: string }>('SELECT cash FROM players WHERE id = $1', [playerId]);
    if (Number(playerRes.rows[0]?.cash ?? 0) < SPY_COST) {
      return reply.status(400).send({ error: `Not enough cash. Need $${SPY_COST}` });
    }

    // Get target info
    const targetRes = await query(`
      SELECT p.username, p.level, p.heat_police, p.rep_business, p.rep_underworld,
        (p.cash + p.bank_balance)::numeric AS visible_wealth,
        (SELECT COUNT(*) FROM businesses b WHERE b.owner_id = p.id AND b.status != 'shutdown')::int AS business_count,
        (SELECT COUNT(*) FROM employees e JOIN businesses b ON b.id = e.business_id WHERE b.owner_id = p.id AND e.status IN ('active','training'))::int AS employee_count,
        (SELECT string_agg(DISTINCT b.type, ', ') FROM businesses b WHERE b.owner_id = p.id AND b.status != 'shutdown') AS business_types,
        (SELECT COUNT(*) FROM crime_operations WHERE player_id = p.id AND status = 'success')::int AS crimes_committed
      FROM players p WHERE p.id = $1
    `, [target_id]);

    if (!targetRes.rows.length) return reply.status(404).send({ error: 'Player not found' });
    const target = targetRes.rows[0];

    // Deduct cost
    await query('UPDATE players SET cash = cash - $1 WHERE id = $2', [SPY_COST, playerId]);

    // Add some noise/inaccuracy (10-20% fuzzy)
    const fuzz = (val: number) => Math.round(val * (0.85 + Math.random() * 0.3));

    const reportData = {
      username: target.username,
      level: Number(target.level),
      estimated_wealth: fuzz(Number(target.visible_wealth)),
      business_count: Number(target.business_count),
      employee_count: Number(target.employee_count),
      business_types: target.business_types ?? 'None',
      heat_level: Number(target.heat_police) > 50 ? 'High' : Number(target.heat_police) > 20 ? 'Medium' : 'Low',
      reputation: Number(target.rep_business) > 70 ? 'Well-known' : 'Unknown',
      criminal_activity: Number(target.crimes_committed) > 5 ? 'Suspected criminal' : Number(target.crimes_committed) > 0 ? 'Minor infractions' : 'Clean record',
      accuracy: '70-100%',
    };

    // Save report
    await query(
      `INSERT INTO intel_reports (player_id, target_id, target_username, report_data, cost) VALUES ($1, $2, $3, $4, $5)`,
      [playerId, target_id, target.username, JSON.stringify(reportData), SPY_COST],
    );

    await query(
      "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'SPY', $2, $3)",
      [playerId, `Gathered intel on ${target.username}`, -SPY_COST],
    );

    return reply.send({ data: { report: reportData, cost: SPY_COST } });
  });

  // GET /reports — past spy reports
  app.get('/reports', async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT id, target_username, report_data, cost, created_at
       FROM intel_reports WHERE player_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.player.id],
    );
    return reply.send({ data: res.rows });
  });
}
