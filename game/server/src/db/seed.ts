import 'dotenv/config';
import { query, withTransaction } from './client';
import { CITIES } from '../../../shared/src/types/entities';
import type { CitySize } from '../../../shared/src/types/entities';
import { AI_MARKUP, AI_BUY_DISCOUNT, AI_QUANTITY_CAPS } from '../lib/constants';

// ─── Helpers ──────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

const FIRST_NAMES = [
  'Marcus', 'Elena', 'Diego', 'Priya', 'Luca', 'Amara', 'Victor', 'Nadia',
  'Tobias', 'Soren', 'Kira', 'Remi', 'Ivan', 'Zara', 'Felix', 'Leila',
  'Anton', 'Cleo', 'Dasha', 'Emil',
];

const LAST_NAMES = [
  'Voss', 'Chen', 'Reyes', 'Patel', 'Romano', 'Okafor', 'Drakov', 'Sorenson',
  'Hasegawa', 'Moreau', 'Lindqvist', 'Nkosi', 'Vogel', 'Tran', 'Esposito',
  'Farouk', 'Gundersen', 'Harlow', 'Ibarra', 'Johansson',
];

const usedNames = new Set<string>();

function randomName(): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const name = `${FIRST_NAMES[randInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randInt(0, LAST_NAMES.length - 1)]}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  const fallback = `Employee ${usedNames.size + 1}`;
  usedNames.add(fallback);
  return fallback;
}

type EmployeeRole = 'WORKER' | 'DRIVER' | 'ACCOUNTANT' | 'MANAGER' | 'SECURITY' | 'ENFORCER';

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function salaryForRole(role: EmployeeRole, efficiency: number): number {
  const bonus = efficiency / 100;
  switch (role) {
    case 'WORKER':     return Math.round(80  + bonus * 70);   // 80–150
    case 'DRIVER':     return Math.round(110 + bonus * 90);   // 110–200
    case 'ACCOUNTANT': return Math.round(150 + bonus * 150);  // 150–300
    case 'MANAGER':    return Math.round(200 + bonus * 200);  // 200–400
    case 'SECURITY':   return Math.round(150 + bonus * 150);  // 150–300
    case 'ENFORCER':   return Math.round(200 + bonus * 250);  // 200–450
  }
}

// ─── Resource definitions (spec-exact) ───────────────────────

const SEED_RESOURCES = [
  { name: 'Coal',        category: 'RAW_MATERIAL',   tier: 1, base_value:   8.00, weight: 2.0, perishable: false, perish_hours: null, illegal: false },
  { name: 'Steel Ore',   category: 'RAW_MATERIAL',   tier: 1, base_value:  12.00, weight: 3.0, perishable: false, perish_hours: null, illegal: false },
  { name: 'Wheat',       category: 'RAW_MATERIAL',   tier: 1, base_value:   4.00, weight: 1.0, perishable: false, perish_hours: null, illegal: false },
  { name: 'Lumber',      category: 'RAW_MATERIAL',   tier: 1, base_value:   6.00, weight: 2.5, perishable: false, perish_hours: null, illegal: false },
  { name: 'Fuel',        category: 'RAW_MATERIAL',   tier: 2, base_value:  25.00, weight: 1.5, perishable: false, perish_hours: null, illegal: false },
  { name: 'Steel',       category: 'PROCESSED_GOOD', tier: 2, base_value:  45.00, weight: 4.0, perishable: false, perish_hours: null, illegal: false },
  { name: 'Electronics', category: 'PROCESSED_GOOD', tier: 3, base_value: 120.00, weight: 0.5, perishable: false, perish_hours: null, illegal: false },
  { name: 'Clothing',    category: 'PROCESSED_GOOD', tier: 2, base_value:  35.00, weight: 0.8, perishable: false, perish_hours: null, illegal: false },
  { name: 'Medicine',    category: 'LUXURY',          tier: 3, base_value: 200.00, weight: 0.3, perishable: false, perish_hours: null, illegal: false },
  { name: 'Contraband',  category: 'ILLEGAL',         tier: 3, base_value: 300.00, weight: 1.0, perishable: false, perish_hours: null, illegal: true  },
];

// ─── Main seed ────────────────────────────────────────────────

async function main() {
  console.log('[seed] Starting database seed...');

  await withTransaction(async (client) => {
    // 1. Create or update active season profile
    const now = new Date();
    const endsAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 months

    const taxBrackets = JSON.stringify([
      { min_nw: 0,        max_nw: 50000,      rate: 0.00 },
      { min_nw: 50000,    max_nw: 150000,     rate: 0.05 },
      { min_nw: 150000,   max_nw: 500000,     rate: 0.10 },
      { min_nw: 500000,   max_nw: 1500000,    rate: 0.18 },
      { min_nw: 1500000,  max_nw: 5000000,    rate: 0.25 },
      { min_nw: 5000000,  max_nw: 999999999,  rate: 0.35 },
    ]);

    const seasonRes = await client.query<{ id: string }>(
      `INSERT INTO season_profiles
         (season_number, name, started_at, ends_at, status, starting_cash,
          tax_rate_brackets, crime_multiplier, resource_set, special_rule,
          total_players, top_players)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (season_number) DO UPDATE
         SET status = 'ACTIVE', started_at = $3, ends_at = $4
       RETURNING id`,
      [
        1,
        'Season 1: Iron Dawn',
        now.toISOString(),
        endsAt.toISOString(),
        'ACTIVE',
        5000,
        taxBrackets,
        1.0,
        JSON.stringify(SEED_RESOURCES.map((r) => r.name)),
        null,
        0,
        '[]',
      ],
    );
    const seasonId = seasonRes.rows[0].id;
    console.log(`[seed] Season created/updated: ${seasonId}`);

    // 2. Seed resources — current_ai_price = base_value * 1.25 initially
    console.log('[seed] Seeding resources...');
    const resourceIds: Record<string, string> = {};

    for (const res of SEED_RESOURCES) {
      const supply = res.base_value < 20 ? 80000 : res.base_value < 100 ? 30000 : 10000;
      const demand = supply * rand(0.9, 1.2);
      const aiPrice = parseFloat((res.base_value * AI_MARKUP).toFixed(2));

      const rRes = await client.query<{ id: string }>(
        `INSERT INTO resources
           (name, category, tier, base_value, weight, perishable, perish_hours,
            illegal, season_id, global_supply, global_demand, current_ai_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          res.name, res.category, res.tier, res.base_value, res.weight,
          res.perishable, res.perish_hours, res.illegal,
          seasonId, supply, demand, aiPrice,
        ],
      );
      if (rRes.rows.length > 0) {
        resourceIds[res.name] = rRes.rows[0].id;
        console.log(`[seed]   Resource: ${res.name} (${rRes.rows[0].id})`);
      }
    }

    // Fetch IDs for any that already existed
    const existingResources = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM resources WHERE season_id = $1`,
      [seasonId],
    );
    for (const r of existingResources.rows) {
      resourceIds[r.name] = r.id;
    }

    // 3. Seed 100 employees with role-weighted distribution
    //    Weights: 60% WORKER, 15% DRIVER, 10% ACCOUNTANT, 8% MANAGER, 5% SECURITY, 2% ENFORCER
    console.log('[seed] Seeding 100 employees...');
    const roleOptions: EmployeeRole[] = ['WORKER', 'DRIVER', 'ACCOUNTANT', 'MANAGER', 'SECURITY', 'ENFORCER'];
    const roleWeights = [60, 15, 10, 8, 5, 2];

    for (let i = 0; i < 100; i++) {
      const role = pickWeighted(roleOptions, roleWeights);
      const efficiency    = randInt(30, 90);
      const speed         = randInt(30, 90);
      const loyalty       = randInt(20, 85);
      const reliability   = randInt(40, 95);
      const corruptionRisk = role === 'ENFORCER'
        ? parseFloat(rand(0.40, 0.80).toFixed(4))
        : parseFloat(rand(0.05, 0.60).toFixed(4));
      const criminalCapable =
        role === 'ENFORCER' ? true :
        role === 'DRIVER'   ? Math.random() < 0.5 :
        false;
      const salary = salaryForRole(role, efficiency);

      await client.query(
        `INSERT INTO employees
           (season_id, name, role, efficiency, speed, loyalty, reliability,
            corruption_risk, criminal_capable, salary, experience_points,
            morale, bribe_resistance, business_id, hired_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL,NULL)`,
        [
          seasonId,
          randomName(),
          role,
          parseFloat((efficiency / 100).toFixed(4)),
          parseFloat((speed / 100).toFixed(4)),
          parseFloat((loyalty / 100).toFixed(4)),
          parseFloat((reliability / 100).toFixed(4)),
          corruptionRisk,
          criminalCapable,
          salary,
          0,
          parseFloat(rand(0.6, 1.0).toFixed(4)),
          parseFloat(rand(0.2, 0.9).toFixed(4)),
        ],
      );
    }
    console.log('[seed] 100 employees seeded.');

    // 4. Seed AI market listings: 5 cities × 10 resources
    //    AI_SELL with qty=cap, price=current_ai_price, expires_at=NOW()+2h
    console.log('[seed] Seeding AI market listings...');
    for (const city of CITIES) {
      for (const [resName, resId] of Object.entries(resourceIds)) {
        const resDef = SEED_RESOURCES.find((r) => r.name === resName);
        if (!resDef) continue;

        const tier = resDef.tier as 1 | 2 | 3 | 4;
        const cap = AI_QUANTITY_CAPS[city.size as CitySize]?.[tier] ?? 500;
        const aiPrice  = parseFloat((resDef.base_value * AI_MARKUP).toFixed(2));
        const aiBuyPrice = parseFloat((resDef.base_value * AI_BUY_DISCOUNT).toFixed(2));

        // AI sell listing
        await client.query(
          `INSERT INTO market_listings
             (season_id, listing_type, seller_id, business_id, resource_id,
              city, quantity, quantity_remaining, price_per_unit, min_quantity,
              expires_at, is_anonymous, status)
           VALUES ($1,'AI_SELL',NULL,NULL,$2,$3,$4,$4,$5,1,
                   NOW() + INTERVAL '2 hours',false,'OPEN')`,
          [seasonId, resId, city.name, cap, aiPrice],
        );

        // AI buy listing
        await client.query(
          `INSERT INTO market_listings
             (season_id, listing_type, seller_id, business_id, resource_id,
              city, quantity, quantity_remaining, price_per_unit, min_quantity,
              is_anonymous, status)
           VALUES ($1,'AI_BUY',NULL,NULL,$2,$3,$4,$4,$5,1,false,'OPEN')`,
          [seasonId, resId, city.name, cap, aiBuyPrice],
        );
      }
      console.log(`[seed]   Listings seeded for ${city.name}`);
    }
  });

  console.log('[seed] Seed complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
