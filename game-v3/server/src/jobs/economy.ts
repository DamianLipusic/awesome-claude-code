import { withTransaction } from '../db/client.js';
import type { PoolClient } from 'pg';
import { evaluateDiscovery } from '../lib/discovery.js';
import { broadcast } from '../websocket/connections.js';
import { maybeCreateEvent, expireEvents } from '../lib/events.js';

interface ItemRow {
  id: string;
  key: string;
  base_price: string;
  production_stage: number;
  ai_supply: number;
}

const STAGE_THRESHOLDS: Record<string, number> = {
  raw: 200,
  intermediate: 100,
  finished: 50,
};

export async function runEconomyTick(): Promise<{ prices_updated: number; listings_added: number; discoveries_evaluated: number; duration_ms: number }> {
  const start = Date.now();
  let listingsAdded = 0;
  let pricesUpdated = 0;
  let discoveriesEvaluated = 0;

  await withTransaction(async (client: PoolClient) => {
    // ─── 1. Get active season ────────────────────────────────────
    const seasonRes = await client.query<{ id: string }>(
      `SELECT id FROM seasons WHERE status = 'active' LIMIT 1`,
    );
    if (!seasonRes.rows.length) {
      return; // No active season, nothing to do
    }
    const seasonId = seasonRes.rows[0].id;

    // ─── 2. AI market restock ────────────────────────────────────
    const itemsRes = await client.query<ItemRow>(
      `SELECT i.id, i.key, i.base_price, i.production_stage, i.category,
              COALESCE(SUM(CASE WHEN ml.seller_type = 'ai' AND ml.status = 'open' THEN ml.quantity ELSE 0 END), 0)::int AS ai_supply
       FROM items i
       LEFT JOIN market_listings ml ON ml.item_id = i.id
       GROUP BY i.id, i.key, i.base_price, i.production_stage, i.category`,
    );

    for (const item of itemsRes.rows) {
      const category = (item as unknown as { category: string }).category;
      const threshold = STAGE_THRESHOLDS[category] ?? 100;

      if (item.ai_supply < threshold) {
        const quantity = threshold - item.ai_supply;
        const basePrice = Number(item.base_price);
        // Price between 95% and 110% of base
        const price = Math.round(basePrice * (0.95 + Math.random() * 0.15) * 100) / 100;

        await client.query(
          `INSERT INTO market_listings (season_id, seller_type, seller_id, item_id, quantity, price_per_unit, status)
           VALUES ($1, 'ai', NULL, $2, $3, $4, 'open')`,
          [seasonId, item.id, quantity, price],
        );

        listingsAdded++;
      }
    }

    pricesUpdated = itemsRes.rows.length;

    // ─── 3. Employee stress update ───────────────────────────────
    await client.query(
      `UPDATE employees SET stress = LEAST(100, stress + 1)
       WHERE status = 'active' AND stress < 100`,
    );

    // ─── 4. Discovery evaluation ──────────────────────────────────
    try {
      discoveriesEvaluated = await evaluateDiscovery(client);
    } catch (err) {
      console.error('[economy] Discovery evaluation error:', err);
    }

    // ─── 5. Record price snapshots ────────────────────────────────
    try {
      await client.query(`
        INSERT INTO price_history (item_id, item_key, price)
        SELECT i.id, i.key,
          COALESCE(
            (SELECT AVG(ml.price_per_unit) FROM market_listings ml
             WHERE ml.item_id = i.id AND ml.status IN ('open','sold')
             AND ml.created_at > NOW() - INTERVAL '1 day'),
            i.base_price
          )::numeric(18,2)
        FROM items i
      `);
    } catch (err) {
      console.error('[economy] Price history error:', err);
    }

    // ─── 6. Events: expire old + maybe create new ───────────────
    try {
      const expired = await expireEvents(client);
      if (expired > 0) console.log(`[economy] Expired ${expired} event(s)`);
      const eventResult = await maybeCreateEvent(client);
      if (eventResult.created) console.log(`[economy] New event: ${eventResult.event}`);
    } catch (err) {
      console.error('[economy] Event error:', err);
    }
  });

  const duration_ms = Date.now() - start;

  // Log to game_ticks (outside transaction)
  const { query: dbQuery } = await import('../db/client.js');
  await dbQuery(
    `INSERT INTO game_ticks (tick_type, completed_at, duration_ms, stats)
     VALUES ('economy', NOW(), $1, $2)`,
    [duration_ms, JSON.stringify({ prices_updated: pricesUpdated, listings_added: listingsAdded, discoveries_evaluated: discoveriesEvaluated })],
  );

  broadcast('tick:economy', { prices_updated: pricesUpdated, listings_added: listingsAdded, discoveries_evaluated: discoveriesEvaluated });
  return { prices_updated: pricesUpdated, listings_added: listingsAdded, discoveries_evaluated: discoveriesEvaluated, duration_ms };
}
