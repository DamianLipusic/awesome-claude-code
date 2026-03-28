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

const STARTING_CASH = 100_000;
const NPC_COUNT = 18;
const EMPLOYEE_POOL_SIZE = 150;
const PRICE_HISTORY_DAYS = 7;

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
    case 'WORKER':     return Math.round(150  + b * 150);
    case 'DRIVER':     return Math.round(200  + b * 200);
    case 'ACCOUNTANT': return Math.round(300  + b * 300);
    case 'MANAGER':    return Math.round(500  + b * 700);
    case 'SECURITY':   return Math.round(250  + b * 250);
    case 'ENFORCER':   return Math.round(400  + b * 500);
  }
}

const DAILY_OPERATING: Record<BusinessType, number> = {
  RETAIL: 800, FACTORY: 3000, MINE: 2000, FARM: 1200,
  LOGISTICS: 1800, SECURITY_FIRM: 1500, FRONT_COMPANY: 2500,
};

// ─── Resource definitions ─────────────────────────────────────

const CITY_PRICE_MODS = {"Ironport": 1.0, "Duskfield": 0.95, "Ashvale": 0.85, "Coldmarsh": 0.80, "Farrow": 0.70};

const SEED_RESOURCES = [
  { name: 'Coal',        category: 'RAW_MATERIAL',   tier: 1, base_value:  15.00, weight: 2.0, illegal: false },
  { name: 'Steel Ore',   category: 'RAW_MATERIAL',   tier: 1, base_value:  25.00, weight: 3.0, illegal: false },
  { name: 'Wheat',       category: 'RAW_MATERIAL',   tier: 1, base_value:   8.00, weight: 1.0, illegal: false },
  { name: 'Lumber',      category: 'RAW_MATERIAL',   tier: 1, base_value:  18.00, weight: 2.5, illegal: false },
  { name: 'Metals',      category: 'RAW_MATERIAL',   tier: 1, base_value:  20.00, weight: 3.5, illegal: false },
  { name: 'Fuel',        category: 'RAW_MATERIAL',   tier: 2, base_value:  45.00, weight: 1.5, illegal: false },
  { name: 'Steel',       category: 'PROCESSED_GOOD', tier: 2, base_value:  85.00, weight: 4.0, illegal: false },
  { name: 'Electronics', category: 'PROCESSED_GOOD', tier: 3, base_value: 250.00, weight: 0.5, illegal: false },
  { name: 'Clothing',    category: 'PROCESSED_GOOD', tier: 2, base_value:  60.00, weight: 0.8, illegal: false },
  { name: 'Medicine',    category: 'LUXURY',          tier: 3, base_value: 350.00, weight: 0.3, illegal: false },
  { name: 'Contraband',  category: 'ILLEGAL',         tier: 3, base_value: 500.00, weight: 1.0, illegal: true  },
];

// ─── District definitions ─────────────────────────────────────

const SEED_DISTRICTS = [
  // Ironport (capital) - 4 districts
  { city: 'Ironport', name: 'Harbor District',     tier: 3, foot_traffic: 0.85, location_quality: 0.80, rent_multiplier: 1.80, revenue_multiplier: 1.50, max_businesses: 15 },
  { city: 'Ironport', name: 'Industrial Quarter',  tier: 2, foot_traffic: 0.50, location_quality: 0.60, rent_multiplier: 1.00, revenue_multiplier: 1.00, max_businesses: 20 },
  { city: 'Ironport', name: 'Market Square',       tier: 4, foot_traffic: 0.95, location_quality: 0.95, rent_multiplier: 3.00, revenue_multiplier: 2.50, max_businesses: 8 },
  { city: 'Ironport', name: 'Dockside Slums',      tier: 1, foot_traffic: 0.35, location_quality: 0.25, rent_multiplier: 0.60, revenue_multiplier: 0.70, max_businesses: 12 },
  // Duskfield - 4 districts
  { city: 'Duskfield', name: 'Smokestack Row',     tier: 2, foot_traffic: 0.45, location_quality: 0.55, rent_multiplier: 0.90, revenue_multiplier: 1.00, max_businesses: 18 },
  { city: 'Duskfield', name: 'Merchant Lane',      tier: 3, foot_traffic: 0.75, location_quality: 0.70, rent_multiplier: 1.50, revenue_multiplier: 1.40, max_businesses: 12 },
  { city: 'Duskfield', name: 'The Warrens',        tier: 1, foot_traffic: 0.30, location_quality: 0.20, rent_multiplier: 0.50, revenue_multiplier: 0.65, max_businesses: 15 },
  { city: 'Duskfield', name: 'Foundry Block',      tier: 2, foot_traffic: 0.55, location_quality: 0.65, rent_multiplier: 1.10, revenue_multiplier: 1.10, max_businesses: 14 },
  // Ashvale - 3 districts
  { city: 'Ashvale', name: 'Tourist Strip',        tier: 3, foot_traffic: 0.90, location_quality: 0.85, rent_multiplier: 2.00, revenue_multiplier: 1.60, max_businesses: 10 },
  { city: 'Ashvale', name: 'Old Town',             tier: 2, foot_traffic: 0.60, location_quality: 0.50, rent_multiplier: 0.95, revenue_multiplier: 0.95, max_businesses: 16 },
  { city: 'Ashvale', name: 'Ashvale Commons',      tier: 1, foot_traffic: 0.40, location_quality: 0.35, rent_multiplier: 0.70, revenue_multiplier: 0.75, max_businesses: 12 },
  // Coldmarsh - 3 districts
  { city: 'Coldmarsh', name: 'Frozen Quay',        tier: 2, foot_traffic: 0.50, location_quality: 0.45, rent_multiplier: 0.85, revenue_multiplier: 0.90, max_businesses: 14 },
  { city: 'Coldmarsh', name: 'Marshtown',          tier: 1, foot_traffic: 0.25, location_quality: 0.20, rent_multiplier: 0.45, revenue_multiplier: 0.60, max_businesses: 18 },
  { city: 'Coldmarsh', name: 'North Gate',         tier: 2, foot_traffic: 0.55, location_quality: 0.50, rent_multiplier: 0.90, revenue_multiplier: 0.95, max_businesses: 12 },
  // Farrow - 3 districts
  { city: 'Farrow', name: 'Farrow Heights',        tier: 2, foot_traffic: 0.60, location_quality: 0.55, rent_multiplier: 1.00, revenue_multiplier: 1.00, max_businesses: 10 },
  { city: 'Farrow', name: 'Mining Flats',          tier: 1, foot_traffic: 0.20, location_quality: 0.15, rent_multiplier: 0.40, revenue_multiplier: 0.55, max_businesses: 20 },
  { city: 'Farrow', name: 'Rail Junction',         tier: 2, foot_traffic: 0.50, location_quality: 0.45, rent_multiplier: 0.80, revenue_multiplier: 0.85, max_businesses: 14 },
];

// ─── Business listing templates ───────────────────────────────

const LISTING_TEMPLATES: Array<{ type: BusinessType; namePrefix: string }> = [
  { type: 'RETAIL', namePrefix: 'Corner Shop' },
  { type: 'RETAIL', namePrefix: 'General Store' },
  { type: 'FACTORY', namePrefix: 'Assembly Plant' },
  { type: 'MINE', namePrefix: 'Shaft Operation' },
  { type: 'FARM', namePrefix: 'Homestead Farm' },
  { type: 'LOGISTICS', namePrefix: 'Freight Depot' },
  { type: 'SECURITY_FIRM', namePrefix: 'Guard Services' },
  { type: 'FRONT_COMPANY', namePrefix: 'Import/Export LLC' },
];

const LISTING_PRICES: Record<BusinessType, [number, number]> = {
  RETAIL: [18000, 35000],
  FACTORY: [120000, 200000],
  MINE: [60000, 110000],
  FARM: [30000, 55000],
  LOGISTICS: [45000, 80000],
  SECURITY_FIRM: [35000, 60000],
  FRONT_COMPANY: [80000, 140000],
};

// ─── NPC player profiles ──────────────────────────────────────

interface NpcProfile {
  username: string;
  netWorth: number;
  alignment: Alignment;
  bizTypes: BusinessType[];
  city: string;
}

const NPC_PROFILES: NpcProfile[] = [
  { username: 'IronTycoon',     netWorth: 480_000, alignment: 'LEGAL',    bizTypes: ['MINE','FACTORY'],       city: 'Ironport'  },
  { username: 'ShadowKing',     netWorth: 390_000, alignment: 'CRIMINAL', bizTypes: ['FRONT_COMPANY','RETAIL'],city: 'Duskfield' },
  { username: 'GoldenMerchant', netWorth: 310_000, alignment: 'MIXED',    bizTypes: ['RETAIL','LOGISTICS'],    city: 'Ironport'  },
  { username: 'NorthernBoss',   netWorth: 250_000, alignment: 'CRIMINAL', bizTypes: ['FRONT_COMPANY'],         city: 'Ashvale'   },
  { username: 'TradeKing',      netWorth: 210_000, alignment: 'LEGAL',    bizTypes: ['LOGISTICS','FARM'],      city: 'Ironport'  },
  { username: 'ColdMarshCo',    netWorth: 145_000, alignment: 'LEGAL',    bizTypes: ['FARM'],                  city: 'Coldmarsh' },
  { username: 'FarrowMines',    netWorth: 120_000, alignment: 'LEGAL',    bizTypes: ['MINE'],                  city: 'Farrow'    },
  { username: 'DuskDealer',     netWorth:  95_000, alignment: 'MIXED',    bizTypes: ['RETAIL'],                city: 'Duskfield' },
  { username: 'AshvaleFab',     netWorth:  80_000, alignment: 'LEGAL',    bizTypes: ['FACTORY'],               city: 'Ashvale'   },
  { username: 'VaultRunner',    netWorth:  72_000, alignment: 'CRIMINAL', bizTypes: ['FRONT_COMPANY'],         city: 'Ironport'  },
  { username: 'GrainTrader',    netWorth:  55_000, alignment: 'LEGAL',    bizTypes: ['FARM'],                  city: 'Coldmarsh' },
  { username: 'QuickShip',      netWorth:  48_000, alignment: 'LEGAL',    bizTypes: ['LOGISTICS'],             city: 'Farrow'    },
  { username: 'SmokeCo',        netWorth:  40_000, alignment: 'MIXED',    bizTypes: ['RETAIL'],                city: 'Ashvale'   },
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
        is_front, front_capacity, suspicion_level, max_employees)
     VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
      10,
    ],
  );
  const bizId = bizRes.rows[0].id;

  const empCount = randInt(3, 6);
  for (let i = 0; i < empCount; i++) {
    const needsCriminal = type === 'FRONT_COMPANY' && i < 2;
    await seedEmployee(client, seasonId, bizId, needsCriminal ? (Math.random() < 0.5 ? 'ENFORCER' : 'DRIVER') : undefined);
  }

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

// ─── New System Seed Helpers ─────────────────────────────────

const CITY_ZONES: Record<string, { zone: string; traffic: number; setupCost: number; monthlyCost: number }> = {
  Ironport:   { zone: 'PORT',             traffic: 85, setupCost: 15000, monthlyCost: 2000 },
  Duskfield:  { zone: 'INDUSTRIAL',       traffic: 60, setupCost: 10000, monthlyCost: 1500 },
  Ashvale:    { zone: 'TOURIST_DISTRICT', traffic: 90, setupCost: 20000, monthlyCost: 2500 },
  Coldmarsh:  { zone: 'SUBURB',           traffic: 40, setupCost: 8000,  monthlyCost: 1000 },
  Farrow:     { zone: 'DOWNTOWN',         traffic: 75, setupCost: 18000, monthlyCost: 2200 },
};

const REPUTATION_AXES = ['BUSINESS', 'CRIMINAL', 'NEGOTIATION', 'EMPLOYEE', 'COMMUNITY', 'RELIABILITY'];

const SEED_EVENTS: Array<{ category: string; title: string; description: string; probability: number; duration: number }> = [
  { category: 'MARKET_CRASH',      title: 'Steel Market Collapse',          description: 'A sudden oversupply of imported steel crashes local prices by 40%.',         probability: 0.15, duration: 48 },
  { category: 'SUPPLY_SURGE',      title: 'Wheat Harvest Boom',             description: 'Perfect growing season floods the market with cheap wheat.',                  probability: 0.25, duration: 72 },
  { category: 'POLICE_CRACKDOWN',  title: 'Operation Clean Sweep',          description: 'Police launch coordinated raids on suspected front companies.',              probability: 0.10, duration: 24 },
  { category: 'EMPLOYEE_STRIKE',   title: 'Dockworkers Strike',             description: 'Port workers demand higher wages, halting all shipping operations.',          probability: 0.20, duration: 36 },
  { category: 'RIVAL_COLLAPSE',    title: 'Northern Holdings Bankruptcy',   description: 'A major NPC corporation collapses, flooding the market with cheap assets.',   probability: 0.08, duration: 48 },
  { category: 'DISASTER',          title: 'Warehouse Fire in Duskfield',    description: 'Industrial fire destroys stored goods in the warehouse district.',            probability: 0.12, duration: 24 },
  { category: 'POLITICAL',         title: 'New Trade Tariffs',              description: 'Government imposes import tariffs, raising costs on processed goods.',        probability: 0.18, duration: 96 },
  { category: 'INSIDER_LEAK',      title: 'Leaked Financial Records',       description: 'Confidential financial data of top players becomes public knowledge.',       probability: 0.10, duration: 12 },
  { category: 'ALLIANCE_COLLAPSE', title: 'The Iron Pact Dissolves',        description: 'Major alliance fractures due to internal betrayal and treasury theft.',       probability: 0.07, duration: 24 },
  { category: 'BOOM',              title: 'Electronics Gold Rush',          description: 'Surging demand for electronics drives prices up 60%.',                        probability: 0.20, duration: 48 },
  { category: 'MARKET_CRASH',      title: 'Fuel Price Shock',               description: 'International fuel crisis causes local fuel prices to spike then crash.',     probability: 0.12, duration: 36 },
  { category: 'SUPPLY_SURGE',      title: 'Contraband Flood',               description: 'A failed bust releases a huge quantity of contraband onto the black market.', probability: 0.15, duration: 24 },
  { category: 'POLICE_CRACKDOWN',  title: 'Anti-Corruption Task Force',     description: 'Federal agents investigate money laundering across all cities.',              probability: 0.08, duration: 72 },
  { category: 'EMPLOYEE_STRIKE',   title: 'Factory Workers Walkout',        description: 'Factory employees across Ashvale refuse to work without safety upgrades.',    probability: 0.18, duration: 48 },
  { category: 'DISASTER',          title: 'Port Storm Damage',              description: 'Severe storm damages Ironport docks, delaying all shipments.',                probability: 0.14, duration: 36 },
  { category: 'POLITICAL',         title: 'Deregulation Wave',              description: 'New government relaxes business regulations, reducing operating costs.',      probability: 0.22, duration: 120 },
  { category: 'BOOM',              title: 'Construction Boom',              description: 'Massive infrastructure project drives demand for raw materials sky-high.',    probability: 0.20, duration: 72 },
  { category: 'INSIDER_LEAK',      title: 'Spy Network Exposed',            description: 'Intelligence network leak reveals who is spying on whom.',                    probability: 0.06, duration: 12 },
  { category: 'RIVAL_COLLAPSE',    title: 'Shadow Syndicate Raid',          description: 'Police dismantle a criminal syndicate, creating a power vacuum.',             probability: 0.09, duration: 48 },
  { category: 'ALLIANCE_COLLAPSE', title: 'Trade Pact Betrayal',            description: 'Key alliance member secretly sells shared intel to rivals.',                  probability: 0.07, duration: 24 },
];

async function seedLocationsAndRoutes(client: PoolClient, seasonId: string, playerIds: string[]): Promise<void> {
  console.log('[8/12] Seeding locations for 5 cities...');
  let locIdx = 0;
  for (const [cityName, info] of Object.entries(CITY_ZONES)) {
    const pid = playerIds[locIdx % playerIds.length];
    await client.query(
      `INSERT INTO locations (player_id, name, zone, city, setup_cost, monthly_cost, traffic_level)
       VALUES ($1, $2, $3::location_zone, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [pid, `${cityName} Hub`, info.zone, cityName, info.setupCost, info.monthlyCost, info.traffic],
    );
    locIdx++;
  }
  console.log('    done - 5 city locations created');

  console.log('[9/12] Seeding transport routes between cities...');
  const cityNames = Object.keys(CITY_ZONES);
  let routeCount = 0;
  for (let i = 0; i < cityNames.length; i++) {
    for (let j = i + 1; j < cityNames.length; j++) {
      const dist = Math.abs(i - j);
      const baseCost = 200 + dist * 150;
      const risk = parseFloat((0.02 + dist * 0.03).toFixed(4));
      const hours = 6 + dist * 8;
      const ttype = dist <= 1 ? 'LOCAL_COURIER' : dist <= 2 ? 'REGIONAL' : 'SHIPPING';
      await client.query(
        `INSERT INTO transport_routes (origin_city, destination_city, transport, base_cost, risk_level, travel_time_hours)
         VALUES ($1, $2, $3::transport_type, $4, $5, $6)`,
        [cityNames[i], cityNames[j], ttype, baseCost, risk, hours],
      );
      await client.query(
        `INSERT INTO transport_routes (origin_city, destination_city, transport, base_cost, risk_level, travel_time_hours)
         VALUES ($1, $2, $3::transport_type, $4, $5, $6)`,
        [cityNames[j], cityNames[i], ttype, baseCost, risk, hours],
      );
      routeCount += 2;
    }
  }
  console.log(`    done - ${routeCount} transport routes created`);
}

async function seedSeasonalEvents(client: PoolClient, seasonId: string): Promise<void> {
  console.log('[10/12] Seeding 20 seasonal events...');
  for (const evt of SEED_EVENTS) {
    await client.query(
      `INSERT INTO seasonal_events (season_id, category, title, description, probability, duration_hours, impact_json)
       VALUES ($1, $2::event_category, $3, $4, $5, $6, $7)`,
      [seasonId, evt.category, evt.title, evt.description, evt.probability, evt.duration,
       JSON.stringify({ affected_resources: [], magnitude: evt.probability * 100 })],
    );
  }
  console.log('    done - 20 seasonal events created');
}

async function seedReputationProfiles(client: PoolClient, playerIds: string[]): Promise<void> {
  console.log('[11/12] Seeding reputation profiles for all players...');
  let count = 0;
  for (const pid of playerIds) {
    for (const axis of REPUTATION_AXES) {
      await client.query(
        `INSERT INTO reputation_profiles (player_id, axis, score)
         VALUES ($1, $2::reputation_axis, 50)
         ON CONFLICT (player_id, axis) DO NOTHING`,
        [pid, axis],
      );
      count++;
    }
  }
  console.log(`    done - ${count} reputation profiles created (${playerIds.length} players x 6 axes)`);
}

async function seedDistricts(client: PoolClient): Promise<Record<string, string>> {
  console.log('[6/12] Seeding 17 districts across 5 cities...');
  const districtIds: Record<string, string> = {};
  for (const d of SEED_DISTRICTS) {
    const res = await client.query<{ id: string }>(
      `INSERT INTO districts (city, name, tier, foot_traffic, location_quality, rent_multiplier, revenue_multiplier, max_businesses)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (city, name) DO UPDATE SET tier = EXCLUDED.tier
       RETURNING id`,
      [d.city, d.name, d.tier, d.foot_traffic, d.location_quality, d.rent_multiplier, d.revenue_multiplier, d.max_businesses],
    );
    districtIds[`${d.city}:${d.name}`] = res.rows[0].id;
  }
  console.log(`    done - ${SEED_DISTRICTS.length} districts created`);
  return districtIds;
}

async function seedBusinessListings(client: PoolClient, seasonId: string, districtIds: Record<string, string>): Promise<void> {
  console.log('[7/12] Seeding business listings (5-8 per city)...');
  const cities = ['Ironport', 'Duskfield', 'Ashvale', 'Coldmarsh', 'Farrow'];
  let totalListings = 0;

  for (const city of cities) {
    const count = randInt(5, 8);
    const cityDistricts = SEED_DISTRICTS.filter(d => d.city === city);

    for (let i = 0; i < count; i++) {
      const template = pick(LISTING_TEMPLATES);
      const district = pick(cityDistricts);
      const districtKey = `${city}:${district.name}`;
      const districtId = districtIds[districtKey];
      const [minPrice, maxPrice] = LISTING_PRICES[template.type];
      const askingPrice = randInt(minPrice, maxPrice);
      const dailyCost = DAILY_OPERATING[template.type] * rand(0.8, 1.2);
      const sizeSqm = randInt(50, 300);
      const expiresIn = randInt(24, 168);

      await client.query(
        `INSERT INTO business_listings
           (season_id, city, district_id, type, name, asking_price, daily_operating_cost,
            foot_traffic, location_quality, size_sqm, status, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'AVAILABLE', NOW() + INTERVAL '${expiresIn} hours')`,
        [
          seasonId, city, districtId, template.type,
          `${template.namePrefix} - ${district.name}`,
          askingPrice, parseFloat(dailyCost.toFixed(2)),
          district.foot_traffic, district.location_quality, sizeSqm,
        ],
      );
      totalListings++;
    }
  }
  console.log(`    done - ${totalListings} business listings created`);
}

async function seedManagers(client: PoolClient, seasonId: string): Promise<void> {
  console.log('[12/12] Seeding 3-5 rare managers in the pool...');
  const managerCount = randInt(3, 5);
  for (let i = 0; i < managerCount; i++) {
    await seedEmployee(client, seasonId, null, 'MANAGER');
  }
  console.log(`    done - ${managerCount} managers seeded in available pool`);
}

// ─── Main seed ────────────────────────────────────────────────

async function main() {
  console.log('\n=== EmpireOS Database Seed v2 ===');
  console.log('=== Phase 5 Economy Overhaul  ===\n');

  await withTransaction(async (client) => {

    // ── 1. Season ─────────────────────────────────────────────
    console.log('[1/12] Creating Season 1: Iron Dawn...');
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
        STARTING_CASH,
        taxBrackets, 1.0,
        SEED_RESOURCES.map(r => r.name),
        'Beta Season - All bugs are features', 0, '[]',
      ],
    );
    const seasonId = seasonRes.rows[0].id;
    console.log(`    done - Season ID: ${seasonId}`);

    // ── 2. Resources ──────────────────────────────────────────
    console.log('[2/12] Seeding resources + price history...');
    const resourceIds: Record<string, string> = {};

    for (const res of SEED_RESOURCES) {
      const supply = res.base_value < 20 ? 80000 : res.base_value < 100 ? 30000 : 10000;
      const demand = supply * rand(0.9, 1.2);
      const aiPrice = parseFloat((res.base_value * AI_MARKUP).toFixed(2));

      const rRes = await client.query<{ id: string }>(
        `INSERT INTO resources
           (name, category, tier, base_value, weight, perishable, perish_hours,
            illegal, season_id, global_supply, global_demand, current_ai_price, city_price_modifiers)
         VALUES ($1,$2,$3,$4,$5,false,null,$6,$7,$8,$9,$10,$11)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [res.name, res.category, res.tier, res.base_value, res.weight,
         res.illegal, seasonId, supply, demand, aiPrice, JSON.stringify(CITY_PRICE_MODS)],
      );
      if (rRes.rows.length > 0) {
        resourceIds[res.name] = rRes.rows[0].id;
      }
    }

    const existing = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM resources WHERE season_id = $1`, [seasonId],
    );
    for (const r of existing.rows) resourceIds[r.name] = r.id;

    for (const res of SEED_RESOURCES) {
      const resId = resourceIds[res.name];
      if (!resId) continue;
      let price = res.base_value * AI_MARKUP;
      for (let day = PRICE_HISTORY_DAYS; day >= 0; day--) {
        for (let tick = 0; tick < 8; tick++) {
          const drift = rand(-0.03, 0.03);
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
    console.log(`    done - ${SEED_RESOURCES.length} resources + price history`);

    // ── 3. AI market listings ─────────────────────────────────
    console.log('[3/12] Seeding AI market listings...');
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
    console.log(`    done - AI listings created`);

    // ── 4. NPC players ────────────────────────────────────────
    console.log(`[4/12] Creating ${NPC_COUNT} NPC players with businesses...`);
    const npcPassword = await bcrypt.hash('npc-internal-account-not-for-login', 10);

    for (const npc of NPC_PROFILES) {
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
          parseFloat((npc.netWorth * rand(0.1, 0.3)).toFixed(2)),
          npc.netWorth,
          3 + Math.floor(npc.netWorth / 100_000),
          randInt(0, Math.min(1000, Math.floor(npc.netWorth / 500))),
          npc.alignment,
          randInt(0, 50),
        ],
      );

      if (pRes.rows.length === 0) {
        console.log(`    NPC ${npc.username} already exists, skipping`);
        continue;
      }
      const npcId = pRes.rows[0].id;

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

      if (npc.alignment !== 'LEGAL') {
        const dirty = parseFloat(rand(1000, npc.netWorth * 0.2).toFixed(2));
        await client.query(
          `INSERT INTO dirty_money_balances (player_id, season_id, total_dirty, total_earned, total_laundered)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (player_id, season_id) DO NOTHING`,
          [npcId, seasonId, dirty, dirty * rand(1.2, 2.0), dirty * rand(0.1, 0.5)],
        );
      }

      for (const bizType of npc.bizTypes) {
        await seedBusiness(client, npcId, seasonId, bizType, npc.city, resourceIds);
      }

      console.log(`    done - ${npc.username} (${npc.alignment}, $${npc.netWorth.toLocaleString()})`);
    }

    // ── 5. Employee pool ──────────────────────────────────────
    console.log(`[5/12] Creating ${EMPLOYEE_POOL_SIZE} hireable employees...`);
    const roleOptions: EmployeeRole[] = ['WORKER','DRIVER','ACCOUNTANT','MANAGER','SECURITY','ENFORCER'];
    const roleWeights = [55, 15, 12, 8, 7, 3];
    for (let i = 0; i < EMPLOYEE_POOL_SIZE; i++) {
      await seedEmployee(client, seasonId, null, pickWeighted(roleOptions, roleWeights));
    }
    console.log(`    done - ${EMPLOYEE_POOL_SIZE} employees ready to hire`);

    // ── 6. Districts ──────────────────────────────────────────
    const districtIds = await seedDistricts(client);

    // ── 7. Business Listings ──────────────────────────────────
    await seedBusinessListings(client, seasonId, districtIds);

    // ── 8-11. Systems seed data ─────────────────────────────
    const allPlayerIds = (await client.query<{ id: string }>(
      `SELECT id FROM players WHERE season_id = $1`, [seasonId]
    )).rows.map(r => r.id);

    await seedLocationsAndRoutes(client, seasonId, allPlayerIds);
    await seedSeasonalEvents(client, seasonId);
    await seedReputationProfiles(client, allPlayerIds);

    // ── 12. Rare managers ─────────────────────────────────────
    await seedManagers(client, seasonId);

    // ── Update season leaderboard ─────────────────────────────
    console.log('Updating season leaderboard...');
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
    console.log('    done - Leaderboard updated');

    // ── Summary ───────────────────────────────────────────────
    const counts = await client.query<{ players: string; businesses: string; employees: string; listings: string; districts: string; biz_listings: string }>(
      `SELECT
         (SELECT COUNT(*) FROM players         WHERE season_id = $1)::text AS players,
         (SELECT COUNT(*) FROM businesses      WHERE season_id = $1)::text AS businesses,
         (SELECT COUNT(*) FROM employees       WHERE season_id = $1)::text AS employees,
         (SELECT COUNT(*) FROM market_listings WHERE season_id = $1)::text AS listings,
         (SELECT COUNT(*) FROM districts)::text AS districts,
         (SELECT COUNT(*) FROM business_listings WHERE season_id = $1)::text AS biz_listings`,
      [seasonId],
    );
    const c = counts.rows[0];

    console.log('\n=== Seed Complete! ===');
    console.log(`  Players        : ${c.players}`);
    console.log(`  Businesses     : ${c.businesses}`);
    console.log(`  Employees      : ${c.employees}`);
    console.log(`  Market Listings: ${c.listings}`);
    console.log(`  Districts      : ${c.districts}`);
    console.log(`  Biz Listings   : ${c.biz_listings}`);
    console.log(`  Starting Cash  : $${STARTING_CASH.toLocaleString()}`);
    console.log('=====================\n');
  });

  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
