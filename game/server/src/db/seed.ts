import 'dotenv/config';
import bcrypt from 'bcrypt';
import { query, withTransaction } from './client';
import type { PoolClient } from 'pg';
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
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── Config ───────────────────────────────────────────────────

const BETA_STARTING_CASH = 10_000;   // Extra cash for beta testers
const NPC_COUNT = 18;                // Fake players for leaderboard
const EMPLOYEE_POOL_SIZE = 120;      // Hireable employees
const PRICE_HISTORY_DAYS = 7;        // Days of historical price data

// ─── Name pools ───────────────────────────────────────────────

const FIRST_NAMES = [
  'Marcus','Elena','Diego','Priya','Luca','Amara','Victor','Nadia',
  'Tobias','Soren','Kira','Remi','Ivan','Zara','Felix','Leila',
  'Anton','Cleo','Dasha','Emil','Noah','Yuki','Dante','Mira',
  'Kaspar','Vera','Orion','Selene','Bjorn','Lyra',
];
const LAST_NAMES = [
  'Voss','Chen','Reyes','Patel','Romano','Okafor','Drakov','Sorenson',
  'Hasegawa','Moreau','Lindqvist','Nkosi','Vogel','Tran','Esposito',
  'Farouk','Gundersen','Harlow','Ibarra','Johansson','Mendez','Krause',
  'Nakamura','Ferrara','Osei','Petrov','Laurent','Kimura','Torres','Blanc',
];
const BUSINESS_ADJECTIVES = [
  'Iron','Golden','Silver','Shadow','Northern','Eastern','Pacific','Delta',
  'Capital','Prime','Apex','Summit','Horizon','Forge','Crown','Steel',
];
const BUSINESS_NOUNS = [
  'Works','Trading Co.','Ventures','Industries','Group','Holdings',
  'Logistics','Supply','Resources','Partners','Corp','Enterprises',
];

const usedNames = new Set<string>();
function randomPersonName(): string {
  for (let i = 0; i < 300; i++) {
    const n = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    if (!usedNames.has(n)) { usedNames.add(n); return n; }
  }
  const fb = `Worker ${usedNames.size + 1}`;
  usedNames.add(fb);
  return fb;
}

const usedBizNames = new Set<string>();
function randomBizName(): string {
  for (let i = 0; i < 300; i++) {
    const n = `${pick(BUSINESS_ADJECTIVES)} ${pick(BUSINESS_NOUNS)}`;
    if (!usedBizNames.has(n)) { usedBizNames.add(n); return n; }
  }
  return `Business ${usedBizNames.size + 1}`;
}

// ─── Types ────────────────────────────────────────────────────

type EmployeeRole = 'WORKER' | 'DRIVER' | 'ACCOUNTANT' | 'MANAGER' | 'SECURITY' | 'ENFORCER';
type BusinessType = 'RETAIL' | 'FACTORY' | 'MINE' | 'FARM' | 'LOGISTICS' | 'SECURITY_FIRM' | 'FRONT_COMPANY';
type Alignment = 'LEGAL' | 'MIXED' | 'CRIMINAL';

function salaryForRole(role: EmployeeRole, efficiency: number): number {
  const b = efficiency / 100;
  switch (role) {
    case 'WORKER':     return Math.round(80  + b * 70);
    case 'DRIVER':     return Math.round(110 + b * 90);
    case 'ACCOUNTANT': return Math.round(150 + b * 150);
    case 'MANAGER':    return Math.round(200 + b * 200);
    case 'SECURITY':   return Math.round(150 + b * 150);
    case 'ENFORCER':   return Math.round(200 + b * 250);
  }
}

const DAILY_OPERATING: Record<BusinessType, number> = {
  RETAIL: 200, FACTORY: 800, MINE: 600, FARM: 300,
  LOGISTICS: 500, SECURITY_FIRM: 400, FRONT_COMPANY: 700,
};

// ─── Resource definitions ─────────────────────────────────────

const SEED_RESOURCES = [
  { name: 'Coal',        category: 'RAW_MATERIAL',   tier: 1, base_value:   8.00, weight: 2.0, illegal: false },
  { name: 'Steel Ore',   category: 'RAW_MATERIAL',   tier: 1, base_value:  12.00, weight: 3.0, illegal: false },
  { name: 'Wheat',       category: 'RAW_MATERIAL',   tier: 1, base_value:   4.00, weight: 1.0, illegal: false },
  { name: 'Lumber',      category: 'RAW_MATERIAL',   tier: 1, base_value:   6.00, weight: 2.5, illegal: false },
  { name: 'Fuel',        category: 'RAW_MATERIAL',   tier: 2, base_value:  25.00, weight: 1.5, illegal: false },
  { name: 'Steel',       category: 'PROCESSED_GOOD', tier: 2, base_value:  45.00, weight: 4.0, illegal: false },
  { name: 'Electronics', category: 'PROCESSED_GOOD', tier: 3, base_value: 120.00, weight: 0.5, illegal: false },
  { name: 'Clothing',    category: 'PROCESSED_GOOD', tier: 2, base_value:  35.00, weight: 0.8, illegal: false },
  { name: 'Medicine',    category: 'LUXURY',          tier: 3, base_value: 200.00, weight: 0.3, illegal: false },
  { name: 'Contraband',  category: 'ILLEGAL',         tier: 3, base_value: 300.00, weight: 1.0, illegal: true  },
];

// ─── NPC player profiles ──────────────────────────────────────

interface NpcProfile {
  username: string;
  netWorth: number;
  alignment: Alignment;
  bizTypes: BusinessType[];
  city: string;
}

const NPC_PROFILES: NpcProfile[] = [
  // Top tier — established players
  { username: 'IronTycoon',     netWorth: 480_000, alignment: 'LEGAL',    bizTypes: ['MINE','FACTORY'],       city: 'Ironport'  },
  { username: 'ShadowKing',     netWorth: 390_000, alignment: 'CRIMINAL', bizTypes: ['FRONT_COMPANY','RETAIL'],city: 'Duskfield' },
  { username: 'GoldenMerchant', netWorth: 310_000, alignment: 'MIXED',    bizTypes: ['RETAIL','LOGISTICS'],    city: 'Ironport'  },
  { username: 'NorthernBoss',   netWorth: 250_000, alignment: 'CRIMINAL', bizTypes: ['FRONT_COMPANY'],         city: 'Ashvale'   },
  { username: 'TradeKing',      netWorth: 210_000, alignment: 'LEGAL',    bizTypes: ['LOGISTICS','FARM'],      city: 'Ironport'  },
  // Mid tier
  { username: 'ColdMarshCo',    netWorth: 145_000, alignment: 'LEGAL',    bizTypes: ['FARM'],                  city: 'Coldmarsh' },
  { username: 'FarrowMines',    netWorth: 120_000, alignment: 'LEGAL',    bizTypes: ['MINE'],                  city: 'Farrow'    },
  { username: 'DuskDealer',     netWorth:  95_000, alignment: 'MIXED',    bizTypes: ['RETAIL'],                city: 'Duskfield' },
  { username: 'AshvaleFab',     netWorth:  80_000, alignment: 'LEGAL',    bizTypes: ['FACTORY'],               city: 'Ashvale'   },
  { username: 'VaultRunner',    netWorth:  72_000, alignment: 'CRIMINAL', bizTypes: ['FRONT_COMPANY'],         city: 'Ironport'  },
  // Lower mid
  { username: 'GrainTrader',    netWorth:  55_000, alignment: 'LEGAL',    bizTypes: ['FARM'],                  city: 'Coldmarsh' },
  { username: 'QuickShip',      netWorth:  48_000, alignment: 'LEGAL',    bizTypes: ['LOGISTICS'],             city: 'Farrow'    },
  { username: 'SmokeCo',        netWorth:  40_000, alignment: 'MIXED',    bizTypes: ['RETAIL'],                city: 'Ashvale'   },
  // Fresh starters (just above player start)
  { username: 'NewBlood99',     netWorth:  18_000, alignment: 'LEGAL',    bizTypes: ['RETAIL'],                city: 'Duskfield' },
  { username: 'StreetRunner',   netWorth:  16_000, alignment: 'MIXED',    bizTypes: ['RETAIL'],                city: 'Farrow'    },
  { username: 'JustStarted',    netWorth:  12_500, alignment: 'LEGAL',    bizTypes: [],                        city: 'Ironport'  },
  { username: 'LuckyBreak',     netWorth:  11_000, alignment: 'LEGAL',    bizTypes: [],                        city: 'Coldmarsh' },
  { username: 'EarlyBird',      netWorth:  10_800, alignment: 'LEGAL',    bizTypes: [],                        city: 'Ashvale'   },
];

// ─── Seed helpers ─────────────────────────────────────────────

async function seedEmployee(
  client: PoolClient,
  seasonId: string,
  businessId: string | null,
  role?: EmployeeRole,
): Promise<string> {
  const roles: EmployeeRole[] = ['WORKER','DRIVER','ACCOUNTANT','MANAGER','SECURITY','ENFORCER'];
  const weights = [60, 15, 10, 8, 5, 2];
  const r = role ?? pickWeighted(roles, weights);
  const eff = randInt(30, 90);
  const isCriminal = r === 'ENFORCER' ? true : r === 'DRIVER' ? Math.random() < 0.5 : false;
  const corr = r === 'ENFORCER'
    ? parseFloat(rand(0.4, 0.8).toFixed(4))
    : parseFloat(rand(0.05, 0.6).toFixed(4));

  const res = await client.query<{ id: string }>(
    `INSERT INTO employees
       (season_id, name, role, efficiency, speed, loyalty, reliability,
        corruption_risk, criminal_capable, salary, experience_points,
        morale, bribe_resistance, business_id, hired_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      seasonId,
      randomPersonName(),
      r,
      parseFloat((eff / 100).toFixed(4)),
      parseFloat((randInt(30, 90) / 100).toFixed(4)),
      parseFloat((randInt(20, 85) / 100).toFixed(4)),
      parseFloat((randInt(40, 95) / 100).toFixed(4)),
      corr,
      isCriminal,
      salaryForRole(r, eff),
      businessId ? randInt(0, 500) : 0,
      parseFloat(rand(0.6, 1.0).toFixed(4)),
      parseFloat(rand(0.2, 0.9).toFixed(4)),
      businessId,
      businessId ? new Date(Date.now() - randInt(1, 90) * 86_400_000).toISOString() : null,
    ],
  );
  return res.rows[0].id;
}

async function seedBusiness(
  client: PoolClient,
  ownerId: string,
  seasonId: string,
  type: BusinessType,
  city: string,
  resourceIds: Record<string, string>,
): Promise<string> {
  const tier = 1;
  const capacity = 100;
  const storageCap = 500;

  // Give business some inventory
  const inventoryEntries: Array<[string, number]> = [];
  for (const res of SEED_RESOURCES.slice(0, 6)) {
    if (Math.random() < 0.4) {
      inventoryEntries.push([res.name, randInt(10, 150)]);
    }
  }
  const inventory = Object.fromEntries(inventoryEntries);

  const totalRevenue = parseFloat(rand(1000, 50000).toFixed(2));
  const totalExpenses = parseFloat(rand(500, totalRevenue * 0.8).toFixed(2));

  const bizRes = await client.query<{ id: string }>(
    `INSERT INTO businesses
       (owner_id, season_id, name, type, tier, city, status, capacity, efficiency,
        inventory, storage_cap, daily_operating_cost, total_revenue, total_expenses,
        is_front, front_capacity, suspicion_level)
     VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
    [
      ownerId,
      seasonId,
      randomBizName(),
      type,
      tier,
      city,
      capacity,
      parseFloat(rand(0.6, 1.0).toFixed(4)),
      JSON.stringify(inventory),
      storageCap,
      DAILY_OPERATING[type],
      totalRevenue,
      totalExpenses,
      type === 'FRONT_COMPANY',
      type === 'FRONT_COMPANY' ? parseFloat(rand(5000, 50000).toFixed(2)) : 0,
      type === 'FRONT_COMPANY' ? randInt(0, 300) : 0,
    ],
  );
  const bizId = bizRes.rows[0].id;

  // Hire 3-6 employees for this business
  const empCount = randInt(3, 6);
  for (let i = 0; i < empCount; i++) {
    const needsCriminal = type === 'FRONT_COMPANY' && i < 2;
    await seedEmployee(client, seasonId, bizId, needsCriminal ? (Math.random() < 0.5 ? 'ENFORCER' : 'DRIVER') : undefined);
  }

  // Seed player market listings from this business (some inventory for sale)
  for (const [resName, qty] of inventoryEntries) {
    if (qty > 20 && Math.random() < 0.6) {
      const resId = resourceIds[resName];
      if (!resId) continue;
      const resDef = SEED_RESOURCES.find(r => r.name === resName)!;
      const listQty = randInt(10, Math.floor(qty * 0.7));
      const priceVariance = rand(0.90, 1.15);
      const price = parseFloat((resDef.base_value * AI_MARKUP * priceVariance).toFixed(2));

      await client.query(
        `INSERT INTO market_listings
           (season_id, listing_type, seller_id, business_id, resource_id,
            city, quantity, quantity_remaining, price_per_unit, min_quantity,
            expires_at, is_anonymous, status)
         VALUES ($1,'PLAYER_SELL',$2,$3,$4,$5,$6,$6,$7,1,
                 NOW() + INTERVAL '48 hours',$8,'OPEN')`,
        [seasonId, ownerId, bizId, resId, city, listQty, price, Math.random() < 0.3],
      );
    }
  }

  return bizId;
}

// ─── Main seed ────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║      EmpireOS — Database Seed        ║');
  console.log('╚══════════════════════════════════════╝\n');

  await withTransaction(async (client) => {

    // ── 1. Season ─────────────────────────────────────────────
    console.log('[1/6] Creating Season 1: Iron Dawn...');
    const now = new Date();
    const endsAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    const taxBrackets = JSON.stringify([
      { min_nw: 0,       max_nw: 50000,     rate: 0.00 },
      { min_nw: 50000,   max_nw: 150000,    rate: 0.05 },
      { min_nw: 150000,  max_nw: 500000,    rate: 0.10 },
      { min_nw: 500000,  max_nw: 1500000,   rate: 0.18 },
      { min_nw: 1500000, max_nw: 5000000,   rate: 0.25 },
      { min_nw: 5000000, max_nw: 999999999, rate: 0.35 },
    ]);

    const seasonRes = await client.query<{ id: string }>(
      `INSERT INTO season_profiles
         (season_number, name, started_at, ends_at, status, starting_cash,
          tax_rate_brackets, crime_multiplier, resource_set, special_rule, total_players, top_players)
       VALUES ($1,$2,$3,$4,'ACTIVE',$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (season_number) DO UPDATE
         SET status='ACTIVE', started_at=$3, ends_at=$4, starting_cash=$5
       RETURNING id`,
      [
        1, 'Season 1: Iron Dawn',
        now.toISOString(), endsAt.toISOString(),
        BETA_STARTING_CASH,
        taxBrackets, 1.0,
        SEED_RESOURCES.map(r => r.name),
        'Beta Season — All bugs are features', 0, '[]',
      ],
    );
    const seasonId = seasonRes.rows[0].id;
    console.log(`    ✓ Season ID: ${seasonId}`);

    // ── 2. Resources ──────────────────────────────────────────
    console.log('[2/6] Seeding resources + price history...');
    const resourceIds: Record<string, string> = {};

    for (const res of SEED_RESOURCES) {
      const supply = res.base_value < 20 ? 80000 : res.base_value < 100 ? 30000 : 10000;
      const demand = supply * rand(0.9, 1.2);
      const aiPrice = parseFloat((res.base_value * AI_MARKUP).toFixed(2));

      const rRes = await client.query<{ id: string }>(
        `INSERT INTO resources
           (name, category, tier, base_value, weight, perishable, perish_hours,
            illegal, season_id, global_supply, global_demand, current_ai_price)
         VALUES ($1,$2,$3,$4,$5,false,null,$6,$7,$8,$9,$10)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [res.name, res.category, res.tier, res.base_value, res.weight,
         res.illegal, seasonId, supply, demand, aiPrice],
      );
      if (rRes.rows.length > 0) {
        resourceIds[res.name] = rRes.rows[0].id;
      }
    }

    // Fill any that already existed
    const existing = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM resources WHERE season_id = $1`, [seasonId],
    );
    for (const r of existing.rows) resourceIds[r.name] = r.id;

    // Seed 7 days of price history (simulated market movement)
    for (const res of SEED_RESOURCES) {
      const resId = resourceIds[res.name];
      if (!resId) continue;
      let price = res.base_value * AI_MARKUP;
      for (let day = PRICE_HISTORY_DAYS; day >= 0; day--) {
        // 8 ticks per day (every 3 hours)
        for (let tick = 0; tick < 8; tick++) {
          const drift = rand(-0.03, 0.03);   // ±3% per tick
          price = Math.max(res.base_value * 0.5, Math.min(res.base_value * 3.0, price * (1 + drift)));
          const hoursAgo = day * 24 + (8 - tick) * 3;
          await client.query(
            `INSERT INTO price_history (resource_id, season_id, price, recorded_at)
             VALUES ($1,$2,$3, NOW() - INTERVAL '${hoursAgo} hours')`,
            [resId, seasonId, parseFloat(price.toFixed(2))],
          );
        }
      }
    }
    console.log(`    ✓ ${SEED_RESOURCES.length} resources + ${SEED_RESOURCES.length * 8 * PRICE_HISTORY_DAYS} price history records`);

    // ── 3. AI market listings ─────────────────────────────────
    console.log('[3/6] Seeding AI market listings (5 cities × 10 resources)...');
    for (const city of CITIES) {
      for (const [resName, resId] of Object.entries(resourceIds)) {
        const resDef = SEED_RESOURCES.find(r => r.name === resName);
        if (!resDef) continue;
        const tier = resDef.tier as 1 | 2 | 3 | 4;
        const cap = AI_QUANTITY_CAPS[city.size as CitySize]?.[tier] ?? 500;
        const aiPrice    = parseFloat((resDef.base_value * AI_MARKUP).toFixed(2));
        const aiBuyPrice = parseFloat((resDef.base_value * AI_BUY_DISCOUNT).toFixed(2));

        await client.query(
          `INSERT INTO market_listings
             (season_id, listing_type, seller_id, business_id, resource_id,
              city, quantity, quantity_remaining, price_per_unit, min_quantity,
              expires_at, is_anonymous, status)
           VALUES ($1,'AI_SELL',NULL,NULL,$2,$3,$4,$4,$5,1,NOW()+INTERVAL '2 hours',false,'OPEN')`,
          [seasonId, resId, city.name, cap, aiPrice],
        );
        await client.query(
          `INSERT INTO market_listings
             (season_id, listing_type, seller_id, business_id, resource_id,
              city, quantity, quantity_remaining, price_per_unit, min_quantity,
              is_anonymous, status)
           VALUES ($1,'AI_BUY',NULL,NULL,$2,$3,$4,$4,$5,1,false,'OPEN')`,
          [seasonId, resId, city.name, cap, aiBuyPrice],
        );
      }
    }
    console.log(`    ✓ ${CITIES.length * SEED_RESOURCES.length * 2} AI listings created`);

    // ── 4. NPC players ────────────────────────────────────────
    console.log(`[4/6] Creating ${NPC_COUNT} NPC players with businesses...`);
    const npcPassword = await bcrypt.hash('npc-internal-account-not-for-login', 10);

    for (const npc of NPC_PROFILES) {
      // Create player
      const pRes = await client.query<{ id: string }>(
        `INSERT INTO players
           (username, email, password_hash, season_id, cash, net_worth,
            business_slots, reputation_score, alignment, meta_points)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (username) DO NOTHING
         RETURNING id`,
        [
          npc.username,
          `${npc.username.toLowerCase()}@npc.internal`,
          npcPassword,
          seasonId,
          parseFloat((npc.netWorth * rand(0.1, 0.3)).toFixed(2)),  // Cash is 10-30% of networth
          npc.netWorth,
          3 + Math.floor(npc.netWorth / 100_000),  // More business slots for richer NPCs
          randInt(0, Math.min(1000, Math.floor(npc.netWorth / 500))),
          npc.alignment,
          randInt(0, 50),
        ],
      );

      if (pRes.rows.length === 0) {
        console.log(`    ⚠ NPC ${npc.username} already exists, skipping`);
        continue;
      }
      const npcId = pRes.rows[0].id;

      // Create heat score
      const heat = npc.alignment === 'CRIMINAL'
        ? randInt(50, 400)
        : npc.alignment === 'MIXED'
        ? randInt(0, 150)
        : 0;
      const heatLevel =
        heat >= 600 ? 'BURNING' : heat >= 300 ? 'HOT' : heat >= 100 ? 'WARM' : 'COLD';

      await client.query(
        `INSERT INTO heat_scores (player_id, season_id, score, level, last_criminal_act, decay_rate)
         VALUES ($1,$2,$3,$4,$5,2.0)
         ON CONFLICT (player_id, season_id) DO NOTHING`,
        [
          npcId, seasonId, heat, heatLevel,
          npc.alignment !== 'LEGAL' ? new Date(Date.now() - randInt(1, 72) * 3_600_000).toISOString() : null,
        ],
      );

      // Create dirty money balance for criminals
      if (npc.alignment !== 'LEGAL') {
        const dirty = parseFloat(rand(1000, npc.netWorth * 0.2).toFixed(2));
        await client.query(
          `INSERT INTO dirty_money_balances (player_id, season_id, total_dirty, total_earned, total_laundered)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (player_id, season_id) DO NOTHING`,
          [npcId, seasonId, dirty, dirty * rand(1.2, 2.0), dirty * rand(0.1, 0.5)],
        );
      }

      // Create businesses
      for (const bizType of npc.bizTypes) {
        await seedBusiness(client, npcId, seasonId, bizType, npc.city, resourceIds);
      }

      process.stdout.write(`    ✓ ${npc.username} (${npc.alignment}, $${npc.netWorth.toLocaleString()})\n`);
    }

    // ── 5. Employee pool ──────────────────────────────────────
    console.log(`[5/6] Creating ${EMPLOYEE_POOL_SIZE} hireable employees...`);
    const roleOptions: EmployeeRole[] = ['WORKER','DRIVER','ACCOUNTANT','MANAGER','SECURITY','ENFORCER'];
    const roleWeights = [55, 15, 12, 8, 7, 3];
    for (let i = 0; i < EMPLOYEE_POOL_SIZE; i++) {
      await seedEmployee(client, seasonId, null, pickWeighted(roleOptions, roleWeights));
    }
    console.log(`    ✓ ${EMPLOYEE_POOL_SIZE} employees ready to hire`);

    // ── 6. Update season player count & leaderboard ───────────
    console.log('[6/6] Updating season leaderboard...');
    const topPlayers = await client.query<{ id: string; username: string; net_worth: string }>(
      `SELECT id, username, net_worth FROM players
       WHERE season_id = $1 ORDER BY net_worth DESC LIMIT 10`,
      [seasonId],
    );
    const topJson = JSON.stringify(
      topPlayers.rows.map((p, i) => ({
        rank: i + 1,
        player_id: p.id,
        username: p.username,
        net_worth: parseFloat(p.net_worth),
      })),
    );
    await client.query(
      `UPDATE season_profiles
       SET total_players = (SELECT COUNT(*) FROM players WHERE season_id = $1),
           top_players = $2
       WHERE id = $1`,
      [seasonId, topJson],
    );
    console.log('    ✓ Leaderboard updated');

    // ── Summary ───────────────────────────────────────────────
    const counts = await client.query<{ players: string; businesses: string; employees: string; listings: string }>(
      `SELECT
         (SELECT COUNT(*) FROM players         WHERE season_id = $1)::text AS players,
         (SELECT COUNT(*) FROM businesses      WHERE season_id = $1)::text AS businesses,
         (SELECT COUNT(*) FROM employees       WHERE season_id = $1)::text AS employees,
         (SELECT COUNT(*) FROM market_listings WHERE season_id = $1)::text AS listings`,
      [seasonId],
    );
    const c = counts.rows[0];

    console.log('\n╔══════════════════════════════════════╗');
    console.log('║           Seed Complete!             ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Players      : ${String(c.players).padEnd(20)} ║`);
    console.log(`║  Businesses   : ${String(c.businesses).padEnd(20)} ║`);
    console.log(`║  Employees    : ${String(c.employees).padEnd(20)} ║`);
    console.log(`║  Market Listings: ${String(c.listings).padEnd(18)} ║`);
    console.log(`║  Starting Cash: $${String(BETA_STARTING_CASH.toLocaleString()).padEnd(19)} ║`);
    console.log('╚══════════════════════════════════════╝\n');
  });

  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
