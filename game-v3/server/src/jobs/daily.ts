// EmpireOS V3 — Daily tick
// Runs once per day: deducts costs, refreshes employee pool, checks unlock phases, cleans old logs.

import { withTransaction } from '../db/client.js';
import { EMPLOYEE_POOL, UNLOCK_CONDITIONS, type EmployeeTier } from '../config/game.config.js';
import { broadcast } from '../websocket/connections.js';
import type { PoolClient } from 'pg';

// ─── Helpers (same logic as seed.ts) ────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedTier(): EmployeeTier {
  const tiers = EMPLOYEE_POOL.tiers;
  const totalWeight = Object.values(tiers).reduce((s, t) => s + t.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const [key, cfg] of Object.entries(tiers)) {
    roll -= cfg.weight;
    if (roll <= 0) return key as EmployeeTier;
  }
  return 'common';
}

const FIRST_NAMES = [
  'Marcus', 'Elena', 'Jin', 'Aisha', 'Dmitri',
  'Sofia', 'Carlos', 'Yuki', 'Amara', 'Viktor',
  'Lena', 'Omar', 'Mei', 'Andrei', 'Fatima',
  'Kofi', 'Ines', 'Raj', 'Hana', 'Leo',
];

const LAST_NAMES = [
  'Volkov', 'Chen', 'Santos', 'Okafor', 'Kim',
  'Rossi', 'Petrov', 'Tanaka', 'Larsson', 'Ali',
  'Morozov', 'Silva', 'Park', 'Weber', 'Nakamura',
  'Diaz', 'Nguyen', 'Kowalski', 'Ferreira', 'Singh',
];

const HIDDEN_TRAITS = [
  'workaholic', 'lazy', 'loyal', 'greedy', 'meticulous',
  'clumsy', 'charismatic', 'paranoid', 'innovative', 'reckless',
  null, null, null,
];

function randomName(): string {
  return `${FIRST_NAMES[rand(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[rand(0, LAST_NAMES.length - 1)]}`;
}

// ─── Types ──────────────────────────────────────────────────────────

interface PlayerCostRow {
  player_id: string;
  cash: string;
  level: number;
  unlock_phase: number;
  biz_count: number;
  location_costs: string;
  salary_costs: string;
}

// ─── Main daily tick ────────────────────────────────────────────────

export async function runDailyTick(): Promise<{
  players_charged: number;
  employees_generated: number;
  phases_upgraded: number;
  duration_ms: number;
}> {
  const start = Date.now();
  let playersCharged = 0;
  let employeesGenerated = 0;
  let phasesUpgraded = 0;

  await withTransaction(async (client: PoolClient) => {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Daily Costs
    // ═══════════════════════════════════════════════════════════════

    const costRes = await client.query<PlayerCostRow>(`
      SELECT p.id AS player_id, p.cash::numeric, p.level, p.unlock_phase,
        (SELECT COUNT(*) FROM businesses b2 WHERE b2.owner_id = p.id AND b2.status = 'active')::int AS biz_count,
        COALESCE(SUM(l.daily_cost), 0)::numeric AS location_costs,
        COALESCE((
          SELECT SUM(e.salary) FROM employees e
          JOIN businesses b3 ON b3.id = e.business_id
          WHERE b3.owner_id = p.id AND e.status IN ('active','training')
        ), 0)::numeric AS salary_costs
      FROM players p
      JOIN businesses b ON b.owner_id = p.id AND b.status = 'active'
      JOIN locations l ON l.id = b.location_id
      GROUP BY p.id, p.cash, p.level, p.unlock_phase
    `);

    for (const row of costRes.rows) {
      const locationCosts = Number(row.location_costs);
      const salaryCosts = Number(row.salary_costs);
      const totalCost = locationCosts + salaryCosts;

      if (totalCost <= 0) continue;

      // Deduct from cash
      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [totalCost, row.player_id],
      );

      // Activity log
      await client.query(
        `INSERT INTO activity_log (player_id, type, message, amount)
         VALUES ($1, 'DAILY_COST', $2, $3)`,
        [
          row.player_id,
          `Daily costs: $${totalCost.toFixed(2)} (locations: $${locationCosts.toFixed(2)}, salaries: $${salaryCosts.toFixed(2)})`,
          -totalCost,
        ],
      );

      // Check if cash is now negative
      const cashAfter = Number(row.cash) - totalCost;
      if (cashAfter < 0) {
        // Suspend all businesses
        await client.query(
          `UPDATE businesses SET status = 'idle' WHERE owner_id = $1 AND status = 'active'`,
          [row.player_id],
        );
        await client.query(
          `INSERT INTO activity_log (player_id, type, message, amount)
           VALUES ($1, 'WARNING', 'Businesses suspended — insufficient funds!', 0)`,
          [row.player_id],
        );
      }

      playersCharged++;
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Employee Pool Refresh
    // ═══════════════════════════════════════════════════════════════

    // Delete old unfilled pool employees
    await client.query(
      `DELETE FROM employees WHERE status = 'available' AND business_id IS NULL`,
    );

    // Get active season
    const seasonRes = await client.query<{ id: string }>(
      `SELECT id FROM seasons WHERE status = 'active' LIMIT 1`,
    );
    if (seasonRes.rows.length > 0) {
      const seasonId = seasonRes.rows[0].id;

      // Get next pool_batch number
      const batchRes = await client.query<{ next_batch: number }>(
        `SELECT COALESCE(MAX(pool_batch), 0) + 1 AS next_batch FROM employees`,
      );
      const nextBatch = batchRes.rows[0].next_batch;

      // Generate new wave
      const poolSize = rand(EMPLOYEE_POOL.minPoolSize, EMPLOYEE_POOL.maxPoolSize);

      for (let i = 0; i < poolSize; i++) {
        const tier = pickWeightedTier();
        const cfg = EMPLOYEE_POOL.tiers[tier];
        const efficiency = rand(cfg.effMin, cfg.effMax);
        const salary = rand(cfg.salaryMin, cfg.salaryMax);
        const speed = rand(cfg.effMin, cfg.effMax);
        const loyalty = rand(30, 80);
        const discretion = rand(20, 70);
        const learningRate = rand(30, 70);
        const corruptionRisk = rand(5, 30);
        const hiddenTrait = HIDDEN_TRAITS[rand(0, HIDDEN_TRAITS.length - 1)];
        const name = randomName();

        await client.query(
          `INSERT INTO employees (season_id, name, role, salary, efficiency, speed, loyalty, discretion, learning_rate, corruption_risk, hidden_trait, status, pool_batch)
           VALUES ($1, $2, 'WORKER', $3, $4, $5, $6, $7, $8, $9, $10, 'available', $11)`,
          [seasonId, name, salary, efficiency, speed, loyalty, discretion, learningRate, corruptionRisk, hiddenTrait, nextBatch],
        );

        employeesGenerated++;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Unlock Phase Check
    // ═══════════════════════════════════════════════════════════════

    for (const row of costRes.rows) {
      const currentPhase = row.unlock_phase;
      const level = row.level;
      let newPhase = currentPhase;

      if (currentPhase === 1) {
        const cond = UNLOCK_CONDITIONS[2];
        // Check totalRevenue: sum of positive amounts from SALE and AUTOSELL activity
        const revRes = await client.query<{ total_revenue: string }>(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS total_revenue
           FROM activity_log
           WHERE player_id = $1 AND type IN ('sale', 'SALE', 'AUTOSELL') AND amount > 0`,
          [row.player_id],
        );
        const totalRevenue = Number(revRes.rows[0].total_revenue);

        if ((cond.totalRevenue && totalRevenue >= cond.totalRevenue) || level >= cond.orLevel) {
          newPhase = 2;
        }
      }

      if (currentPhase === 2 || newPhase === 2) {
        if (newPhase >= 2 && currentPhase <= 2) {
          const cond = UNLOCK_CONDITIONS[3];
          if ((cond.businessCount && row.biz_count >= cond.businessCount) || level >= cond.orLevel) {
            newPhase = 3;
          }
        }
      }

      if (currentPhase === 3 || newPhase === 3) {
        if (newPhase >= 3 && currentPhase <= 3) {
          const cond = UNLOCK_CONDITIONS[4];
          // Check netWorth: cash + bank + sum of business values (we approximate with location prices)
          const worthRes = await client.query<{ net_worth: string }>(
            `SELECT (
              p.cash + p.bank_balance +
              COALESCE((SELECT SUM(l.price) FROM businesses b JOIN locations l ON l.id = b.location_id WHERE b.owner_id = p.id AND b.status != 'shutdown'), 0)
            )::numeric AS net_worth
            FROM players p WHERE p.id = $1`,
            [row.player_id],
          );
          const netWorth = Number(worthRes.rows[0]?.net_worth ?? 0);

          if ((cond.netWorth && netWorth >= cond.netWorth) || level >= cond.orLevel) {
            newPhase = 4;
          }
        }
      }

      if (newPhase > currentPhase) {
        await client.query(
          `UPDATE players SET unlock_phase = $1 WHERE id = $2`,
          [newPhase, row.player_id],
        );
        await client.query(
          `INSERT INTO activity_log (player_id, type, message, amount)
           VALUES ($1, 'UNLOCK', $2, 0)`,
          [row.player_id, `Phase ${newPhase} unlocked! New features available.`],
        );
        phasesUpgraded++;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Police Raids (heat >= 70 = risk of raid)
    // ═══════════════════════════════════════════════════════════════

    const hotPlayers = await client.query<{ id: string; heat_police: number }>(
      'SELECT id, heat_police FROM players WHERE heat_police >= 70',
    );

    for (const hp of hotPlayers.rows) {
      // Raid chance: (heat - 60) / 100, so at 70 = 10%, at 100 = 40%
      const raidChance = (hp.heat_police - 60) / 100;
      if (Math.random() >= raidChance) continue;

      // Pick a random active business to raid (prefer low-security ones)
      const bizRes = await client.query(
        "SELECT id, name, security_physical, security_legal FROM businesses WHERE owner_id = $1 AND status = 'active' ORDER BY (security_physical + security_legal) ASC, RANDOM() LIMIT 1",
        [hp.id],
      );
      if (!bizRes.rows.length) continue;

      const biz = bizRes.rows[0];
      // Security reduces raid success: high security can block the raid
      const securityDefense = (Number(biz.security_physical ?? 0) + Number(biz.security_legal ?? 0)) / 200;
      if (Math.random() < securityDefense) continue; // Security blocked the raid

      const fine = 2000 + Math.floor(hp.heat_police * 50);

      // Freeze business for 30 minutes
      await client.query(
        "UPDATE businesses SET status = 'raided' WHERE id = $1",
        [biz.id],
      );

      // Fine the player
      await client.query(
        'UPDATE players SET cash = GREATEST(0, cash - $1), heat_police = GREATEST(0, heat_police - 20), rep_street = GREATEST(0, rep_street - 5) WHERE id = $2',
        [fine, hp.id],
      );

      await client.query(
        "INSERT INTO activity_log (player_id, business_id, type, message, amount) VALUES ($1, $2, 'POLICE_RAID', $3, $4)",
        [hp.id, biz.id, `Police raided "${biz.name}"! Fined $${fine}. Business frozen.`, -fine],
      );

      console.log(`[daily] Police raided ${biz.name} (player ${hp.id}), fine $${fine}`);
    }

    // Unfreeze businesses raided > 30 min ago
    await client.query(
      `UPDATE businesses SET status = 'active'
       WHERE status = 'raided'
       AND id IN (
         SELECT business_id FROM activity_log
         WHERE type = 'POLICE_RAID' AND created_at < NOW() - INTERVAL '30 minutes'
       )`,
    );

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Fulfill contracts
    try {
      const { fulfillContracts } = await import('../routes/contracts.js');
      const contractsFulfilled = await fulfillContracts((sql, params) => client.query(sql, params) as any);
      if (contractsFulfilled > 0) console.log(`[daily] ${contractsFulfilled} contract(s) fulfilled`);
    } catch (err) {
      console.error('[daily] Contract fulfillment error:', err);
    }

    // STEP 6: Cleanup
    // ═══════════════════════════════════════════════════════════════

    await client.query(
      `DELETE FROM inventory_log WHERE created_at < NOW() - INTERVAL '7 days'`,
    );
    await client.query(
      `DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '30 days'`,
    );
  });

  const duration_ms = Date.now() - start;

  // Log to game_ticks (outside transaction)
  const { query: dbQuery } = await import('../db/client.js');
  await dbQuery(
    `INSERT INTO game_ticks (tick_type, completed_at, duration_ms, stats)
     VALUES ('daily', NOW(), $1, $2)`,
    [duration_ms, JSON.stringify({ players_charged: playersCharged, employees_generated: employeesGenerated, phases_upgraded: phasesUpgraded })],
  );

  broadcast('tick:daily', { players_charged: playersCharged, employees_generated: employeesGenerated, phases_upgraded: phasesUpgraded });
  return { players_charged: playersCharged, employees_generated: employeesGenerated, phases_upgraded: phasesUpgraded, duration_ms };
}
