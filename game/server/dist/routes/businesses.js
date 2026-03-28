"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessRoutes = businessRoutes;
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const client_1 = require("../db/client");
const networth_1 = require("../lib/networth");
const constants_1 = require("../lib/constants");
const entities_1 = require("../../../shared/src/types/entities");
const simulation_1 = require("../jobs/simulation");
const CreateBusinessSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50),
    type: zod_1.z.enum(['RETAIL', 'FACTORY', 'MINE', 'FARM', 'LOGISTICS', 'SECURITY_FIRM', 'FRONT_COMPANY']),
    city: zod_1.z.enum(['Ironport', 'Duskfield', 'Ashvale', 'Coldmarsh', 'Farrow']),
});
const UpdateBusinessSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50).optional(),
    status: zod_1.z.enum(['ACTIVE', 'IDLE']).optional(),
}).refine(d => d.name !== undefined || d.status !== undefined, {
    message: 'At least one of name or status must be provided',
});
const BASE_CAPACITY = {
    RETAIL: 200,
    FACTORY: 500,
    MINE: 400,
    FARM: 600,
    LOGISTICS: 300,
    SECURITY_FIRM: 100,
    FRONT_COMPANY: 300,
};
async function businessRoutes(app) {
    // GET /businesses
    app.get('/', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const res = await (0, client_1.query)(`SELECT b.*,
              (SELECT COUNT(*)::int FROM employees e WHERE e.business_id = b.id) AS employee_count
         FROM businesses b
        WHERE b.owner_id = $1 AND b.status != 'BANKRUPT'
        ORDER BY b.established_at ASC`, [request.player.id]);
        return reply.send({ data: res.rows });
    });
    // POST /businesses
    app.post('/', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const parsed = CreateBusinessSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.errors[0].message });
        }
        const { name, type, city } = parsed.data;
        const playerId = request.player.id;
        const seasonId = request.player.season_id;
        try {
            const biz = await (0, client_1.withTransaction)(async (client) => {
                const playerRow = await client.query(`SELECT cash, business_slots FROM players WHERE id = $1 FOR UPDATE`, [playerId]);
                if (!playerRow.rows.length)
                    throw Object.assign(new Error('Player not found'), { statusCode: 404 });
                const player = playerRow.rows[0];
                const countRes = await client.query(`SELECT COUNT(*) AS cnt FROM businesses WHERE owner_id = $1 AND status != 'BANKRUPT'`, [playerId]);
                if (Number(countRes.rows[0].cnt) >= player.business_slots) {
                    throw Object.assign(new Error('Business slot limit reached'), { statusCode: 400 });
                }
                const costs = entities_1.BUSINESS_BASE_COSTS[type];
                const startupCost = costs?.startup ?? 5000;
                const dailyCost = costs?.daily_operating ?? 200;
                if (Number(player.cash) < startupCost) {
                    throw Object.assign(new Error('Insufficient funds'), { statusCode: 400 });
                }
                const isFront = type === 'FRONT_COMPANY';
                const baseCapacity = BASE_CAPACITY[type] ?? 200;
                const bizRes = await client.query(`INSERT INTO businesses
             (owner_id, season_id, name, type, tier, city, status, capacity,
              efficiency, inventory, storage_cap, daily_operating_cost, is_front, front_capacity)
           VALUES ($1,$2,$3,$4,1,$5,'ACTIVE',$6,1.0,'{}',1000,$7,$8,$9)
           RETURNING id`, [
                    playerId, seasonId, name, type, city,
                    baseCapacity, dailyCost, isFront, isFront ? 50000 : 0,
                ]);
                const businessId = bizRes.rows[0].id;
                await client.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [startupCost, playerId]);
                return businessId;
            });
            await (0, networth_1.recalculateNetWorth)(playerId);
            const res = await (0, client_1.query)(`SELECT * FROM businesses WHERE id = $1`, [biz]);
            return reply.status(201).send({ data: res.rows[0] });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 500).send({ error: e.message });
        }
    });
    // GET /businesses/:id
    app.get('/:id', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id } = request.params;
        const res = await (0, client_1.query)(`SELECT b.*,
              sl.tier AS security_tier, sl.protection_rating, sl.daily_cost AS security_daily_cost
         FROM businesses b
         LEFT JOIN security_layers sl ON sl.id = b.security_layer_id
        WHERE b.id = $1 AND b.owner_id = $2`, [id, request.player.id]);
        if (res.rows.length === 0)
            return reply.status(404).send({ error: 'Business not found' });
        const empRes = await (0, client_1.query)(`SELECT * FROM employees WHERE business_id = $1 ORDER BY hired_at ASC`, [id]);
        return reply.send({ data: { ...res.rows[0], employees: empRes.rows } });
    });
    // PUT /businesses/:id
    app.put('/:id', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id } = request.params;
        const parsed = UpdateBusinessSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.errors[0].message });
        }
        const setClauses = [];
        const values = [];
        let pi = 1;
        if (parsed.data.name !== undefined) {
            setClauses.push(`name = $${pi++}`);
            values.push(parsed.data.name);
        }
        if (parsed.data.status !== undefined) {
            setClauses.push(`status = $${pi++}`);
            values.push(parsed.data.status);
        }
        values.push(id, request.player.id);
        await (0, client_1.query)(`UPDATE businesses SET ${setClauses.join(', ')} WHERE id = $${pi++} AND owner_id = $${pi++}`, values);
        const res = await (0, client_1.query)(`SELECT * FROM businesses WHERE id = $1`, [id]);
        if (res.rows.length === 0)
            return reply.status(404).send({ error: 'Business not found' });
        return reply.send({ data: res.rows[0] });
    });
    // POST /businesses/:id/upgrade
    app.post('/:id/upgrade', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id } = request.params;
        const playerId = request.player.id;
        try {
            await (0, client_1.withTransaction)(async (client) => {
                const bizRow = await client.query(`SELECT type, tier FROM businesses WHERE id = $1 AND owner_id = $2 FOR UPDATE`, [id, playerId]);
                if (!bizRow.rows.length)
                    throw Object.assign(new Error('Business not found'), { statusCode: 404 });
                const biz = bizRow.rows[0];
                if (biz.tier >= 4)
                    throw Object.assign(new Error('Already max tier'), { statusCode: 400 });
                const nextTier = biz.tier + 1;
                const upgradeCosts = constants_1.UPGRADE_COSTS[biz.type];
                const cost = upgradeCosts?.[nextTier] ?? 999999;
                const playerRow = await client.query(`SELECT cash FROM players WHERE id = $1 FOR UPDATE`, [playerId]);
                if (Number(playerRow.rows[0].cash) < cost) {
                    throw Object.assign(new Error(`Insufficient funds (need $${cost})`), { statusCode: 400 });
                }
                const tierMultiplier = constants_1.TIER_CAPACITY_MULTIPLIER[nextTier] ?? 1.0;
                const baseCapacity = BASE_CAPACITY[biz.type] ?? 200;
                const newCapacity = Math.round(baseCapacity * tierMultiplier);
                await client.query(`UPDATE businesses SET tier = $1, capacity = $2 WHERE id = $3`, [nextTier, newCapacity, id]);
                await client.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [cost, playerId]);
            });
            await (0, networth_1.recalculateNetWorth)(playerId);
            const res = await (0, client_1.query)(`SELECT * FROM businesses WHERE id = $1`, [id]);
            return reply.send({ data: res.rows[0] });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 500).send({ error: e.message });
        }
    });
    // GET /businesses/:id/employees
    app.get('/:id/employees', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id } = request.params;
        const ownerCheck = await (0, client_1.query)(`SELECT id FROM businesses WHERE id = $1 AND owner_id = $2`, [id, request.player.id]);
        if (!ownerCheck.rows.length)
            return reply.status(404).send({ error: 'Business not found' });
        const res = await (0, client_1.query)(`SELECT * FROM employees WHERE business_id = $1`, [id]);
        return reply.send({ data: res.rows });
    });
    // POST /businesses/:id/produce — manual production trigger
    app.post('/:id/produce', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id } = request.params;
        const check = await (0, client_1.query)(`SELECT id FROM businesses WHERE id = $1 AND owner_id = $2`, [id, request.player.id]);
        if (!check.rows.length)
            return reply.status(404).send({ error: 'Business not found' });
        await (0, simulation_1.employee_production)(id);
        await (0, networth_1.recalculateNetWorth)(request.player.id);
        const res = await (0, client_1.query)(`SELECT inventory FROM businesses WHERE id = $1`, [id]);
        return reply.send({ data: { inventory: res.rows[0]?.inventory ?? {} } });
    });
    // GET /businesses/:id/upgrade-info
    app.get('/:id/upgrade-info', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id } = request.params;
        const res = await (0, client_1.query)(`SELECT type, tier, storage_cap FROM businesses WHERE id = $1 AND owner_id = $2`, [id, request.player.id]);
        if (!res.rows.length)
            return reply.status(404).send({ error: 'Business not found' });
        const { type, tier, storage_cap } = res.rows[0];
        const nextTier = tier < 4 ? tier + 1 : null;
        const upgradeCosts = constants_1.UPGRADE_COSTS[type];
        const upgrade_cost = nextTier ? (upgradeCosts?.[nextTier] ?? 0) : 0;
        const baseCapacity = BASE_CAPACITY[type] ?? 200;
        const nextCapacity = nextTier ? Math.round(baseCapacity * (constants_1.TIER_CAPACITY_MULTIPLIER[nextTier] ?? 1)) : 0;
        const capacity_increase = nextCapacity - storage_cap;
        const efficiency_boost = nextTier ? 0.05 : 0;
        return reply.send({
            data: {
                current_tier: tier,
                next_tier: nextTier,
                upgrade_cost,
                capacity_increase,
                efficiency_boost,
            },
        });
    });
    // GET /businesses/:id/revenue
    app.get('/:id/revenue', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id } = request.params;
        const { days = '7' } = request.query;
        const ownerCheck = await (0, client_1.query)(`SELECT id FROM businesses WHERE id = $1 AND owner_id = $2`, [id, request.player.id]);
        if (!ownerCheck.rows.length)
            return reply.status(404).send({ error: 'Business not found' });
        const numDays = Math.min(parseInt(days, 10) || 7, 30);
        const res = await (0, client_1.query)(`SELECT day::text, revenue, expenses
         FROM business_ledger
        WHERE business_id = $1
          AND day >= CURRENT_DATE - INTERVAL '${numDays} days'
        ORDER BY day ASC`, [id]);
        // Build a full array covering the last N days (fill gaps with 0)
        const dates = [];
        const revenues = [];
        const expenses = [];
        const rowMap = new Map(res.rows.map((r) => [r.day, r]));
        for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const row = rowMap.get(key);
            dates.push(key);
            revenues.push(row ? Number(row.revenue) : 0);
            expenses.push(row ? Number(row.expenses) : 0);
        }
        return reply.send({ data: { dates, revenues, expenses } });
    });
    // GET /businesses/:id/config
    app.get('/:id/config', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id } = request.params;
        const res = await (0, client_1.query)(`SELECT producing_resource_id AS resource_id,
              quantity_per_tick,
              auto_sell,
              auto_sell_price
         FROM businesses
        WHERE id = $1 AND owner_id = $2`, [id, request.player.id]);
        if (!res.rows.length)
            return reply.status(404).send({ error: 'Business not found' });
        return reply.send({ data: res.rows[0] });
    });
    // PUT /businesses/:id/config
    const ConfigSchema = zod_1.z.object({
        resource_id: zod_1.z.string().uuid().nullable().optional(),
        auto_sell: zod_1.z.boolean().optional(),
        auto_sell_price: zod_1.z.number().positive().nullable().optional(),
    });
    app.put('/:id/config', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id } = request.params;
        const parsed = ConfigSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.status(400).send({ error: parsed.error.errors[0].message });
        const ownerCheck = await (0, client_1.query)(`SELECT id FROM businesses WHERE id = $1 AND owner_id = $2`, [id, request.player.id]);
        if (!ownerCheck.rows.length)
            return reply.status(404).send({ error: 'Business not found' });
        const setClauses = [];
        const values = [];
        let pi = 1;
        if (parsed.data.resource_id !== undefined) {
            setClauses.push(`producing_resource_id = $${pi++}`);
            values.push(parsed.data.resource_id);
        }
        if (parsed.data.auto_sell !== undefined) {
            setClauses.push(`auto_sell = $${pi++}`);
            values.push(parsed.data.auto_sell);
        }
        if (parsed.data.auto_sell_price !== undefined) {
            setClauses.push(`auto_sell_price = $${pi++}`);
            values.push(parsed.data.auto_sell_price);
        }
        if (!setClauses.length)
            return reply.status(400).send({ error: 'Nothing to update' });
        values.push(id);
        await (0, client_1.query)(`UPDATE businesses SET ${setClauses.join(', ')} WHERE id = $${pi}`, values);
        return reply.send({ data: { success: true } });
    });
    // DELETE /businesses/:id/employees/:employeeId
    app.delete('/:id/employees/:employeeId', { preHandler: [auth_1.requireAuth] }, async (request, reply) => {
        const { id: businessId, employeeId } = request.params;
        const playerId = request.player.id;
        const empRow = await (0, client_1.query)(`SELECT e.id FROM employees e
         JOIN businesses b ON b.id = e.business_id
        WHERE e.id = $1 AND b.id = $2 AND b.owner_id = $3`, [employeeId, businessId, playerId]);
        if (!empRow.rows.length)
            return reply.status(403).send({ error: 'Employee not found or not owned by player' });
        await (0, client_1.query)(`UPDATE employees SET business_id = NULL, hired_at = NULL WHERE id = $1`, [employeeId]);
        return reply.status(204).send();
    });
}
//# sourceMappingURL=businesses.js.map