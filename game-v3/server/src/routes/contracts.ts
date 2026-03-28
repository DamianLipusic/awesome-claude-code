import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import pool, { query, withTransaction } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const OfferSchema = z.object({
  buyer_id: z.string().uuid(),
  item_id: z.string().uuid(),
  supplier_business_id: z.string().uuid(),
  quantity_per_cycle: z.number().int().positive(),
  cycle_hours: z.number().int().min(1).max(168).default(24),
  price_per_unit: z.number().positive(),
  penalty_per_miss: z.number().min(0).default(0),
  max_cycles: z.number().int().positive().optional(),
});

export async function contractRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET / — my contracts (as supplier or buyer)
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(`
      SELECT c.*, i.key AS item_key, i.name AS item_name,
        ps.username AS supplier_name, pb.username AS buyer_name
      FROM contracts c
      JOIN items i ON i.id = c.item_id
      JOIN players ps ON ps.id = c.supplier_id
      JOIN players pb ON pb.id = c.buyer_id
      WHERE c.supplier_id = $1 OR c.buyer_id = $1
      ORDER BY c.created_at DESC LIMIT 30
    `, [req.player.id]);
    return reply.send({ data: res.rows });
  });

  // POST /offer — create contract offer (you as supplier)
  app.post('/offer', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = OfferSchema.parse(req.body);
    const playerId = req.player.id;

    if (body.buyer_id === playerId) return reply.status(400).send({ error: "Can't contract with yourself" });

    // Verify business ownership
    const bizRes = await query(
      "SELECT id FROM businesses WHERE id = $1 AND owner_id = $2 AND status = 'active'",
      [body.supplier_business_id, playerId],
    );
    if (!bizRes.rows.length) return reply.status(404).send({ error: 'Business not found' });

    // Verify buyer exists
    const buyerRes = await query('SELECT username FROM players WHERE id = $1', [body.buyer_id]);
    if (!buyerRes.rows.length) return reply.status(404).send({ error: 'Buyer not found' });

    // Verify item exists
    const itemRes = await query<{ name: string }>('SELECT name FROM items WHERE id = $1', [body.item_id]);
    if (!itemRes.rows.length) return reply.status(404).send({ error: 'Item not found' });

    const seasonRes = await query<{ id: string }>("SELECT id FROM seasons WHERE status = 'active' LIMIT 1");

    const res = await query(
      `INSERT INTO contracts (season_id, supplier_id, buyer_id, item_id, supplier_business_id,
        quantity_per_cycle, cycle_hours, price_per_unit, penalty_per_miss, max_cycles)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [seasonRes.rows[0]?.id, playerId, body.buyer_id, body.item_id, body.supplier_business_id,
       body.quantity_per_cycle, body.cycle_hours, body.price_per_unit, body.penalty_per_miss, body.max_cycles ?? null],
    );

    await query(
      "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'CONTRACT_OFFER', $2, 0)",
      [playerId, `Offered ${body.quantity_per_cycle} ${itemRes.rows[0].name}/cycle to ${buyerRes.rows[0].username}`],
    );

    return reply.send({ data: { contract_id: res.rows[0].id, message: `Contract offered to ${buyerRes.rows[0].username}` } });
  });

  // POST /:id/accept — buyer accepts contract
  app.post('/:id/accept', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { business_id } = z.object({ business_id: z.string().uuid() }).parse(req.body);

    const contractRes = await query(
      "SELECT * FROM contracts WHERE id = $1 AND buyer_id = $2 AND status = 'pending'",
      [id, req.player.id],
    );
    if (!contractRes.rows.length) return reply.status(404).send({ error: 'Contract not found or not pending' });

    // Verify buyer's business
    const bizRes = await query(
      "SELECT id FROM businesses WHERE id = $1 AND owner_id = $2 AND status = 'active'",
      [business_id, req.player.id],
    );
    if (!bizRes.rows.length) return reply.status(404).send({ error: 'Business not found' });

    const contract = contractRes.rows[0];
    const cycleMs = Number(contract.cycle_hours) * 3600000;

    await query(
      `UPDATE contracts SET status = 'active', buyer_business_id = $1,
       next_delivery_at = NOW() + ($2 || ' hours')::interval WHERE id = $3`,
      [business_id, String(contract.cycle_hours), id],
    );

    await query(
      "INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'CONTRACT_ACCEPT', $2, 0)",
      [req.player.id, `Accepted supply contract #${id.slice(0, 8)}`],
    );

    return reply.send({ data: { message: 'Contract accepted. First delivery scheduled.' } });
  });

  // POST /:id/cancel — either party cancels
  app.post('/:id/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const playerId = req.player.id;

    const res = await query(
      `UPDATE contracts SET status = 'cancelled'
       WHERE id = $1 AND (supplier_id = $2 OR buyer_id = $2) AND status IN ('pending','active') RETURNING id`,
      [id, playerId],
    );
    if (!res.rows.length) return reply.status(404).send({ error: 'Contract not found' });

    return reply.send({ data: { message: 'Contract cancelled' } });
  });

  // GET /incoming — pending offers where I'm the buyer
  app.get('/incoming', async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(`
      SELECT c.*, i.name AS item_name, ps.username AS supplier_name
      FROM contracts c
      JOIN items i ON i.id = c.item_id
      JOIN players ps ON ps.id = c.supplier_id
      WHERE c.buyer_id = $1 AND c.status = 'pending'
      ORDER BY c.created_at DESC
    `, [req.player.id]);
    return reply.send({ data: res.rows });
  });
}

// ─── Contract Fulfillment (called during daily tick) ──────────────
export async function fulfillContracts(dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>): Promise<number> {
  const dueContracts = await dbQuery(
    "SELECT * FROM contracts WHERE status = 'active' AND next_delivery_at <= NOW()",
  );

  let fulfilled = 0;

  for (const contract of dueContracts.rows) {
    const supplierId = contract.supplier_id as string;
    const buyerId = contract.buyer_id as string;
    const supplierBizId = contract.supplier_business_id as string;
    const buyerBizId = contract.buyer_business_id as string;
    const itemId = contract.item_id as string;
    const qty = Number(contract.quantity_per_cycle);
    const pricePerUnit = Number(contract.price_per_unit);
    const penalty = Number(contract.penalty_per_miss);
    const cycleHours = Number(contract.cycle_hours);
    const maxCycles = contract.max_cycles ? Number(contract.max_cycles) : null;
    const cyclesCompleted = Number(contract.cycles_completed);

    // Check supplier inventory
    const invRes = await dbQuery(
      'SELECT amount, reserved FROM inventory WHERE business_id = $1 AND item_id = $2',
      [supplierBizId, itemId],
    );
    const available = invRes.rows.length ? Number(invRes.rows[0].amount) - Number(invRes.rows[0].reserved) : 0;

    if (available >= qty) {
      // Fulfill: transfer items + payment
      const totalPayment = qty * pricePerUnit;

      // Deduct from supplier
      await dbQuery('UPDATE inventory SET amount = amount - $1, updated_at = NOW() WHERE business_id = $2 AND item_id = $3', [qty, supplierBizId, itemId]);
      // Add to buyer
      await dbQuery(`
        INSERT INTO inventory (business_id, item_id, amount) VALUES ($1, $2, $3)
        ON CONFLICT (business_id, item_id) DO UPDATE SET amount = inventory.amount + $3, updated_at = NOW()
      `, [buyerBizId, itemId, qty]);
      // Payment: buyer → supplier
      await dbQuery('UPDATE players SET cash = cash - $1 WHERE id = $2', [totalPayment, buyerId]);
      await dbQuery('UPDATE players SET cash = cash + $1 WHERE id = $2', [totalPayment, supplierId]);

      // Update contract
      const newCycles = cyclesCompleted + 1;
      const done = maxCycles && newCycles >= maxCycles;
      await dbQuery(
        `UPDATE contracts SET cycles_completed = $1, next_delivery_at = $2, status = $3 WHERE id = $4`,
        [newCycles, done ? null : new Date(Date.now() + cycleHours * 3600000).toISOString(), done ? 'completed' : 'active', contract.id],
      );

      // Rep boost
      await dbQuery('UPDATE players SET rep_business = LEAST(100, rep_business + 1) WHERE id = $1', [supplierId]);
      fulfilled++;
    } else {
      // Miss: penalty
      if (penalty > 0) {
        await dbQuery('UPDATE players SET cash = GREATEST(0, cash - $1) WHERE id = $2', [penalty, supplierId]);
        await dbQuery('UPDATE players SET cash = cash + $1 WHERE id = $2', [penalty, buyerId]);
      }
      await dbQuery('UPDATE contracts SET cycles_missed = cycles_missed + 1, next_delivery_at = NOW() + ($1 || \' hours\')::interval WHERE id = $2', [String(cycleHours), contract.id]);
      await dbQuery("INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'CONTRACT_MISS', $2, $3)", [supplierId, `Missed delivery on contract #${(contract.id as string).slice(0, 8)}`, -penalty]);
    }
  }

  return fulfilled;
}
