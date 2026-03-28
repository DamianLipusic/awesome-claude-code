"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractRoutes = contractRoutes;
const zod_1 = require("zod");
const client_1 = require("../db/client");
const auth_1 = require("../middleware/auth");
// ─── Input schemas ────────────────────────────────────────────
const CreateContractSchema = zod_1.z.object({
    resource_id: zod_1.z.string().uuid(),
    quantity_per_period: zod_1.z.number().int().positive(),
    price_per_unit: zod_1.z.number().positive(),
    period: zod_1.z.enum(['DAILY', 'WEEKLY']),
    duration_periods: zod_1.z.number().int().positive(),
    breach_penalty: zod_1.z.number().min(0).optional().default(0),
    delivery_city: zod_1.z.string().min(1),
    counterparty_id: zod_1.z.string().uuid().nullable().optional(),
});
// ─── Route plugin ─────────────────────────────────────────────
async function contractRoutes(fastify) {
    // GET /contracts — my active + pending contracts (as initiator or counterparty)
    fastify.get('/', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const result = await (0, client_1.query)(`SELECT
           tc.id,
           tc.season_id,
           tc.initiator_id,
           pi.username AS initiator_username,
           tc.counterparty_id,
           pc.username AS counterparty_username,
           tc.resource_id,
           r.name AS resource_name,
           tc.quantity_per_period,
           tc.price_per_unit,
           tc.period,
           tc.duration_periods,
           tc.periods_completed,
           tc.status,
           tc.created_at,
           tc.next_settlement,
           tc.breach_penalty,
           tc.auto_renew,
           tc.price_locked,
           tc.delivery_city
         FROM trade_contracts tc
         JOIN players pi ON pi.id = tc.initiator_id
         LEFT JOIN players pc ON pc.id = tc.counterparty_id
         JOIN resources r ON r.id = tc.resource_id
         WHERE tc.season_id = $1
           AND (tc.initiator_id = $2 OR tc.counterparty_id = $2)
           AND tc.status IN ('ACTIVE', 'PENDING')
         ORDER BY tc.created_at DESC`, [playerSeasonId, playerId]);
        return reply.send({ data: result.rows });
    });
    // GET /contracts/open — all PENDING open offers (counterparty_id IS NULL), paginated
    fastify.get('/open', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerSeasonId = request.player.season_id;
        const { offset } = request.query;
        const limit = 20;
        const offsetVal = parseInt(offset ?? '0', 10);
        const result = await (0, client_1.query)(`SELECT
           tc.id,
           tc.season_id,
           tc.initiator_id,
           p.username AS initiator_username,
           tc.resource_id,
           r.name AS resource_name,
           tc.quantity_per_period,
           tc.price_per_unit,
           tc.period,
           tc.duration_periods,
           tc.periods_completed,
           tc.status,
           tc.created_at,
           tc.breach_penalty,
           tc.delivery_city
         FROM trade_contracts tc
         JOIN players p ON p.id = tc.initiator_id
         JOIN resources r ON r.id = tc.resource_id
         WHERE tc.season_id = $1
           AND tc.status = 'PENDING'
           AND tc.counterparty_id IS NULL
         ORDER BY tc.created_at DESC
         LIMIT $2 OFFSET $3`, [playerSeasonId, limit, offsetVal]);
        const countResult = await (0, client_1.query)(`SELECT COUNT(*) AS count
         FROM trade_contracts
         WHERE season_id = $1
           AND status = 'PENDING'
           AND counterparty_id IS NULL`, [playerSeasonId]);
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
        return reply.send({
            data: {
                items: result.rows,
                total,
                limit,
                offset: offsetVal,
            },
        });
    });
    // POST /contracts — create a new contract or open offer
    fastify.post('/', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const parsed = CreateContractSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const { resource_id, quantity_per_period, price_per_unit, period, duration_periods, breach_penalty, delivery_city, counterparty_id, } = parsed.data;
        // Validate resource exists in this season
        const resourceCheck = await (0, client_1.query)(`SELECT id FROM resources WHERE id = $1 AND season_id = $2`, [resource_id, playerSeasonId]);
        if (!resourceCheck.rows.length) {
            return reply.status(400).send({ error: 'Resource not found in current season' });
        }
        try {
            const contract = await (0, client_1.withTransaction)(async (client) => {
                // Validate counterparty exists if provided
                if (counterparty_id) {
                    const cpRow = await client.query(`SELECT id FROM players WHERE id = $1 AND season_id = $2`, [counterparty_id, playerSeasonId]);
                    if (!cpRow.rows.length) {
                        throw Object.assign(new Error('Counterparty player not found'), { statusCode: 404 });
                    }
                    if (counterparty_id === playerId) {
                        throw Object.assign(new Error('Cannot create a contract with yourself'), { statusCode: 400 });
                    }
                }
                const settlementInterval = period === 'DAILY' ? '1 day' : '7 days';
                const insertResult = await client.query(`INSERT INTO trade_contracts
               (season_id, initiator_id, counterparty_id, resource_id, quantity_per_period,
                price_per_unit, period, duration_periods, periods_completed, status,
                breach_penalty, delivery_city, auto_renew, price_locked,
                next_settlement, created_at)
             VALUES
               ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'PENDING', $9, $10, FALSE, FALSE,
                NOW() + $11::interval,
                NOW())
             RETURNING *`, [
                    playerSeasonId,
                    playerId,
                    counterparty_id ?? null,
                    resource_id,
                    quantity_per_period,
                    price_per_unit,
                    period,
                    duration_periods,
                    breach_penalty,
                    delivery_city,
                    settlementInterval,
                ]);
                const contract = insertResult.rows[0];
                // Notify counterparty if specified
                if (counterparty_id) {
                    await client.query(`INSERT INTO alerts (player_id, season_id, type, message, created_at, read, data)
               VALUES ($1, $2, 'MARKET_CONTRACT_OFFER',
                 'You have received a new trade contract offer', NOW(), FALSE, $3)`, [
                        counterparty_id,
                        playerSeasonId,
                        JSON.stringify({ contract_id: contract.id, initiator_id: playerId }),
                    ]);
                }
                return contract;
            });
            return reply.status(201).send({ data: contract });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 500).send({ error: e.message });
        }
    });
    // POST /contracts/:id/accept
    fastify.post('/:id/accept', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const { id: contractId } = request.params;
        try {
            const contract = await (0, client_1.withTransaction)(async (client) => {
                const contractRow = await client.query(`SELECT * FROM trade_contracts WHERE id = $1 AND season_id = $2 FOR UPDATE`, [contractId, playerSeasonId]);
                if (!contractRow.rows.length) {
                    throw Object.assign(new Error('Contract not found'), { statusCode: 404 });
                }
                const ct = contractRow.rows[0];
                if (ct.status !== 'PENDING') {
                    throw Object.assign(new Error(`Cannot accept a contract with status '${ct.status}'`), { statusCode: 400 });
                }
                if (ct.counterparty_id !== null && ct.counterparty_id !== playerId) {
                    throw Object.assign(new Error('This contract is not open for you to accept'), { statusCode: 403 });
                }
                if (ct.initiator_id === playerId) {
                    throw Object.assign(new Error('Cannot accept your own contract'), { statusCode: 400 });
                }
                const updateResult = await client.query(`UPDATE trade_contracts
             SET status = 'ACTIVE',
                 counterparty_id = $1,
                 next_settlement = NOW() + CASE period WHEN 'DAILY' THEN INTERVAL '1 day' ELSE INTERVAL '7 days' END
             WHERE id = $2
             RETURNING *`, [playerId, contractId]);
                // Notify initiator
                await client.query(`INSERT INTO alerts (player_id, season_id, type, message, created_at, read, data)
             VALUES ($1, $2, 'MARKET_CONTRACT_OFFER',
               'Your contract offer has been accepted', NOW(), FALSE, $3)`, [
                    ct.initiator_id,
                    playerSeasonId,
                    JSON.stringify({ contract_id: contractId, counterparty_id: playerId }),
                ]);
                return updateResult.rows[0];
            });
            return reply.send({ data: contract });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 500).send({ error: e.message });
        }
    });
    // DELETE /contracts/:id — cancel a PENDING contract you initiated
    fastify.delete('/:id', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const { id: contractId } = request.params;
        try {
            await (0, client_1.withTransaction)(async (client) => {
                const contractRow = await client.query(`SELECT id, initiator_id, status
             FROM trade_contracts
             WHERE id = $1 AND season_id = $2
             FOR UPDATE`, [contractId, playerSeasonId]);
                if (!contractRow.rows.length) {
                    throw Object.assign(new Error('Contract not found'), { statusCode: 404 });
                }
                const ct = contractRow.rows[0];
                if (ct.initiator_id !== playerId) {
                    throw Object.assign(new Error('Only the initiator can cancel this contract'), { statusCode: 403 });
                }
                if (ct.status !== 'PENDING') {
                    throw Object.assign(new Error(`Cannot cancel a contract with status '${ct.status}'`), { statusCode: 400 });
                }
                await client.query(`UPDATE trade_contracts SET status = 'CANCELLED' WHERE id = $1`, [contractId]);
            });
            return reply.send({ data: { cancelled: true } });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 500).send({ error: e.message });
        }
    });
}
//# sourceMappingURL=contracts.js.map