import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';

// manager_assignments: id, player_id, business_id, employee_id, manager_tier, efficiency_bonus, embezzlement_risk, assigned_at
// embezzlement_logs: id, manager_id, amount, detected, created_at

const MANAGER_TIERS = {
  LEVEL_1: { efficiency_bonus: 0.1, embezzlement_risk: 0.05, min_efficiency: 60 },
  LEVEL_2: { efficiency_bonus: 0.2, embezzlement_risk: 0.03, min_efficiency: 75 },
  LEVEL_3: { efficiency_bonus: 0.3, embezzlement_risk: 0.01, min_efficiency: 90 },
} as const;

type ManagerTier = keyof typeof MANAGER_TIERS;

const AUDIT_COST = 1000;

const AssignManagerSchema = z.object({
  business_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  tier: z.enum(['LEVEL_1', 'LEVEL_2', 'LEVEL_3']),
});

export async function managerRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /managers/assign - Assign an employee as manager
  fastify.post(
    '/assign',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = AssignManagerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }
      const { business_id, employee_id, tier } = parsed.data;
      const playerId = request.player.id;
      const tierConfig = MANAGER_TIERS[tier as ManagerTier];

      const result = await withTransaction(async (client) => {
        // Verify business ownership
        const bizRow = await client.query(
          `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2 AND status != 'BANKRUPT'`,
          [business_id, playerId],
        );
        if (!bizRow.rows.length) {
          throw Object.assign(new Error('Business not found or not owned by you'), { statusCode: 404 });
        }

        // Check no existing manager
        const existingMgr = await client.query(
          `SELECT id FROM manager_assignments WHERE business_id = $1`,
          [business_id],
        );
        if (existingMgr.rows.length) {
          throw Object.assign(new Error('Business already has a manager assigned'), { statusCode: 409 });
        }

        // Verify employee ownership and efficiency
        const empRow = await client.query<{ id: string; efficiency: number }>(
          `SELECT e.id, e.efficiency
             FROM employees e
             JOIN businesses b ON b.id = e.business_id
            WHERE e.id = $1 AND b.owner_id = $2`,
          [employee_id, playerId],
        );
        if (!empRow.rows.length) {
          throw Object.assign(new Error('Employee not found or not owned by you'), { statusCode: 404 });
        }

        const emp = empRow.rows[0];
        if (emp.efficiency < tierConfig.min_efficiency) {
          throw Object.assign(
            new Error(`Employee efficiency ${emp.efficiency} is below the minimum ${tierConfig.min_efficiency} required for ${tier}`),
            { statusCode: 400 },
          );
        }

        // Check employee is not already a manager elsewhere
        const alreadyMgr = await client.query(
          `SELECT id FROM manager_assignments WHERE employee_id = $1`,
          [employee_id],
        );
        if (alreadyMgr.rows.length) {
          throw Object.assign(new Error('Employee is already assigned as a manager'), { statusCode: 409 });
        }

        // Insert manager assignment
        const ins = await client.query(
          `INSERT INTO manager_assignments (player_id, business_id, employee_id, manager_tier, efficiency_bonus, embezzlement_risk, assigned_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING *`,
          [playerId, business_id, employee_id, tier, tierConfig.efficiency_bonus, tierConfig.embezzlement_risk],
        );

        return ins.rows[0];
      });

      return reply.status(201).send({ data: result });
    },
  );

  // GET /managers - List all manager assignments for player
  fastify.get(
    '/',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const result = await query(
        `SELECT m.*, b.name AS business_name, e.name AS employee_name, e.efficiency
           FROM manager_assignments m
           JOIN businesses b ON b.id = m.business_id
           JOIN employees e ON e.id = m.employee_id
          WHERE m.player_id = $1
          ORDER BY m.assigned_at DESC`,
        [playerId],
      );
      return reply.send({ data: result.rows });
    },
  );

  // GET /managers/:businessId - Get manager for specific business
  fastify.get(
    '/:businessId',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { businessId } = request.params as { businessId: string };

      const result = await query(
        `SELECT m.*, e.name AS employee_name, e.efficiency
           FROM manager_assignments m
           JOIN businesses b ON b.id = m.business_id
           JOIN employees e ON e.id = m.employee_id
          WHERE m.business_id = $1 AND m.player_id = $2`,
        [businessId, playerId],
      );
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'No manager found for this business' });
      }
      return reply.send({ data: result.rows[0] });
    },
  );

  // DELETE /managers/:businessId - Remove manager from business
  fastify.delete(
    '/:businessId',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { businessId } = request.params as { businessId: string };

      const result = await query(
        `DELETE FROM manager_assignments
          WHERE business_id = $1 AND player_id = $2
          RETURNING *`,
        [businessId, playerId],
      );
      if (!result.rows.length) {
        return reply.status(404).send({ error: 'No manager found for this business' });
      }
      return reply.send({ data: result.rows[0], message: 'Manager removed' });
    },
  );

  // GET /managers/performance/:businessId - Manager performance report
  fastify.get(
    '/performance/:businessId',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { businessId } = request.params as { businessId: string };

      const mgrRow = await query(
        `SELECT m.*, e.name AS employee_name, e.efficiency
           FROM manager_assignments m
           JOIN businesses b ON b.id = m.business_id
           JOIN employees e ON e.id = m.employee_id
          WHERE m.business_id = $1 AND m.player_id = $2`,
        [businessId, playerId],
      );
      if (!mgrRow.rows.length) {
        return reply.status(404).send({ error: 'No manager found for this business' });
      }
      const manager = mgrRow.rows[0] as Record<string, unknown>;

      // embezzlement_logs: id, manager_id, amount, detected, created_at
      const embezzlementRow = await query<{ total_stolen: string; incident_count: string }>(
        `SELECT COALESCE(SUM(amount), 0) AS total_stolen,
                COUNT(*) AS incident_count
           FROM embezzlement_logs
          WHERE manager_id = $1`,
        [manager.id],
      );

      return reply.send({
        data: {
          manager,
          performance: {
            total_stolen: Number(embezzlementRow.rows[0].total_stolen),
            embezzlement_incidents: Number(embezzlementRow.rows[0].incident_count),
          },
        },
      });
    },
  );

  // POST /managers/audit/:businessId - Audit business for embezzlement
  fastify.post(
    '/audit/:businessId',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const { businessId } = request.params as { businessId: string };

      const result = await withTransaction(async (client) => {
        const playerRow = await client.query<{ cash: string }>(
          `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
          [playerId],
        );
        if (!playerRow.rows.length) {
          throw Object.assign(new Error('Player not found'), { statusCode: 404 });
        }
        if (Number(playerRow.rows[0].cash) < AUDIT_COST) {
          throw Object.assign(new Error(`Insufficient funds. Audit costs $${AUDIT_COST}`), { statusCode: 400 });
        }

        const mgrRow = await client.query(
          `SELECT m.*
             FROM manager_assignments m
            WHERE m.business_id = $1 AND m.player_id = $2`,
          [businessId, playerId],
        );
        if (!mgrRow.rows.length) {
          throw Object.assign(new Error('No manager found for this business'), { statusCode: 404 });
        }
        const manager = mgrRow.rows[0] as Record<string, unknown>;

        await client.query(
          `UPDATE players SET cash = cash - $1 WHERE id = $2`,
          [AUDIT_COST, playerId],
        );

        const embezzlementRow = await client.query<{ total_stolen: string; incident_count: string }>(
          `SELECT COALESCE(SUM(amount), 0) AS total_stolen,
                  COUNT(*) AS incident_count
             FROM embezzlement_logs
            WHERE manager_id = $1
              AND created_at >= NOW() - INTERVAL '7 days'`,
          [manager.id],
        );

        const totalStolen = Number(embezzlementRow.rows[0].total_stolen);
        const incidentCount = Number(embezzlementRow.rows[0].incident_count);
        const caught = incidentCount > 0;

        if (caught) {
          await client.query(`DELETE FROM manager_assignments WHERE id = $1`, [manager.id]);

          await client.query(
            `UPDATE players SET cash = cash + $1 WHERE id = $2`,
            [totalStolen, playerId],
          );

          return {
            result: 'CAUGHT',
            incidents: incidentCount,
            amount_recovered: totalStolen,
            manager_fired: true,
          };
        }

        return {
          result: 'CLEAN',
          incidents: 0,
          amount_recovered: 0,
          manager_fired: false,
        };
      });

      return reply.send({ data: result });
    },
  );
}

export default managerRoutes;
