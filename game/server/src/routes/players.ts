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

    // Detailed business data with per-tick economics
    const bizDetailRes = await query<{
      id: string; name: string; type: string; tier: number; city: string;
      efficiency: string; daily_operating_cost: string; inventory: Record<string, number>;
      employee_count: string; total_revenue: string; total_expenses: string;
    }>(
      `SELECT b.id, b.name, b.type::text, b.tier, b.city,
              b.efficiency, b.daily_operating_cost, b.inventory,
              COALESCE(ec.cnt, 0)::text AS employee_count,
              b.total_revenue::text, b.total_expenses::text
         FROM businesses b
         LEFT JOIN (SELECT business_id, COUNT(*) AS cnt FROM employees GROUP BY business_id) ec ON ec.business_id = b.id
        WHERE b.owner_id = $1 AND b.status != 'BANKRUPT'
        ORDER BY b.established_at ASC`,
      [playerId],
    );

    const BASE_REVENUE = 1400;
    let totalDailyRev = 0;
    let totalDailyCost = 0;
    let totalEmployees = 0;
    const byType: Record<string, number> = {};
    const businessDetails = bizDetailRes.rows.map((b) => {
      const eff = parseFloat(b.efficiency);
      const empCount = parseInt(b.employee_count);
      const dailyRev = b.tier * BASE_REVENUE * eff * (1 + empCount * 0.1);
      const dailyCost = parseFloat(b.daily_operating_cost);
      const dailyNet = dailyRev - dailyCost;
      totalDailyRev += dailyRev;
      totalDailyCost += dailyCost;
      totalEmployees += empCount;
      byType[b.type] = (byType[b.type] || 0) + 1;

      const inv = b.inventory as Record<string, number>;
      const invItems = Object.entries(inv).filter(([, v]) => v > 0);
      const totalInventory = invItems.reduce((a, [, v]) => a + v, 0);

      return {
        id: b.id, name: b.name, type: b.type, tier: b.tier, city: b.city,
        efficiency: parseFloat((eff * 100).toFixed(1)),
        employees: empCount,
        daily_revenue: parseFloat(dailyRev.toFixed(2)),
        daily_cost: parseFloat(dailyCost.toFixed(2)),
        daily_net: parseFloat(dailyNet.toFixed(2)),
        profitable: dailyNet > 0,
        inventory_count: totalInventory,
        inventory_items: invItems.length > 0 ? Object.fromEntries(invItems) : {},
        lifetime_revenue: parseFloat(b.total_revenue),
        lifetime_expenses: parseFloat(b.total_expenses),
      };
    });

    const avgEff = bizDetailRes.rows.length > 0
      ? bizDetailRes.rows.reduce((a, b) => a + parseFloat(b.efficiency), 0) / bizDetailRes.rows.length
      : 0;

    // Cash trend: compare current cash to 1-hour-ago estimate from ledger
    const ledgerRes = await query<{ recent_net: string }>(
      `SELECT COALESCE(SUM(bl.revenue - bl.expenses), 0)::text AS recent_net
         FROM business_ledger bl
         JOIN businesses b ON b.id = bl.business_id
        WHERE b.owner_id = $1 AND bl.day = CURRENT_DATE`,
      [playerId],
    );
    const todayNet = parseFloat(ledgerRes.rows[0]?.recent_net ?? '0');

    // Upgrade info for cheapest next upgrade
    const upgradeTargets = bizDetailRes.rows
      .filter((b) => b.tier < 4)
      .map((b) => {
        const upgradeCosts: Record<string, Record<number, number>> = {
          RETAIL: { 2: 8000, 3: 20000, 4: 60000 },
          FACTORY: { 2: 30000, 3: 80000, 4: 200000 },
          MINE: { 2: 22000, 3: 60000, 4: 150000 },
          FARM: { 2: 12000, 3: 30000, 4: 80000 },
          LOGISTICS: { 2: 18000, 3: 50000, 4: 120000 },
          SECURITY_FIRM: { 2: 15000, 3: 40000, 4: 100000 },
          FRONT_COMPANY: { 2: 25000, 3: 70000, 4: 175000 },
        };
        const cost = upgradeCosts[b.type]?.[b.tier + 1] ?? 0;
        return { business_id: b.id, business_name: b.name, current_tier: b.tier, next_tier: b.tier + 1, cost };
      })
      .sort((a, b) => a.cost - b.cost);

    return reply.send({
      data: {
        player: playerRes.rows[0],
        season,
        rank: Number(rankRes.rows[0]?.rank ?? 1),
        alerts,
        income: {
          daily_revenue: parseFloat(totalDailyRev.toFixed(2)),
          daily_expenses: parseFloat(totalDailyCost.toFixed(2)),
          daily_net: parseFloat((totalDailyRev - totalDailyCost).toFixed(2)),
          per_tick_net: parseFloat(((totalDailyRev - totalDailyCost) / 288).toFixed(2)),
          today_net: parseFloat(todayNet.toFixed(2)),
          cash_trend: totalDailyRev - totalDailyCost > 0 ? 'growing' : totalDailyRev - totalDailyCost < -10 ? 'declining' : 'stable',
        },
        businesses: {
          total: bizDetailRes.rows.length,
          total_employees: totalEmployees,
          avg_efficiency: parseFloat((avgEff * 100).toFixed(1)),
          list: businessDetails,
        },
        progression: {
          next_upgrade: upgradeTargets[0] || null,
          can_afford_upgrade: upgradeTargets.length > 0 && parseFloat(playerRes.rows[0].cash) >= upgradeTargets[0].cost,
          upgrade_options: upgradeTargets.slice(0, 3),
        },
        crime: {
          heat: heatRes.rows[0] ?? null,
          dirty_money: dirtyRes.rows[0] ?? null,
          active_ops: activeOps.rows.length,
          active_laundering: activeLaundering.rows.length,
        },
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
