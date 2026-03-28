import { withTransaction } from '../db/client.js';
import { AUTOSELL } from '../config/game.config.js';
import { broadcast } from '../websocket/connections.js';
import type { PoolClient } from 'pg';

interface SellableRow {
  business_id: string;
  owner_id: string;
  type: string;
  location_traffic: number;
  item_id: string;
  amount: number;
  reserved: number;
  item_key: string;
  item_name: string;
  base_price: string;
}

/** Get current market price for an item (avg of recent listings or fallback to base_price) */
async function getCurrentPrice(client: PoolClient, itemId: string): Promise<number> {
  const res = await client.query<{ current_price: string }>(
    `SELECT COALESCE(
       (SELECT AVG(ml.price_per_unit) FROM market_listings ml
        WHERE ml.item_id = $1 AND ml.status IN ('open','sold')
        AND ml.created_at > NOW() - INTERVAL '1 day'),
       (SELECT base_price FROM items WHERE id = $1)
     )::numeric(10,2) AS current_price`,
    [itemId],
  );
  return Number(res.rows[0]?.current_price ?? 0);
}

export async function runAutosellTick(): Promise<{ businesses_sold: number; total_revenue: number; duration_ms: number }> {
  const start = Date.now();
  let businessesSold = 0;
  let totalRevenue = 0;

  await withTransaction(async (client: PoolClient) => {
    // ─── 1. Load all active businesses with sellable inventory ───
    const res = await client.query<SellableRow>(
      `SELECT b.id AS business_id, b.owner_id, b.type,
              l.traffic AS location_traffic,
              inv.item_id, inv.amount::int AS amount, inv.reserved::int AS reserved,
              i.key AS item_key, i.name AS item_name, i.base_price
       FROM businesses b
       JOIN locations l ON l.id = b.location_id
       JOIN inventory inv ON inv.business_id = b.id
       JOIN items i ON i.id = inv.item_id
       WHERE b.status = 'active' AND b.auto_sell = TRUE AND inv.amount - inv.reserved > 0`,
    );

    // ─── 2. Process each sellable row ────────────────────────────
    const processedBusinesses = new Set<string>();

    for (const row of res.rows) {
      const sellable = row.amount - row.reserved;
      const demandCap = Math.floor(row.location_traffic * AUTOSELL.demandFactor);

      if (demandCap <= 0) continue;

      const sellQty = Math.min(sellable, demandCap);
      if (sellQty <= 0) continue;

      // Get current market price
      const currentPrice = await getCurrentPrice(client, row.item_id);
      const price = Math.round(currentPrice * AUTOSELL.priceModifier * 100) / 100;
      const revenue = Math.round(sellQty * price * 100) / 100;

      // Add revenue to player cash
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [revenue, row.owner_id],
      );

      // Deduct from inventory
      await client.query(
        `UPDATE inventory SET amount = amount - $1, updated_at = NOW()
         WHERE business_id = $2 AND item_id = $3`,
        [sellQty, row.business_id, row.item_id],
      );

      // Inventory log
      await client.query(
        `INSERT INTO inventory_log (business_id, item_id, delta, reason)
         VALUES ($1, $2, $3, 'autosell')`,
        [row.business_id, row.item_id, -sellQty],
      );

      // Activity log
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount)
         VALUES ($1, $2, 'AUTOSELL', $3, $4)`,
        [row.owner_id, row.business_id, `Auto-sold ${sellQty} ${row.item_name} for $${revenue.toFixed(2)}`, revenue],
      );

      processedBusinesses.add(row.business_id);
      totalRevenue += revenue;
    }

    businessesSold = processedBusinesses.size;
  });

  const duration_ms = Date.now() - start;

  // Log to game_ticks (outside transaction)
  const { query: dbQuery } = await import('../db/client.js');
  await dbQuery(
    `INSERT INTO game_ticks (tick_type, completed_at, duration_ms, stats)
     VALUES ('autosell', NOW(), $1, $2)`,
    [duration_ms, JSON.stringify({ businesses_sold: businessesSold, total_revenue: totalRevenue })],
  );

  broadcast('tick:autosell', { businesses_sold: businessesSold, total_revenue: totalRevenue });
  return { businesses_sold: businessesSold, total_revenue: totalRevenue, duration_ms };
}
