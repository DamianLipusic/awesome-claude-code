import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { query } from '../db/client';
import { getCurrentSeason } from '../lib/season';
import { getPlayerAlerts, getUnreadAlertCount, markAlertRead, markAllAlertsRead } from '../lib/alerts';

export async function playerRoutes(app: FastifyInstance): Promise<void> {
  // GET /players/me
  app.get('/me', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT id, username, email, created_at, last_active, season_id, cash,
              net_worth, business_slots, reputation_score, alignment,
              meta_points, season_history, cosmetics, veteran_bonus_cash
         FROM players WHERE id = $1`,
      [request.player.id],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Player not found' });
    return reply.send({ data: res.rows[0] });
  });

  // GET /players/dashboard
  app.get('/dashboard', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const seasonId = request.player.season_id;

    const [playerRes, season, activeOps, activeLaundering, heatRes, dirtyRes] = await Promise.all([
      query(
        `SELECT id, username, email, cash, net_worth, business_slots, reputation_score,
                alignment, season_id, meta_points, cosmetics, veteran_bonus_cash,
                created_at, last_active, season_history
           FROM players WHERE id = $1`,
        [playerId],
      ),
      getCurrentSeason(),
      query(
        `SELECT * FROM criminal_operations WHERE player_id = $1 AND status = 'ACTIVE'`,
        [playerId],
      ),
      query(
        `SELECT * FROM laundering_processes WHERE player_id = $1 AND status = 'IN_PROGRESS'`,
        [playerId],
      ),
      query(
        `SELECT * FROM heat_scores WHERE player_id = $1 AND season_id = $2`,
        [playerId, seasonId],
      ),
      query(
        `SELECT * FROM dirty_money_balances WHERE player_id = $1 AND season_id = $2`,
        [playerId, seasonId],
      ),
    ]);

    if (playerRes.rows.length === 0) return reply.status(404).send({ error: 'Not found' });

    const rankRes = await query<{ rank: string }>(
      `SELECT COUNT(*) + 1 AS rank FROM players
        WHERE season_id = $1 AND net_worth > $2`,
      [seasonId, playerRes.rows[0].net_worth],
    );

    const alerts = await getPlayerAlerts(playerId, 10);

    // Income summary: calculate from businesses
    const incomeRes = await query<{ revenue: string; expenses: string }>(
      `SELECT COALESCE(SUM(b.total_revenue), 0)::text AS revenue,
              COALESCE(SUM(b.total_expenses), 0)::text AS expenses
         FROM businesses b
        WHERE b.owner_id = $1 AND b.status != 'BANKRUPT'`,
      [playerId],
    );
    const revPerTick = parseFloat(incomeRes.rows[0]?.revenue ?? '0');
    const expPerTick = parseFloat(incomeRes.rows[0]?.expenses ?? '0');

    // Business overview
    const bizOverviewRes = await query<{ total: string; total_employees: string; avg_efficiency: string }>(
      `SELECT COUNT(*)::text AS total,
              COALESCE((SELECT COUNT(*)::text FROM employees e
                         JOIN businesses b2 ON b2.id = e.business_id
                        WHERE b2.owner_id = $1 AND b2.status != 'BANKRUPT'), '0') AS total_employees,
              COALESCE(AVG(b.efficiency)::text, '0') AS avg_efficiency
         FROM businesses b
        WHERE b.owner_id = $1 AND b.status != 'BANKRUPT'`,
      [playerId],
    );
    const bizByTypeRes = await query<{ type: string; count: string }>(
      `SELECT type, COUNT(*)::text AS count
         FROM businesses
        WHERE owner_id = $1 AND status != 'BANKRUPT'
        GROUP BY type`,
      [playerId],
    );
    const byType: Record<string, number> = {};
    for (const row of bizByTypeRes.rows) {
      byType[row.type] = Number(row.count);
    }

    // Active events
    const activeEventsRes = await query(
      `SELECT * FROM seasonal_events
        WHERE season_id = $1 AND status = 'ACTIVE'
        ORDER BY triggered_at DESC`,
      [seasonId],
    );

    // Reputation
    const reputationRes = await query<{ axis: string; score: number }>(
      `SELECT axis, score
         FROM reputation_profiles
        WHERE player_id = $1`,
      [playerId],
    );

    return reply.send({
      data: {
        player: playerRes.rows[0],
        heat: heatRes.rows[0] ?? null,
        dirty_money: dirtyRes.rows[0] ?? null,
        active_ops: activeOps.rows,
        active_laundering: activeLaundering.rows,
        season,
        rank: Number(rankRes.rows[0]?.rank ?? 1),
        alerts,
        income_summary: {
          revenue_per_tick: revPerTick,
          expenses_per_tick: expPerTick,
          net_per_tick: revPerTick - expPerTick,
        },
        business_overview: {
          total: Number(bizOverviewRes.rows[0]?.total ?? 0),
          by_type: byType,
          total_employees: Number(bizOverviewRes.rows[0]?.total_employees ?? 0),
          avg_efficiency: Number(parseFloat(bizOverviewRes.rows[0]?.avg_efficiency ?? '0').toFixed(1)),
        },
        active_events: activeEventsRes.rows,
        reputation: reputationRes.rows,
      },
    });
  });

  // GET /players/leaderboard
  app.get('/leaderboard', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', per_page = '100' } = request.query as { page?: string; per_page?: string };
    const limit = Math.min(parseInt(per_page, 10) || 100, 100);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

    const season = await getCurrentSeason();
    if (!season) return reply.send({ data: { items: [], total: 0, page: 1, per_page: limit } });

    const [res, countRes] = await Promise.all([
      query(
        `SELECT p.id, p.username, p.net_worth, p.alignment,
                (SELECT COUNT(*)::int FROM businesses b
                   WHERE b.owner_id = p.id AND b.status != 'BANKRUPT') AS business_count
           FROM players p
          WHERE p.season_id = $1
          ORDER BY p.net_worth DESC
          LIMIT $2 OFFSET $3`,
        [season.id, limit, offset],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM players WHERE season_id = $1`,
        [season.id],
      ),
    ]);

    const entries = res.rows.map((row, idx) => ({
      rank: offset + idx + 1,
      player_id: row.id,
      username: row.username,
      net_worth: Number(row.net_worth),
      alignment: row.alignment,
      business_count: Number(row.business_count),
    }));

    return reply.send({
      data: {
        items: entries,
        total: Number(countRes.rows[0]?.count ?? 0),
        page: parseInt(page, 10) || 1,
        per_page: limit,
      },
    });
  });

  // GET /players/:id/profile
  app.get('/:id/profile', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const res = await query(
      `SELECT id, username, net_worth, alignment, reputation_score, meta_points,
              season_history, cosmetics
         FROM players WHERE id = $1`,
      [id],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Player not found' });
    return reply.send({ data: res.rows[0] });
  });

  // ─── Notification Endpoints ──────────────────────────────────

  // GET /players/notifications — last 50 alerts, unread first
  app.get('/notifications', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const alerts = await getPlayerAlerts(playerId, 50);
    const unreadCount = await getUnreadAlertCount(playerId);
    return reply.send({ data: { alerts, unread_count: unreadCount } });
  });

  // POST /players/notifications/:id/read — mark single notification as read
  app.post('/notifications/:id/read', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const success = await markAlertRead(id, request.player.id);
    if (!success) return reply.status(404).send({ error: 'Notification not found' });
    return reply.send({ data: { success: true } });
  });

  // POST /players/notifications/read-all — mark all as read
  app.post('/notifications/read-all', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const count = await markAllAlertsRead(playerId);
    return reply.send({ data: { marked_read: count } });
  });
}
