import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { calculateHireCost, MAX_EMPLOYEES_PER_TIER, PRODUCTION_RECIPES, GAME_BALANCE } from '../lib/constants';
import type { BusinessType } from '../../../shared/src/types/entities';
import { secureRandom, secureRandomInt } from '../lib/random';
import type { EmployeeRole } from '../../../shared/src/types/entities';
import { adjustReputation } from '../lib/reputation';

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

const PoachSchema = z.object({
  target_employee_id: z.string().uuid(),
  business_id: z.string().uuid(),
  offered_salary: z.number().positive(),
});

const TrainSchema = z.object({
  employee_id: z.string().uuid(),
  skill_type: z.enum(['efficiency', 'speed', 'loyalty', 'reliability']),
});

const TRAINING_COST = 5000;

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

  // GET /employees — list player's employees
  fastify.get(
    '/',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const result = await query(
        `SELECT e.*, b.name as business_name
         FROM employees e
         JOIN businesses b ON e.business_id = b.id
         WHERE b.owner_id = $1`,
        [playerId],
      );
      return reply.send({ data: result.rows });
    },
  );

  // GET /employees/available
  fastify.get(
    '/available',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const seasonId = request.player.season_id;
      const { role, min_efficiency, max_salary } = request.query as {
        role?: string;
        min_efficiency?: string;
        max_salary?: string;
      };

      const countsRow = await query<{ business_count: string; employee_count: string }>(
        `SELECT
           (SELECT COUNT(*) FROM businesses WHERE owner_id = $1 AND season_id = $2) AS business_count,
           (SELECT COUNT(*) FROM employees e JOIN businesses b ON b.id = e.business_id
             WHERE b.owner_id = $1 AND b.season_id = $2) AS employee_count`,
        [playerId, seasonId],
      );
      const businessCount = parseInt(countsRow.rows[0]?.business_count ?? '0', 10);
      const employeeCount = parseInt(countsRow.rows[0]?.employee_count ?? '0', 10);
      const hiring_cost = calculateHireCost(businessCount, employeeCount);

      // Available employees = those with no business_id assigned, in the current season
      const params: unknown[] = [seasonId];
      let paramIndex = 2;
      const conditions: string[] = ['e.business_id IS NULL', 'e.season_id = $1'];

      if (role && role !== 'ALL') {
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
      const limit = Math.min(Math.max(parseInt((request.query as { limit?: string }).limit ?? '50', 10) || 50, 1), 100);
      const offset = Math.max(parseInt((request.query as { offset?: string }).offset ?? '0', 10) || 0, 0);
      params.push(limit, offset);
      const result = await query(
        `SELECT e.id, e.name, e.role, e.efficiency, e.speed, e.loyalty, e.reliability,
                e.corruption_risk, e.salary, e.morale, e.criminal_capable, e.bribe_resistance,
                e.experience_points
           FROM employees e
          WHERE ${where}
          ORDER BY e.efficiency DESC
          LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        params,
      );

      return reply.send({ data: { employees: result.rows, hiring_cost } });
    },
  );

  // POST /employees/quick-hire — hire the best available worker for a business
  fastify.post(
    '/quick-hire',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const seasonId = request.player.season_id;
      const { business_id, count: hireCount = 1 } = (request.body as { business_id: string; count?: number }) ?? {};
      if (!business_id) return reply.status(400).send({ error: 'business_id is required' });

      const maxHire = Math.min(hireCount, 5); // Cap at 5 per request

      try {
        const result = await withTransaction(async (client) => {
          // Validate business
          const bizRow = await client.query<{ id: string; tier: number; name: string }>(
            `SELECT id, tier, name FROM businesses WHERE id = $1 AND owner_id = $2 AND season_id = $3 FOR UPDATE`,
            [business_id, playerId, seasonId],
          );
          if (!bizRow.rows.length) throw Object.assign(new Error('Business not found'), { statusCode: 404 });

          const biz = bizRow.rows[0];
          const maxEmp = MAX_EMPLOYEES_PER_TIER[biz.tier] ?? 10;
          const empCountRow = await client.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM employees WHERE business_id = $1`,
            [business_id],
          );
          const currentEmp = parseInt(empCountRow.rows[0]?.count ?? '0', 10);
          const slotsAvailable = maxEmp - currentEmp;
          if (slotsAvailable <= 0) throw Object.assign(new Error('Business at max capacity'), { statusCode: 400 });

          const toHire = Math.min(maxHire, slotsAvailable);

          // Get best available workers sorted by efficiency
          const workersRes = await client.query<{ id: string; name: string; efficiency: string }>(
            `SELECT id, name, efficiency FROM employees
              WHERE business_id IS NULL AND season_id = $1 AND role = 'WORKER'
              ORDER BY efficiency DESC
              LIMIT $2
              FOR UPDATE SKIP LOCKED`,
            [seasonId, toHire],
          );
          if (workersRes.rows.length === 0) throw Object.assign(new Error('No workers available'), { statusCode: 400 });

          // Calculate costs
          const countsRow = await client.query<{ business_count: string; employee_count: string }>(
            `SELECT
               (SELECT COUNT(*) FROM businesses WHERE owner_id = $1 AND season_id = $2) AS business_count,
               (SELECT COUNT(*) FROM employees e2 JOIN businesses b2 ON b2.id = e2.business_id
                 WHERE b2.owner_id = $1 AND b2.season_id = $2) AS employee_count`,
            [playerId, seasonId],
          );
          const bc = parseInt(countsRow.rows[0].business_count, 10);
          let ec = parseInt(countsRow.rows[0].employee_count, 10);

          let totalCost = 0;
          const hired: Array<{ name: string; efficiency: string }> = [];

          for (const worker of workersRes.rows) {
            const cost = calculateHireCost(bc, ec);
            totalCost += cost;
            ec++;
            hired.push({ name: worker.name, efficiency: worker.efficiency });

            await client.query(
              `UPDATE employees SET business_id = $1, hired_at = NOW() WHERE id = $2`,
              [business_id, worker.id],
            );
          }

          // Check cash
          const playerRow = await client.query<{ cash: string }>(
            `SELECT cash FROM players WHERE id = $1 FOR UPDATE`, [playerId],
          );
          if (Number(playerRow.rows[0]?.cash ?? 0) < totalCost) {
            throw Object.assign(new Error(`Need $${totalCost}, have $${playerRow.rows[0]?.cash}`), { statusCode: 400 });
          }

          await client.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [totalCost, playerId]);
          await recalcBusinessEfficiency(client as Parameters<typeof recalcBusinessEfficiency>[0], business_id);

          return {
            hired: hired.length,
            total_cost: totalCost,
            workers: hired,
            business_name: biz.name,
            employees_now: currentEmp + hired.length,
            max_employees: maxEmp,
          };
        });

        return reply.status(201).send({
          data: result,
          message: `Hired ${result.hired} worker(s) for ${result.business_name}! (${result.employees_now}/${result.max_employees} slots)`,
        });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // POST /employees/hire
  fastify.post(
    '/hire',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const seasonId = request.player.season_id;
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
            [business_id, playerId, seasonId],
          );
          if (!bizRow.rows.length) {
            throw Object.assign(new Error('Business not found or not owned by player'), { statusCode: 403 });
          }

          // Check employee cap per tier
          const bizTierRow = await client.query<{ tier: number }>(
            `SELECT tier FROM businesses WHERE id = $1`,
            [business_id],
          );
          const bizTier = bizTierRow.rows[0]?.tier ?? 1;
          const maxEmployees = MAX_EMPLOYEES_PER_TIER[bizTier] ?? 10;
          const empCountRow = await client.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM employees WHERE business_id = $1`,
            [business_id],
          );
          const currentEmployees = parseInt(empCountRow.rows[0]?.count ?? '0', 10);
          if (currentEmployees >= maxEmployees) {
            throw Object.assign(
              new Error(`Business is at max capacity (${maxEmployees} employees for tier ${bizTier})`),
              { statusCode: 400 },
            );
          }

          // Validate employee is available (business_id IS NULL = in pool)
          const empRow = await client.query<{ id: string; business_id: string | null }>(
            `SELECT id, business_id FROM employees WHERE id = $1 AND season_id = $2 FOR UPDATE`,
            [employee_id, seasonId],
          );
          if (!empRow.rows.length) {
            throw Object.assign(new Error('Employee not found'), { statusCode: 404 });
          }
          if (empRow.rows[0].business_id !== null) {
            throw Object.assign(new Error('Employee is already employed'), { statusCode: 400 });
          }

          // Calculate hiring cost
          const countsRow = await client.query<{ business_count: string; employee_count: string }>(
            `SELECT
               (SELECT COUNT(*) FROM businesses WHERE owner_id = $1 AND season_id = $2) AS business_count,
               (SELECT COUNT(*) FROM employees e2 JOIN businesses b2 ON b2.id = e2.business_id
                 WHERE b2.owner_id = $1 AND b2.season_id = $2) AS employee_count`,
            [playerId, seasonId],
          );
          const bc = parseInt(countsRow.rows[0].business_count, 10);
          const ec = parseInt(countsRow.rows[0].employee_count, 10);
          const hiring_cost = calculateHireCost(bc, ec);

          const playerRow = await client.query<{ cash: string }>(
            `SELECT cash FROM players WHERE id = $1 FOR UPDATE`,
            [playerId],
          );
          if (!playerRow.rows.length) throw Object.assign(new Error('Player not found'), { statusCode: 404 });
          if (Number(playerRow.rows[0].cash) < hiring_cost) {
            throw Object.assign(
              new Error(`Insufficient cash: need ${hiring_cost}, have ${playerRow.rows[0].cash}`),
              { statusCode: 400 },
            );
          }

          await client.query(
            `UPDATE players SET cash = cash - $1 WHERE id = $2`,
            [hiring_cost, playerId],
          );
          await client.query(
            `UPDATE employees SET business_id = $1, hired_at = NOW() WHERE id = $2`,
            [business_id, employee_id],
          );
          await recalcBusinessEfficiency(client as Parameters<typeof recalcBusinessEfficiency>[0], business_id);

          return { hired: true, hiring_cost, employee_id, business_id };
        });

        // Fetch updated business info for impact summary
        const updatedBiz = await query<{
          type: string; tier: number; efficiency: string;
          daily_operating_cost: string; name: string;
        }>(
          `SELECT type, tier, efficiency, daily_operating_cost, name FROM businesses WHERE id = $1`,
          [business_id],
        );
        const empCountRes = await query<{ count: string }>(
          `SELECT COUNT(*) as count FROM employees WHERE business_id = $1`,
          [business_id],
        );

        let impact = null;
        if (updatedBiz.rows.length > 0) {
          const biz = updatedBiz.rows[0];
          const empCount = parseInt(empCountRes.rows[0]?.count ?? '1', 10);
          const eff = parseFloat(biz.efficiency);
          const dailyRev = biz.tier * GAME_BALANCE.BUSINESS_BASE_REVENUE * eff * (1 + empCount * 0.1);
          const dailyCost = parseFloat(biz.daily_operating_cost);
          const recipe = PRODUCTION_RECIPES[biz.type as BusinessType]?.[biz.tier];

          impact = {
            business_name: biz.name,
            employees_now: empCount,
            max_employees: MAX_EMPLOYEES_PER_TIER[biz.tier] ?? 10,
            daily_revenue: parseFloat(dailyRev.toFixed(2)),
            daily_cost: parseFloat(dailyCost.toFixed(2)),
            daily_net: parseFloat((dailyRev - dailyCost).toFixed(2)),
            profitable: dailyRev > dailyCost,
            produces: recipe?.outputs.filter(o => o.quantity > 0).map(o => o.resource_name) ?? [],
          };
        }

        return reply.status(201).send({
          data: result,
          impact,
          message: impact
            ? `Hired! ${impact.business_name} now earns $${impact.daily_net.toFixed(0)}/day with ${impact.employees_now} worker(s).`
            : 'Employee hired successfully.',
        });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // PUT /employees/:id
  fastify.put(
    '/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const seasonId = request.player.season_id;
      const { id: employeeId } = request.params as { id: string };

      const parsed = UpdateEmployeeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0].message });
      }
      const { role, morale } = parsed.data;

      const ownerCheck = await query<{ id: string }>(
        `SELECT e.id FROM employees e
           JOIN businesses b ON b.id = e.business_id
          WHERE e.id = $1 AND b.owner_id = $2 AND b.season_id = $3`,
        [employeeId, playerId, seasonId],
      );
      if (!ownerCheck.rows.length) {
        return reply.status(403).send({ error: 'Employee not found or not owned by player' });
      }

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
        params.push(morale / 100); // normalize 0-100 → 0.0-1.0
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
    '/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const seasonId = request.player.season_id;
      const { id: employeeId } = request.params as { id: string };

      try {
        await withTransaction(async (client) => {
          const empRow = await client.query<{ id: string; business_id: string }>(
            `SELECT e.id, e.business_id FROM employees e
               JOIN businesses b ON b.id = e.business_id
              WHERE e.id = $1 AND b.owner_id = $2 AND b.season_id = $3
              FOR UPDATE`,
            [employeeId, playerId, seasonId],
          );
          if (!empRow.rows.length) {
            throw Object.assign(new Error('Employee not found or not owned by player'), { statusCode: 403 });
          }
          const { business_id } = empRow.rows[0];

          // Return employee to the pool (set business_id = NULL, keep season_id)
          await client.query(
            `UPDATE employees SET business_id = NULL, hired_at = NULL WHERE id = $1`,
            [employeeId],
          );
          await recalcBusinessEfficiency(client as Parameters<typeof recalcBusinessEfficiency>[0], business_id);

          await client.query(
            `INSERT INTO alerts (player_id, season_id, type, message, data)
             VALUES ($1, $2, 'EMPLOYEE_QUIT', 'An employee was fired', $3)`,
            [playerId, seasonId, JSON.stringify({ employee_id: employeeId, business_id })],
          );
        });

        return reply.send({ data: { fired: true } });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // POST /employees/poach - Attempt to poach another player's employee
  fastify.post(
    '/poach',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const seasonId = request.player.season_id;
      const parsed = PoachSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0].message });
      }
      const { target_employee_id, business_id, offered_salary } = parsed.data;

      try {
        const result = await withTransaction(async (client) => {
          const bizRow = await client.query<{ id: string }>(
            'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2 AND season_id = $3 FOR UPDATE',
            [business_id, playerId, seasonId],
          );
          if (!bizRow.rows.length) {
            throw Object.assign(new Error('Business not found or not owned by player'), { statusCode: 403 });
          }

          const empRow = await client.query<{
            id: string; business_id: string; salary: number; loyalty: number; name: string;
          }>(
            'SELECT e.id, e.business_id, e.salary, e.loyalty, e.name FROM employees e JOIN businesses b ON b.id = e.business_id WHERE e.id = $1 AND e.season_id = $2 AND b.owner_id != $3 FOR UPDATE',
            [target_employee_id, seasonId, playerId],
          );
          if (!empRow.rows.length) {
            throw Object.assign(new Error('Employee not found, not employed, or already owned by you'), { statusCode: 400 });
          }
          const emp = empRow.rows[0];

          if (offered_salary <= emp.salary) {
            throw Object.assign(new Error('Offered salary must exceed current salary of ' + emp.salary), { statusCode: 400 });
          }

          const salaryRatio = offered_salary / emp.salary;
          const loyaltyFactor = 1 - (emp.loyalty / 100);
          const successChance = Math.min(0.9, salaryRatio * 0.3 * (0.5 + loyaltyFactor * 0.5));

          const roll = secureRandom();
          if (roll >= successChance) {
            await adjustReputation(playerId, 'EMPLOYEE', -2, 'Failed poach attempt on ' + emp.name);
            return { success: false, message: emp.name + ' rejected your offer.' };
          }

          await client.query(
            'UPDATE employees SET business_id = $1, salary = $2, hired_at = NOW() WHERE id = $3',
            [business_id, offered_salary, target_employee_id],
          );

          await adjustReputation(playerId, 'CRIMINAL', 1, 'Poached employee ' + emp.name);
          await adjustReputation(playerId, 'EMPLOYEE', 1, 'Poached employee ' + emp.name);

          const origOwner = await client.query<{ owner_id: string; season_id: string }>(
            'SELECT owner_id, season_id FROM businesses WHERE id = $1',
            [emp.business_id],
          );
          if (origOwner.rows.length) {
            await client.query(
              "INSERT INTO alerts (player_id, season_id, type, message, data) VALUES ($1, $2, 'EMPLOYEE_QUIT', $3, $4)",
              [origOwner.rows[0].owner_id, origOwner.rows[0].season_id, emp.name + ' was poached by a rival!', JSON.stringify({ employee_id: target_employee_id, poached_by: playerId })],
            );
          }

          await recalcBusinessEfficiency(client as Parameters<typeof recalcBusinessEfficiency>[0], business_id);

          return { success: true, employee_id: target_employee_id, new_salary: offered_salary };
        });

        return reply.send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // POST /employees/train - Train an employee (costs money, improves skills)
  fastify.post(
    '/train',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const seasonId = request.player.season_id;
      const parsed = TrainSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0].message });
      }
      const { employee_id, skill_type } = parsed.data;

      try {
        const result = await withTransaction(async (client) => {
          const empRow = await client.query<{ id: string }>(
            'SELECT e.id FROM employees e JOIN businesses b ON b.id = e.business_id WHERE e.id = $1 AND b.owner_id = $2 AND b.season_id = $3 FOR UPDATE',
            [employee_id, playerId, seasonId],
          );
          if (!empRow.rows.length) {
            throw Object.assign(new Error('Employee not found or not owned by player'), { statusCode: 403 });
          }

          const playerRow = await client.query<{ cash: string }>(
            'SELECT cash FROM players WHERE id = $1 FOR UPDATE',
            [playerId],
          );
          if (Number(playerRow.rows[0]?.cash ?? 0) < TRAINING_COST) {
            throw Object.assign(new Error('Insufficient cash: need ' + TRAINING_COST), { statusCode: 400 });
          }

          await client.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [TRAINING_COST, playerId]);

          const boost = secureRandomInt(5, 11);
          const columnMap: Record<string, string> = {
            efficiency: 'efficiency',
            speed: 'speed',
            loyalty: 'loyalty',
            reliability: 'reliability',
          };
          const col = columnMap[skill_type];
          await client.query(
            'UPDATE employees SET ' + col + ' = LEAST(' + col + ' + $1, 100), experience_points = experience_points + 50 WHERE id = $2',
            [boost, employee_id],
          );

          await adjustReputation(playerId, 'EMPLOYEE', 1, 'Trained employee in ' + skill_type);

          return { trained: true, employee_id, skill_type, boost, cost: TRAINING_COST };
        });

        return reply.send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // GET /employees/traits/:employeeId - Get hidden traits (only if loyalty > 80)
  fastify.get(
    '/traits/:employeeId',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const seasonId = request.player.season_id;
      const { employeeId } = request.params as { employeeId: string };

      const empRow = await query<{ id: string; loyalty: number }>(
        'SELECT e.id, e.loyalty FROM employees e JOIN businesses b ON b.id = e.business_id WHERE e.id = $1 AND b.owner_id = $2 AND b.season_id = $3',
        [employeeId, playerId, seasonId],
      );
      if (!empRow.rows.length) {
        return reply.status(403).send({ error: 'Employee not found or not owned by player' });
      }

      if (empRow.rows[0].loyalty < 80) {
        return reply.status(403).send({
          error: 'Employee loyalty must be at least 80 to reveal hidden traits',
          current_loyalty: empRow.rows[0].loyalty,
        });
      }

      const traits = await query<{ trait_name: string; trait_value: number; discovered: boolean }>(
        'SELECT trait_name, trait_value, discovered FROM employee_traits WHERE employee_id = $1',
        [employeeId],
      );

      if (traits.rows.length > 0) {
        await query('UPDATE employee_traits SET discovered = true WHERE employee_id = $1', [employeeId]);
      }

      return reply.send({ data: { employee_id: employeeId, traits: traits.rows } });
    },
  );

}
