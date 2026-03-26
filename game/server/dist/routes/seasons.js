"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seasonRoutes = seasonRoutes;
const client_1 = require("../db/client");
const auth_1 = require("../middleware/auth");
// ─── Route plugin ─────────────────────────────────────────────
async function seasonRoutes(fastify) {
    // GET /seasons/current
    fastify.get('/current', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const result = await (0, client_1.query)(`SELECT
           id, season_number, name, started_at, ends_at, status, starting_cash,
           tax_rate_brackets, crime_multiplier, resource_set, special_rule,
           total_players, top_players, winner_id,
           EXTRACT(EPOCH FROM (ends_at - NOW()))::int AS time_remaining_seconds
         FROM season_profiles
         WHERE status IN ('ACTIVE', 'ENDING')
         ORDER BY started_at DESC
         LIMIT 1`);
        if (!result.rows.length) {
            return reply.status(404).send({ error: 'No active season found' });
        }
        return reply.send({ data: result.rows[0] });
    });
    // GET /seasons/history
    fastify.get('/history', { preHandler: [auth_1.requireAuth] }, async (_request, reply) => {
        const result = await (0, client_1.query)(`SELECT
           id, season_number, name, started_at, ends_at, status, starting_cash,
           tax_rate_brackets, crime_multiplier, resource_set, special_rule,
           total_players, top_players, winner_id
         FROM season_profiles
         WHERE status = 'COMPLETED'
         ORDER BY started_at DESC
         LIMIT 10`);
        return reply.send({ data: result.rows });
    });
}
//# sourceMappingURL=seasons.js.map