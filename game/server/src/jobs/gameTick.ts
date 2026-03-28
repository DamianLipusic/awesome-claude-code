import { query, withTransaction } from '../db/client';

/**
 * V2 Game Tick — batched for performance
 * 1. Fetch all businesses with worker counts (single query)
 * 2. Calculate production for each
 * 3. Batch update inventory + batch insert activity logs (single transaction)
 * 4. Update net worth for all players (single query)
 */

const BUSINESS_CONFIG: Record<string, { prodPerWorker: number; product: string }> = {
  FARM:   { prodPerWorker: 8, product: 'Food' },
  MINE:   { prodPerWorker: 5, product: 'Ore' },
  RETAIL: { prodPerWorker: 6, product: 'Goods' },
};

export async function runGameTick(): Promise<{ duration_ms: number; businesses: number; produced: number }> {
  const start = Date.now();

  // Single query: get all businesses with worker counts
  const bizRes = await query<{
    id: string; owner_id: string; name: string; type: string; tier: number; worker_count: string;
  }>(
    `SELECT b.id, b.owner_id, b.name, b.type, b.tier,
            (SELECT COUNT(*) FROM workers w WHERE w.business_id = b.id)::text AS worker_count
     FROM businesses b`
  );

  // Calculate production for each business
  const productions: { id: string; owner_id: string; name: string; produced: number; product: string }[] = [];

  for (const biz of bizRes.rows) {
    const workers = Number(biz.worker_count);
    if (workers === 0) continue;

    const cfg = BUSINESS_CONFIG[biz.type];
    if (!cfg) continue;

    const produced = workers * cfg.prodPerWorker * biz.tier;
    productions.push({ id: biz.id, owner_id: biz.owner_id, name: biz.name, produced, product: cfg.product });
  }

  if (productions.length > 0) {
    // Single transaction: batch update inventory + batch insert activity logs
    await withTransaction(async (client) => {
      // Build batch inventory update using UNNEST
      const bizIds = productions.map(p => p.id);
      const amounts = productions.map(p => p.produced);

      await client.query(
        `UPDATE businesses b SET inventory = b.inventory + v.amount
         FROM (SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::int[]) AS amount) v
         WHERE b.id = v.id`,
        [bizIds, amounts]
      );

      // Build batch activity log insert using UNNEST
      const playerIds = productions.map(p => p.owner_id);
      const messages = productions.map(p => `${p.name} produced ${p.produced} ${p.product}`);
      const logAmounts = productions.map(p => p.produced);

      await client.query(
        `INSERT INTO activity_log (player_id, type, message, amount)
         SELECT UNNEST($1::uuid[]), 'PRODUCTION', UNNEST($2::text[]), UNNEST($3::numeric[])`,
        [playerIds, messages, logAmounts]
      );
    });
  }

  const totalBusinesses = productions.length;
  const totalProduced = productions.reduce((sum, p) => sum + p.produced, 0);

  // Single query: update net worth for all players
  await query(`
    UPDATE players p SET net_worth = p.cash + COALESCE((
      SELECT SUM(
        b.inventory * CASE b.type
          WHEN 'FARM' THEN 15 * b.tier
          WHEN 'MINE' THEN 25 * b.tier
          WHEN 'RETAIL' THEN 20 * b.tier
          ELSE 10
        END
      )
      FROM businesses b WHERE b.owner_id = p.id
    ), 0)
  `);

  const duration_ms = Date.now() - start;

  // Log tick
  await query(
    `INSERT INTO game_ticks (duration_ms, businesses_processed, goods_produced) VALUES ($1, $2, $3)`,
    [duration_ms, totalBusinesses, totalProduced]
  );

  return { duration_ms, businesses: totalBusinesses, produced: totalProduced };
}
