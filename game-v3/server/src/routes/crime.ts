import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import pool, { query, withTransaction } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { awardXP } from '../lib/xp.js';
import { checkAchievements } from '../lib/achievements.js';
import { sendToPlayer } from '../websocket/connections.js';

// ─── Crime Operation Definitions ──────────────────────────────────
interface CrimeDef {
  type: string;
  name: string;
  description: string;
  icon: string;
  durationMinutes: number;
  riskBase: number; // 0-100
  rewardMin: number;
  rewardMax: number;
  heatGainOnFail: number;
  minPhase: number;
}

const CRIME_DEFS: CrimeDef[] = [
  {
    type: 'theft', name: 'Petty Theft', description: 'Steal goods from a local warehouse.',
    icon: '🤏', durationMinutes: 5, riskBase: 25, rewardMin: 500, rewardMax: 2000,
    heatGainOnFail: 5, minPhase: 1,
  },
  {
    type: 'robbery', name: 'Store Robbery', description: 'Rob a store for a big payout.',
    icon: '🔫', durationMinutes: 15, riskBase: 45, rewardMin: 3000, rewardMax: 10000,
    heatGainOnFail: 15, minPhase: 2,
  },
  {
    type: 'fraud', name: 'Insurance Fraud', description: 'Fake a claim. High reward, high risk.',
    icon: '📋', durationMinutes: 30, riskBase: 55, rewardMin: 8000, rewardMax: 25000,
    heatGainOnFail: 20, minPhase: 3,
  },
  {
    type: 'smuggling', name: 'Smuggling Run', description: 'Move contraband across zones.',
    icon: '📦', durationMinutes: 45, riskBase: 60, rewardMin: 15000, rewardMax: 50000,
    heatGainOnFail: 30, minPhase: 3,
  },
];

export async function crimeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /types — available crime types for player's phase
  app.get('/types', async (req: FastifyRequest, reply: FastifyReply) => {
    const playerRes = await query<{ unlock_phase: number }>(
      'SELECT unlock_phase FROM players WHERE id = $1', [req.player.id],
    );
    const phase = playerRes.rows[0]?.unlock_phase ?? 1;

    const available = CRIME_DEFS
      .filter(c => c.minPhase <= phase)
      .map(c => ({
        type: c.type, name: c.name, description: c.description, icon: c.icon,
        duration_minutes: c.durationMinutes, risk: c.riskBase,
        reward_range: [c.rewardMin, c.rewardMax],
      }));

    return reply.send({ data: available });
  });

  // GET /active — player's active and recent operations
  app.get('/active', async (req: FastifyRequest, reply: FastifyReply) => {
    const ops = await query(
      `SELECT id, type, target_desc, risk_level, reward_min, reward_max, status,
              started_at, resolves_at, resolved_at, result_amount, result_message
       FROM crime_operations WHERE player_id = $1
       ORDER BY started_at DESC LIMIT 20`,
      [req.player.id],
    );
    return reply.send({ data: ops.rows });
  });

  // POST /start — start a crime operation
  const StartSchema = z.object({ type: z.enum(['theft', 'robbery', 'fraud', 'smuggling']) });

  app.post('/start', async (req: FastifyRequest, reply: FastifyReply) => {
    const { type } = StartSchema.parse(req.body);
    const playerId = req.player.id;

    const crimeDef = CRIME_DEFS.find(c => c.type === type);
    if (!crimeDef) return reply.status(400).send({ error: 'Unknown crime type' });

    // Check phase
    const playerRes = await query<{ unlock_phase: number; heat_police: number }>(
      'SELECT unlock_phase, heat_police FROM players WHERE id = $1', [playerId],
    );
    if ((playerRes.rows[0]?.unlock_phase ?? 1) < crimeDef.minPhase) {
      return reply.status(400).send({ error: `Requires Phase ${crimeDef.minPhase}. Keep growing your empire.` });
    }

    // Check no active operation
    const activeRes = await query(
      "SELECT COUNT(*)::int AS cnt FROM crime_operations WHERE player_id = $1 AND status = 'active'",
      [playerId],
    );
    if (Number(activeRes.rows[0].cnt) >= 2) {
      return reply.status(400).send({ error: 'Too many active operations. Wait for one to finish.' });
    }

    // Risk increases with heat
    const heat = Number(playerRes.rows[0]?.heat_police ?? 0);
    const riskLevel = Math.min(95, crimeDef.riskBase + Math.floor(heat / 3));

    const op = await query(
      `INSERT INTO crime_operations (player_id, type, target_desc, risk_level, reward_min, reward_max, resolves_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($7 || ' minutes')::interval) RETURNING id, resolves_at`,
      [playerId, type, `${crimeDef.name}: ${crimeDef.description}`, riskLevel, crimeDef.rewardMin, crimeDef.rewardMax, String(crimeDef.durationMinutes)],
    );

    await query(
      "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'CRIME_START', $2, 0)",
      [playerId, `Started ${crimeDef.icon} ${crimeDef.name}`],
    );

    return reply.send({
      data: {
        operation_id: op.rows[0].id,
        type, name: crimeDef.name,
        risk_level: riskLevel,
        resolves_at: op.rows[0].resolves_at,
        message: `${crimeDef.name} started. Resolves in ${crimeDef.durationMinutes} minutes.`,
      },
    });
  });

  // POST /resolve — check and resolve completed operations (called by tick or manually)
  app.post('/resolve', async (req: FastifyRequest, reply: FastifyReply) => {
    const playerId = req.player.id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const pendingRes = await client.query(
        "SELECT * FROM crime_operations WHERE player_id = $1 AND status = 'active' AND resolves_at <= NOW()",
        [playerId],
      );

      const results: { id: string; type: string; success: boolean; amount: number; message: string }[] = [];

      for (const op of pendingRes.rows) {
        const roll = Math.random() * 100;
        const success = roll >= Number(op.risk_level);
        const crimeDef = CRIME_DEFS.find(c => c.type === op.type) ?? CRIME_DEFS[0];

        if (success) {
          const reward = Math.round(Number(op.reward_min) + Math.random() * (Number(op.reward_max) - Number(op.reward_min)));

          // Add dirty money
          await client.query(
            'UPDATE players SET dirty_money = dirty_money + $1 WHERE id = $2',
            [reward, playerId],
          );

          await client.query(
            "UPDATE crime_operations SET status = 'success', resolved_at = NOW(), result_amount = $1, result_message = $2 WHERE id = $3",
            [reward, `Success! Earned $${reward} in dirty money.`, op.id],
          );

          await client.query(
            "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'CRIME_SUCCESS', $2, $3)",
            [playerId, `${crimeDef.icon} ${crimeDef.name} succeeded! +$${reward} dirty money`, reward],
          );

          results.push({ id: op.id, type: op.type, success: true, amount: reward, message: `Success! +$${reward} dirty money` });
        } else {
          const heatGain = crimeDef.heatGainOnFail;

          await client.query(
            'UPDATE players SET heat_police = LEAST(100, heat_police + $1) WHERE id = $2',
            [heatGain, playerId],
          );

          const busted = Math.random() < 0.3; // 30% chance of getting busted (lose cash)
          let penalty = 0;
          if (busted) {
            penalty = Math.round(Number(op.reward_min) * 0.5);
            await client.query('UPDATE players SET cash = GREATEST(0, cash - $1) WHERE id = $2', [penalty, playerId]);
          }

          await client.query(
            "UPDATE crime_operations SET status = $1, resolved_at = NOW(), result_amount = $2, result_message = $3 WHERE id = $4",
            [busted ? 'busted' : 'failed', -penalty, busted ? `Busted! Lost $${penalty} and gained ${heatGain} heat.` : `Failed. +${heatGain} police heat.`, op.id],
          );

          await client.query(
            "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'CRIME_FAIL', $2, $3)",
            [playerId, busted ? `${crimeDef.icon} Busted! -$${penalty}, +${heatGain} heat` : `${crimeDef.icon} ${crimeDef.name} failed. +${heatGain} heat`, busted ? -penalty : 0],
          );

          results.push({ id: op.id, type: op.type, success: false, amount: busted ? -penalty : 0, message: busted ? `Busted! -$${penalty}` : `Failed. +${heatGain} heat` });
        }
      }

      await client.query('COMMIT');

      return reply.send({ data: { resolved: results.length, results } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─── POST /sabotage — attack rival's business ──────────────────
  const SabotageSchema = z.object({
    target_business_id: z.string().uuid().optional(),
    target_player_id: z.string().uuid().optional(),
    type: z.enum(['disruption', 'arson', 'data_leak']),
  }).refine(
    (d) => d.target_business_id || d.target_player_id,
    { message: 'Either target_business_id or target_player_id is required' },
  );

  app.post('/sabotage', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = SabotageSchema.parse(req.body);
    const type = parsed.type;
    const playerId = req.player.id;

    const costs = { disruption: 5000, arson: 15000, data_leak: 8000 };
    const heatGains = { disruption: 10, arson: 25, data_leak: 15 };
    const descriptions = {
      disruption: 'Supply Disruption — stops production for 30 minutes',
      arson: 'Arson — damages business tier',
      data_leak: 'Data Leak — reveals business finances to you',
    };

    const cost = costs[type];

    // Check cash
    const playerRes = await query<{ cash: string; heat_police: number }>(
      'SELECT cash, heat_police FROM players WHERE id = $1', [playerId],
    );
    if (Number(playerRes.rows[0]?.cash ?? 0) < cost) {
      return reply.status(400).send({ error: `Need $${cost}` });
    }

    // Resolve target_business_id: if target_player_id given, pick a random active business
    let target_business_id = parsed.target_business_id;
    if (!target_business_id && parsed.target_player_id) {
      if (parsed.target_player_id === playerId) {
        return reply.status(400).send({ error: "Can't sabotage yourself" });
      }
      const bizRes = await query(
        `SELECT id FROM businesses WHERE owner_id = $1 AND status = 'active' ORDER BY random() LIMIT 1`,
        [parsed.target_player_id],
      );
      if (!bizRes.rows.length) {
        return reply.status(404).send({ error: 'Target player has no active businesses' });
      }
      target_business_id = bizRes.rows[0].id as string;
    }

    // Check target business (must belong to another player)
    const targetRes = await query(
      `SELECT b.id, b.name, b.type, b.tier, b.owner_id, b.security_physical, b.security_cyber,
              p.username AS owner_name
       FROM businesses b JOIN players p ON p.id = b.owner_id
       WHERE b.id = $1 AND b.status = 'active' AND b.owner_id != $2`,
      [target_business_id, playerId],
    );
    if (!targetRes.rows.length) return reply.status(404).send({ error: 'Target not found or is yours' });
    const target = targetRes.rows[0];

    // Require spy report on target player
    const spyCheck = await query(
      'SELECT COUNT(*)::int AS cnt FROM intel_reports WHERE player_id = $1 AND target_id = $2',
      [playerId, target.owner_id],
    );
    if (Number(spyCheck.rows[0].cnt) === 0) {
      return reply.status(400).send({ error: 'Need intel on this player first. Spy on them.' });
    }

    // Pay cost
    await query('UPDATE players SET cash = cash - $1 WHERE id = $2', [cost, playerId]);

    // Security defense check
    const secType = type === 'data_leak' ? 'security_cyber' : 'security_physical';
    const secLevel = Number(target[secType] ?? 0);
    const blocked = Math.random() * 100 < secLevel;

    if (blocked) {
      await query('UPDATE players SET heat_police = LEAST(100, heat_police + $1) WHERE id = $2', [Math.floor(heatGains[type] / 2), playerId]);
      await query("INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'SABOTAGE_BLOCKED', $2, $3)",
        [playerId, `Sabotage on "${target.name}" blocked by security!`, -cost]);

      // Trust penalty
      const { adjustTrust } = await import('../lib/trust.js');
      await adjustTrust((sql, params) => query(sql, params) as any, playerId, target.owner_id as string, -10, 'sabotage');

      return reply.send({ data: { success: false, message: `Blocked by ${target.name}'s security! Lost $${cost}.` } });
    }

    // Execute sabotage
    let resultMsg = '';
    if (type === 'disruption') {
      await query("UPDATE businesses SET status = 'idle' WHERE id = $1", [target_business_id]);
      resultMsg = `Production disrupted at "${target.name}" for 30 minutes.`;
      // Auto-restore after 30min (handled by next daily tick unfreeze logic — reuse raided→active pattern)
      await query("INSERT INTO activity_log (player_id, business_id, type, message, amount) VALUES ($1, $2, 'SABOTAGED', $3, 0)",
        [target.owner_id, target_business_id, `"${target.name}" was sabotaged! Production halted.`]);
    } else if (type === 'arson') {
      if (Number(target.tier) > 1) {
        await query('UPDATE businesses SET tier = tier - 1 WHERE id = $1', [target_business_id]);
        resultMsg = `Arson on "${target.name}" — downgraded from Tier ${target.tier} to ${Number(target.tier) - 1}.`;
      } else {
        resultMsg = `Arson on "${target.name}" — damaged but already Tier 1.`;
      }
      await query("INSERT INTO activity_log (player_id, business_id, type, message, amount) VALUES ($1, $2, 'SABOTAGED', $3, 0)",
        [target.owner_id, target_business_id, `"${target.name}" was attacked! Tier damaged.`]);
    } else if (type === 'data_leak') {
      // Return financial info about the target business
      const finRes = await query(`
        SELECT COALESCE(SUM(inv.amount * i.base_price), 0)::numeric AS inventory_value
        FROM inventory inv JOIN items i ON i.id = inv.item_id
        WHERE inv.business_id = $1
      `, [target_business_id]);
      resultMsg = `Data leak from "${target.name}": inventory value $${Number(finRes.rows[0]?.inventory_value ?? 0).toFixed(2)}, Tier ${target.tier}, ${target.type}`;
    }

    // Heat + trust
    await query('UPDATE players SET heat_police = LEAST(100, heat_police + $1), heat_rival = LEAST(100, heat_rival + $2) WHERE id = $3',
      [heatGains[type], 5, playerId]);
    const { adjustTrust } = await import('../lib/trust.js');
    await adjustTrust((sql, params) => query(sql, params) as any, playerId, target.owner_id as string, -15, 'sabotage');

    await query("INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'SABOTAGE', $2, $3)",
      [playerId, resultMsg, -cost]);

    return reply.send({ data: { success: true, type, target: target.name, cost, message: resultMsg } });
  });

  // GET /status — player's crime stats (dirty money, heat)
  app.get('/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT dirty_money, heat_police, heat_rival, heat_fed,
              (SELECT COUNT(*) FROM crime_operations WHERE player_id = $1 AND status = 'active')::int AS active_ops,
              (SELECT COUNT(*) FROM laundering_jobs WHERE player_id = $1 AND status = 'active')::int AS active_laundering
       FROM players WHERE id = $1`,
      [req.player.id],
    );
    return reply.send({ data: res.rows[0] });
  });

  // ─── Laundering ─────────────────────────────────────────────────

  const LaunderSchema = z.object({
    business_id: z.string().uuid(),
    amount: z.number().positive(),
  });

  // POST /launder — start laundering dirty money through a business
  app.post('/launder', async (req: FastifyRequest, reply: FastifyReply) => {
    const { business_id, amount } = LaunderSchema.parse(req.body);
    const playerId = req.player.id;

    // Check dirty money
    const playerRes = await query<{ dirty_money: string; heat_police: number }>(
      'SELECT dirty_money, heat_police FROM players WHERE id = $1', [playerId],
    );
    const dirtyMoney = Number(playerRes.rows[0]?.dirty_money ?? 0);
    if (dirtyMoney < amount) {
      return reply.status(400).send({ error: `Not enough dirty money. Have $${dirtyMoney.toFixed(2)}` });
    }

    // Check business ownership
    const bizRes = await query<{ id: string; type: string; name: string }>(
      "SELECT id, type, name FROM businesses WHERE id = $1 AND owner_id = $2 AND status = 'active'",
      [business_id, playerId],
    );
    if (!bizRes.rows.length) {
      return reply.status(404).send({ error: 'Business not found or not active' });
    }

    // Check active laundering limit
    const activeRes = await query(
      "SELECT COUNT(*)::int AS cnt FROM laundering_jobs WHERE player_id = $1 AND status = 'active'",
      [playerId],
    );
    if (Number(activeRes.rows[0].cnt) >= 3) {
      return reply.status(400).send({ error: 'Too many active laundering jobs. Max 3.' });
    }

    // Efficiency based on business type (SHOPs are best for laundering)
    const heat = Number(playerRes.rows[0]?.heat_police ?? 0);
    const bizType = bizRes.rows[0].type;
    const baseEfficiency = bizType === 'SHOP' ? 0.85 : bizType === 'FACTORY' ? 0.75 : 0.65;
    const efficiency = Math.max(0.5, baseEfficiency - heat / 200);
    const riskLevel = Math.min(80, 20 + Math.floor(amount / 5000) + Math.floor(heat / 2));
    const durationMinutes = Math.max(10, Math.floor(amount / 500));

    // Deduct dirty money
    await query('UPDATE players SET dirty_money = dirty_money - $1 WHERE id = $2', [amount, playerId]);

    // Create job
    const jobRes = await query(
      `INSERT INTO laundering_jobs (player_id, business_id, dirty_amount, efficiency, risk_level, resolves_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' minutes')::interval) RETURNING id, resolves_at`,
      [playerId, business_id, amount, efficiency, riskLevel, String(durationMinutes)],
    );

    await query(
      "INSERT INTO activity_log (player_id, business_id, type, message, amount) VALUES ($1, $2, 'LAUNDER_START', $3, $4)",
      [playerId, business_id, `Started laundering $${amount.toFixed(2)} through ${bizRes.rows[0].name}`, -amount],
    );

    return reply.send({
      data: {
        job_id: jobRes.rows[0].id,
        business: bizRes.rows[0].name,
        dirty_amount: amount,
        efficiency: Math.round(efficiency * 100),
        risk_level: riskLevel,
        resolves_at: jobRes.rows[0].resolves_at,
        duration_minutes: durationMinutes,
        estimated_clean: Math.round(amount * efficiency * 100) / 100,
      },
    });
  });

  // GET /laundering — active laundering jobs
  app.get('/laundering', async (req: FastifyRequest, reply: FastifyReply) => {
    const jobs = await query(
      `SELECT lj.id, lj.dirty_amount, lj.clean_amount, lj.efficiency, lj.risk_level,
              lj.status, lj.started_at, lj.resolves_at, lj.resolved_at,
              b.name AS business_name, b.type AS business_type
       FROM laundering_jobs lj
       JOIN businesses b ON b.id = lj.business_id
       WHERE lj.player_id = $1
       ORDER BY lj.started_at DESC LIMIT 20`,
      [req.player.id],
    );
    return reply.send({ data: jobs.rows });
  });

  // POST /laundering/resolve — resolve completed laundering jobs
  app.post('/laundering/resolve', async (req: FastifyRequest, reply: FastifyReply) => {
    const playerId = req.player.id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const pendingRes = await client.query(
        "SELECT * FROM laundering_jobs WHERE player_id = $1 AND status = 'active' AND resolves_at <= NOW()",
        [playerId],
      );

      const results: { id: string; success: boolean; clean_amount: number; message: string }[] = [];

      for (const job of pendingRes.rows) {
        const roll = Math.random() * 100;
        const detected = roll < Number(job.risk_level);

        if (!detected) {
          const cleanAmount = Math.round(Number(job.dirty_amount) * Number(job.efficiency) * 100) / 100;

          await client.query('UPDATE players SET cash = cash + $1 WHERE id = $2', [cleanAmount, playerId]);
          await client.query(
            "UPDATE laundering_jobs SET status = 'completed', resolved_at = NOW(), clean_amount = $1 WHERE id = $2",
            [cleanAmount, job.id],
          );
          await client.query(
            "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'LAUNDER_SUCCESS', $2, $3)",
            [playerId, `Laundering complete: $${cleanAmount.toFixed(2)} clean cash`, cleanAmount],
          );

          results.push({ id: job.id, success: true, clean_amount: cleanAmount, message: `+$${cleanAmount.toFixed(2)} clean cash` });
        } else {
          // Detected! Money lost + heat increase
          const heatGain = 10 + Math.floor(Number(job.dirty_amount) / 5000);
          await client.query(
            'UPDATE players SET heat_police = LEAST(100, heat_police + $1) WHERE id = $2',
            [heatGain, playerId],
          );
          await client.query(
            "UPDATE laundering_jobs SET status = 'detected', resolved_at = NOW(), clean_amount = 0 WHERE id = $1",
            [job.id],
          );
          await client.query(
            "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'LAUNDER_DETECTED', $2, 0)",
            [playerId, `Laundering detected! $${Number(job.dirty_amount).toFixed(2)} confiscated, +${heatGain} heat`],
          );

          results.push({ id: job.id, success: false, clean_amount: 0, message: `Detected! Money lost, +${heatGain} heat` });
        }
      }

      await client.query('COMMIT');
      return reply.send({ data: { resolved: results.length, results } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
