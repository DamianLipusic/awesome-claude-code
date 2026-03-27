import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';

// ─── Input schemas ────────────────────────────────────────────

const CreateContractSchema = z.object({
  resource_id: z.string().uuid(),
  quantity_per_period: z.number().int().positive(),
  price_per_unit: z.number().positive(),
  period: z.enum(['DAILY', 'WEEKLY']),
  duration_periods: z.number().int().positive(),
  breach_penalty: z.number().min(0).optional().default(0),
  delivery_city: z.string().min(1),
  counterparty_id: z.string().uuid().nullable().optional(),
});

const ExclusiveContractSchema = z.object({
  resource_id: z.string().uuid(),
  quantity_per_period: z.number().int().positive(),
  price_per_unit: z.number().positive(),
  period: z.enum(['DAILY', 'WEEKLY']),
  duration_periods: z.number().int().positive(),
  delivery_city: z.string().min(1),
  counterparty_id: z.string().uuid(),
  exclusivity_premium: z.number().min(0.1).max(1.0).optional().default(0.25),
});

const ProfitShareSchema = z.object({
  partner_id: z.string().uuid(),
  business_id: z.string().uuid(),
  share_percent: z.number().min(1).max(99),
});

const BreachSchema = z.object({
  contract_id: z.string().uuid(),
  breach_type: z.enum(['NON_DELIVERY', 'QUALITY_ISSUE', 'LATE_DELIVERY', 'PRICE_MANIPULATION']),
});

// ─── Route plugin ─────────────────────────────────────────────

export async function contractRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /contracts — my active + pending contracts (as initiator or counterparty)
  fastify.get(
    '/',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id; const playerSeasonId = request.player.season_id;

      const result = await query(
        `SELECT
           tc.id,
           tc.season_id,
           tc.initiator_id,
           pi.username AS initiator_username,
           tc.counterparty_id,
           pc.username AS counterparty_username,
           tc.resource_id,
           r.name AS resource_name,
           tc.quantity_per_period,
           tc.price_per_unit,
           tc.period,
           tc.duration_periods,
           tc.periods_completed,
           tc.status,
           tc.created_at,
           tc.next_settlement,
           tc.breach_penalty,
           tc.auto_renew,
           tc.price_locked,
           tc.delivery_city
         FROM trade_contracts tc
         JOIN players pi ON pi.id = tc.initiator_id
         LEFT JOIN players pc ON pc.id = tc.counterparty_id
         JOIN resources r ON r.id = tc.resource_id
         WHERE tc.season_id = $1
           AND (tc.initiator_id = $2 OR tc.counterparty_id = $2)
           AND tc.status IN ('ACTIVE', 'PENDING')
         ORDER BY tc.created_at DESC`,
        [playerSeasonId, playerId],
      );

      // Enhance with computed lifecycle fields
      const enhanced = result.rows.map((c: any) => {
        const periodsRemaining = c.duration_periods - (c.periods_completed ?? 0);
        const totalValue = c.quantity_per_period * parseFloat(c.price_per_unit) * c.duration_periods;
        const earnedSoFar = c.quantity_per_period * parseFloat(c.price_per_unit) * (c.periods_completed ?? 0);
        return {
          ...c,
          periods_remaining: periodsRemaining,
          total_contract_value: parseFloat(totalValue.toFixed(2)),
          earned_so_far: parseFloat(earnedSoFar.toFixed(2)),
          completion_pct: c.duration_periods > 0 ? Math.round(((c.periods_completed ?? 0) / c.duration_periods) * 100) : 0,
        };
      });

      return reply.send({ data: enhanced });
    },
  );

  // GET /contracts/open — all PENDING open offers (counterparty_id IS NULL), paginated
  fastify.get(
    '/open',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerSeasonId = request.player.season_id;
      const { offset } = request.query as { offset?: string };
      const limit = 20;
      const offsetVal = parseInt(offset ?? '0', 10);

      const result = await query(
        `SELECT
           tc.id,
           tc.season_id,
           tc.initiator_id,
           p.username AS initiator_username,
           tc.resource_id,
           r.name AS resource_name,
           tc.quantity_per_period,
           tc.price_per_unit,
           tc.period,
           tc.duration_periods,
           tc.periods_completed,
           tc.status,
           tc.created_at,
           tc.breach_penalty,
           tc.delivery_city
         FROM trade_contracts tc
         JOIN players p ON p.id = tc.initiator_id
         JOIN resources r ON r.id = tc.resource_id
         WHERE tc.season_id = $1
           AND tc.status = 'PENDING'
           AND tc.counterparty_id IS NULL
         ORDER BY tc.created_at DESC
         LIMIT $2 OFFSET $3`,
        [playerSeasonId, limit, offsetVal],
      );

      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM trade_contracts
         WHERE season_id = $1
           AND status = 'PENDING'
           AND counterparty_id IS NULL`,
        [playerSeasonId],
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      return reply.send({
        data: {
          items: result.rows,
          total,
          limit,
          offset: offsetVal,
        },
      });
    },
  );

  // POST /contracts — create a new contract or open offer
  fastify.post(
    '/',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id; const playerSeasonId = request.player.season_id;
      const parsed = CreateContractSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0].message });
      }
      const {
        resource_id,
        quantity_per_period,
        price_per_unit,
        period,
        duration_periods,
        breach_penalty,
        delivery_city,
        counterparty_id,
      } = parsed.data;

      // Validate resource exists in this season
      const resourceCheck = await query<{ id: string }>(
        `SELECT id FROM resources WHERE id = $1 AND season_id = $2`,
        [resource_id, playerSeasonId],
      );
      if (!resourceCheck.rows.length) {
        return reply.status(400).send({ error: 'Resource not found in current season' });
      }

      try {
        const contract = await withTransaction(async (client) => {
          // Validate counterparty exists if provided
          if (counterparty_id) {
            const cpRow = await client.query<{ id: string }>(
              `SELECT id FROM players WHERE id = $1 AND season_id = $2`,
              [counterparty_id, playerSeasonId],
            );
            if (!cpRow.rows.length) {
              throw Object.assign(new Error('Counterparty player not found'), { statusCode: 404 });
            }
            if (counterparty_id === playerId) {
              throw Object.assign(new Error('Cannot create a contract with yourself'), { statusCode: 400 });
            }
          }

          const settlementInterval = period === 'DAILY' ? '1 day' : '7 days';
          const insertResult = await client.query(
            `INSERT INTO trade_contracts
               (season_id, initiator_id, counterparty_id, resource_id, quantity_per_period,
                price_per_unit, period, duration_periods, periods_completed, status,
                breach_penalty, delivery_city, auto_renew, price_locked,
                next_settlement, created_at)
             VALUES
               ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'PENDING', $9, $10, FALSE, FALSE,
                NOW() + $11::interval,
                NOW())
             RETURNING *`,
            [
              playerSeasonId,
              playerId,
              counterparty_id ?? null,
              resource_id,
              quantity_per_period,
              price_per_unit,
              period,
              duration_periods,
              breach_penalty,
              delivery_city,
              settlementInterval,
            ],
          );

          const contract = insertResult.rows[0];

          // Notify counterparty if specified
          if (counterparty_id) {
            await client.query(
              `INSERT INTO alerts (player_id, season_id, type, message, created_at, read, data)
               VALUES ($1, $2, 'MARKET_CONTRACT_OFFER',
                 'You have received a new trade contract offer', NOW(), FALSE, $3)`,
              [
                counterparty_id,
                playerSeasonId,
                JSON.stringify({ contract_id: contract.id, initiator_id: playerId }),
              ],
            );
          }

          return contract;
        });

        return reply.status(201).send({ data: contract });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // POST /contracts/:id/accept
  fastify.post(
    '/:id/accept',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id; const playerSeasonId = request.player.season_id;
      const { id: contractId } = request.params as { id: string };

      try {
        const contract = await withTransaction(async (client) => {
          const contractRow = await client.query<{
            id: string;
            initiator_id: string;
            counterparty_id: string | null;
            status: string;
            period: string;
          }>(
            `SELECT * FROM trade_contracts WHERE id = $1 AND season_id = $2 FOR UPDATE`,
            [contractId, playerSeasonId],
          );
          if (!contractRow.rows.length) {
            throw Object.assign(new Error('Contract not found'), { statusCode: 404 });
          }
          const ct = contractRow.rows[0];

          if (ct.status !== 'PENDING') {
            throw Object.assign(new Error(`Cannot accept a contract with status '${ct.status}'`), { statusCode: 400 });
          }
          if (ct.counterparty_id !== null && ct.counterparty_id !== playerId) {
            throw Object.assign(new Error('This contract is not open for you to accept'), { statusCode: 403 });
          }
          if (ct.initiator_id === playerId) {
            throw Object.assign(new Error('Cannot accept your own contract'), { statusCode: 400 });
          }

          const updateResult = await client.query(
            `UPDATE trade_contracts
             SET status = 'ACTIVE',
                 counterparty_id = $1,
                 next_settlement = NOW() + CASE period WHEN 'DAILY' THEN INTERVAL '1 day' ELSE INTERVAL '7 days' END
             WHERE id = $2
             RETURNING *`,
            [playerId, contractId],
          );

          // Notify initiator
          await client.query(
            `INSERT INTO alerts (player_id, season_id, type, message, created_at, read, data)
             VALUES ($1, $2, 'MARKET_CONTRACT_OFFER',
               'Your contract offer has been accepted', NOW(), FALSE, $3)`,
            [
              ct.initiator_id,
              playerSeasonId,
              JSON.stringify({ contract_id: contractId, counterparty_id: playerId }),
            ],
          );

          return updateResult.rows[0];
        });

        return reply.send({ data: contract });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // DELETE /contracts/:id — cancel a PENDING contract you initiated
  fastify.delete(
    '/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id; const playerSeasonId = request.player.season_id;
      const { id: contractId } = request.params as { id: string };

      try {
        await withTransaction(async (client) => {
          const contractRow = await client.query<{
            id: string;
            initiator_id: string;
            status: string;
          }>(
            `SELECT id, initiator_id, status
             FROM trade_contracts
             WHERE id = $1 AND season_id = $2
             FOR UPDATE`,
            [contractId, playerSeasonId],
          );
          if (!contractRow.rows.length) {
            throw Object.assign(new Error('Contract not found'), { statusCode: 404 });
          }
          const ct = contractRow.rows[0];

          if (ct.initiator_id !== playerId) {
            throw Object.assign(new Error('Only the initiator can cancel this contract'), { statusCode: 403 });
          }
          if (ct.status !== 'PENDING') {
            throw Object.assign(
              new Error(`Cannot cancel a contract with status '${ct.status}'`),
              { statusCode: 400 },
            );
          }

          await client.query(
            `UPDATE trade_contracts SET status = 'CANCELLED' WHERE id = $1`,
            [contractId],
          );
        });

        return reply.send({ data: { cancelled: true } });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // ─── Phase 3: Contract System V2 ──────────────────────────

  // POST /contracts/exclusive — Create exclusive supply contract (higher price, penalty for breaking)
  fastify.post(
    '/exclusive',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const playerSeasonId = request.player.season_id;
      const parsed = ExclusiveContractSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
      const { resource_id, quantity_per_period, price_per_unit, period, duration_periods, delivery_city, counterparty_id, exclusivity_premium } = parsed.data;
      if (counterparty_id === playerId) return reply.status(400).send({ error: "Cannot create a contract with yourself" });
      try {
        const contract = await withTransaction(async (client) => {
          // Validate resource
          const resourceCheck = await client.query<{ id: string }>("SELECT id FROM resources WHERE id = $1 AND season_id = $2", [resource_id, playerSeasonId]);
          if (!resourceCheck.rows.length) throw Object.assign(new Error("Resource not found in current season"), { statusCode: 400 });
          // Validate counterparty
          const cpRow = await client.query<{ id: string }>("SELECT id FROM players WHERE id = $1 AND season_id = $2", [counterparty_id, playerSeasonId]);
          if (!cpRow.rows.length) throw Object.assign(new Error("Counterparty player not found"), { statusCode: 404 });
          // Exclusive price = base price * (1 + premium)
          const exclusivePrice = Math.ceil(price_per_unit * (1 + exclusivity_premium));
          // Breach penalty = total contract value * 0.5
          const breachPenalty = Math.ceil(exclusivePrice * quantity_per_period * duration_periods * 0.5);
          const settlementInterval = period === 'DAILY' ? '1 day' : '7 days';
          const insertResult = await client.query(
            `INSERT INTO trade_contracts
               (season_id, initiator_id, counterparty_id, resource_id, quantity_per_period,
                price_per_unit, period, duration_periods, periods_completed, status,
                breach_penalty, delivery_city, auto_renew, price_locked,
                next_settlement, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'PENDING', $9, $10, FALSE, TRUE,
                NOW() + $11::interval, NOW())
             RETURNING *`,
            [playerSeasonId, playerId, counterparty_id, resource_id, quantity_per_period,
             exclusivePrice, period, duration_periods, breachPenalty, delivery_city, settlementInterval]
          );
          const contract = insertResult.rows[0];
          await client.query(
            `INSERT INTO alerts (player_id, season_id, type, message, created_at, read, data)
             VALUES ($1, $2, 'MARKET_CONTRACT_OFFER',
               'You have received an exclusive supply contract offer', NOW(), FALSE, $3)`,
            [counterparty_id, playerSeasonId, JSON.stringify({ contract_id: contract.id, initiator_id: playerId, exclusive: true })]
          );
          return { ...contract, exclusive: true, exclusivity_premium, calculated_breach_penalty: breachPenalty };
        });
        return reply.status(201).send({ data: contract });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // POST /contracts/:id/breach — Report a contract breach
  fastify.post(
    '/:id/breach',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const playerSeasonId = request.player.season_id;
      const { id: contractId } = request.params as { id: string };
      const parsed = BreachSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
      const { breach_type } = parsed.data;
      try {
        const result = await withTransaction(async (client) => {
          const contractRow = await client.query<{ id: string; initiator_id: string; counterparty_id: string; status: string; breach_penalty: string }>(
            "SELECT id, initiator_id, counterparty_id, status, breach_penalty FROM trade_contracts WHERE id = $1 AND season_id = $2 FOR UPDATE",
            [contractId, playerSeasonId]
          );
          if (!contractRow.rows.length) throw Object.assign(new Error("Contract not found"), { statusCode: 404 });
          const ct = contractRow.rows[0];
          if (ct.status !== 'ACTIVE') throw Object.assign(new Error("Can only report breach on active contracts"), { statusCode: 400 });
          if (ct.initiator_id !== playerId && ct.counterparty_id !== playerId) {
            throw Object.assign(new Error("Not a party to this contract"), { statusCode: 403 });
          }
          // Determine the breaching party (the other party)
          const breachingPartyId = ct.initiator_id === playerId ? ct.counterparty_id : ct.initiator_id;
          const penaltyAmount = Number(ct.breach_penalty);
          // Apply penalty if > 0
          if (penaltyAmount > 0) {
            await client.query("UPDATE players SET cash = GREATEST(0, cash - $1) WHERE id = $2", [penaltyAmount, breachingPartyId]);
            await client.query("UPDATE players SET cash = cash + $1 WHERE id = $2", [penaltyAmount, playerId]);
          }
          // Mark contract as breached
          await client.query("UPDATE trade_contracts SET status = 'BREACHED' WHERE id = $1", [contractId]);
          // Log the breach
          const breachRow = await client.query<{ id: string }>(
            "INSERT INTO contract_breaches (contract_id, reporter_id, breach_type, penalty_amount, status) VALUES ($1, $2, $3, $4, 'REPORTED') RETURNING id",
            [contractId, playerId, breach_type, penaltyAmount]
          );
          // Decrease trust between parties
          const [pA, pB] = [playerId, breachingPartyId].sort();
          await client.query(
            `INSERT INTO trust_levels (player_a, player_b, trust_score, betrayal_count)
             VALUES ($1, $2, 30, 1)
             ON CONFLICT (player_a, player_b)
             DO UPDATE SET trust_score = GREATEST(0, trust_levels.trust_score - 20), betrayal_count = trust_levels.betrayal_count + 1, updated_at = NOW()`,
            [pA, pB]
          );
          return { breach_id: breachRow.rows[0].id, contract_id: contractId, breach_type, penalty_applied: penaltyAmount, breaching_party: breachingPartyId };
        });
        return reply.send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // GET /contracts/dependencies — Show contract dependency chain
  fastify.get(
    '/dependencies',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const playerSeasonId = request.player.season_id;
      // Get all active contracts for this player, grouped by resource
      const result = await query(
        `SELECT
           tc.id,
           tc.resource_id,
           r.name AS resource_name,
           tc.initiator_id,
           tc.counterparty_id,
           pi.username AS initiator_username,
           pc.username AS counterparty_username,
           tc.quantity_per_period,
           tc.price_per_unit,
           tc.period,
           tc.status,
           CASE WHEN tc.initiator_id = $1 THEN 'SUPPLIER' ELSE 'BUYER' END AS role
         FROM trade_contracts tc
         JOIN players pi ON pi.id = tc.initiator_id
         LEFT JOIN players pc ON pc.id = tc.counterparty_id
         JOIN resources r ON r.id = tc.resource_id
         WHERE tc.season_id = $2
           AND (tc.initiator_id = $1 OR tc.counterparty_id = $1)
           AND tc.status = 'ACTIVE'
         ORDER BY r.name, tc.created_at`,
        [playerId, playerSeasonId]
      );
      // Group by resource to show dependency chains
      const deps: Record<string, { resource_name: string; supply_contracts: unknown[]; buy_contracts: unknown[] }> = {};
      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        const resourceId = r.resource_id as string;
        if (!deps[resourceId]) {
          deps[resourceId] = { resource_name: r.resource_name as string, supply_contracts: [], buy_contracts: [] };
        }
        if (r.role === 'SUPPLIER') {
          deps[resourceId].supply_contracts.push(r);
        } else {
          deps[resourceId].buy_contracts.push(r);
        }
      }
      return reply.send({ data: deps });
    },
  );

  // POST /contracts/profit-share — Create profit-sharing agreement between players
  fastify.post(
    '/profit-share',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const playerId = request.player.id;
      const parsed = ProfitShareSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
      const { partner_id, business_id, share_percent } = parsed.data;
      if (partner_id === playerId) return reply.status(400).send({ error: "Cannot create profit share with yourself" });
      try {
        const result = await withTransaction(async (client) => {
          // Verify business ownership
          const bizRow = await client.query<{ id: string; owner_id: string }>(
            "SELECT id, owner_id FROM businesses WHERE id = $1 AND owner_id = $2 AND status != 'BANKRUPT'",
            [business_id, playerId]
          );
          if (!bizRow.rows.length) throw Object.assign(new Error("Business not found or not owned by you"), { statusCode: 404 });
          // Verify partner exists
          const partnerCheck = await client.query("SELECT id FROM players WHERE id = $1", [partner_id]);
          if (!partnerCheck.rows.length) throw Object.assign(new Error("Partner player not found"), { statusCode: 404 });
          // Check for existing profit share on this business
          const existing = await client.query(
            "SELECT id FROM profit_shares WHERE business_id = $1",
            [business_id]
          );
          if (existing.rows.length) throw Object.assign(new Error("A profit share already exists for this business"), { statusCode: 409 });
          const psRow = await client.query<{ id: string }>(
            "INSERT INTO profit_shares (player_a, player_b, business_id, share_percent) VALUES ($1, $2, $3, $4) RETURNING id",
            [playerId, partner_id, business_id, share_percent]
          );
          return { profit_share_id: psRow.rows[0].id, business_id, partner_id, share_percent };
        });
        return reply.status(201).send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );
}
