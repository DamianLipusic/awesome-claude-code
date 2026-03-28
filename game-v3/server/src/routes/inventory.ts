import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const TransferSchema = z.object({
  to_business_id: z.string().uuid(),
  item_id: z.string().uuid(),
  quantity: z.number().positive(),
});

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // ─── GET /businesses/:bizId/inventory — inventory + logs ──────
  app.get('/businesses/:bizId/inventory', async (req: FastifyRequest, reply: FastifyReply) => {
    const { bizId } = req.params as { bizId: string };

    // Verify business ownership
    const bizRes = await query<{ id: string }>(
      `SELECT id FROM businesses WHERE id = $1 AND owner_id = $2 AND status != 'shutdown'`,
      [bizId, req.player.id],
    );
    if (!bizRes.rows.length) {
      return reply.status(404).send({ error: 'Business not found' });
    }

    // Inventory items
    const invRes = await query(
      `SELECT inv.id, inv.item_id, inv.amount, inv.reserved, inv.dirty_amount,
              i.key, i.name, i.category, i.base_price
       FROM inventory inv
       JOIN items i ON i.id = inv.item_id
       WHERE inv.business_id = $1
       ORDER BY i.production_stage`,
      [bizId],
    );

    // Last 20 inventory logs
    const logRes = await query(
      `SELECT il.delta, il.reason, il.created_at, i.name AS item_name
       FROM inventory_log il
       JOIN items i ON i.id = il.item_id
       WHERE il.business_id = $1
       ORDER BY il.created_at DESC
       LIMIT 20`,
      [bizId],
    );

    return reply.send({
      data: {
        inventory: invRes.rows,
        logs: logRes.rows,
      },
    });
  });

  // ─── POST /businesses/:bizId/inventory/transfer — transfer items ──
  app.post('/businesses/:bizId/inventory/transfer', async (req: FastifyRequest, reply: FastifyReply) => {
    const { bizId } = req.params as { bizId: string };
    const parsed = TransferSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { to_business_id, item_id, quantity } = parsed.data;

    // Check both businesses owned by player
    const bizCheck = await query<{ id: string }>(
      `SELECT id FROM businesses WHERE id IN ($1, $2) AND owner_id = $3 AND status != 'shutdown'`,
      [bizId, to_business_id, req.player.id],
    );
    if (bizCheck.rows.length < 2) {
      return reply.status(400).send({ error: 'Both businesses must exist and be owned by you' });
    }
    if (bizId === to_business_id) {
      return reply.status(400).send({ error: 'Cannot transfer to the same business' });
    }

    // Check source has enough
    const srcInv = await query<{ amount: string; reserved: string }>(
      `SELECT amount, reserved FROM inventory WHERE business_id = $1 AND item_id = $2`,
      [bizId, item_id],
    );
    if (!srcInv.rows.length) {
      return reply.status(400).send({ error: 'Item not found in source inventory' });
    }
    const available = Number(srcInv.rows[0].amount) - Number(srcInv.rows[0].reserved);
    if (available < quantity) {
      return reply.status(400).send({ error: `Not enough available. Have ${available}, need ${quantity}` });
    }

    await withTransaction(async (client) => {
      // Deduct from source
      await client.query(
        `UPDATE inventory SET amount = amount - $1, updated_at = NOW() WHERE business_id = $2 AND item_id = $3`,
        [quantity, bizId, item_id],
      );
      // Add to target (upsert)
      await client.query(
        `INSERT INTO inventory (business_id, item_id, amount, reserved, dirty_amount)
         VALUES ($1, $2, $3, 0, 0)
         ON CONFLICT (business_id, item_id) DO UPDATE SET amount = inventory.amount + $3, updated_at = NOW()`,
        [to_business_id, item_id, quantity],
      );
      // Log source
      await client.query(
        `INSERT INTO inventory_log (business_id, item_id, delta, reason)
         VALUES ($1, $2, $3, 'transfer_out')`,
        [bizId, item_id, -quantity],
      );
      // Log target
      await client.query(
        `INSERT INTO inventory_log (business_id, item_id, delta, reason)
         VALUES ($1, $2, $3, 'transfer_in')`,
        [to_business_id, item_id, quantity],
      );
      // Activity log
      await client.query(
        `INSERT INTO activity_log (player_id, business_id, type, message, amount)
         VALUES ($1, $2, 'inventory_transfer', $3, 0)`,
        [req.player.id, bizId, `Transferred ${quantity} items`],
      );
    });

    return reply.send({ data: { message: `Transferred ${quantity} items`, from: bizId, to: to_business_id } });
  });
}
