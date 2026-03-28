"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playerRoutes = playerRoutes;
const auth_1 = require("../middleware/auth");
const client_1 = require("../db/client");
const season_1 = require("../lib/season");
const alerts_1 = require("../lib/alerts");
async function playerRoutes(app) {
    // GET /players/me
    app.get('/me', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const res = await (0, client_1.query)(`SELECT id, username, email, created_at, last_active, season_id, cash,
              net_worth, business_slots, reputation_score, alignment,
              meta_points, season_history, cosmetics, veteran_bonus_cash
         FROM players WHERE id = $1`, [request.player.id]);
        if (res.rows.length === 0)
            return reply.status(404).send({ error: 'Player not found' });
        return reply.send({ data: res.rows[0] });
    });
    // GET /players/dashboard
    app.get('/dashboard', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const seasonId = request.player.season_id;
        const [playerRes, season, activeOps, activeLaundering, heatRes, dirtyRes] = await Promise.all([
            (0, client_1.query)(`SELECT id, username, email, cash, net_worth, business_slots, reputation_score,
                alignment, season_id, meta_points, cosmetics, veteran_bonus_cash,
                created_at, last_active, season_history
           FROM players WHERE id = $1`, [playerId]),
            (0, season_1.getCurrentSeason)(),
            (0, client_1.query)(`SELECT * FROM criminal_operations WHERE player_id = $1 AND status = 'ACTIVE'`, [playerId]),
            (0, client_1.query)(`SELECT * FROM laundering_processes WHERE player_id = $1 AND status = 'IN_PROGRESS'`, [playerId]),
            (0, client_1.query)(`SELECT * FROM heat_scores WHERE player_id = $1 AND season_id = $2`, [playerId, seasonId]),
            (0, client_1.query)(`SELECT * FROM dirty_money_balances WHERE player_id = $1 AND season_id = $2`, [playerId, seasonId]),
        ]);
        if (playerRes.rows.length === 0)
            return reply.status(404).send({ error: 'Not found' });
        const rankRes = await (0, client_1.query)(`SELECT COUNT(*) + 1 AS rank FROM players
        WHERE season_id = $1 AND net_worth > $2`, [seasonId, playerRes.rows[0].net_worth]);
        const alerts = await (0, alerts_1.getPlayerAlerts)(playerId, 10);
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
            },
        });
    });
    // GET /players/leaderboard
    app.get('/leaderboard', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { page = '1', per_page = '100' } = request.query;
        const limit = Math.min(parseInt(per_page, 10) || 100, 100);
        const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
        const season = await (0, season_1.getCurrentSeason)();
        if (!season)
            return reply.send({ data: { items: [], total: 0, page: 1, per_page: limit } });
        const [res, countRes] = await Promise.all([
            (0, client_1.query)(`SELECT p.id, p.username, p.net_worth, p.alignment,
                (SELECT COUNT(*)::int FROM businesses b
                   WHERE b.owner_id = p.id AND b.status != 'BANKRUPT') AS business_count
           FROM players p
          WHERE p.season_id = $1
          ORDER BY p.net_worth DESC
          LIMIT $2 OFFSET $3`, [season.id, limit, offset]),
            (0, client_1.query)(`SELECT COUNT(*) AS count FROM players WHERE season_id = $1`, [season.id]),
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
    app.get('/:id/profile', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id } = request.params;
        const res = await (0, client_1.query)(`SELECT id, username, net_worth, alignment, reputation_score, meta_points,
              season_history, cosmetics
         FROM players WHERE id = $1`, [id]);
        if (res.rows.length === 0)
            return reply.status(404).send({ error: 'Player not found' });
        return reply.send({ data: res.rows[0] });
    });
}
//# sourceMappingURL=players.js.map