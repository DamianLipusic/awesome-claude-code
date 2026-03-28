import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import pool, { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { XP_REWARDS } from '../config/game.config.js';
import { awardXP } from '../lib/xp.js';
import { checkAchievements } from '../lib/achievements.js';

export async function actionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // POST /sell-all — sell all inventory across all businesses at 95% market price
  app.post('/sell-all', async (req: FastifyRequest, reply: FastifyReply) => {
    const playerId = req.player.id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get all sellable inventory (amount - reserved > 0)
      const invRes = await client.query(`
        SELECT inv.id, inv.business_id, inv.item_id, inv.amount, inv.reserved,
               i.key AS item_key, i.name AS item_name, i.base_price,
               b.name AS business_name
        FROM inventory inv
        JOIN items i ON i.id = inv.item_id
        JOIN businesses b ON b.id = inv.business_id
        WHERE b.owner_id = $1 AND b.status != 'shutdown'
          AND inv.amount - inv.reserved > 0
        ORDER BY i.name
      `, [playerId]);

      if (invRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.send({ data: { sold: 0, total_revenue: 0, items: [] } });
      }

      let totalRevenue = 0;
      const soldItems: { item: string; quantity: number; revenue: number; business: string }[] = [];

      for (const row of invRes.rows) {
        const sellQty = Number(row.amount) - Number(row.reserved);
        if (sellQty <= 0) continue;

        // Get current market price
        const priceRes = await client.query(`
          SELECT COALESCE(
            (SELECT AVG(ml.price_per_unit) FROM market_listings ml
             WHERE ml.item_id = $1 AND ml.status = 'open'
             AND ml.created_at > NOW() - INTERVAL '24 hours'),
            $2
          )::numeric(18,2) AS price
        `, [row.item_id, row.base_price]);
        const price = Number(priceRes.rows[0].price) * 0.95;
        const revenue = Math.round(sellQty * price * 100) / 100;

        // Deduct inventory
        await client.query(
          `UPDATE inventory SET amount = amount - $1, updated_at = NOW() WHERE id = $2`,
          [sellQty, row.id],
        );

        // Log inventory change
        await client.query(
          `INSERT INTO inventory_log (business_id, item_id, delta, reason) VALUES ($1, $2, $3, 'sell_all')`,
          [row.business_id, row.item_id, -sellQty],
        );

        totalRevenue += revenue;
        soldItems.push({
          item: row.item_name,
          quantity: sellQty,
          revenue,
          business: row.business_name,
        });
      }

      // Add revenue to player cash
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [totalRevenue, playerId],
      );

      // Activity log
      await client.query(
        `INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'SELL_ALL', $2, $3)`,
        [playerId, `Sold all inventory: ${soldItems.length} items for $${totalRevenue.toFixed(2)}`, totalRevenue],
      );

      // XP
      const xpAmount = XP_REWARDS.SELL_PER_1000 * Math.floor(totalRevenue / 1000);
      if (xpAmount > 0) {
        await awardXP(client, playerId, xpAmount);
      }

      // Check achievements
      await checkAchievements(client, playerId);

      await client.query('COMMIT');

      return reply.send({
        data: {
          sold: soldItems.reduce((s, i) => s + i.quantity, 0),
          total_revenue: totalRevenue,
          items: soldItems,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /auto-supply — transfer raw/intermediate materials to businesses that need them
  app.post('/auto-supply', async (req: FastifyRequest, reply: FastifyReply) => {
    const playerId = req.player.id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Find businesses with recipes that need inputs
      const needsRes = await client.query(`
        SELECT b.id AS biz_id, b.name AS biz_name, b.type,
               ri.item_id AS needed_item_id, ri.quantity_per_unit,
               i.key AS item_key, i.name AS item_name,
               COALESCE((SELECT inv.amount - inv.reserved FROM inventory inv
                         WHERE inv.business_id = b.id AND inv.item_id = ri.item_id), 0) AS current_stock
        FROM businesses b
        JOIN recipes r ON r.id = b.recipe_id
        JOIN recipe_inputs ri ON ri.recipe_id = r.id
        JOIN items i ON i.id = ri.item_id
        WHERE b.owner_id = $1 AND b.status = 'active'
        ORDER BY current_stock ASC
      `, [playerId]);

      // Find businesses that HAVE those items as output (sources)
      const sourcesRes = await client.query(`
        SELECT b.id AS biz_id, b.name AS biz_name,
               inv.item_id, inv.amount - inv.reserved AS available,
               i.key AS item_key, i.name AS item_name
        FROM businesses b
        JOIN inventory inv ON inv.business_id = b.id
        JOIN items i ON i.id = inv.item_id
        WHERE b.owner_id = $1 AND b.status = 'active'
          AND inv.amount - inv.reserved > 0
      `, [playerId]);

      // Build source map: item_id → [{biz_id, available}]
      const sourceMap = new Map<string, { biz_id: string; biz_name: string; available: number }[]>();
      for (const src of sourcesRes.rows) {
        if (!sourceMap.has(src.item_id)) sourceMap.set(src.item_id, []);
        sourceMap.get(src.item_id)!.push({
          biz_id: src.biz_id,
          biz_name: src.biz_name,
          available: Number(src.available),
        });
      }

      const transfers: { from: string; to: string; item: string; quantity: number }[] = [];

      for (const need of needsRes.rows) {
        const sources = sourceMap.get(need.needed_item_id);
        if (!sources || sources.length === 0) continue;

        // Don't transfer to self
        const externalSources = sources.filter(s => s.biz_id !== need.biz_id);
        if (externalSources.length === 0) continue;

        // Transfer up to 20 units or whatever is available
        const targetAmount = 20;
        const currentStock = Number(need.current_stock);
        const needed = Math.max(0, targetAmount - currentStock);
        if (needed <= 0) continue;

        for (const source of externalSources) {
          if (source.available <= 0) continue;
          const transferQty = Math.min(needed, source.available);

          // Deduct from source
          await client.query(
            `UPDATE inventory SET amount = amount - $1, updated_at = NOW()
             WHERE business_id = $2 AND item_id = $3`,
            [transferQty, source.biz_id, need.needed_item_id],
          );
          await client.query(
            `INSERT INTO inventory_log (business_id, item_id, delta, reason) VALUES ($1, $2, $3, 'auto_supply_out')`,
            [source.biz_id, need.needed_item_id, -transferQty],
          );

          // Add to target (upsert)
          await client.query(`
            INSERT INTO inventory (business_id, item_id, amount)
            VALUES ($1, $2, $3)
            ON CONFLICT (business_id, item_id) DO UPDATE SET amount = inventory.amount + $3, updated_at = NOW()
          `, [need.biz_id, need.needed_item_id, transferQty]);
          await client.query(
            `INSERT INTO inventory_log (business_id, item_id, delta, reason) VALUES ($1, $2, $3, 'auto_supply_in')`,
            [need.biz_id, need.needed_item_id, transferQty],
          );

          source.available -= transferQty;
          transfers.push({
            from: source.biz_name,
            to: need.biz_name,
            item: need.item_name,
            quantity: transferQty,
          });
          break; // One source per need
        }
      }

      if (transfers.length > 0) {
        await client.query(
          `INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'AUTO_SUPPLY', $2, 0)`,
          [playerId, `Auto-supplied ${transfers.length} transfers`],
        );
      }

      await client.query('COMMIT');

      return reply.send({
        data: {
          transfers_count: transfers.length,
          transfers,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─── POST /deposit — move cash to bank ────────────────────────
  const AmountSchema = z.object({ amount: z.number().positive() });

  app.post('/deposit', async (req: FastifyRequest, reply: FastifyReply) => {
    const { amount } = AmountSchema.parse(req.body);
    const playerId = req.player.id;

    const playerRes = await query<{ cash: string }>('SELECT cash FROM players WHERE id = $1', [playerId]);
    const cash = Number(playerRes.rows[0]?.cash ?? 0);
    if (cash < amount) return reply.status(400).send({ error: `Not enough cash. Have $${cash.toFixed(2)}` });

    await query(
      'UPDATE players SET cash = cash - $1, bank_balance = bank_balance + $1 WHERE id = $2',
      [amount, playerId],
    );
    await query(
      "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'BANK_DEPOSIT', $2, $3)",
      [playerId, `Deposited $${amount.toFixed(2)} to bank`, -amount],
    );

    return reply.send({ data: { deposited: amount, message: `Deposited $${amount.toFixed(2)}` } });
  });

  // ─── POST /withdraw — move bank to cash ───────────────────────
  app.post('/withdraw', async (req: FastifyRequest, reply: FastifyReply) => {
    const { amount } = AmountSchema.parse(req.body);
    const playerId = req.player.id;

    const playerRes = await query<{ bank_balance: string }>('SELECT bank_balance FROM players WHERE id = $1', [playerId]);
    const bank = Number(playerRes.rows[0]?.bank_balance ?? 0);
    if (bank < amount) return reply.status(400).send({ error: `Not enough in bank. Have $${bank.toFixed(2)}` });

    await query(
      'UPDATE players SET cash = cash + $1, bank_balance = bank_balance - $1 WHERE id = $2',
      [amount, playerId],
    );
    await query(
      "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'BANK_WITHDRAW', $2, $3)",
      [playerId, `Withdrew $${amount.toFixed(2)} from bank`, amount],
    );

    return reply.send({ data: { withdrawn: amount, message: `Withdrew $${amount.toFixed(2)}` } });
  });
}
