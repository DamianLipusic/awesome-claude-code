import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { query, withTransaction } from '../db/client';
import { recalculateNetWorth } from '../lib/networth';
import { UPGRADE_COSTS, TIER_CAPACITY_MULTIPLIER } from '../lib/constants';
import { BUSINESS_BASE_COSTS } from '../../../shared/src/types/entities';
import type { BusinessType } from '../../../shared/src/types/entities';
import { employee_production } from '../jobs/simulation';

const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['RETAIL', 'FACTORY', 'MINE', 'FARM', 'LOGISTICS', 'SECURITY_FIRM', 'FRONT_COMPANY']),
  city: z.enum(['Ironport', 'Duskfield', 'Ashvale', 'Coldmarsh', 'Farrow']),
});

const UpdateBusinessSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  status: z.enum(['ACTIVE', 'IDLE']).optional(),
}).refine(d => d.name !== undefined || d.status !== undefined, {
  message: 'At least one of name or status must be provided',
});

const BASE_CAPACITY: Record<BusinessType, number> = {
  RETAIL: 200,
  FACTORY: 500,
  MINE: 400,
  FARM: 600,
  LOGISTICS: 300,
  SECURITY_FIRM: 100,
  FRONT_COMPANY: 300,
};

export async function businessRoutes(app: FastifyInstance): Promise<void> {
  // GET /businesses
  app.get('/', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT b.*,
              (SELECT COUNT(*)::int FROM employees e WHERE e.business_id = b.id) AS employee_count
         FROM businesses b
        WHERE b.owner_id = $1 AND b.status != 'BANKRUPT'
        ORDER BY b.established_at ASC`,
      [request.player.id],
    );
    return reply.send({ data: res.rows });
  });

  // POST /businesses
  app.post('/', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateBusinessSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { name, type, city } = parsed.data;

    const playerId = request.player.id;
    const seasonId = request.player.season_id;

    try {
      const biz = await withTransaction(async (client) => {
        const playerRow = await client.query<{ cash: string; business_slots: number }>(
          `SELECT cash, business_slots FROM players WHERE id = $1 FOR UPDATE`,
          [playerId],
        );
        if (!playerRow.rows.length) throw Object.assign(new Error('Player not found'), { statusCode: 404 });
        const player = playerRow.rows[0];

        const countRes = await client.query<{ cnt: string }>(
          `SELECT COUNT(*) AS cnt FROM businesses WHERE owner_id = $1 AND status != 'BANKRUPT'`,
          [playerId],
        );
        if (Number(countRes.rows[0].cnt) >= player.business_slots) {
          throw Object.assign(new Error('Business slot limit reached'), { statusCode: 400 });
        }

        const costs = BUSINESS_BASE_COSTS[type as BusinessType];
        const startupCost = costs?.startup ?? 5000;
        const dailyCost = costs?.daily_operating ?? 200;

        if (Number(player.cash) < startupCost) {
          throw Object.assign(new Error('Insufficient funds'), { statusCode: 400 });
        }

        const isFront = type === 'FRONT_COMPANY';
        const baseCapacity = BASE_CAPACITY[type as BusinessType] ?? 200;

        const bizRes = await client.query<{ id: string }>(
          `INSERT INTO businesses
             (owner_id, season_id, name, type, tier, city, status, capacity,
              efficiency, inventory, storage_cap, daily_operating_cost, is_front, front_capacity)
           VALUES ($1,$2,$3,$4,1,$5,'ACTIVE',$6,1.0,'{}',1000,$7,$8,$9)
           RETURNING id`,
          [
            playerId, seasonId, name, type, city,
            baseCapacity, dailyCost, isFront, isFront ? 50000 : 0,
          ],
        );
        const businessId = bizRes.rows[0].id;

        await client.query(
          `UPDATE players SET cash = cash - $1 WHERE id = $2`,
          [startupCost, playerId],
        );

        return businessId;
      });

      await recalculateNetWorth(playerId);
      const res = await query(`SELECT * FROM businesses WHERE id = $1`, [biz]);
      return reply.status(201).send({ data: res.rows[0] });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /businesses/:id
  app.get('/:id', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const res = await query(
      `SELECT b.*,
              sl.tier AS security_tier, sl.protection_rating, sl.daily_cost AS security_daily_cost
         FROM businesses b
         LEFT JOIN security_layers sl ON sl.id = b.security_layer_id
        WHERE b.id = $1 AND b.owner_id = $2`,
      [id, request.player.id],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Business not found' });

    const empRes = await query(
      `SELECT * FROM employees WHERE business_id = $1 ORDER BY hired_at ASC`,
      [id],
    );
    return reply.send({ data: { ...res.rows[0], employees: empRes.rows } });
  });

  // PUT /businesses/:id
  app.put('/:id', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateBusinessSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let pi = 1;

    if (parsed.data.name !== undefined) { setClauses.push(`name = $${pi++}`); values.push(parsed.data.name); }
    if (parsed.data.status !== undefined) { setClauses.push(`status = $${pi++}`); values.push(parsed.data.status); }

    values.push(id, request.player.id);
    await query(
      `UPDATE businesses SET ${setClauses.join(', ')} WHERE id = $${pi++} AND owner_id = $${pi++}`,
      values,
    );
    const res = await query(`SELECT * FROM businesses WHERE id = $1`, [id]);
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Business not found' });
    return reply.send({ data: res.rows[0] });
  });

  // POST /businesses/:id/upgrade
  app.post('/:id/upgrade', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const playerId = request.player.id;

    try {
      await withTransaction(async (client) => {
        const bizRow = await client.query<{ type: string; tier: number }>(
          `SELECT type, tier FROM businesses WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
          [id, playerId],
        );
        if (!bizRow.rows.length) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
        const biz = bizRow.rows[0];

        if (biz.tier >= 4) throw Object.assign(new Error('Already max tier'), { statusCode: 400 });

        const nextTier = biz.tier + 1;
        const upgradeCosts = UPGRADE_COSTS[biz.type as BusinessType];
        const cost = upgradeCosts?.[nextTier] ?? 999999;

        const playerRow = await client.query<{ cash: string }>(
          `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
          [playerId],
        );
        if (Number(playerRow.rows[0].cash) < cost) {
          throw Object.assign(new Error(`Insufficient funds (need $${cost})`), { statusCode: 400 });
        }

        const tierMultiplier = TIER_CAPACITY_MULTIPLIER[nextTier] ?? 1.0;
        const baseCapacity = BASE_CAPACITY[biz.type as BusinessType] ?? 200;
        const newCapacity = Math.round(baseCapacity * tierMultiplier);

        await client.query(
          `UPDATE businesses SET tier = $1, capacity = $2 WHERE id = $3`,
          [nextTier, newCapacity, id],
        );
        await client.query(
          `UPDATE players SET cash = cash - $1 WHERE id = $2`,
          [cost, playerId],
        );
      });

      await recalculateNetWorth(playerId);
      const res = await query(`SELECT * FROM businesses WHERE id = $1`, [id]);
      return reply.send({ data: res.rows[0] });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /businesses/:id/employees
  app.get('/:id/employees', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const ownerCheck = await query(
      `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2`,
      [id, request.player.id],
    );
    if (!ownerCheck.rows.length) return reply.status(404).send({ error: 'Business not found' });

    const res = await query(`SELECT * FROM employees WHERE business_id = $1`, [id]);
    return reply.send({ data: res.rows });
  });

  // POST /businesses/:id/produce — manual production trigger
  app.post('/:id/produce', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const check = await query(
      `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2`,
      [id, request.player.id],
    );
    if (!check.rows.length) return reply.status(404).send({ error: 'Business not found' });

    await employee_production(id);
    await recalculateNetWorth(request.player.id);

    const res = await query(`SELECT inventory FROM businesses WHERE id = $1`, [id]);
    return reply.send({ data: { inventory: res.rows[0]?.inventory ?? {} } });
  });
}
