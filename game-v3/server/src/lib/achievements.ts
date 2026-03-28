// EmpireOS V3 — Achievements System
import type { PoolClient } from 'pg';
import { awardXP } from './xp.js';

interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  check: (state: PlayerAchState) => boolean;
}

interface PlayerAchState {
  cash: number;
  netWorth: number;
  businessCount: number;
  employeeCount: number;
  hasMine: boolean;
  hasFactory: boolean;
  hasShop: boolean;
  totalSold: number;
  maxTier: number;
  level: number;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { key: 'first_business', title: 'Entrepreneur', description: 'Start your first business', icon: '🏗️', xpReward: 50, check: (s) => s.businessCount >= 1 },
  { key: 'first_sale', title: 'First Dollar', description: 'Make your first sale', icon: '💵', xpReward: 50, check: (s) => s.totalSold >= 1 },
  { key: 'cash_10k', title: 'Getting Started', description: 'Accumulate $10,000 cash', icon: '💰', xpReward: 100, check: (s) => s.cash >= 10000 },
  { key: 'cash_100k', title: 'Wealthy', description: 'Accumulate $100,000 cash', icon: '🤑', xpReward: 200, check: (s) => s.cash >= 100000 },
  { key: 'net_worth_500k', title: 'Half Millionaire', description: 'Net worth exceeds $500,000', icon: '💎', xpReward: 500, check: (s) => s.netWorth >= 500000 },
  { key: 'three_businesses', title: 'Empire Builder', description: 'Own 3 businesses', icon: '🏢', xpReward: 150, check: (s) => s.businessCount >= 3 },
  { key: 'five_businesses', title: 'Tycoon', description: 'Own 5 businesses', icon: '🌆', xpReward: 300, check: (s) => s.businessCount >= 5 },
  { key: 'diversified', title: 'Diversified', description: 'Own a Mine, Factory, and Shop', icon: '🔄', xpReward: 200, check: (s) => s.hasMine && s.hasFactory && s.hasShop },
  { key: 'ten_employees', title: 'Boss', description: 'Employ 10 workers', icon: '👥', xpReward: 150, check: (s) => s.employeeCount >= 10 },
  { key: 'tier_3', title: 'Upgraded', description: 'Upgrade a business to Tier 3', icon: '⬆️', xpReward: 200, check: (s) => s.maxTier >= 3 },
  { key: 'tier_5', title: 'Maxed Out', description: 'Upgrade a business to Tier 5', icon: '🔥', xpReward: 500, check: (s) => s.maxTier >= 5 },
  { key: 'level_5', title: 'Experienced', description: 'Reach Level 5', icon: '⭐', xpReward: 100, check: (s) => s.level >= 5 },
  { key: 'level_10', title: 'Master', description: 'Reach Level 10', icon: '👑', xpReward: 500, check: (s) => s.level >= 10 },
];

/**
 * Check and award achievements for a player.
 * Called after significant actions (sell, create business, upgrade, level up).
 */
export async function checkAchievements(client: PoolClient, playerId: string): Promise<string[]> {
  // Get existing achievements
  const existingRes = await client.query<{ key: string }>(
    'SELECT key FROM achievements WHERE player_id = $1',
    [playerId],
  );
  const existing = new Set(existingRes.rows.map(r => r.key));

  // Build player state
  const stateRes = await client.query(`
    SELECT
      p.cash::numeric AS cash, p.level,
      (p.cash + p.bank_balance +
        COALESCE((SELECT SUM(inv.amount * i.base_price) FROM inventory inv JOIN businesses b ON b.id = inv.business_id JOIN items i ON i.id = inv.item_id WHERE b.owner_id = p.id AND b.status != 'shutdown'), 0) +
        COALESCE((SELECT SUM(CASE b.type WHEN 'MINE' THEN 12000 WHEN 'FACTORY' THEN 15000 WHEN 'SHOP' THEN 8000 ELSE 10000 END * b.tier) FROM businesses b WHERE b.owner_id = p.id AND b.status != 'shutdown'), 0)
      )::numeric AS net_worth,
      (SELECT COUNT(*) FROM businesses b WHERE b.owner_id = p.id AND b.status != 'shutdown')::int AS biz_count,
      (SELECT COUNT(*) FROM employees e JOIN businesses b ON b.id = e.business_id WHERE b.owner_id = p.id AND e.status IN ('active','training'))::int AS emp_count,
      EXISTS(SELECT 1 FROM businesses b WHERE b.owner_id = p.id AND b.type = 'MINE' AND b.status != 'shutdown') AS has_mine,
      EXISTS(SELECT 1 FROM businesses b WHERE b.owner_id = p.id AND b.type = 'FACTORY' AND b.status != 'shutdown') AS has_factory,
      EXISTS(SELECT 1 FROM businesses b WHERE b.owner_id = p.id AND b.type = 'SHOP' AND b.status != 'shutdown') AS has_shop,
      (SELECT COUNT(*) FROM activity_log WHERE player_id = p.id AND type IN ('SALE','SELL_ALL','AUTOSELL'))::int AS total_sold,
      COALESCE((SELECT MAX(b.tier) FROM businesses b WHERE b.owner_id = p.id AND b.status != 'shutdown'), 0)::int AS max_tier
    FROM players p WHERE p.id = $1
  `, [playerId]);

  if (!stateRes.rows.length) return [];
  const row = stateRes.rows[0];

  const state: PlayerAchState = {
    cash: Number(row.cash),
    netWorth: Number(row.net_worth),
    businessCount: Number(row.biz_count),
    employeeCount: Number(row.emp_count),
    hasMine: Boolean(row.has_mine),
    hasFactory: Boolean(row.has_factory),
    hasShop: Boolean(row.has_shop),
    totalSold: Number(row.total_sold),
    maxTier: Number(row.max_tier),
    level: Number(row.level),
  };

  const newAchievements: string[] = [];

  for (const ach of ACHIEVEMENT_DEFS) {
    if (existing.has(ach.key)) continue;
    if (!ach.check(state)) continue;

    // Award achievement
    await client.query(
      `INSERT INTO achievements (player_id, key, title, description, icon, xp_reward)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (player_id, key) DO NOTHING`,
      [playerId, ach.key, ach.title, ach.description, ach.icon, ach.xpReward],
    );

    if (ach.xpReward > 0) {
      await awardXP(client, playerId, ach.xpReward);
    }

    // Activity log
    await client.query(
      `INSERT INTO activity_log (player_id, type, message, amount)
       VALUES ($1, 'ACHIEVEMENT', $2, $3)`,
      [playerId, `${ach.icon} Achievement: ${ach.title}`, ach.xpReward],
    );

    newAchievements.push(ach.title);
  }

  return newAchievements;
}

/** Get all achievements for a player */
export async function getPlayerAchievements(playerId: string): Promise<{ key: string; title: string; description: string; icon: string; xp_reward: number; unlocked_at: string }[]> {
  const { query } = await import('../db/client.js');
  const res = await query(
    'SELECT key, title, description, icon, xp_reward, unlocked_at FROM achievements WHERE player_id = $1 ORDER BY unlocked_at DESC',
    [playerId],
  );
  return res.rows as any;
}

/** Get all achievement definitions (for showing locked ones) */
export function getAllAchievementDefs() {
  return ACHIEVEMENT_DEFS.map(a => ({ key: a.key, title: a.title, description: a.description, icon: a.icon, xpReward: a.xpReward }));
}
