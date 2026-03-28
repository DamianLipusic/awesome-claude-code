// EmpireOS V3 — Seed data
// Run via: npm run seed

import 'dotenv/config';
import pool from './client.js';
import {
  ITEMS,
  RECIPES,
  SEED_LOCATIONS,
  EMPLOYEE_POOL,
  type ItemKey,
  type EmployeeTier,
} from '../config/game.config.js';

// ─── Helpers ────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return +(Math.random() * (max - min) + min).toFixed(2);
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
  null, null, null, // ~30% chance of no trait
];

function randomName(): string {
  return `${FIRST_NAMES[rand(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[rand(0, LAST_NAMES.length - 1)]}`;
}

// ─── Main seed ──────────────────────────────────────────────────────

async function seed() {
  console.log('[seed] Starting seed...\n');

  // 1. Season
  const seasonRes = await pool.query(`
    INSERT INTO seasons (number, status, config_json)
    VALUES (1, 'active', '{"name":"Season 1 - Foundation"}'::jsonb)
    ON CONFLICT (number) DO UPDATE SET status = 'active'
    RETURNING id
  `);
  const seasonId = seasonRes.rows[0].id;
  console.log(`[seed] Season 1: ${seasonId}`);

  // 2. Items
  const itemIds: Record<string, string> = {};
  for (const [key, cfg] of Object.entries(ITEMS)) {
    const res = await pool.query(
      `INSERT INTO items (key, name, category, base_price, production_stage)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO NOTHING
       RETURNING id`,
      [key, cfg.name, cfg.category, cfg.basePrice, cfg.stage],
    );
    if (res.rows.length > 0) {
      itemIds[key] = res.rows[0].id;
    } else {
      // Already exists — fetch the id
      const existing = await pool.query(`SELECT id FROM items WHERE key = $1`, [key]);
      itemIds[key] = existing.rows[0].id;
    }
  }
  console.log(`[seed] Items: ${Object.keys(itemIds).length} (${Object.keys(itemIds).join(', ')})`);

  // 3. Recipes + inputs
  // Clear old recipes first so re-seeding is idempotent
  await pool.query(`DELETE FROM recipe_inputs`);
  await pool.query(`DELETE FROM recipes`);

  let recipeCount = 0;
  for (const r of RECIPES) {
    const outputItemId = itemIds[r.outputItem];
    const recRes = await pool.query(
      `INSERT INTO recipes (business_type, output_item_id, base_rate, cycle_minutes)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [r.businessType, outputItemId, r.baseRate, r.cycleMinutes],
    );
    const recipeId = recRes.rows[0].id;

    for (const inp of r.inputs) {
      await pool.query(
        `INSERT INTO recipe_inputs (recipe_id, item_id, quantity_per_unit)
         VALUES ($1, $2, $3)`,
        [recipeId, itemIds[inp.item], inp.qtyPerUnit],
      );
    }
    recipeCount++;
  }
  console.log(`[seed] Recipes: ${recipeCount}`);

  // 4. Locations
  // Delete old seed locations then re-insert (idempotent)
  await pool.query(`DELETE FROM locations WHERE season_id = $1`, [seasonId]);

  for (const loc of SEED_LOCATIONS) {
    await pool.query(
      `INSERT INTO locations (season_id, name, type, zone, price, daily_cost, traffic, visibility, storage_capacity, laundering_potential)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [seasonId, loc.name, loc.type, loc.zone, loc.price, loc.dailyCost, loc.traffic, loc.visibility, loc.storage, loc.laundering],
    );
  }
  console.log(`[seed] Locations: ${SEED_LOCATIONS.length}`);

  // 5. Employees (first pool wave)
  // Remove old pool employees so re-seeding is clean
  await pool.query(`DELETE FROM employees WHERE pool_batch = 1 AND status = 'available'`);

  const employeeCount = 10;
  for (let i = 0; i < employeeCount; i++) {
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

    await pool.query(
      `INSERT INTO employees (season_id, name, role, salary, efficiency, speed, loyalty, discretion, learning_rate, corruption_risk, hidden_trait, status, pool_batch)
       VALUES ($1, $2, 'WORKER', $3, $4, $5, $6, $7, $8, $9, $10, 'available', 1)`,
      [seasonId, name, salary, efficiency, speed, loyalty, discretion, learningRate, corruptionRisk, hiddenTrait],
    );
  }
  console.log(`[seed] Employees: ${employeeCount} (pool_batch=1)`);

  // 6. AI market listings
  await pool.query(`DELETE FROM market_listings WHERE seller_type = 'ai'`);

  const qtyByCategory: Record<string, number> = { raw: 200, intermediate: 100, finished: 50 };
  let listingCount = 0;
  for (const [key, cfg] of Object.entries(ITEMS)) {
    const qty = qtyByCategory[cfg.category] ?? 100;
    const price = +(cfg.basePrice * randFloat(0.95, 1.10)).toFixed(2);
    await pool.query(
      `INSERT INTO market_listings (season_id, seller_type, item_id, quantity, price_per_unit, status)
       VALUES ($1, 'ai', $2, $3, $4, 'open')`,
      [seasonId, itemIds[key as ItemKey], qty, price],
    );
    listingCount++;
  }
  console.log(`[seed] Market listings (AI): ${listingCount}`);

  // 7. Discovery Rules
  const DISCOVERY_RULES = [
    {
      key: 'first_business',
      trigger: { cash_gte: 8000, business_count_eq: 0 },
      surface: 'dashboard', reward: 'info',
      payload: { message: 'A location in the industrial district is available for a good price...' },
      sort: 10,
    },
    {
      key: 'hire_first_worker',
      trigger: { business_count_gte: 1, employee_count_eq: 0 },
      surface: 'dashboard', reward: 'info',
      payload: { message: 'New workers are looking for employment. Check the recruit pool.' },
      sort: 20,
    },
    {
      key: 'production_started',
      trigger: { total_inventory_gte: 1 },
      surface: 'dashboard', reward: 'info',
      payload: { message: 'Your workers are producing! Check your inventory.' },
      sort: 25,
    },
    {
      key: 'sell_on_market',
      trigger: { total_inventory_gte: 20, has_never_sold: true },
      surface: 'dashboard', reward: 'option',
      payload: { message: 'You could get better prices selling directly on the market...' },
      sort: 30,
    },
    {
      key: 'inventory_filling',
      trigger: { any_storage_pct_gte: 70 },
      surface: 'business_detail', reward: 'info',
      payload: { message: 'Storage is filling up. Sell or upgrade before production stops.' },
      sort: 35,
    },
    {
      key: 'second_business',
      trigger: { business_count_eq: 1, cash_gte: 15000 },
      surface: 'dashboard', reward: 'info',
      payload: { message: 'With this capital, expanding to a second business could multiply your income.' },
      sort: 40,
    },
    {
      key: 'production_chain',
      trigger: { has_mine: true, has_no_factory: true, cash_gte: 15000 },
      surface: 'dashboard', reward: 'info',
      payload: { message: 'Raw materials sell cheap. Processing them into steel or flour would multiply their value.' },
      sort: 50,
    },
    {
      key: 'training_hint',
      trigger: { employee_count_gte: 3, has_never_trained: true },
      surface: 'employees', reward: 'option',
      payload: { message: 'Some workers show potential. Training could unlock it.' },
      sort: 55,
    },
    {
      key: 'upgrade_hint',
      trigger: { any_business_at_max_employees: true },
      surface: 'business_detail', reward: 'info',
      payload: { message: 'This business is at capacity. Upgrading allows more workers and storage.' },
      sort: 60,
    },
    {
      key: 'shop_hint',
      trigger: { has_factory: true, has_no_shop: true, cash_gte: 8000 },
      surface: 'dashboard', reward: 'info',
      payload: { message: 'Finished goods pile up. A shop in a high-traffic area could move them faster.' },
      sort: 65,
    },
    {
      key: 'cost_warning',
      trigger: { daily_costs_exceed_income: true },
      surface: 'dashboard', reward: 'info',
      payload: { message: 'Your expenses are outpacing income. Review your accounting before it gets critical.' },
      sort: 70,
    },
    {
      key: 'transfer_hint',
      trigger: { business_count_gte: 2, any_converter_missing_input: true },
      surface: 'business_detail', reward: 'option',
      payload: { message: 'You can transfer materials between your businesses. Check inventory.' },
      sort: 75,
    },
  ];

  let discoveryCount = 0;
  for (const rule of DISCOVERY_RULES) {
    const res = await pool.query(
      `INSERT INTO discovery_rules (key, trigger_condition, ui_surface, reward_type, reward_payload, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO NOTHING
       RETURNING id`,
      [rule.key, JSON.stringify(rule.trigger), rule.surface, rule.reward, JSON.stringify(rule.payload), rule.sort],
    );
    if (res.rows.length > 0) discoveryCount++;
  }
  console.log(`[seed] Discovery rules: ${discoveryCount} inserted (${DISCOVERY_RULES.length} total)`);

  // ─── Summary ──────────────────────────────────────────────────────
  console.log('\n[seed] === Seed Summary ===');
  console.log(`  Season:     1 (active)`);
  console.log(`  Items:      ${Object.keys(itemIds).length}`);
  console.log(`  Recipes:    ${recipeCount}`);
  console.log(`  Locations:  ${SEED_LOCATIONS.length}`);
  console.log(`  Employees:  ${employeeCount}`);
  console.log(`  AI Listings: ${listingCount}`);
  console.log(`  Discovery:  ${discoveryCount}`);
  console.log('[seed] Done.\n');

  await pool.end();
}

seed().catch((err) => {
  console.error('[seed] Fatal error:', err);
  pool.end().finally(() => process.exit(1));
});
