import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { BUSINESS_TYPES, type BusinessType } from '../config/game.config.js';
import { calculateLevel } from '../config/game.config.js';

// Net worth = cash + bank + inventory_value + business_value
async function computeNetWorth(playerId: string): Promise<number> {
  const res = await query<{ net_worth: string }>(`
    SELECT (
      p.cash + p.bank_balance +
      COALESCE((
        SELECT SUM(inv.amount * i.base_price)
        FROM inventory inv
        JOIN businesses b ON b.id = inv.business_id
        JOIN items i ON i.id = inv.item_id
        WHERE b.owner_id = p.id AND b.status != 'shutdown'
      ), 0) +
      COALESCE((
        SELECT SUM(
          CASE b.type
            WHEN 'MINE' THEN 12000
            WHEN 'FACTORY' THEN 15000
            WHEN 'SHOP' THEN 8000
            ELSE 10000
          END * b.tier
        )
        FROM businesses b
        WHERE b.owner_id = p.id AND b.status != 'shutdown'
      ), 0)
    )::numeric(18,2) AS net_worth
    FROM players p WHERE p.id = $1
  `, [playerId]);
  return Number(res.rows[0]?.net_worth ?? 0);
}

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  // GET / — top 20 leaderboard (no auth required for viewing)
  app.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(`
      SELECT
        p.id, p.username, p.level, p.xp, p.cash, p.bank_balance,
        (SELECT COUNT(*) FROM businesses b WHERE b.owner_id = p.id AND b.status != 'shutdown')::int AS business_count,
        (
          p.cash + p.bank_balance +
          COALESCE((
            SELECT SUM(inv.amount * i.base_price)
            FROM inventory inv
            JOIN businesses b ON b.id = inv.business_id
            JOIN items i ON i.id = inv.item_id
            WHERE b.owner_id = p.id AND b.status != 'shutdown'
          ), 0) +
          COALESCE((
            SELECT SUM(
              CASE b.type
                WHEN 'MINE' THEN 12000
                WHEN 'FACTORY' THEN 15000
                WHEN 'SHOP' THEN 8000
                ELSE 10000
              END * b.tier
            )
            FROM businesses b
            WHERE b.owner_id = p.id AND b.status != 'shutdown'
          ), 0)
        )::numeric(18,2) AS net_worth
      FROM players p
      ORDER BY net_worth DESC
      LIMIT 20
    `);

    const rankNames = ['Rookie', 'Hustler', 'Entrepreneur', 'Mogul', 'Tycoon', 'Baron', 'Kingpin', 'Legend', 'Titan', 'Overlord'];

    const leaderboard = res.rows.map((row: Record<string, unknown>, index: number) => ({
      rank: index + 1,
      id: row.id,
      username: row.username,
      level: Number(row.level),
      rank_title: rankNames[Math.min(Number(row.level) - 1, rankNames.length - 1)] ?? 'Rookie',
      net_worth: Number(row.net_worth),
      business_count: Number(row.business_count),
    }));

    return reply.send({ data: leaderboard });
  });

  // GET /me — current player's rank and net worth (auth required)
  app.get('/me', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const playerId = req.player.id;
    const netWorth = await computeNetWorth(playerId);

    // Get rank position
    const rankRes = await query<{ rank: string }>(`
      SELECT COUNT(*) + 1 AS rank FROM players p2
      WHERE (
        p2.cash + p2.bank_balance +
        COALESCE((
          SELECT SUM(inv.amount * i.base_price)
          FROM inventory inv
          JOIN businesses b ON b.id = inv.business_id
          JOIN items i ON i.id = inv.item_id
          WHERE b.owner_id = p2.id AND b.status != 'shutdown'
        ), 0) +
        COALESCE((
          SELECT SUM(
            CASE b.type
              WHEN 'MINE' THEN 12000
              WHEN 'FACTORY' THEN 15000
              WHEN 'SHOP' THEN 8000
              ELSE 10000
            END * b.tier
          )
          FROM businesses b
          WHERE b.owner_id = p2.id AND b.status != 'shutdown'
        ), 0)
      ) > $1
    `, [netWorth]);

    return reply.send({
      data: {
        rank: Number(rankRes.rows[0]?.rank ?? 1),
        net_worth: netWorth,
      },
    });
  });

  // GET /stats — world statistics
  app.get('/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(`
      SELECT
        (SELECT COUNT(*) FROM players)::int AS total_players,
        (SELECT COUNT(*) FROM players WHERE last_active > NOW() - INTERVAL '30 minutes')::int AS active_players,
        (SELECT COUNT(*) FROM businesses WHERE status != 'shutdown')::int AS total_businesses,
        (SELECT COUNT(*) FROM employees WHERE status IN ('active','training'))::int AS total_employees,
        (SELECT COUNT(*) FROM market_listings WHERE status = 'open')::int AS open_listings,
        (SELECT COALESCE(SUM(amount), 0) FROM activity_log WHERE amount > 0 AND created_at > NOW() - INTERVAL '24 hours')::numeric AS market_volume_24h,
        (SELECT COUNT(*) FROM game_events WHERE active = TRUE AND ends_at > NOW())::int AS active_events
    `);
    return reply.send({ data: res.rows[0] });
  });
}
