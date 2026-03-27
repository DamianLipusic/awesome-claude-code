import { query, withTransaction } from '../db/client';
import type { PoolClient } from 'pg';
import { secureRandom, secureRandomInt } from '../lib/random';

// ── NPC Personality Types ────────────────────────────────────

export type NpcArchetype = 'MOGUL' | 'SHADOW_KING' | 'BROKER' | 'IRON_FIST';

interface NpcPersonality {
  archetype: NpcArchetype;
  investmentBias: Record<string, number>;
  crimeWillingness: number;
  marketAggression: number;
  expansionRate: number;
  retaliationChance: number;
}

const ARCHETYPE_CONFIGS: Record<NpcArchetype, NpcPersonality> = {
  MOGUL: {
    archetype: 'MOGUL',
    investmentBias: { RETAIL: 0.3, FACTORY: 0.4, FARM: 0.2, MINE: 0.1 },
    crimeWillingness: 0.05,
    marketAggression: 0.4,
    expansionRate: 0.6,
    retaliationChance: 0.2,
  },
  SHADOW_KING: {
    archetype: 'SHADOW_KING',
    investmentBias: { FRONT_COMPANY: 0.4, RETAIL: 0.2, SECURITY_FIRM: 0.3, LOGISTICS: 0.1 },
    crimeWillingness: 0.85,
    marketAggression: 0.5,
    expansionRate: 0.5,
    retaliationChance: 0.9,
  },
  BROKER: {
    archetype: 'BROKER',
    investmentBias: { LOGISTICS: 0.4, RETAIL: 0.3, FACTORY: 0.2, FARM: 0.1 },
    crimeWillingness: 0.1,
    marketAggression: 0.9,
    expansionRate: 0.3,
    retaliationChance: 0.3,
  },
  IRON_FIST: {
    archetype: 'IRON_FIST',
    investmentBias: { MINE: 0.3, FACTORY: 0.3, SECURITY_FIRM: 0.3, FRONT_COMPANY: 0.1 },
    crimeWillingness: 0.6,
    marketAggression: 0.6,
    expansionRate: 0.7,
    retaliationChance: 0.95,
  },
};

// ── Helpers ──────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return secureRandom() * (max - min) + min;
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = secureRandom() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ── NPC Investment Logic ─────────────────────────────────────

async function npcInvest(client: PoolClient, npc: NpcState): Promise<number> {
  let actions = 0;
  const personality = getPersonality(npc.npc_personality);
  if (!personality) return 0;

  const reserve = 5000;
  const investableCash = npc.cash - reserve;
  if (investableCash < 10000) return 0;

  const bizCount = await client.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM businesses WHERE owner_id = $1 AND season_id = $2',
    [npc.id, npc.season_id]
  );
  const currentBizCount = parseInt(bizCount.rows[0].count);

  if (currentBizCount >= npc.business_slots) return 0;
  if (secureRandom() > personality.expansionRate * 0.3) return 0;

  const types = Object.keys(personality.investmentBias);
  const weights = Object.values(personality.investmentBias);
  const bizType = weightedPick(types, weights);

  const cities = ['Ironport', 'Duskfield', 'Ashvale', 'Coldmarsh', 'Farrow'];
  const city = cities[secureRandomInt(0, cities.length - 1)];

  const baseCosts: Record<string, number> = {
    RETAIL: 5000, FACTORY: 15000, MINE: 12000, FARM: 8000,
    LOGISTICS: 10000, SECURITY_FIRM: 8000, FRONT_COMPANY: 20000,
  };
  const cost = baseCosts[bizType] ?? 10000;
  if (investableCash < cost) return 0;

  const dailyOps: Record<string, number> = {
    RETAIL: 200, FACTORY: 800, MINE: 600, FARM: 300,
    LOGISTICS: 500, SECURITY_FIRM: 400, FRONT_COMPANY: 700,
  };

  const adjectives = ['Iron', 'Golden', 'Shadow', 'Northern', 'Prime', 'Apex', 'Crown', 'Steel'];
  const nouns = ['Works', 'Trading Co.', 'Ventures', 'Industries', 'Group', 'Holdings'];
  const bizName = adjectives[secureRandomInt(0, adjectives.length - 1)] + ' ' + nouns[secureRandomInt(0, nouns.length - 1)];

  await client.query(
    `INSERT INTO businesses
       (owner_id, season_id, name, type, tier, city, status, capacity, efficiency,
        inventory, storage_cap, daily_operating_cost, is_front, front_capacity, suspicion_level)
     VALUES ($1,$2,$3,$4,1,$5,'ACTIVE',100,0.75,'{}',500,$6,$7,$8,0)`,
    [
      npc.id, npc.season_id, bizName, bizType, city,
      dailyOps[bizType] ?? 500,
      bizType === 'FRONT_COMPANY',
      bizType === 'FRONT_COMPANY' ? parseFloat(rand(5000, 30000).toFixed(2)) : 0,
    ]
  );

  await client.query(
    'UPDATE players SET cash = cash - $1 WHERE id = $2',
    [cost, npc.id]
  );

  actions++;
  console.log('[NPC:' + npc.username + '] Invested in ' + bizType + ' "' + bizName + '" in ' + city + ' for $' + cost);
  return actions;
}

// ── NPC Employee Management ──────────────────────────────────

async function npcManageEmployees(client: PoolClient, npc: NpcState): Promise<number> {
  let actions = 0;

  const businesses = await client.query<{
    id: string; type: string; capacity: number;
  }>(
    `SELECT b.id, b.type, b.capacity
     FROM businesses b
     WHERE b.owner_id = $1 AND b.season_id = $2 AND b.status = 'ACTIVE'`,
    [npc.id, npc.season_id]
  );

  for (const biz of businesses.rows) {
    const empCount = await client.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM employees WHERE business_id = $1',
      [biz.id]
    );
    const currentEmps = parseInt(empCount.rows[0].count);

    const targetEmps = Math.min(4, Math.ceil(biz.capacity / 30));
    if (currentEmps < targetEmps && npc.cash > 2000) {
      const available = await client.query<{ id: string; salary: string }>(
        `SELECT id, salary FROM employees
         WHERE business_id IS NULL AND season_id = $1
         ORDER BY efficiency DESC LIMIT 1`,
        [npc.season_id]
      );

      if (available.rows.length > 0) {
        const emp = available.rows[0];
        await client.query(
          'UPDATE employees SET business_id = $1, hired_at = NOW() WHERE id = $2',
          [biz.id, emp.id]
        );
        actions++;
      }
    }

    if (currentEmps > 1) {
      const fired = await client.query(
        `UPDATE employees SET business_id = NULL, hired_at = NULL
         WHERE business_id = $1 AND morale < 0.2
         RETURNING id`,
        [biz.id]
      );
      actions += fired.rowCount ?? 0;
    }
  }

  return actions;
}

// ── NPC Market Trading ───────────────────────────────────────

async function npcTrade(client: PoolClient, npc: NpcState): Promise<number> {
  let actions = 0;
  const personality = getPersonality(npc.npc_personality);
  if (!personality) return 0;

  if (secureRandom() > personality.marketAggression * 0.5) return 0;

  const businesses = await client.query<{
    id: string; inventory: Record<string, number>; city: string;
  }>(
    'SELECT id, inventory, city FROM businesses WHERE owner_id = $1 AND season_id = $2 AND status = $3',
    [npc.id, npc.season_id, 'ACTIVE']
  );

  for (const biz of businesses.rows) {
    const inv = biz.inventory ?? {};
    for (const [resourceName, qty] of Object.entries(inv)) {
      if (qty < 10) continue;

      const resInfo = await client.query<{ id: string; current_ai_price: string }>(
        'SELECT id, current_ai_price FROM resources WHERE name = $1 AND season_id = $2 LIMIT 1',
        [resourceName, npc.season_id]
      );
      if (resInfo.rows.length === 0) continue;

      const resource = resInfo.rows[0];
      const aiPrice = parseFloat(resource.current_ai_price);

      const sellQty = Math.min(qty, Math.floor(qty * 0.5));
      if (sellQty < 5) continue;

      const markup = personality.archetype === 'BROKER' ? 1.15 : 1.05;
      const sellPrice = parseFloat((aiPrice * markup).toFixed(2));

      await client.query(
        `INSERT INTO market_listings
           (season_id, listing_type, seller_id, business_id, resource_id, city,
            quantity, quantity_remaining, price_per_unit, min_quantity,
            expires_at, is_anonymous, status)
         VALUES ($1, 'PLAYER_SELL', $2, $3, $4, $5, $6, $6, $7, 1,
                 NOW() + INTERVAL '4 hours', $8, 'OPEN')`,
        [
          npc.season_id, npc.id, biz.id, resource.id, biz.city,
          sellQty, sellPrice,
          personality.archetype === 'SHADOW_KING',
        ]
      );

      const newInv = { ...inv, [resourceName]: qty - sellQty };
      if (newInv[resourceName] <= 0) delete newInv[resourceName];
      await client.query(
        'UPDATE businesses SET inventory = $1 WHERE id = $2',
        [JSON.stringify(newInv), biz.id]
      );

      actions++;
    }
  }

  // Broker buys underpriced resources
  if (personality.archetype === 'BROKER' && npc.cash > 5000) {
    const cheapListings = await client.query<{
      id: string; resource_id: string; price_per_unit: string;
      quantity_remaining: string; seller_id: string;
    }>(
      `SELECT ml.id, ml.resource_id, ml.price_per_unit, ml.quantity_remaining, ml.seller_id
       FROM market_listings ml
       JOIN resources r ON r.id = ml.resource_id
       WHERE ml.season_id = $1
         AND ml.status = 'OPEN'
         AND ml.seller_id != $2
         AND ml.price_per_unit < r.current_ai_price * 0.85
       ORDER BY ml.price_per_unit ASC
       LIMIT 3`,
      [npc.season_id, npc.id]
    );

    for (const listing of cheapListings.rows) {
      const price = parseFloat(listing.price_per_unit);
      const qty = parseFloat(listing.quantity_remaining);
      const totalCost = price * qty;
      if (totalCost > npc.cash - 3000) continue;

      await client.query(
        `UPDATE market_listings SET status = 'FILLED', filled_at = NOW(),
                quantity_remaining = 0 WHERE id = $1`,
        [listing.id]
      );

      await client.query(
        'UPDATE players SET cash = cash - $1 WHERE id = $2',
        [totalCost, npc.id]
      );

      await client.query(
        'UPDATE players SET cash = cash + $1 WHERE id = $2',
        [totalCost, listing.seller_id]
      );

      actions++;
      console.log('[NPC:' + npc.username + '] Bought ' + qty + ' units at $' + price + '/ea (total: $' + totalCost.toFixed(2) + ')');
    }
  }

  return actions;
}

// ── NPC Crime Operations ─────────────────────────────────────

async function npcCrimeOps(client: PoolClient, npc: NpcState): Promise<number> {
  let actions = 0;
  const personality = getPersonality(npc.npc_personality);
  if (!personality) return 0;

  if (secureRandom() > personality.crimeWillingness * 0.2) return 0;

  const activeCrime = await client.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM criminal_operations
     WHERE player_id = $1 AND status IN ('PLANNING', 'ACTIVE')`,
    [npc.id]
  );
  if (parseInt(activeCrime.rows[0].count) >= 2) return 0;

  const heatRow = await client.query<{ score: string }>(
    'SELECT COALESCE(score, 0) as score FROM heat_scores WHERE player_id = $1 AND season_id = $2',
    [npc.id, npc.season_id]
  );
  const heat = parseFloat(heatRow.rows[0]?.score ?? '0');
  if (heat > 500) return 0;

  const crimeTypes = personality.archetype === 'SHADOW_KING'
    ? ['SMUGGLING', 'EXTORTION', 'FRAUD']
    : ['SMUGGLING', 'THEFT'];
  const crimeType = crimeTypes[secureRandomInt(0, crimeTypes.length - 1)];

  const biz = await client.query<{ id: string; city: string }>(
    `SELECT id, city FROM businesses
     WHERE owner_id = $1 AND season_id = $2 AND status = 'ACTIVE'
     LIMIT 1`,
    [npc.id, npc.season_id]
  );
  if (biz.rows.length === 0) return 0;

  const targetBiz = biz.rows[0];
  const dirtyYield = Math.floor(rand(500, 5000));
  const riskLevel = Math.floor(rand(1, 5));

  // Insert as COMPLETED crime op matching actual schema
  await client.query(
    `INSERT INTO criminal_operations
       (player_id, season_id, business_id, op_type, status,
        dirty_money_yield, risk_level, started_at, completes_at, was_detected)
     VALUES ($1, $2, $3, $4, 'COMPLETED', $5, $6, NOW(), NOW(), false)`,
    [
      npc.id, npc.season_id, targetBiz.id, crimeType,
      dirtyYield, riskLevel,
    ]
  );

  // Add dirty money to NPC cash
  await client.query(
    'UPDATE players SET cash = cash + $1 WHERE id = $2',
    [dirtyYield, npc.id]
  );

  // Add heat
  const heatGain = Math.floor(rand(10, 80));
  await client.query(
    `UPDATE heat_scores SET score = LEAST(score + $1, 1000) WHERE player_id = $2 AND season_id = $3`,
    [heatGain, npc.id, npc.season_id]
  );

  actions++;
  console.log('[NPC:' + npc.username + '] Ran ' + crimeType + ': earned $' + dirtyYield + ', heat +' + heatGain);
  return actions;
}

// ── NPC State ────────────────────────────────────────────────

interface NpcState {
  id: string;
  username: string;
  cash: number;
  season_id: string;
  business_slots: number;
  alignment: string;
  npc_personality: unknown;
}

function getPersonality(raw: unknown): NpcPersonality | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const archetype = obj.archetype as NpcArchetype | undefined;
  if (!archetype || !ARCHETYPE_CONFIGS[archetype]) return null;
  return ARCHETYPE_CONFIGS[archetype];
}

// ── Main NPC Tick Processor ──────────────────────────────────

export async function processNPCTick(): Promise<number> {
  let totalActions = 0;

  const npcs = await query<NpcState>(
    `SELECT id, username, cash::float as cash, season_id, business_slots, alignment, npc_personality
     FROM players
     WHERE is_npc = true AND season_id IS NOT NULL`
  );

  if (npcs.rows.length === 0) {
    console.log('[NPC] No active NPC players found.');
    return 0;
  }

  console.log('[NPC] Processing ' + npcs.rows.length + ' NPC players...');

  for (const npc of npcs.rows) {
    try {
      await withTransaction(async (client) => {
        totalActions += await npcInvest(client, npc);
        totalActions += await npcManageEmployees(client, npc);
        totalActions += await npcTrade(client, npc);
        if (npc.alignment !== 'LEGAL') {
          totalActions += await npcCrimeOps(client, npc);
        }
      });
    } catch (err) {
      console.error('[NPC:' + npc.username + '] Error during tick:', err);
    }
  }

  console.log('[NPC] Tick complete: ' + totalActions + ' total actions across ' + npcs.rows.length + ' NPCs.');
  return totalActions;
}

export { ARCHETYPE_CONFIGS };
