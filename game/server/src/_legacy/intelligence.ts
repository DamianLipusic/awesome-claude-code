import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { query, withTransaction } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { secureRandom, secureRandomInt } from "../lib/random";

const PLACE_SPY_COST = 5000;
const COUNTER_INTEL_COST = 3000;
const COUNTER_INTEL_BASE_CHANCE = 0.30;
const DISCOVERY_TRUST_PENALTY = 30;
const INITIAL_DISCOVERY_RISK = 0.20;
const DAILY_RISK_INCREMENT = 0.02;
const INTEL_ACCURACY_DECAY_PER_HOUR = 0.01;
const RUMOR_BASE_COST = 3000;
const SWEEP_COST = 4000;
const SWEEP_BASE_CHANCE = 0.40;

const INTEL_TYPES = ["EMPLOYEE_COUNT","PRODUCTION_LEVEL","CASH_POSITION","CRIME_OPS","HEAT_LEVEL","CONTRACTS","LOCATION"] as const;

const PlaceSpySchema = z.object({ target_player_id: z.string().uuid(), employee_id: z.string().uuid() });
const SellIntelSchema = z.object({
  intel_type: z.enum(INTEL_TYPES),
  target_player_id: z.string().uuid(),
  data: z.string().min(1).max(1000),
  price: z.number().positive().max(100000),
});
const RumorSchema = z.object({
  target_player_id: z.string().uuid(),
  rumor_text: z.string().min(1).max(500),
});
const SellIntelMarketSchema = z.object({
  intel_type: z.enum(INTEL_TYPES),
  target_player_id: z.string().uuid(),
  data: z.string().min(1).max(1000),
  price: z.number().positive().max(100000),
});

export async function intelligenceRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /spies/place - Place a spy
  // spies: id, owner_player_id, spy_employee_id, target_player_id, status, discovery_risk, intel_gathered, placed_at
  fastify.post("/spies/place", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const parsed = PlaceSpySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { target_player_id, employee_id } = parsed.data;
    if (target_player_id === playerId) return reply.status(400).send({ error: "Cannot spy on yourself" });
    try {
      const result = await withTransaction(async (client) => {
        const targetCheck = await client.query("SELECT id FROM players WHERE id = $1", [target_player_id]);
        if (!targetCheck.rows.length) throw Object.assign(new Error("Target player not found"), { statusCode: 404 });
        const empRow = await client.query<{ id: string; business_id: string | null }>(
          "SELECT e.id, e.business_id FROM employees e JOIN businesses b ON b.id = e.business_id WHERE e.id = $1 AND b.owner_id = $2 FOR UPDATE",
          [employee_id, playerId]
        );
        if (!empRow.rows.length) throw Object.assign(new Error("Employee not found or not owned"), { statusCode: 403 });
        const existingSpy = await client.query(
          "SELECT id FROM spies WHERE spy_employee_id = $1 AND status = 'ACTIVE'",
          [employee_id]
        );
        if (existingSpy.rows.length) throw Object.assign(new Error("Employee is already a spy"), { statusCode: 400 });
        const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (Number(playerRow.rows[0].cash) < PLACE_SPY_COST) throw Object.assign(new Error("Insufficient cash: need " + PLACE_SPY_COST), { statusCode: 400 });
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [PLACE_SPY_COST, playerId]);
        const spyRow = await client.query<{ id: string }>(
          "INSERT INTO spies (owner_player_id, spy_employee_id, target_player_id, discovery_risk, status, placed_at) VALUES ($1, $2, $3, $4, 'ACTIVE', NOW()) RETURNING id",
          [playerId, employee_id, target_player_id, INITIAL_DISCOVERY_RISK]
        );
        return { spy_id: spyRow.rows[0].id, target_player_id, employee_id, cost: PLACE_SPY_COST, discovery_risk: INITIAL_DISCOVERY_RISK };
      });
      return reply.status(201).send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /spies - List player's active spies
  fastify.get("/spies", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const result = await query(
      `SELECT s.id, s.spy_employee_id, s.target_player_id, s.discovery_risk, s.status, s.placed_at,
              e.name AS employee_name, p.username AS target_username,
              EXTRACT(EPOCH FROM (NOW() - s.placed_at)) / 86400.0 AS days_active
         FROM spies s
         JOIN employees e ON e.id = s.spy_employee_id
         JOIN players p ON p.id = s.target_player_id
        WHERE s.owner_player_id = $1 AND s.status = 'ACTIVE'
        ORDER BY s.placed_at DESC`,
      [playerId]
    );
    const spies = result.rows.map((row: Record<string, unknown>) => {
      const daysActive = Number(row.days_active) || 0;
      const currentRisk = Math.min(1.0, INITIAL_DISCOVERY_RISK + daysActive * DAILY_RISK_INCREMENT);
      return { ...row, current_discovery_risk: Math.round(currentRisk * 100) / 100 };
    });
    return reply.send({ data: spies });
  });

  // DELETE /spies/:id - Recall a spy
  fastify.delete("/spies/:id", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: spyId } = request.params as { id: string };
    const result = await query(
      "UPDATE spies SET status = 'RECALLED' WHERE id = $1 AND owner_player_id = $2 AND status = 'ACTIVE' RETURNING id",
      [spyId, playerId]
    );
    if (!result.rows.length) return reply.status(404).send({ error: "Active spy not found" });
    return reply.send({ data: { recalled: true, spy_id: spyId } });
  });

  // GET /spies/:id/intel - Get intel from a spy
  fastify.get("/spies/:id/intel", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: spyId } = request.params as { id: string };
    const spy = await query<{ target_player_id: string; placed_at: string }>(
      "SELECT target_player_id, placed_at FROM spies WHERE id = $1 AND owner_player_id = $2 AND status = 'ACTIVE'",
      [spyId, playerId]
    );
    if (!spy.rows.length) return reply.status(404).send({ error: "Active spy not found" });
    const targetId = spy.rows[0].target_player_id;
    const [playerData, businessData, employeeData, heatData] = await Promise.all([
      query<{ cash: string }>("SELECT cash FROM players WHERE id = $1", [targetId]),
      query<{ count: string; total_revenue: string }>("SELECT COUNT(*) AS count, COALESCE(SUM(total_revenue), 0) AS total_revenue FROM businesses WHERE owner_id = $1", [targetId]),
      query<{ count: string }>("SELECT COUNT(*) AS count FROM employees e JOIN businesses b ON b.id = e.business_id WHERE b.owner_id = $1", [targetId]),
      query<{ score: string }>("SELECT score FROM heat_scores WHERE player_id = $1", [targetId]),
    ]);
    const intel = {
      EMPLOYEE_COUNT: parseInt(employeeData.rows[0]?.count ?? "0", 10),
      PRODUCTION_LEVEL: Number(businessData.rows[0]?.total_revenue ?? 0),
      CASH_POSITION: Number(playerData.rows[0]?.cash ?? 0),
      HEAT_LEVEL: Number(heatData.rows[0]?.score ?? 0),
      BUSINESS_COUNT: parseInt(businessData.rows[0]?.count ?? "0", 10),
    };
    return reply.send({ data: { spy_id: spyId, target_player_id: targetId, intel } });
  });

  // POST /counter-intel - Sweep for enemy spies
  fastify.post("/counter-intel", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    try {
      const result = await withTransaction(async (client) => {
        const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (Number(playerRow.rows[0].cash) < COUNTER_INTEL_COST) throw Object.assign(new Error("Insufficient cash: need " + COUNTER_INTEL_COST), { statusCode: 400 });
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [COUNTER_INTEL_COST, playerId]);
        const spies = await client.query<{ id: string; owner_player_id: string; discovery_risk: string; placed_at: string }>(
          "SELECT id, owner_player_id, discovery_risk, placed_at FROM spies WHERE target_player_id = $1 AND status = 'ACTIVE'",
          [playerId]
        );
        const discovered: Array<{ spy_id: string; owner_player_id: string }> = [];
        for (const spy of spies.rows) {
          const daysActive = (Date.now() - new Date(spy.placed_at).getTime()) / (86400 * 1000);
          const currentRisk = Math.min(1.0, Number(spy.discovery_risk) + daysActive * DAILY_RISK_INCREMENT);
          const detectChance = COUNTER_INTEL_BASE_CHANCE + currentRisk * 0.3;
          if (secureRandom() < detectChance) {
            await client.query("UPDATE spies SET status = 'DISCOVERED' WHERE id = $1", [spy.id]);
            // trust_levels: player_a, player_b
            const [pA, pB] = [playerId, spy.owner_player_id].sort();
            await client.query(
              `INSERT INTO trust_levels (player_a, player_b, trust_score, betrayal_count)
               VALUES ($1, $2, $3, 1)
               ON CONFLICT (player_a, player_b)
               DO UPDATE SET trust_score = GREATEST(0, trust_levels.trust_score - $4), betrayal_count = trust_levels.betrayal_count + 1, updated_at = NOW()`,
              [pA, pB, 50 - DISCOVERY_TRUST_PENALTY, DISCOVERY_TRUST_PENALTY]
            );
            discovered.push({ spy_id: spy.id, owner_player_id: spy.owner_player_id });
          }
        }
        return { cost: COUNTER_INTEL_COST, spies_checked: spies.rows.length, spies_discovered: discovered.length, discovered };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /market - Browse intelligence market
  // intelligence_market: id, seller_id, buyer_id, intel_type, target_player_id, data, accuracy, price, purchased_at, created_at
  fastify.get("/market", { preHandler: [requireAuth] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await query(
      `SELECT im.id, im.seller_id, im.intel_type, im.target_player_id, im.price, im.accuracy, im.created_at,
              p.username AS seller_username, pt.username AS target_username
         FROM intelligence_market im
         JOIN players p ON p.id = im.seller_id
         JOIN players pt ON pt.id = im.target_player_id
        WHERE im.buyer_id IS NULL
        ORDER BY im.created_at DESC`
    );
    return reply.send({ data: result.rows });
  });

  // POST /market/buy/:id - Buy intel from market
  fastify.post("/market/buy/:id", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: listingId } = request.params as { id: string };
    try {
      const result = await withTransaction(async (client) => {
        const listing = await client.query<{ id: string; seller_id: string; price: string; data: string; intel_type: string; target_player_id: string; accuracy: string; created_at: string }>(
          "SELECT * FROM intelligence_market WHERE id = $1 AND buyer_id IS NULL FOR UPDATE",
          [listingId]
        );
        if (!listing.rows.length) throw Object.assign(new Error("Listing not found or already sold"), { statusCode: 404 });
        const item = listing.rows[0];
        const price = Number(item.price);
        if (item.seller_id === playerId) throw Object.assign(new Error("Cannot buy your own intel"), { statusCode: 400 });
        const buyerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (Number(buyerRow.rows[0].cash) < price) throw Object.assign(new Error("Insufficient cash"), { statusCode: 400 });
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [price, playerId]);
        await client.query("UPDATE players SET cash = cash + $1 WHERE id = $2", [price, item.seller_id]);
        await client.query("UPDATE intelligence_market SET buyer_id = $1, purchased_at = NOW() WHERE id = $2", [playerId, listingId]);
        return { listing_id: listingId, intel_type: item.intel_type, target_player_id: item.target_player_id, data: item.data, price, accuracy: Number(item.accuracy) };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // POST /market/sell - List intel for sale
  fastify.post("/market/sell", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const parsed = SellIntelSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { intel_type, target_player_id, data, price } = parsed.data;
    if (target_player_id === playerId) return reply.status(400).send({ error: "Cannot sell intel about yourself" });
    const targetCheck = await query("SELECT id FROM players WHERE id = $1", [target_player_id]);
    if (!targetCheck.rows.length) return reply.status(404).send({ error: "Target player not found" });
    const result = await query<{ id: string }>(
      "INSERT INTO intelligence_market (seller_id, intel_type, target_player_id, data, price, accuracy) VALUES ($1, $2, $3, $4, $5, 1.0) RETURNING id",
      [playerId, intel_type, target_player_id, JSON.stringify(data), price]
    );
    return reply.status(201).send({ data: { listing_id: result.rows[0].id, intel_type, target_player_id, price } });
  });

  // ─── Phase 3: Intelligence System Deepening ────────────────

  // POST /intelligence/rumor — Spread a rumor about another player (costs money, affects reputation)
  fastify.post("/intelligence/rumor", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const parsed = RumorSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { target_player_id, rumor_text } = parsed.data;
    if (target_player_id === playerId) return reply.status(400).send({ error: "Cannot spread rumors about yourself" });
    try {
      const result = await withTransaction(async (client) => {
        const targetCheck = await client.query("SELECT id FROM players WHERE id = $1", [target_player_id]);
        if (!targetCheck.rows.length) throw Object.assign(new Error("Target player not found"), { statusCode: 404 });
        const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (Number(playerRow.rows[0].cash) < RUMOR_BASE_COST) throw Object.assign(new Error("Insufficient cash: need " + RUMOR_BASE_COST), { statusCode: 400 });
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [RUMOR_BASE_COST, playerId]);
        // Decrease target's reputation across multiple axes
        const reputationImpact = secureRandomInt(3, 8); // 3-7 points
        await client.query(
          "UPDATE reputation_profiles SET score = GREATEST(0, score - $1), updated_at = NOW() WHERE player_id = $2 AND axis IN ('COMMUNITY', 'BUSINESS')",
          [reputationImpact, target_player_id]
        );
        // Log as reputation event
        await client.query(
          "INSERT INTO reputation_events (player_id, event_type, axis, impact, description) VALUES ($1, 'RUMOR', 'COMMUNITY', $2, $3)",
          [target_player_id, -reputationImpact, rumor_text.slice(0, 255)]
        );
        // Increase rivalry
        const [pA, pB] = [playerId, target_player_id].sort();
        await client.query(
          `INSERT INTO rivalry_points (player_a, player_b, points, state)
           VALUES ($1, $2, 5, 'COMPETITIVE')
           ON CONFLICT (player_a, player_b)
           DO UPDATE SET points = LEAST(100, rivalry_points.points + 5), updated_at = NOW()`,
          [pA, pB]
        );
        return { cost: RUMOR_BASE_COST, target_player_id, reputation_impact: -reputationImpact, rumor_spread: true };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // POST /intelligence/sweep — Sweep your businesses for enemy spies (costs money, chance to discover)
  fastify.post("/intelligence/sweep", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    try {
      const result = await withTransaction(async (client) => {
        const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (Number(playerRow.rows[0].cash) < SWEEP_COST) throw Object.assign(new Error("Insufficient cash: need " + SWEEP_COST), { statusCode: 400 });
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [SWEEP_COST, playerId]);
        // Find spies targeting this player
        const spies = await client.query<{ id: string; owner_player_id: string; discovery_risk: string; placed_at: string }>(
          "SELECT id, owner_player_id, discovery_risk, placed_at FROM spies WHERE target_player_id = $1 AND status = 'ACTIVE'",
          [playerId]
        );
        const discovered: Array<{ spy_id: string; owner_player_id: string }> = [];
        for (const spy of spies.rows) {
          const daysActive = (Date.now() - new Date(spy.placed_at).getTime()) / (86400 * 1000);
          const currentRisk = Math.min(1.0, Number(spy.discovery_risk) + daysActive * DAILY_RISK_INCREMENT);
          const detectChance = SWEEP_BASE_CHANCE + currentRisk * 0.25;
          if (secureRandom() < detectChance) {
            await client.query("UPDATE spies SET status = 'DISCOVERED' WHERE id = $1", [spy.id]);
            const [pA, pB] = [playerId, spy.owner_player_id].sort();
            await client.query(
              `INSERT INTO trust_levels (player_a, player_b, trust_score, betrayal_count)
               VALUES ($1, $2, 30, 1)
               ON CONFLICT (player_a, player_b)
               DO UPDATE SET trust_score = GREATEST(0, trust_levels.trust_score - $3), betrayal_count = trust_levels.betrayal_count + 1, updated_at = NOW()`,
              [pA, pB, DISCOVERY_TRUST_PENALTY]
            );
            discovered.push({ spy_id: spy.id, owner_player_id: spy.owner_player_id });
          }
        }
        return { cost: SWEEP_COST, businesses_swept: spies.rows.length, spies_discovered: discovered.length, discovered };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /intelligence/dossier/:playerId — Get compiled intelligence on a player (from your spies)
  fastify.get("/intelligence/dossier/:playerId", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { playerId: targetId } = request.params as { playerId: string };
    if (targetId === playerId) return reply.status(400).send({ error: "Cannot compile dossier on yourself" });
    // Check if player has any spies on this target
    const spies = await query<{ id: string; placed_at: string }>(
      "SELECT id, placed_at FROM spies WHERE owner_player_id = $1 AND target_player_id = $2 AND status = 'ACTIVE'",
      [playerId, targetId]
    );
    if (!spies.rows.length) return reply.status(403).send({ error: "No active spies on this target. Place a spy first." });
    // Gather all available intel
    const [targetPlayer, targetBusinesses, targetEmployees, targetHeat, targetReputation, targetContracts, targetLocations] = await Promise.all([
      query<{ username: string; cash: string; created_at: string }>("SELECT username, cash, created_at FROM players WHERE id = $1", [targetId]),
      query("SELECT id, name, type, tier, city, status, efficiency, total_revenue, total_expenses FROM businesses WHERE owner_id = $1", [targetId]),
      query<{ count: string }>("SELECT COUNT(*) AS count FROM employees e JOIN businesses b ON b.id = e.business_id WHERE b.owner_id = $1", [targetId]),
      query<{ score: string }>("SELECT score FROM heat_scores WHERE player_id = $1", [targetId]),
      query("SELECT axis, score FROM reputation_profiles WHERE player_id = $1", [targetId]),
      query<{ count: string }>("SELECT COUNT(*) AS count FROM trade_contracts WHERE (initiator_id = $1 OR counterparty_id = $1) AND status = 'ACTIVE'", [targetId]),
      query("SELECT id, name, zone, city FROM locations WHERE player_id = $1", [targetId]),
    ]);
    // Also include purchased intelligence from market
    const purchasedIntel = await query(
      "SELECT intel_type, data, accuracy, created_at FROM intelligence_market WHERE buyer_id = $1 AND target_player_id = $2 ORDER BY created_at DESC LIMIT 10",
      [playerId, targetId]
    );
    const dossier = {
      target_player_id: targetId,
      username: targetPlayer.rows[0]?.username ?? 'Unknown',
      active_spies: spies.rows.length,
      financials: {
        estimated_cash: Number(targetPlayer.rows[0]?.cash ?? 0),
        heat_level: Number(targetHeat.rows[0]?.score ?? 0),
      },
      businesses: {
        count: targetBusinesses.rows.length,
        details: targetBusinesses.rows,
      },
      employees: {
        total_count: parseInt(targetEmployees.rows[0]?.count ?? "0", 10),
      },
      reputation: targetReputation.rows,
      active_contracts: parseInt(targetContracts.rows[0]?.count ?? "0", 10),
      locations: targetLocations.rows,
      purchased_intel: purchasedIntel.rows,
    };
    return reply.send({ data: dossier });
  });

  // POST /intelligence/sell — Sell intelligence on the open market
  fastify.post("/intelligence/sell", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const parsed = SellIntelMarketSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { intel_type, target_player_id, data, price } = parsed.data;
    if (target_player_id === playerId) return reply.status(400).send({ error: "Cannot sell intel about yourself" });
    const targetCheck = await query("SELECT id FROM players WHERE id = $1", [target_player_id]);
    if (!targetCheck.rows.length) return reply.status(404).send({ error: "Target player not found" });
    // Verify the seller has some basis for this intel (has or had spies on target)
    const spyCheck = await query(
      "SELECT id FROM spies WHERE owner_player_id = $1 AND target_player_id = $2",
      [playerId, target_player_id]
    );
    if (!spyCheck.rows.length) return reply.status(403).send({ error: "You must have had spies on this target to sell intel about them" });
    // Calculate accuracy based on freshness of spy data
    const activeSpies = await query<{ placed_at: string }>(
      "SELECT placed_at FROM spies WHERE owner_player_id = $1 AND target_player_id = $2 AND status = 'ACTIVE' ORDER BY placed_at DESC LIMIT 1",
      [playerId, target_player_id]
    );
    let accuracy = 0.5; // Base accuracy for historical spies
    if (activeSpies.rows.length) {
      const hoursActive = (Date.now() - new Date(activeSpies.rows[0].placed_at).getTime()) / (3600 * 1000);
      accuracy = Math.max(0.3, 1.0 - hoursActive * INTEL_ACCURACY_DECAY_PER_HOUR);
    }
    const result = await query<{ id: string }>(
      "INSERT INTO intelligence_market (seller_id, intel_type, target_player_id, data, price, accuracy) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [playerId, intel_type, target_player_id, JSON.stringify(data), price, Math.round(accuracy * 10000) / 10000]
    );
    return reply.status(201).send({ data: { listing_id: result.rows[0].id, intel_type, target_player_id, price, accuracy: Math.round(accuracy * 100) / 100 } });
  });
}
