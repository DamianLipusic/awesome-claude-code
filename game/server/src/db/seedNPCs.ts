import 'dotenv/config';
import bcrypt from 'bcrypt';
import { query, withTransaction } from './client';
import type { PoolClient } from 'pg';

/**
 * Seeds the 4 special NPC AI competitors.
 * Run: npx tsx src/db/seedNPCs.ts
 *
 * These NPCs have is_npc=true and npc_personality set,
 * enabling the NPC AI tick processor to control them.
 */

interface NpcDef {
  username: string;
  email: string;
  cash: number;
  netWorth: number;
  alignment: 'LEGAL' | 'MIXED' | 'CRIMINAL';
  archetype: string;
  businessSlots: number;
  businesses: Array<{ type: string; city: string; name: string }>;
  reputation: Record<string, number>;
}

const NPC_DEFS: NpcDef[] = [
  {
    username: '[NPC] The Mogul',
    email: 'npc-mogul@system.local',
    cash: 100_000,
    netWorth: 350_000,
    alignment: 'LEGAL',
    archetype: 'MOGUL',
    businessSlots: 5,
    businesses: [
      { type: 'FACTORY', city: 'Ironport', name: 'Mogul Industries' },
      { type: 'RETAIL', city: 'Ironport', name: 'Mogul Emporium' },
      { type: 'FARM', city: 'Coldmarsh', name: 'Mogul Estates' },
    ],
    reputation: { BUSINESS: 80, COMMUNITY: 75, EMPLOYEE: 70, RELIABILITY: 85, CRIMINAL: 10, NEGOTIATION: 60 },
  },
  {
    username: '[NPC] Shadow King',
    email: 'npc-shadowking@system.local',
    cash: 100_000,
    netWorth: 280_000,
    alignment: 'CRIMINAL',
    archetype: 'SHADOW_KING',
    businessSlots: 5,
    businesses: [
      { type: 'FRONT_COMPANY', city: 'Duskfield', name: 'Shadow Enterprises' },
      { type: 'SECURITY_FIRM', city: 'Duskfield', name: 'Nightwatch Security' },
      { type: 'RETAIL', city: 'Ashvale', name: 'Midnight Market' },
    ],
    reputation: { BUSINESS: 40, COMMUNITY: 20, EMPLOYEE: 35, RELIABILITY: 30, CRIMINAL: 90, NEGOTIATION: 75 },
  },
  {
    username: '[NPC] The Broker',
    email: 'npc-broker@system.local',
    cash: 100_000,
    netWorth: 220_000,
    alignment: 'LEGAL',
    archetype: 'BROKER',
    businessSlots: 4,
    businesses: [
      { type: 'LOGISTICS', city: 'Ironport', name: 'Broker Freight' },
      { type: 'RETAIL', city: 'Farrow', name: 'Broker Trading Post' },
    ],
    reputation: { BUSINESS: 65, COMMUNITY: 50, EMPLOYEE: 55, RELIABILITY: 90, CRIMINAL: 5, NEGOTIATION: 95 },
  },
  {
    username: '[NPC] Iron Fist',
    email: 'npc-ironfist@system.local',
    cash: 100_000,
    netWorth: 300_000,
    alignment: 'MIXED',
    archetype: 'IRON_FIST',
    businessSlots: 5,
    businesses: [
      { type: 'MINE', city: 'Farrow', name: 'Iron Fist Mining' },
      { type: 'FACTORY', city: 'Ashvale', name: 'Iron Fist Foundry' },
      { type: 'SECURITY_FIRM', city: 'Ironport', name: 'Iron Fist Protection' },
    ],
    reputation: { BUSINESS: 60, COMMUNITY: 25, EMPLOYEE: 30, RELIABILITY: 55, CRIMINAL: 65, NEGOTIATION: 50 },
  },
];

const DAILY_OPERATING: Record<string, number> = {
  RETAIL: 200, FACTORY: 800, MINE: 600, FARM: 300,
  LOGISTICS: 500, SECURITY_FIRM: 400, FRONT_COMPANY: 700,
};

async function seedNPCs() {
  console.log('[seedNPCs] Starting NPC AI competitor seeding...');

  // Get active season
  const seasonRes = await query<{ id: string }>(
    "SELECT id FROM season_profiles WHERE status = 'ACTIVE' LIMIT 1"
  );
  if (seasonRes.rows.length === 0) {
    console.error('[seedNPCs] No active season found. Run main seed first.');
    process.exit(1);
  }
  const seasonId = seasonRes.rows[0].id;
  console.log('[seedNPCs] Active season: ' + seasonId);

  const passwordHash = await bcrypt.hash('npc-system-account', 12);

  await withTransaction(async (client: PoolClient) => {
    for (const def of NPC_DEFS) {
      // Check if NPC already exists
      const existing = await client.query(
        'SELECT id FROM players WHERE username = $1',
        [def.username]
      );
      if (existing.rows.length > 0) {
        console.log('[seedNPCs] NPC "' + def.username + '" already exists, skipping.');
        continue;
      }

      // Create NPC player
      const playerRes = await client.query<{ id: string }>(
        `INSERT INTO players
           (username, email, password_hash, season_id, cash, net_worth,
            business_slots, alignment, is_npc, npc_personality)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
         RETURNING id`,
        [
          def.username, def.email, passwordHash, seasonId,
          def.cash, def.netWorth, def.businessSlots, def.alignment,
          JSON.stringify({ archetype: def.archetype }),
        ]
      );
      const playerId = playerRes.rows[0].id;
      console.log('[seedNPCs] Created NPC: ' + def.username + ' (' + playerId + ')');

      // Create reputation profiles
      for (const [axis, score] of Object.entries(def.reputation)) {
        await client.query(
          `INSERT INTO reputation_profiles (player_id, axis, score)
           VALUES ($1, $2, $3)`,
          [playerId, axis, score]
        );
      }

      // Create businesses
      for (const bizDef of def.businesses) {
        const bizRes = await client.query<{ id: string }>(
          `INSERT INTO businesses
             (owner_id, season_id, name, type, tier, city, status, capacity, efficiency,
              inventory, storage_cap, daily_operating_cost, is_front, front_capacity, suspicion_level)
           VALUES ($1, $2, $3, $4, 1, $5, 'ACTIVE', 100, 0.80, '{}', 500, $6, $7, $8, 0)
           RETURNING id`,
          [
            playerId, seasonId, bizDef.name, bizDef.type, bizDef.city,
            DAILY_OPERATING[bizDef.type] ?? 500,
            bizDef.type === 'FRONT_COMPANY',
            bizDef.type === 'FRONT_COMPANY' ? 25000 : 0,
          ]
        );
        console.log('[seedNPCs]   Business: ' + bizDef.name + ' (' + bizDef.type + ' in ' + bizDef.city + ')');

        // Assign 2 employees per business from the pool
        const emps = await client.query<{ id: string }>(
          `SELECT id FROM employees
           WHERE business_id IS NULL AND season_id = $1
           ORDER BY RANDOM() LIMIT 2`,
          [seasonId]
        );
        for (const emp of emps.rows) {
          await client.query(
            'UPDATE employees SET business_id = $1, hired_at = NOW() WHERE id = $2',
            [bizRes.rows[0].id, emp.id]
          );
        }
      }
    }
  });

  console.log('[seedNPCs] Done! 4 NPC AI competitors seeded.');
  process.exit(0);
}

seedNPCs().catch((err) => {
  console.error('[seedNPCs] Fatal error:', err);
  process.exit(1);
});
