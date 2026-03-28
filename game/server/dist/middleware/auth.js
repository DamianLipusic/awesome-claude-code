"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const client_1 = require("../db/client");
/**
 * requireAuth — Fastify preHandler hook that verifies the JWT access token
 * and attaches the authenticated player to request.player.
 */
async function requireAuth(request, reply) {
    try {
        await request.jwtVerify();
        const payload = request.user;
        if (payload.type !== 'access') {
            return reply.status(401).send({ error: 'Invalid token type' });
        }
        // Verify player still exists and update last_active
        const res = await (0, client_1.query)(`UPDATE players SET last_active = NOW()
        WHERE id = $1
       RETURNING id, username, season_id`, [payload.sub]);
        if (res.rows.length === 0) {
            return reply.status(401).send({ error: 'Player not found' });
        }
        request.player = {
            id: res.rows[0].id,
            username: res.rows[0].username,
            season_id: res.rows[0].season_id,
        };
    }
    catch (err) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
}
//# sourceMappingURL=auth.js.map