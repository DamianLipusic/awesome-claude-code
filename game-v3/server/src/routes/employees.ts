import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import {
  maxEmployees,
  TRAINING,
  type TrainingType,
} from '../config/game.config.js';
import { awardXP, XP_REWARDS } from '../lib/xp.js';
import { checkAchievements } from '../lib/achievements.js';

const HireSchema = z.object({
  employee_id: z.string().uuid(),
  business_id: z.string().uuid(),
});

const AssignSchema = z.object({
  business_id: z.string().uuid(),
});

const TrainSchema = z.object({
  type: z.enum(['basic', 'advanced', 'elite']),
});

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // ─── GET /pool — available employees in current season ────────
  app.get('/pool', async (req: FastifyRequest, reply: FastifyReply) => {
    // Get player's season
    const playerRes = await query<{ season_id: string | null }>(
      `SELECT season_id FROM players WHERE id = $1`,
      [req.player.id],
    );
    if (!playerRes.rows.length) {
      return reply.status(404).send({ error: 'Player not found' });
    }
    const seasonId = playerRes.rows[0].season_id;

    const res = await query(
      `SELECT id, name, role, salary, efficiency, speed, loyalty, discretion, learning_rate, corruption_risk, status
       FROM employees
       WHERE season_id = $1 AND status = 'available' AND business_id IS NULL
       ORDER BY efficiency DESC`,
      [seasonId],
    );
    return reply.send({ data: res.rows });
  });

  // ─── POST /hire — hire employee for a business ────────────────
  app.post('/hire', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = HireSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { employee_id, business_id } = parsed.data;

    // Check business owned by player
    const bizRes = await query<{ id: string; tier: number }>(
      `SELECT id, tier FROM businesses WHERE id = $1 AND owner_id = $2 AND status != 'shutdown'`,
      [business_id, req.player.id],
    );
    if (!bizRes.rows.length) {
      return reply.status(404).send({ error: 'Business not found or not owned by you' });
    }
    const biz = bizRes.rows[0];

    // Check employee is available
    const empRes = await query<{ id: string; salary: string; status: string; business_id: string | null }>(
      `SELECT id, salary, status, business_id FROM employees WHERE id = $1`,
      [employee_id],
    );
    if (!empRes.rows.length) {
      return reply.status(404).send({ error: 'Employee not found' });
    }
    const emp = empRes.rows[0];
    if (emp.status !== 'available' || emp.business_id !== null) {
      return reply.status(400).send({ error: 'Employee is not available for hire' });
    }

    // Check employee count limit
    const countRes = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM employees WHERE business_id = $1 AND status IN ('active', 'training')`,
      [business_id],
    );
    if (countRes.rows[0].count >= maxEmployees(biz.tier)) {
      return reply.status(400).send({ error: `Business is at max employees (${maxEmployees(biz.tier)})` });
    }

    // Check player cash
    const salary = Number(emp.salary);
    const playerRes = await query<{ cash: string }>(
      `SELECT cash FROM players WHERE id = $1`,
      [req.player.id],
    );
    if (Number(playerRes.rows[0].cash) < salary) {
      return reply.status(400).send({
        error: `Not enough cash. Need $${salary.toLocaleString()} for first month salary, have $${Number(playerRes.rows[0].cash).toLocaleString()}`,
      });
    }

    // Transaction: deduct salary, assign employee
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [salary, req.player.id],
      );
      await client.query(
        `UPDATE employees SET business_id = $1, status = 'active', hired_at = NOW() WHERE id = $2`,
        [business_id, employee_id],
      );
      // Award XP (handles level-up detection + logging)
      await awardXP(client, req.player.id, XP_REWARDS.HIRE);
      await checkAchievements(client, req.player.id);
      // Activity log
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount)
         VALUES ($1, $2, 'employee_hired', $3, $4)`,
        [req.player.id, business_id, `Hired employee`, -salary],
      );
    });

    return reply.send({ data: { message: 'Employee hired successfully', employee_id, business_id } });
  });

  // ─── POST /:id/assign — move employee to different business ──
  app.post('/:id/assign', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const parsed = AssignSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { business_id } = parsed.data;

    // Check employee is owned by player (active in one of their businesses)
    const empRes = await query<{ id: string; business_id: string; status: string }>(
      `SELECT e.id, e.business_id, e.status
       FROM employees e
       JOIN businesses b ON b.id = e.business_id
       WHERE e.id = $1 AND b.owner_id = $2 AND e.status = 'active'`,
      [id, req.player.id],
    );
    if (!empRes.rows.length) {
      return reply.status(404).send({ error: 'Employee not found or not active in your business' });
    }

    // Check target business owned by player
    const bizRes = await query<{ id: string; tier: number }>(
      `SELECT id, tier FROM businesses WHERE id = $1 AND owner_id = $2 AND status != 'shutdown'`,
      [business_id, req.player.id],
    );
    if (!bizRes.rows.length) {
      return reply.status(404).send({ error: 'Target business not found' });
    }

    // Check employee count at target
    const countRes = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM employees WHERE business_id = $1 AND status IN ('active', 'training')`,
      [business_id],
    );
    if (countRes.rows[0].count >= maxEmployees(bizRes.rows[0].tier)) {
      return reply.status(400).send({ error: 'Target business is at max employees' });
    }

    await query(
      `UPDATE employees SET business_id = $1 WHERE id = $2`,
      [business_id, id],
    );

    return reply.send({ data: { message: 'Employee reassigned', employee_id: id, business_id } });
  });

  // ─── POST /:id/fire — dismiss employee ───────────────────────
  app.post('/:id/fire', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    // Check employee is owned by player
    const empRes = await query<{ id: string; business_id: string; name: string }>(
      `SELECT e.id, e.business_id, e.name
       FROM employees e
       JOIN businesses b ON b.id = e.business_id
       WHERE e.id = $1 AND b.owner_id = $2 AND e.status IN ('active', 'training')`,
      [id, req.player.id],
    );
    if (!empRes.rows.length) {
      return reply.status(404).send({ error: 'Employee not found or not in your business' });
    }

    const emp = empRes.rows[0];

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE employees SET business_id = NULL, status = 'available', hired_at = NULL WHERE id = $1`,
        [id],
      );
      // Cancel any active training
      await client.query(
        `UPDATE training SET status = 'cancelled' WHERE employee_id = $1 AND status = 'active'`,
        [id],
      );
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount)
         VALUES ($1, $2, 'employee_fired', $3, 0)`,
        [req.player.id, emp.business_id, `Fired ${emp.name}`],
      );
    });

    return reply.send({ data: { message: `${emp.name} has been fired`, employee_id: id } });
  });

  // ─── POST /:id/train — start training ────────────────────────
  app.post('/:id/train', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const parsed = TrainSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const trainingType = parsed.data.type as TrainingType;
    const trainingConfig = TRAINING[trainingType];

    // Check employee is active and owned by player
    const empRes = await query<{ id: string; business_id: string; salary: string; status: string; name: string }>(
      `SELECT e.id, e.business_id, e.salary, e.status, e.name
       FROM employees e
       JOIN businesses b ON b.id = e.business_id
       WHERE e.id = $1 AND b.owner_id = $2`,
      [id, req.player.id],
    );
    if (!empRes.rows.length) {
      return reply.status(404).send({ error: 'Employee not found or not in your business' });
    }
    const emp = empRes.rows[0];
    if (emp.status !== 'active') {
      return reply.status(400).send({ error: `Employee is ${emp.status}, must be active to train` });
    }

    // Calculate cost
    const cost = Number(emp.salary) * trainingConfig.costMultiplier;

    // Check player cash
    const playerRes = await query<{ cash: string }>(
      `SELECT cash FROM players WHERE id = $1`,
      [req.player.id],
    );
    if (Number(playerRes.rows[0].cash) < cost) {
      return reply.status(400).send({
        error: `Not enough cash. Training costs $${cost.toLocaleString()}`,
      });
    }

    // Generate random stat targets
    const stats = ['efficiency', 'speed', 'loyalty', 'discretion'];
    const statTargets: Record<string, number> = {};
    const numStats = Math.min(2 + Math.floor(Math.random() * 2), stats.length); // 2-3 stats
    const shuffled = stats.sort(() => Math.random() - 0.5);
    for (let i = 0; i < numStats; i++) {
      statTargets[shuffled[i]] = Math.floor(Math.random() * trainingConfig.maxStatGain) + 1;
    }

    const endsAt = new Date(Date.now() + trainingConfig.durationMinutes * 60 * 1000);

    await withTransaction(async (client) => {
      // Deduct cash
      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [cost, req.player.id],
      );
      // Set employee to training
      await client.query(
        `UPDATE employees SET status = 'training' WHERE id = $1`,
        [id],
      );
      // Create training record
      await client.query(
        `INSERT INTO training (employee_id, type, stat_targets, cost, started_at, ends_at, status)
         VALUES ($1, $2, $3, $4, NOW(), $5, 'active')`,
        [id, trainingType, JSON.stringify(statTargets), cost, endsAt.toISOString()],
      );
      // Award XP (handles level-up detection + logging)
      await awardXP(client, req.player.id, XP_REWARDS.TRAIN);
      // Activity log
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount)
         VALUES ($1, $2, 'training_started', $3, $4)`,
        [req.player.id, emp.business_id, `Started ${trainingType} training for ${emp.name}`, -cost],
      );
    });

    return reply.send({
      data: {
        message: `${emp.name} started ${trainingType} training`,
        employee_id: id,
        training_type: trainingType,
        cost,
        ends_at: endsAt.toISOString(),
        stat_targets: statTargets,
      },
    });
  });

  // ─── GET /:id — employee detail ──────────────────────────────
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const empRes = await query(
      `SELECT e.id, e.name, e.role, e.salary, e.efficiency, e.speed, e.loyalty,
              e.discretion, e.learning_rate, e.corruption_risk, e.stress, e.xp, e.level,
              e.status, e.hired_at, e.business_id,
              b.name AS business_name
       FROM employees e
       LEFT JOIN businesses b ON b.id = e.business_id
       WHERE e.id = $1`,
      [id],
    );
    if (!empRes.rows.length) {
      return reply.status(404).send({ error: 'Employee not found' });
    }

    const emp = empRes.rows[0] as Record<string, unknown>;

    // If training, include training info
    let training = null;
    if (emp.status === 'training') {
      const trainRes = await query(
        `SELECT type, stat_targets, started_at, ends_at, status
         FROM training
         WHERE employee_id = $1 AND status = 'active'
         ORDER BY started_at DESC LIMIT 1`,
        [id],
      );
      if (trainRes.rows.length) {
        training = trainRes.rows[0];
      }
    }

    return reply.send({
      data: {
        ...emp,
        training,
      },
    });
  });

  // POST /poach — steal employee from another player
  const PoachSchema = z.object({
    employee_id: z.string().uuid(),
    business_id: z.string().uuid(), // your business to assign to
  });

  app.post('/poach', async (req: FastifyRequest, reply: FastifyReply) => {
    const { employee_id, business_id } = PoachSchema.parse(req.body);
    const playerId = req.player.id;

    const result = await withTransaction(async (client) => {
      // Check target employee exists and belongs to another player
      const empRes = await client.query<{ id: string; name: string; salary: number; business_id: string }>(
        `SELECT e.id, e.name, e.salary, e.business_id FROM employees e
         JOIN businesses b ON b.id = e.business_id
         WHERE e.id = $1 AND e.status = 'active' AND b.owner_id != $2`,
        [employee_id, playerId],
      );
      if (!empRes.rows.length) throw { statusCode: 404, message: 'Employee not found or belongs to you' };

      const emp = empRes.rows[0];
      const poachCost = Math.round(Number(emp.salary) * 2);

      // Check cash
      const cashRes = await client.query<{ cash: string }>('SELECT cash FROM players WHERE id = $1 FOR UPDATE', [playerId]);
      if (Number(cashRes.rows[0]?.cash ?? 0) < poachCost) {
        throw { statusCode: 400, message: `Need $${poachCost} to poach (2x salary)` };
      }

      // Check your business capacity
      const bizRes = await client.query(
        "SELECT id, tier FROM businesses WHERE id = $1 AND owner_id = $2 AND status = 'active'",
        [business_id, playerId],
      );
      if (!bizRes.rows.length) throw { statusCode: 404, message: 'Your business not found' };
      const tier = Number(bizRes.rows[0].tier);
      const empCount = await client.query(
        "SELECT COUNT(*)::int AS cnt FROM employees WHERE business_id = $1 AND status IN ('active','training')",
        [business_id],
      );
      if (Number(empCount.rows[0].cnt) >= maxEmployees(tier)) {
        throw { statusCode: 400, message: 'Business at max employee capacity' };
      }

      // 50% success chance
      const success = Math.random() < 0.5;

      // Always pay the cost
      await client.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [poachCost, playerId]);

      if (success) {
        // Move employee
        await client.query(
          'UPDATE employees SET business_id = $1 WHERE id = $2',
          [business_id, employee_id],
        );

        // Increase rivalry heat for victim
        const victimBiz = await client.query<{ owner_id: string }>(
          'SELECT owner_id FROM businesses WHERE id = $1', [emp.business_id],
        );
        if (victimBiz.rows.length) {
          await client.query(
            'UPDATE players SET heat_rival = LEAST(100, heat_rival + 10) WHERE id = $1',
            [victimBiz.rows[0].owner_id],
          );
        }

        await client.query(
          "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'POACH_SUCCESS', $2, $3)",
          [playerId, `Poached ${emp.name} for $${poachCost}`, -poachCost],
        );

        return { success: true, employee: emp.name, cost: poachCost, message: `Successfully poached ${emp.name}!` };
      } else {
        await client.query(
          "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'POACH_FAILED', $2, $3)",
          [playerId, `Failed to poach ${emp.name}. Lost $${poachCost}`, -poachCost],
        );

        return { success: false, employee: emp.name, cost: poachCost, message: `Failed to poach ${emp.name}. Lost $${poachCost}.` };
      }
    });

    return reply.send({ data: result });
  });
}
