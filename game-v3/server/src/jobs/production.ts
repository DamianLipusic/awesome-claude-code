import { withTransaction } from '../db/client.js';
import { calcProduction, storageCap } from '../config/game.config.js';
import { broadcast, sendToPlayer } from '../websocket/connections.js';
import type { PoolClient } from 'pg';

interface BusinessRow {
  id: string;
  type: string;
  tier: number;
  efficiency: number;
  recipe_id: string | null;
  owner_id: string;
  base_rate: string | null;
  output_item_id: string | null;
  location_traffic: number | null;
  emp_count: number;
  avg_eff: number;
  avg_stress: number;
}

interface RecipeInput {
  item_id: string;
  quantity_per_unit: string;
}

interface InventoryRow {
  item_id: string;
  amount: string;
}

export async function runProductionTick(): Promise<{ businesses: number; produced: number; duration_ms: number }> {
  const start = Date.now();
  let businessCount = 0;
  let totalProduced = 0;

  await withTransaction(async (client: PoolClient) => {
    // ─── 1. Load all active businesses with recipe + employee stats ──
    const bizRes = await client.query<BusinessRow>(`
      SELECT b.id, b.type, b.tier, b.efficiency, b.recipe_id, b.owner_id,
        r.base_rate, r.output_item_id,
        l.traffic AS location_traffic,
        (SELECT COUNT(*) FROM employees e WHERE e.business_id = b.id AND e.status = 'active')::int AS emp_count,
        (SELECT COALESCE(AVG(e.efficiency), 0) FROM employees e WHERE e.business_id = b.id AND e.status = 'active')::int AS avg_eff,
        (SELECT COALESCE(AVG(e.stress), 0) FROM employees e WHERE e.business_id = b.id AND e.status = 'active')::int AS avg_stress
      FROM businesses b
      LEFT JOIN recipes r ON r.id = b.recipe_id
      LEFT JOIN locations l ON l.id = b.location_id
      WHERE b.status = 'active'
    `);

    // ─── 2. Process each business with recipe and employees ─────────
    for (const biz of bizRes.rows) {
      if (!biz.recipe_id || !biz.output_item_id || biz.emp_count === 0) {
        continue;
      }

      const baseRate = Number(biz.base_rate);
      const bizEfficiency = biz.efficiency; // DB default 100

      // Calculate raw output
      let output = calcProduction(baseRate, biz.avg_eff, bizEfficiency, biz.avg_stress);

      // ─── Check storage cap ────────────────────────────────────────
      const cap = storageCap(biz.tier);
      const currentInvRes = await client.query<{ amount: string }>(
        `SELECT COALESCE(amount, 0) AS amount FROM inventory WHERE business_id = $1 AND item_id = $2`,
        [biz.id, biz.output_item_id],
      );
      const currentAmount = currentInvRes.rows.length ? Number(currentInvRes.rows[0].amount) : 0;
      output = Math.min(output, cap - currentAmount);

      // ─── Check input availability ─────────────────────────────────
      const inputsRes = await client.query<RecipeInput>(
        `SELECT item_id, quantity_per_unit FROM recipe_inputs WHERE recipe_id = $1`,
        [biz.recipe_id],
      );

      if (inputsRes.rows.length > 0) {
        for (const input of inputsRes.rows) {
          const qtyNeeded = Number(input.quantity_per_unit);
          const inputInvRes = await client.query<InventoryRow>(
            `SELECT amount FROM inventory WHERE business_id = $1 AND item_id = $2`,
            [biz.id, input.item_id],
          );
          const available = inputInvRes.rows.length ? Number(inputInvRes.rows[0].amount) : 0;
          // Cap output by available inputs
          const maxFromInput = qtyNeeded > 0 ? available / qtyNeeded : Infinity;
          output = Math.min(output, maxFromInput);
        }
      }

      // Floor to integer
      output = Math.floor(output);

      if (output <= 0) continue;

      // ─── Deduct inputs ────────────────────────────────────────────
      for (const input of inputsRes.rows) {
        const deduct = output * Number(input.quantity_per_unit);
        await client.query(
          `UPDATE inventory SET amount = amount - $1, updated_at = NOW() WHERE business_id = $2 AND item_id = $3`,
          [deduct, biz.id, input.item_id],
        );
        await client.query(
          `INSERT INTO inventory_log (business_id, item_id, delta, reason)
           VALUES ($1, $2, $3, 'production_input')`,
          [biz.id, input.item_id, -deduct],
        );
      }

      // ─── Add output to inventory (upsert) ─────────────────────────
      await client.query(
        `INSERT INTO inventory (business_id, item_id, amount, reserved, dirty_amount)
         VALUES ($1, $2, $3, 0, 0)
         ON CONFLICT (business_id, item_id) DO UPDATE SET amount = inventory.amount + $3, updated_at = NOW()`,
        [biz.id, biz.output_item_id, output],
      );
      await client.query(
        `INSERT INTO inventory_log (business_id, item_id, delta, reason)
         VALUES ($1, $2, $3, 'production_output')`,
        [biz.id, biz.output_item_id, output],
      );

      totalProduced += output;
      businessCount++;
    }

    // ─── 3. Handle training completion ──────────────────────────────
    const completedTrainings = await client.query<{ employee_id: string; stat_targets: Record<string, number> }>(
      `UPDATE training SET status = 'completed'
       WHERE status = 'active' AND ends_at <= NOW()
       RETURNING employee_id, stat_targets`,
    );

    for (const t of completedTrainings.rows) {
      const targets = typeof t.stat_targets === 'string' ? JSON.parse(t.stat_targets) : t.stat_targets;
      const boostEff = targets.efficiency || 0;
      const boostSpeed = targets.speed || 0;
      const boostLoyalty = targets.loyalty || 0;
      const boostDiscretion = targets.discretion || 0;

      await client.query(
        `UPDATE employees SET
           status = 'active',
           efficiency = LEAST(100, efficiency + $1),
           speed = LEAST(100, speed + $2),
           loyalty = LEAST(100, loyalty + $3),
           discretion = LEAST(100, discretion + $4)
         WHERE id = $5 AND status = 'training'`,
        [boostEff, boostSpeed, boostLoyalty, boostDiscretion, t.employee_id],
      );
    }
  });

  const duration_ms = Date.now() - start;

  // ─── 4. Heat decay (outside transaction) ──────────────────────
  const { query: dbQuery } = await import('../db/client.js');
  await dbQuery(
    `UPDATE players SET
       heat_police = GREATEST(0, heat_police - 1),
       heat_rival = GREATEST(0, heat_rival - 1),
       heat_fed = GREATEST(0, heat_fed - 1)
     WHERE heat_police > 0 OR heat_rival > 0 OR heat_fed > 0`,
  );

  // ─── 5. Auto-resolve crime operations ─────────────────────────
  const completedCrimes = await dbQuery(
    "SELECT id, player_id, type, risk_level, reward_min, reward_max FROM crime_operations WHERE status = 'active' AND resolves_at <= NOW()",
  );
  for (const op of completedCrimes.rows) {
    const roll = Math.random() * 100;
    const success = roll >= Number(op.risk_level);
    if (success) {
      const reward = Math.round(Number(op.reward_min) + Math.random() * (Number(op.reward_max) - Number(op.reward_min)));
      await dbQuery('UPDATE players SET dirty_money = dirty_money + $1, rep_underworld = LEAST(100, rep_underworld + 2) WHERE id = $2', [reward, op.player_id]);
      await dbQuery("UPDATE crime_operations SET status = 'success', resolved_at = NOW(), result_amount = $1, result_message = 'Auto-resolved: success' WHERE id = $2", [reward, op.id]);
      await dbQuery("INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'CRIME_SUCCESS', $2, $3)", [op.player_id, `Crime succeeded! +$${reward} dirty money`, reward]);
      sendToPlayer(op.player_id, 'crime:resolved', { id: op.id, success: true, amount: reward });
    } else {
      const heatGain = 5 + Math.floor(Number(op.reward_min) / 2000);
      await dbQuery('UPDATE players SET heat_police = LEAST(100, heat_police + $1) WHERE id = $2', [heatGain, op.player_id]);
      await dbQuery("UPDATE crime_operations SET status = 'failed', resolved_at = NOW(), result_amount = 0, result_message = 'Auto-resolved: failed' WHERE id = $1", [op.id]);
      await dbQuery("INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'CRIME_FAIL', $2, 0)", [op.player_id, `Crime failed. +${heatGain} heat`]);
      sendToPlayer(op.player_id, 'crime:resolved', { id: op.id, success: false, heat: heatGain });
    }
  }

  // ─── 6. Auto-resolve laundering jobs ──────────────────────────
  const completedLaunder = await dbQuery(
    "SELECT id, player_id, dirty_amount, efficiency, risk_level FROM laundering_jobs WHERE status = 'active' AND resolves_at <= NOW()",
  );
  for (const job of completedLaunder.rows) {
    const roll = Math.random() * 100;
    const detected = roll < Number(job.risk_level);
    if (!detected) {
      const cleanAmount = Math.round(Number(job.dirty_amount) * Number(job.efficiency) * 100) / 100;
      await dbQuery('UPDATE players SET cash = cash + $1 WHERE id = $2', [cleanAmount, job.player_id]);
      await dbQuery("UPDATE laundering_jobs SET status = 'completed', resolved_at = NOW(), clean_amount = $1 WHERE id = $2", [cleanAmount, job.id]);
      await dbQuery("INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'LAUNDER_SUCCESS', $2, $3)", [job.player_id, `Laundering complete: +$${cleanAmount}`, cleanAmount]);
      sendToPlayer(job.player_id, 'launder:resolved', { id: job.id, success: true, amount: cleanAmount });
    } else {
      const heatGain = 10;
      await dbQuery('UPDATE players SET heat_police = LEAST(100, heat_police + $1) WHERE id = $2', [heatGain, job.player_id]);
      await dbQuery("UPDATE laundering_jobs SET status = 'detected', resolved_at = NOW(), clean_amount = 0 WHERE id = $1", [job.id]);
      await dbQuery("INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'LAUNDER_DETECTED', $2, 0)", [job.player_id, `Laundering detected! Money confiscated, +${heatGain} heat`]);
      sendToPlayer(job.player_id, 'launder:resolved', { id: job.id, success: false, heat: heatGain });
    }
  }

  // ─── 7. Reveal hidden traits (10% chance per active employee) ──
  const TRAITS = ['greedy', 'loyal', 'ambitious', 'lazy', 'fearful', 'cunning', 'honest', 'reckless'];
  try {
    const hiddenEmps = await dbQuery(
      "SELECT e.id, b.owner_id AS player_id, e.name, e.hidden_trait FROM employees e JOIN businesses b ON b.id = e.business_id WHERE e.status = 'active' AND e.hidden_trait IS NOT NULL AND e.hired_at < NOW() - INTERVAL '5 minutes'",
    );
    for (const emp of hiddenEmps.rows) {
      if (Math.random() > 0.10) continue; // 10% chance per tick
      // Reveal: move hidden_trait to visible via activity log
      await dbQuery(
        "UPDATE employees SET hidden_trait = NULL WHERE id = $1",
        [emp.id],
      );
      await dbQuery(
        "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'TRAIT_REVEALED', $2, 0)",
        [emp.player_id, `🔍 ${emp.name}'s hidden trait revealed: ${emp.hidden_trait}`],
      );
      sendToPlayer(emp.player_id, 'trait:revealed', { employee: emp.name, trait: emp.hidden_trait });
    }
  } catch { /* non-critical */ }

  // ─── 8. Manager actions ────────────────────────────────────────
  try {
    const { executeManagerActions } = await import('../routes/managers.js');
    const managerActions = await executeManagerActions(dbQuery);
    if (managerActions > 0) console.log(`[tick:production] ${managerActions} manager action(s)`);
  } catch (err) {
    console.error('[tick:production] Manager actions error:', err);
  }

  // ─── 9. Log to game_ticks table ───────────────────────────────
  await dbQuery(
    `INSERT INTO game_ticks (tick_type, completed_at, duration_ms, stats)
     VALUES ('production', NOW(), $1, $2)`,
    [duration_ms, JSON.stringify({ businesses: businessCount, produced: totalProduced })],
  );

  // Broadcast to connected clients
  broadcast('tick:production', { businesses: businessCount, produced: totalProduced, duration_ms });

  return { businesses: businessCount, produced: totalProduced, duration_ms };
}
