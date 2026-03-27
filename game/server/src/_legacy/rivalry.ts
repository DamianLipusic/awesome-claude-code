import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { query, withTransaction } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { secureRandom, secureRandomInt } from "../lib/random";

const RIVALRY_LEVELS = {
  NEUTRAL:     { min: 0,  max: 20 },
  COMPETITIVE: { min: 21, max: 50 },
  HOSTILE:     { min: 51, max: 75 },
  WAR:         { min: 76, max: 90 },
  BLOOD_FEUD:  { min: 91, max: 100 },
} as const;
type RivalryLevel = keyof typeof RIVALRY_LEVELS;

interface SabotageConfig { cost: number; success_chance: number; rivalry_points: number; description: string; }
const SABOTAGE_TYPES: Record<string, SabotageConfig> = {
  ARSON:          { cost: 8000,  success_chance: 0.50, rivalry_points: 12, description: "Damage buildings -10% efficiency" },
  THEFT:          { cost: 5000,  success_chance: 0.60, rivalry_points: 8,  description: "Steal resources from rival" },
  POACH_EMPLOYEE: { cost: 10000, success_chance: 0.40, rivalry_points: 15, description: "Steal their best employee" },
  SPREAD_RUMORS:  { cost: 2000,  success_chance: 0.70, rivalry_points: 5,  description: "Reduce rival reputation" },
};
const FAILED_SABOTAGE_HEAT = 15;
const CEASEFIRE_REDUCTION = 20;
const TAKEOVER_MULTIPLIER = 3;
const COUNTER_BID_MULTIPLIER = 1.5;
const TAKEOVER_EXPIRY_TICKS = 288; // 24 hours in ticks (5-min ticks)

const SabotageSchema = z.object({
  target_player_id: z.string().uuid(),
  sabotage_type: z.enum(["ARSON", "THEFT", "POACH_EMPLOYEE", "SPREAD_RUMORS"]),
});

const TakeoverBidSchema = z.object({
  target_business_id: z.string().uuid(),
});

function getRivalryLevel(score: number): RivalryLevel {
  if (score >= 91) return "BLOOD_FEUD";
  if (score >= 76) return "WAR";
  if (score >= 51) return "HOSTILE";
  if (score >= 21) return "COMPETITIVE";
  return "NEUTRAL";
}

export async function rivalryRoutes(fastify: FastifyInstance): Promise<void> {

  // GET / - List player rivalries
  // rivalry_points: id, player_a, player_b, points, state, created_at, updated_at
  fastify.get("/", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const result = await query(
      `SELECT r.id, r.player_a, r.player_b, r.points, r.state, r.updated_at,
              pa.username AS player_a_username, pb.username AS player_b_username
         FROM rivalry_points r
         JOIN players pa ON pa.id = r.player_a
         JOIN players pb ON pb.id = r.player_b
        WHERE (r.player_a = $1 OR r.player_b = $1)
        ORDER BY r.points DESC`,
      [playerId]
    );
    const rivalries = result.rows.map((row: Record<string, unknown>) => ({
      ...row,
      level: getRivalryLevel(Number(row.points)),
    }));
    return reply.send({ data: rivalries });
  });

  // GET /:playerId - Get rivalry with specific player
  fastify.get("/:playerId", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { playerId: targetId } = request.params as { playerId: string };
    const result = await query(
      `SELECT r.*, pa.username AS player_a_username, pb.username AS player_b_username
         FROM rivalry_points r
         JOIN players pa ON pa.id = r.player_a
         JOIN players pb ON pb.id = r.player_b
        WHERE ((r.player_a = $1 AND r.player_b = $2) OR (r.player_a = $2 AND r.player_b = $1))`,
      [playerId, targetId]
    );
    if (!result.rows.length) {
      return reply.send({ data: { player_a: playerId, player_b: targetId, points: 0, level: "NEUTRAL" as const } });
    }
    const row = result.rows[0] as Record<string, unknown>;
    return reply.send({ data: { ...row, level: getRivalryLevel(Number(row.points)) } });
  });

  // POST /sabotage - Perform sabotage against a rival
  // sabotage_history: id, attacker_id, target_id, sabotage_type, damage, success, created_at
  fastify.post("/sabotage", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const parsed = SabotageSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { target_player_id, sabotage_type } = parsed.data;
    if (target_player_id === playerId) return reply.status(400).send({ error: "Cannot sabotage yourself" });
    const config = SABOTAGE_TYPES[sabotage_type];
    try {
      const result = await withTransaction(async (client) => {
        const targetCheck = await client.query("SELECT id FROM players WHERE id = $1", [target_player_id]);
        if (!targetCheck.rows.length) throw Object.assign(new Error("Target player not found"), { statusCode: 404 });
        const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (Number(playerRow.rows[0].cash) < config.cost) throw Object.assign(new Error("Insufficient cash: need " + config.cost), { statusCode: 400 });
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [config.cost, playerId]);
        const success = secureRandom() < config.success_chance;
        if (!success) {
          // heat_scores: score column (not heat)
          await client.query(
            "UPDATE heat_scores SET score = LEAST(100, score + $1), last_criminal_act = NOW() WHERE player_id = $2",
            [FAILED_SABOTAGE_HEAT, playerId]
          );
        } else {
          if (sabotage_type === 'ARSON') {
            await client.query(
              "UPDATE businesses SET efficiency = GREATEST(0, efficiency * 0.9) WHERE owner_id = $1",
              [target_player_id]
            );
          } else if (sabotage_type === 'THEFT') {
            const stolen = secureRandomInt(1000, 6000);
            await client.query("UPDATE players SET cash = GREATEST(0, cash - $1) WHERE id = $2", [stolen, target_player_id]);
            await client.query("UPDATE players SET cash = cash + $1 WHERE id = $2", [stolen, playerId]);
          } else if (sabotage_type === 'POACH_EMPLOYEE') {
            // Steal the target's highest-skill employee
            const bestEmp = await client.query<{ id: string; business_id: string; name: string }>(
              `SELECT e.id, e.business_id, e.name
               FROM employees e
               JOIN businesses b ON b.id = e.business_id
               WHERE b.owner_id = $1 AND b.status = 'ACTIVE'
               ORDER BY (e.efficiency + e.speed + e.reliability) DESC
               LIMIT 1
               FOR UPDATE OF e`,
              [target_player_id]
            );
            if (bestEmp.rows.length > 0) {
              const emp = bestEmp.rows[0];
              // Find attacker's first business to assign the poached employee
              const attackerBiz = await client.query<{ id: string }>(
                "SELECT id FROM businesses WHERE owner_id = $1 AND status = 'ACTIVE' LIMIT 1",
                [playerId]
              );
              if (attackerBiz.rows.length > 0) {
                await client.query(
                  "UPDATE employees SET business_id = $1, loyalty = GREATEST(0, loyalty - 30) WHERE id = $2",
                  [attackerBiz.rows[0].id, emp.id]
                );
              }
            }
          } else if (sabotage_type === 'SPREAD_RUMORS') {
            await client.query(
              "UPDATE reputation_profiles SET score = GREATEST(0, score - 5), updated_at = NOW() WHERE player_id = $1 AND axis = 'COMMUNITY'",
              [target_player_id]
            );
          }
        }
        const [pA, pB] = [playerId, target_player_id].sort();
        await client.query(
          `INSERT INTO rivalry_points (player_a, player_b, points, state)
           VALUES ($1, $2, $3, 'COMPETITIVE')
           ON CONFLICT (player_a, player_b)
           DO UPDATE SET points = LEAST(100, rivalry_points.points + $3), updated_at = NOW()`,
          [pA, pB, config.rivalry_points]
        );
        await client.query(
          "INSERT INTO sabotage_history (attacker_id, target_id, sabotage_type, damage, success) VALUES ($1, $2, $3, $4, $5)",
          [playerId, target_player_id, sabotage_type, config.cost, success]
        );
        return { success, sabotage_type, cost: config.cost, rivalry_points_added: config.rivalry_points, heat_added: success ? 0 : FAILED_SABOTAGE_HEAT };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // POST /ceasefire/:playerId - Propose/accept ceasefire (simplified - no ceasefire_proposals table)
  fastify.post("/ceasefire/:playerId", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { playerId: targetId } = request.params as { playerId: string };
    const [pA, pB] = [playerId, targetId].sort();
    const result = await query(
      `UPDATE rivalry_points SET points = GREATEST(0, points - $1), updated_at = NOW()
       WHERE player_a = $2 AND player_b = $3
       RETURNING *`,
      [CEASEFIRE_REDUCTION, pA, pB]
    );
    if (!result.rows.length) {
      return reply.send({ data: { status: "NO_RIVALRY", message: "No rivalry exists to reduce" } });
    }
    return reply.send({ data: { status: "CEASEFIRE_APPLIED", rivalry_reduction: CEASEFIRE_REDUCTION, new_points: Number(result.rows[0].points) } });
  });

  // GET /leaderboard - Top rivalries
  fastify.get("/leaderboard", { preHandler: [requireAuth] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await query(
      `SELECT r.player_a, r.player_b, r.points,
              pa.username AS player_a_username, pb.username AS player_b_username
         FROM rivalry_points r
         JOIN players pa ON pa.id = r.player_a
         JOIN players pb ON pb.id = r.player_b
        ORDER BY r.points DESC LIMIT 20`
    );
    const leaderboard = result.rows.map((row: Record<string, unknown>) => ({
      ...row,
      level: getRivalryLevel(Number(row.points)),
    }));
    return reply.send({ data: leaderboard });
  });

  // GET /history — Recent sabotage events involving this player
  fastify.get("/history", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { limit: limitStr } = request.query as { limit?: string };
    const limit = Math.min(50, parseInt(limitStr ?? '20', 10));

    const result = await query(
      `SELECT sh.id, sh.sabotage_type, sh.damage, sh.success, sh.created_at,
              sh.attacker_id, pa.username AS attacker_username,
              sh.target_id, pt.username AS target_username
         FROM sabotage_history sh
         JOIN players pa ON pa.id = sh.attacker_id
         JOIN players pt ON pt.id = sh.target_id
        WHERE sh.attacker_id = $1 OR sh.target_id = $1
        ORDER BY sh.created_at DESC
        LIMIT $2`,
      [playerId, limit]
    );

    const history = result.rows.map((row: any) => ({
      ...row,
      role: row.attacker_id === playerId ? 'attacker' : 'target',
    }));

    return reply.send({ data: history });
  });

  // ─── Phase 3: Hostile Takeover System ──────────────────────

  // POST /hostile-takeover/bid — Place a bid to take over another player's business
  fastify.post("/hostile-takeover/bid", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const parsed = TakeoverBidSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { target_business_id } = parsed.data;
    try {
      const result = await withTransaction(async (client) => {
        // Get business details
        const bizRow = await client.query<{ id: string; owner_id: string; total_revenue: string; daily_operating_cost: string; tier: number }>(
          "SELECT id, owner_id, total_revenue, daily_operating_cost, tier FROM businesses WHERE id = $1 AND status != 'BANKRUPT'",
          [target_business_id]
        );
        if (!bizRow.rows.length) throw Object.assign(new Error("Business not found"), { statusCode: 404 });
        const biz = bizRow.rows[0];
        if (biz.owner_id === playerId) throw Object.assign(new Error("Cannot take over your own business"), { statusCode: 400 });
        // Calculate business value (simple: tier * 10000 + total_revenue * 0.1)
        const businessValue = biz.tier * 10000 + Number(biz.total_revenue) * 0.1;
        const bidAmount = Math.ceil(businessValue * TAKEOVER_MULTIPLIER);
        // Check no active takeover on this business
        const existingTakeover = await client.query(
          "SELECT id FROM hostile_takeovers WHERE business_id = $1 AND status = 'PENDING'",
          [target_business_id]
        );
        if (existingTakeover.rows.length) throw Object.assign(new Error("An active takeover bid already exists for this business"), { statusCode: 409 });
        // Check player has enough cash
        const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (Number(playerRow.rows[0].cash) < bidAmount) throw Object.assign(new Error("Insufficient cash. Takeover costs " + bidAmount + " (3x business value)"), { statusCode: 400 });
        // Deduct and escrow bid amount
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [bidAmount, playerId]);
        // Expires in 288 ticks (~24h)
        const expiresAt = new Date(Date.now() + TAKEOVER_EXPIRY_TICKS * 5 * 60 * 1000); // 5 min per tick
        const takeoverRow = await client.query<{ id: string }>(
          "INSERT INTO hostile_takeovers (bidder_id, target_owner_id, business_id, bid_amount, status, expires_at) VALUES ($1, $2, $3, $4, 'PENDING', $5) RETURNING id",
          [playerId, biz.owner_id, target_business_id, bidAmount, expiresAt.toISOString()]
        );
        return {
          takeover_id: takeoverRow.rows[0].id,
          business_id: target_business_id,
          target_owner_id: biz.owner_id,
          bid_amount: bidAmount,
          business_value: Math.ceil(businessValue),
          expires_at: expiresAt.toISOString(),
        };
      });
      return reply.status(201).send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // POST /hostile-takeover/counter — Counter a takeover bid (costs 1.5x the bid)
  fastify.post("/hostile-takeover/counter", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { takeover_id } = request.body as { takeover_id: string };
    if (!takeover_id) return reply.status(400).send({ error: "takeover_id is required" });
    try {
      const result = await withTransaction(async (client) => {
        const takeoverRow = await client.query<{ id: string; bidder_id: string; target_owner_id: string; business_id: string; bid_amount: string; status: string; expires_at: string }>(
          "SELECT * FROM hostile_takeovers WHERE id = $1 AND status = 'PENDING' FOR UPDATE",
          [takeover_id]
        );
        if (!takeoverRow.rows.length) throw Object.assign(new Error("Takeover not found or already resolved"), { statusCode: 404 });
        const takeover = takeoverRow.rows[0];
        if (takeover.target_owner_id !== playerId) throw Object.assign(new Error("Only the target owner can counter a takeover"), { statusCode: 403 });
        if (new Date(takeover.expires_at) < new Date()) throw Object.assign(new Error("Takeover has expired"), { statusCode: 400 });
        const counterAmount = Math.ceil(Number(takeover.bid_amount) * COUNTER_BID_MULTIPLIER);
        const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (Number(playerRow.rows[0].cash) < counterAmount) {
          throw Object.assign(new Error("Insufficient cash. Counter costs " + counterAmount + " (1.5x the bid)"), { statusCode: 400 });
        }
        // Deduct counter-bid cost from target
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [counterAmount, playerId]);
        // Refund original bidder
        await client.query("UPDATE players SET cash = cash + $1 WHERE id = $2", [Number(takeover.bid_amount), takeover.bidder_id]);
        // Mark takeover as countered
        await client.query(
          "UPDATE hostile_takeovers SET status = 'COUNTERED', counter_amount = $1, resolved_at = NOW() WHERE id = $2",
          [counterAmount, takeover_id]
        );
        return { takeover_id, status: 'COUNTERED', counter_amount: counterAmount, refunded_to_bidder: Number(takeover.bid_amount) };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /hostile-takeover/active — List active takeover attempts
  fastify.get("/hostile-takeover/active", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const result = await query(
      `SELECT ht.id, ht.bidder_id, ht.target_owner_id, ht.business_id, ht.bid_amount, ht.counter_amount,
              ht.status, ht.expires_at, ht.created_at,
              pb.username AS bidder_username, pt.username AS target_username, b.name AS business_name
         FROM hostile_takeovers ht
         JOIN players pb ON pb.id = ht.bidder_id
         JOIN players pt ON pt.id = ht.target_owner_id
         JOIN businesses b ON b.id = ht.business_id
        WHERE (ht.bidder_id = $1 OR ht.target_owner_id = $1)
          AND ht.status = 'PENDING'
        ORDER BY ht.created_at DESC`,
      [playerId]
    );
    return reply.send({ data: result.rows });
  });

  // POST /hostile-takeover/resolve — Force-resolve expired takeover bids
  fastify.post("/hostile-takeover/resolve", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    try {
      const result = await withTransaction(async (client) => {
        // Find all expired pending takeovers involving this player
        const expiredRows = await client.query<{ id: string; bidder_id: string; target_owner_id: string; business_id: string; bid_amount: string }>(
          `SELECT id, bidder_id, target_owner_id, business_id, bid_amount
             FROM hostile_takeovers
            WHERE status = 'PENDING'
              AND expires_at <= NOW()
              AND (bidder_id = $1 OR target_owner_id = $1)
            FOR UPDATE`,
          [playerId]
        );
        if (!expiredRows.rows.length) return { resolved: 0, transfers: [] };
        const transfers: Array<{ takeover_id: string; business_id: string; new_owner: string }> = [];
        for (const takeover of expiredRows.rows) {
          // Uncountered = ownership transfers to bidder
          await client.query("UPDATE businesses SET owner_id = $1 WHERE id = $2", [takeover.bidder_id, takeover.business_id]);
          // Pay the target owner the bid amount
          await client.query("UPDATE players SET cash = cash + $1 WHERE id = $2", [Number(takeover.bid_amount), takeover.target_owner_id]);
          await client.query(
            "UPDATE hostile_takeovers SET status = 'COMPLETED', resolved_at = NOW() WHERE id = $1",
            [takeover.id]
          );
          transfers.push({ takeover_id: takeover.id, business_id: takeover.business_id, new_owner: takeover.bidder_id });
        }
        return { resolved: transfers.length, transfers };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });
}
