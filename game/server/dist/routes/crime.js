"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crimeRoutes = crimeRoutes;
const zod_1 = require("zod");
const client_1 = require("../db/client");
const auth_1 = require("../middleware/auth");
const constants_1 = require("../lib/constants");
const entities_1 = require("../../../shared/src/types/entities");
const queue_1 = require("../jobs/queue");
// ─── Input schemas ────────────────────────────────────────────
const StartOperationSchema = zod_1.z.object({
    op_type: zod_1.z.enum([
        'SMUGGLING', 'THEFT', 'EXTORTION', 'FRAUD',
        'DRUG_TRADE', 'BRIBERY', 'SABOTAGE',
    ]),
    employees: zod_1.z.array(zod_1.z.string().uuid()),
    business_id: zod_1.z.string().uuid().optional(),
});
const LaunderingSchema = zod_1.z.object({
    method: zod_1.z.enum(['BUSINESS_REVENUE', 'REAL_ESTATE', 'SHELL_COMPANY', 'CRYPTO_ANALOG']),
    amount: zod_1.z.number().positive(),
    business_id: zod_1.z.string().uuid(),
});
const LayLowSchema = zod_1.z.object({
    active: zod_1.z.boolean(),
});
// ─── Route plugin ─────────────────────────────────────────────
async function crimeRoutes(fastify) {
    // GET /crime/heat
    fastify.get('/heat', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const result = await (0, client_1.query)(`SELECT * FROM heat_scores WHERE player_id = $1 AND season_id = $2`, [playerId, playerSeasonId]);
        if (!result.rows.length) {
            return reply.status(404).send({ error: 'Heat score not found' });
        }
        return reply.send({ data: result.rows[0] });
    });
    // GET /crime/dirty-money
    fastify.get('/dirty-money', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const result = await (0, client_1.query)(`SELECT * FROM dirty_money_balances WHERE player_id = $1 AND season_id = $2`, [playerId, playerSeasonId]);
        if (!result.rows.length) {
            return reply.status(404).send({ error: 'Dirty money balance not found' });
        }
        return reply.send({ data: result.rows[0] });
    });
    // GET /crime/operations/available
    fastify.get('/operations/available', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        // Get player heat level
        const heatRow = await (0, client_1.query)(`SELECT level FROM heat_scores WHERE player_id = $1 AND season_id = $2`, [playerId, playerSeasonId]);
        const heatLevel = heatRow.rows[0]?.level ?? 'COLD';
        // Determine max risk level allowed
        let maxRisk = 10;
        if (heatLevel === 'FUGITIVE')
            maxRisk = 4;
        else if (heatLevel === 'BURNING')
            maxRisk = 6;
        // Get player's criminal-capable employee count
        const criminalEmpRow = await (0, client_1.query)(`SELECT COUNT(*) AS count
         FROM employees e
         JOIN businesses b ON b.id = e.business_id
         WHERE b.owner_id = $1 AND b.season_id = $2 AND e.criminal_capable = TRUE`, [playerId, playerSeasonId]);
        const criminalEmployeeCount = parseInt(criminalEmpRow.rows[0]?.count ?? '0', 10);
        // Filter CRIME_OP_CONFIGS by heat level
        const available = Object.entries(entities_1.CRIME_OP_CONFIGS)
            .filter(([, config]) => config.risk_level <= maxRisk)
            .map(([op_type, config]) => ({
            op_type,
            ...config,
            can_perform: criminalEmployeeCount >= config.requires_criminal_employees,
            criminal_employees_available: criminalEmployeeCount,
        }));
        return reply.send({ data: { heat_level: heatLevel, operations: available } });
    });
    // GET /crime/operations/active
    fastify.get('/operations/active', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const result = await (0, client_1.query)(`SELECT * FROM criminal_operations
         WHERE player_id = $1 AND season_id = $2 AND status = 'ACTIVE'
         ORDER BY started_at DESC`, [playerId, playerSeasonId]);
        return reply.send({ data: result.rows });
    });
    // POST /crime/operations
    fastify.post('/operations', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const parsed = StartOperationSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const { op_type, employees, business_id } = parsed.data;
        const config = entities_1.CRIME_OP_CONFIGS[op_type];
        if (!config) {
            return reply.status(400).send({ error: `Unknown op_type: ${op_type}` });
        }
        try {
            const operation = await (0, client_1.withTransaction)(async (client) => {
                // Get player heat level
                const heatRow = await client.query(`SELECT level, score FROM heat_scores WHERE player_id = $1 AND season_id = $2 FOR UPDATE`, [playerId, playerSeasonId]);
                if (!heatRow.rows.length) {
                    throw Object.assign(new Error('Heat score not found'), { statusCode: 404 });
                }
                const heatLevel = heatRow.rows[0].level;
                // Check heat level allows this op
                if (heatLevel === 'FUGITIVE' && config.risk_level > 4) {
                    throw Object.assign(new Error('Heat level FUGITIVE restricts operations to risk_level <= 4'), { statusCode: 400 });
                }
                if (heatLevel === 'BURNING' && config.risk_level > 6) {
                    throw Object.assign(new Error('Heat level BURNING restricts operations to risk_level <= 6'), { statusCode: 400 });
                }
                // Validate employees: criminal_capable, belong to player, not on another active op
                if (employees.length > 0) {
                    const empCheck = await client.query(`SELECT
                 e.id,
                 e.criminal_capable,
                 EXISTS (
                   SELECT 1 FROM criminal_operations co
                   WHERE co.status = 'ACTIVE'
                     AND e.id = ANY(co.employees_assigned)
                 ) AS on_active_op
               FROM employees e
               JOIN businesses b ON b.id = e.business_id
               WHERE e.id = ANY($1::uuid[])
                 AND b.owner_id = $2
                 AND b.season_id = $3`, [employees, playerId, playerSeasonId]);
                    if (empCheck.rows.length !== employees.length) {
                        throw Object.assign(new Error('One or more employees not found or not owned by player'), { statusCode: 400 });
                    }
                    for (const emp of empCheck.rows) {
                        if (!emp.criminal_capable) {
                            throw Object.assign(new Error(`Employee ${emp.id} is not criminal_capable`), { statusCode: 400 });
                        }
                        if (emp.on_active_op) {
                            throw Object.assign(new Error(`Employee ${emp.id} is already assigned to an active operation`), { statusCode: 400 });
                        }
                    }
                }
                // Validate we have enough criminal employees for this op
                if (employees.length < config.requires_criminal_employees) {
                    throw Object.assign(new Error(`This operation requires ${config.requires_criminal_employees} criminal-capable employees`), { statusCode: 400 });
                }
                // completes_at = NOW() + config.duration_hours
                const insertResult = await client.query(`INSERT INTO criminal_operations
               (player_id, business_id, season_id, op_type, status,
                started_at, completes_at, dirty_money_yield, risk_level,
                employees_assigned, was_detected, penalty_applied, detection_roll)
             VALUES
               ($1, $2, $3, $4, 'ACTIVE',
                NOW(), NOW() + ($5 || ' hours')::interval, $6, $7,
                $8::uuid[], NULL, NULL, NULL)
             RETURNING *`, [
                    playerId,
                    business_id ?? null,
                    playerSeasonId,
                    op_type,
                    config.duration_hours,
                    config.base_yield,
                    config.risk_level,
                    employees,
                ]);
                const op = insertResult.rows[0];
                // Update player alignment: first op = MIXED, repeated = CRIMINAL
                await client.query(`UPDATE players
               SET alignment = CASE
                 WHEN alignment = 'LEGAL' THEN 'MIXED'::player_alignment
                 ELSE 'CRIMINAL'::player_alignment
               END
             WHERE id = $1`, [playerId]);
                // UPDATE heat_scores.last_criminal_act
                await client.query(`UPDATE heat_scores SET last_criminal_act = NOW() WHERE player_id = $1 AND season_id = $2`, [playerId, playerSeasonId]);
                // Schedule crime_resolve job
                await (0, queue_1.scheduleCrimeResolveJob)(op.id, new Date(op.completes_at));
                return op;
            });
            return reply.status(201).send({ data: operation });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 500).send({ error: e.message });
        }
    });
    // POST /crime/laundering
    fastify.post('/laundering', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const parsed = LaunderingSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const { method, amount, business_id } = parsed.data;
        const methodConfig = entities_1.LAUNDERING_METHODS[method];
        if (!methodConfig) {
            return reply.status(400).send({ error: `Unknown laundering method: ${method}` });
        }
        try {
            const process = await (0, client_1.withTransaction)(async (client) => {
                // Validate dirty money balance
                const dirtyRow = await client.query(`SELECT total_dirty FROM dirty_money_balances
             WHERE player_id = $1 AND season_id = $2 FOR UPDATE`, [playerId, playerSeasonId]);
                if (!dirtyRow.rows.length || dirtyRow.rows[0].total_dirty < amount) {
                    throw Object.assign(new Error(`Insufficient dirty money: need ${amount}, have ${dirtyRow.rows[0]?.total_dirty ?? 0}`), { statusCode: 400 });
                }
                // Validate method requirements
                if (method === 'BUSINESS_REVENUE' || method === 'SHELL_COMPANY') {
                    const bizRow = await client.query(`SELECT id, is_front, front_capacity FROM businesses WHERE id = $1 AND owner_id = $2 AND season_id = $3`, [business_id, playerId, playerSeasonId]);
                    if (!bizRow.rows.length) {
                        throw Object.assign(new Error('Business not found or not owned by player'), { statusCode: 403 });
                    }
                    if (!bizRow.rows[0].is_front) {
                        throw Object.assign(new Error(`Method ${method} requires a front business (is_front = true)`), { statusCode: 400 });
                    }
                    // Check daily front_capacity not exceeded
                    const usedToday = await client.query(`SELECT COALESCE(SUM(dirty_amount), 0) AS used
               FROM laundering_processes
               WHERE business_id = $1
                 AND status = 'IN_PROGRESS'
                 AND started_at >= NOW() - INTERVAL '1 day'`, [business_id]);
                    const used = parseFloat(usedToday.rows[0]?.used ?? '0');
                    if (used + amount > bizRow.rows[0].front_capacity) {
                        throw Object.assign(new Error(`Business front_capacity exceeded for today: used ${used}, capacity ${bizRow.rows[0].front_capacity}`), { statusCode: 400 });
                    }
                }
                else if (method === 'REAL_ESTATE') {
                    const playerRow = await client.query(`SELECT net_worth FROM players WHERE id = $1`, [playerId]);
                    if (!playerRow.rows.length || playerRow.rows[0].net_worth <= 500000) {
                        throw Object.assign(new Error('REAL_ESTATE laundering requires net_worth > 500000'), { statusCode: 400 });
                    }
                }
                // CRYPTO_ANALOG: always available, no extra validation
                // Validate max_per_day
                if (amount > methodConfig.max_per_day) {
                    throw Object.assign(new Error(`Amount exceeds max_per_day of ${methodConfig.max_per_day} for method ${method}`), { statusCode: 400 });
                }
                const fee = amount * methodConfig.fee;
                const clean_amount = amount - fee;
                const duration_hours = (amount / 10000) * methodConfig.hours_per_10k;
                // INSERT laundering_process
                const insertResult = await client.query(`INSERT INTO laundering_processes
               (player_id, business_id, season_id, dirty_amount, fee_percent, clean_amount,
                method, started_at, completes_at, status, detection_risk)
             VALUES
               ($1, $2, $3, $4, $5, $6, $7, NOW(),
                NOW() + ($8 || ' hours')::interval, 'IN_PROGRESS', $9)
             RETURNING *`, [
                    playerId,
                    business_id,
                    playerSeasonId,
                    amount,
                    methodConfig.fee,
                    clean_amount,
                    method,
                    duration_hours,
                    methodConfig.detection_modifier,
                ]);
                // Reserve dirty money: total_dirty -= amount
                await client.query(`UPDATE dirty_money_balances
             SET total_dirty = total_dirty - $1
             WHERE player_id = $2 AND season_id = $3`, [amount, playerId, playerSeasonId]);
                return insertResult.rows[0];
            });
            return reply.status(201).send({ data: process });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 500).send({ error: e.message });
        }
    });
    // GET /crime/laundering/active
    fastify.get('/laundering/active', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const result = await (0, client_1.query)(`SELECT * FROM laundering_processes
         WHERE player_id = $1 AND season_id = $2 AND status = 'IN_PROGRESS'
         ORDER BY started_at DESC`, [playerId, playerSeasonId]);
        return reply.send({ data: result.rows });
    });
    // POST /crime/heat/bribe
    fastify.post('/heat/bribe', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        try {
            const result = await (0, client_1.withTransaction)(async (client) => {
                const heatRow = await client.query(`SELECT id, score, level, bribe_cooldown
             FROM heat_scores
             WHERE player_id = $1 AND season_id = $2 FOR UPDATE`, [playerId, playerSeasonId]);
                if (!heatRow.rows.length) {
                    throw Object.assign(new Error('Heat score not found'), { statusCode: 404 });
                }
                const heat = heatRow.rows[0];
                // Check bribe cooldown
                if (heat.bribe_cooldown && new Date(heat.bribe_cooldown) > new Date()) {
                    const remainingMs = new Date(heat.bribe_cooldown).getTime() - Date.now();
                    const remainingHours = (remainingMs / (1000 * 60 * 60)).toFixed(1);
                    throw Object.assign(new Error(`Bribe on cooldown. ${remainingHours} hours remaining.`), { statusCode: 429, cooldown_remaining_hours: remainingHours });
                }
                const bribeCost = constants_1.BRIBE_COSTS[heat.level];
                if (bribeCost === undefined) {
                    throw Object.assign(new Error(`No bribe cost defined for heat level ${heat.level}`), { statusCode: 500 });
                }
                // Lock player and check cash
                const playerRow = await client.query(`SELECT cash FROM players WHERE id = $1 FOR UPDATE`, [playerId]);
                if (!playerRow.rows.length) {
                    throw Object.assign(new Error('Player not found'), { statusCode: 404 });
                }
                if (playerRow.rows[0].cash < bribeCost) {
                    throw Object.assign(new Error(`Insufficient cash for bribe: need ${bribeCost}, have ${playerRow.rows[0].cash}`), { statusCode: 400 });
                }
                // Deduct from cash (not dirty money)
                await client.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [bribeCost, playerId]);
                // Reduce heat score by BRIBE_HEAT_REDUCTION, recalculate level
                const newScore = Math.max(0, heat.score - constants_1.BRIBE_HEAT_REDUCTION);
                const newLevel = scoreToHeatLevel(newScore);
                const newCooldown = `NOW() + INTERVAL '${constants_1.BRIBE_COOLDOWN_HOURS} hours'`;
                const updatedHeat = await client.query(`UPDATE heat_scores
             SET score = $1,
                 level = $2,
                 bribe_cooldown = NOW() + ($3 || ' hours')::interval
             WHERE id = $4
             RETURNING *`, [newScore, newLevel, constants_1.BRIBE_COOLDOWN_HOURS, heat.id]);
                return { bribe_cost: bribeCost, new_score: newScore, new_level: newLevel, heat: updatedHeat.rows[0] };
            });
            return reply.send({ data: result });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 500).send({
                error: e.message,
                ...(e.cooldown_remaining_hours ? { cooldown_remaining_hours: e.cooldown_remaining_hours } : {}),
            });
        }
    });
    // PUT /crime/heat/lay-low
    fastify.put('/heat/lay-low', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const playerId = request.player.id;
        const playerSeasonId = request.player.season_id;
        const parsed = LayLowSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const { active } = parsed.data;
        try {
            const result = await (0, client_1.withTransaction)(async (client) => {
                // Toggle lay_low via decay_rate: active = 2x base (4.0), inactive = base (2.0)
                const newDecayRate = active ? 4.0 : 2.0;
                const heatUpdate = await client.query(`UPDATE heat_scores
               SET decay_rate = $1
             WHERE player_id = $2 AND season_id = $3
             RETURNING *`, [newDecayRate, playerId, playerSeasonId]);
                if (!heatUpdate.rows.length) {
                    throw Object.assign(new Error('Heat score not found'), { statusCode: 404 });
                }
                // If activating lay_low: abort all active criminal operations
                let abortedOps = [];
                if (active) {
                    const abortResult = await client.query(`UPDATE criminal_operations
                 SET status = 'ABORTED'
               WHERE player_id = $1 AND season_id = $2 AND status = 'ACTIVE'
               RETURNING id`, [playerId, playerSeasonId]);
                    abortedOps = abortResult.rows;
                }
                return { heat: heatUpdate.rows[0], lay_low: active, aborted_operations: abortedOps };
            });
            return reply.send({ data: result });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 500).send({ error: e.message });
        }
    });
}
// ─── Helper: convert numeric score to HeatLevel ───────────────
function scoreToHeatLevel(score) {
    if (score >= 900)
        return 'FUGITIVE';
    if (score >= 600)
        return 'BURNING';
    if (score >= 300)
        return 'HOT';
    if (score >= 100)
        return 'WARM';
    return 'COLD';
}
//# sourceMappingURL=crime.js.map