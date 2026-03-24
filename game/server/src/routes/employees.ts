import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { calculateHireCost } from '../lib/constants';
import type { EmployeeRole } from '../../../shared/src/types/entities';

// ─── Valid role values (mirrors EmployeeRole union) ───────────

const VALID_ROLES: EmployeeRole[] = [
  'WORKER',
  'MANAGER',
  'SECURITY',
  'DRIVER',
  'ENFORCER',
  'ACCOUNTANT',
];

// ─── Input schemas ────────────────────────────────────────────

const HireSchema = z.object({
  business_id: z.string().uuid(),
  employee_id: z.string().uuid(),
});

const UpdateEmployeeSchema = z
  .object({
    role: z.enum(['WORKER', 'MANAGER', 'SECURITY', 'DRIVER', 'ENFORCER', 'ACCOUNTANT']).optional(),
    morale: z.number().min(0).max(100).optional(),
  })
  .refine((d) => d.role !== undefined || d.morale !== undefined, {
    message: 'At least one of role or morale must be provided',
  });

// ─── Helper: recalculate business efficiency from avg of employees ────

async function recalcBusinessEfficiency(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ avg: string | null }> }> },
  business_id: string,
): Promise<void> {
  await client.query(
    `UPDATE businesses
     SET efficiency = COALESCE(
       (SELECT AVG(efficiency) FROM employees WHERE business_id = $1),
       0
     )
     WHERE id = $1`,
    [business_id],
  );
}

// ─── Route plugin ─────────────────────────────────────────────

export async function employeeRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /employees/available
  fastify.get(
    '/employees/available',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { playerId, playerSeasonId } = request;
      const { role, min_efficiency, max_salary } = request.query as {
        role?: string;
        min_efficiency?: string;
        max_salary?: string;
      };

      // Fetch player's business and employee counts for cost formula
      const countsRow = await query<{ business_count: string; employee_count: string }>(
        `SELECT
           (SELECT COUNT(*) FROM businesses WHERE owner_id = $1 AND season_id = $2) AS business_count,
           (SELECT COUNT(*) FROM employees e JOIN businesses b ON b.id = e.business_id
             WHERE b.owner_id = $1 AND b.season_id = $2) AS employee_count`,
        [playerId, playerSeasonId],
      );
      const businessCount = parseInt(countsRow.rows[0]?.business_count ?? '0', 10);
      const employeeCount = parseInt(countsRow.rows[0]?.employee_count ?? '0', 10);
      const hiring_cost = calculateHireCost(businessCount, employeeCount);

      // Build query
      const params: unknown[] = [playerSeasonId];
      let paramIndex = 2;
      const conditions: string[] = ['e.is_available = TRUE', 'e.season_id = $1'];

      if (role) {
        conditions.push(`e.role = $${paramIndex++}`);
        params.push(role);
      }
      if (min_efficiency) {
        conditions.push(`e.efficiency >= $${paramIndex++}`);
        params.push(parseFloat(min_efficiency));
      }
      if (max_salary) {
        conditions.push(`e.salary <= $${paramIndex++}`);
        params.push(parseFloat(max_salary));
      }

      const where = conditions.join(' AND ');
      const result = await query(
        `SELECT
           e.id, e.name, e.role, e.efficiency, e.speed, e.loyalty, e.reliability,
           e.corruption_risk, e.salary, e.morale, e.criminal_capable, e.bribe_resistance,
           e.experience_points
         FROM employees e
         WHERE ${where}
         ORDER BY e.efficiency DESC`,
        params,
      );

      return reply.send({ data: { employees: result.rows, hiring_cost } });
    },
  );

  // POST /employees/hire
  fastify.post(
    '/employees/hire',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { playerId, playerSeasonId } = request;
      const parsed = HireSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0].message });
      }
      const { business_id, employee_id } = parsed.data;

      try {
        const result = await withTransaction(async (client) => {
          // Validate business ownership
          const bizRow = await client.query<{ id: string }>(
            `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2 AND season_id = $3 FOR UPDATE`,
            [business_id, playerId, playerSeasonId],
          );
          if (!bizRow.rows.length) {
            throw Object.assign(new Error('Business not found or not owned by player'), { statusCode: 403 });
          }

          // Validate employee availability
          const empRow = await client.query<{ id: string; is_available: boolean }>(
            `SELECT id, is_available FROM employees WHERE id = $1 AND season_id = $2 FOR UPDATE`,
            [employee_id, playerSeasonId],
          );
          if (!empRow.rows.length) {
            throw Object.assign(new Error('Employee not found'), { statusCode: 404 });
          }
          if (!empRow.rows[0].is_available) {
            throw Object.assign(new Error('Employee is not available for hire'), { statusCode: 400 });
          }

          // Calculate hiring cost using current counts
          const countsRow = await client.query<{ business_count: string; employee_count: string }>(
            `SELECT
               (SELECT COUNT(*) FROM businesses WHERE owner_id = $1 AND season_id = $2) AS business_count,
               (SELECT COUNT(*) FROM employees e2 JOIN businesses b2 ON b2.id = e2.business_id
                 WHERE b2.owner_id = $1 AND b2.season_id = $2) AS employee_count`,
            [playerId, playerSeasonId],
          );
          const bc = parseInt(countsRow.rows[0].business_count, 10);
          const ec = parseInt(countsRow.rows[0].employee_count, 10);
          const hiring_cost = calculateHireCost(bc, ec);

          // Lock player and check cash
          const playerRow = await client.query<{ cash: number }>(
            `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
            [playerId],
          );
          if (!playerRow.rows.length) {
            throw Object.assign(new Error('Player not found'), { statusCode: 404 });
          }
          if (playerRow.rows[0].cash < hiring_cost) {
            throw Object.assign(
              new Error(`Insufficient cash: need ${hiring_cost}, have ${playerRow.rows[0].cash}`),
              { statusCode: 400 },
            );
          }

          // Deduct hiring cost
          await client.query(
            `UPDATE players SET cash = cash - $1 WHERE id = $2`,
            [hiring_cost, playerId],
          );

          // Hire employee
          await client.query(
            `UPDATE employees
             SET business_id = $1, is_available = FALSE, hired_at = NOW()
             WHERE id = $2`,
            [business_id, employee_id],
          );

          // Recalculate business efficiency
          await recalcBusinessEfficiency(client as Parameters<typeof recalcBusinessEfficiency>[0], business_id);

          return { hired: true, hiring_cost, employee_id, business_id };
        });

        return reply.status(201).send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // PUT /employees/:id
  fastify.put(
    '/employees/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { playerId, playerSeasonId } = request;
      const { id: employeeId } = request.params as { id: string };

      const parsed = UpdateEmployeeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0].message });
      }
      const { role, morale } = parsed.data;

      // Validate ownership: employee.business_id must belong to player
      const ownerCheck = await query<{ id: string }>(
        `SELECT e.id FROM employees e
         JOIN businesses b ON b.id = e.business_id
         WHERE e.id = $1 AND b.owner_id = $2 AND b.season_id = $3`,
        [employeeId, playerId, playerSeasonId],
      );
      if (!ownerCheck.rows.length) {
        return reply.status(403).send({ error: 'Employee not found or not owned by player' });
      }

      // Build update
      const setClauses: string[] = [];
      const params: unknown[] = [];
      let pi = 1;

      if (role !== undefined) {
        if (!VALID_ROLES.includes(role as EmployeeRole)) {
          return reply.status(400).send({ error: `Invalid role: ${role}` });
        }
        setClauses.push(`role = $${pi++}`);
        params.push(role);
      }
      if (morale !== undefined) {
        setClauses.push(`morale = $${pi++}`);
        params.push(morale);
      }
      params.push(employeeId);

      const result = await query(
        `UPDATE employees SET ${setClauses.join(', ')} WHERE id = $${pi} RETURNING *`,
        params,
      );

      return reply.send({ data: result.rows[0] });
    },
  );

  // DELETE /employees/:id — fire employee
  fastify.delete(
    '/employees/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { playerId, playerSeasonId } = request;
      const { id: employeeId } = request.params as { id: string };

      try {
        await withTransaction(async (client) => {
          // Validate ownership
          const empRow = await client.query<{ id: string; business_id: string }>(
            `SELECT e.id, e.business_id FROM employees e
             JOIN businesses b ON b.id = e.business_id
             WHERE e.id = $1 AND b.owner_id = $2 AND b.season_id = $3
             FOR UPDATE`,
            [employeeId, playerId, playerSeasonId],
          );
          if (!empRow.rows.length) {
            throw Object.assign(new Error('Employee not found or not owned by player'), { statusCode: 403 });
          }
          const { business_id } = empRow.rows[0];

          // Fire employee
          await client.query(
            `UPDATE employees
             SET business_id = NULL, is_available = TRUE, hired_at = NULL
             WHERE id = $1`,
            [employeeId],
          );

          // Recalculate business efficiency
          await recalcBusinessEfficiency(client as Parameters<typeof recalcBusinessEfficiency>[0], business_id);

          // Create EMPLOYEE_QUIT alert
          await client.query(
            `INSERT INTO alerts (player_id, season_id, type, message, created_at, read, data)
             VALUES ($1, $2, 'EMPLOYEE_QUIT', 'An employee has been fired', NOW(), FALSE, $3)`,
            [playerId, playerSeasonId, JSON.stringify({ employee_id: employeeId, business_id })],
          );
        });

        return reply.send({ data: { fired: true } });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );
}
