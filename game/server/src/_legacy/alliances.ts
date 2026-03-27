import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { query, withTransaction } from "../db/client";
import { requireAuth } from "../middleware/auth";

const SYNDICATE_CREATION_COST = 10000;
const MAX_SYNDICATE_MEMBERS = 10;
const DEFAULT_TRUST = 50;
const KICK_TRUST_PENALTY = 20;
const WAR_COST = 25000;

const CreateSyndicateSchema = z.object({
  name: z.string().min(3).max(50),
});
const DepositSchema = z.object({ amount: z.number().positive() });
const TrustUpdateSchema = z.object({
  change: z.number().min(-50).max(50),
  reason: z.string().min(1).max(255),
});

function clampTrust(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export async function allianceRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /syndicates - Create a new syndicate
  fastify.post("/syndicates", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const parsed = CreateSyndicateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { name } = parsed.data;
    try {
      const result = await withTransaction(async (client) => {
        const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (!playerRow.rows.length) throw Object.assign(new Error("Player not found"), { statusCode: 404 });
        if (Number(playerRow.rows[0].cash) < SYNDICATE_CREATION_COST) {
          throw Object.assign(new Error("Insufficient cash"), { statusCode: 400 });
        }
        // Check if player is already in a syndicate
        const existingMember = await client.query(
          "SELECT id FROM syndicate_members WHERE player_id = $1",
          [playerId]
        );
        if (existingMember.rows.length) throw Object.assign(new Error("Already in a syndicate"), { statusCode: 400 });
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [SYNDICATE_CREATION_COST, playerId]);
        const syndicateRow = await client.query<{ id: string }>(
          "INSERT INTO syndicates (name, leader_id, status, treasury, member_count) VALUES ($1, $2, $3, 0, 1) RETURNING id",
          [name, playerId, 'ACTIVE']
        );
        const syndicateId = syndicateRow.rows[0].id;
        await client.query(
          "INSERT INTO syndicate_members (syndicate_id, player_id, role, joined_at) VALUES ($1, $2, $3, NOW())",
          [syndicateId, playerId, 'LEADER']
        );
        return { syndicate_id: syndicateId, name, cost: SYNDICATE_CREATION_COST };
      });
      return reply.status(201).send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /syndicates - List all syndicates
  fastify.get("/syndicates", { preHandler: [requireAuth] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await query(
      `SELECT s.id, s.name, s.leader_id, s.treasury, s.member_count, s.status, s.created_at,
              p.username AS leader_username
         FROM syndicates s
         JOIN players p ON p.id = s.leader_id
        ORDER BY s.created_at DESC`
    );
    return reply.send({ data: result.rows });
  });

  // GET /syndicates/:id - Syndicate details with members
  fastify.get("/syndicates/:id", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const syndicateRow = await query(
      `SELECT s.*, p.username AS leader_username
         FROM syndicates s
         JOIN players p ON p.id = s.leader_id
        WHERE s.id = $1`,
      [id]
    );
    if (!syndicateRow.rows.length) return reply.status(404).send({ error: "Syndicate not found" });
    const members = await query(
      `SELECT sm.player_id, sm.role, sm.joined_at, p.username
         FROM syndicate_members sm
         JOIN players p ON p.id = sm.player_id
        WHERE sm.syndicate_id = $1
        ORDER BY sm.joined_at`,
      [id]
    );
    return reply.send({ data: { ...syndicateRow.rows[0], members: members.rows } });
  });

  // POST /syndicates/:id/join - Request to join a syndicate
  fastify.post("/syndicates/:id/join", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: syndicateId } = request.params as { id: string };
    const syndicate = await query("SELECT id FROM syndicates WHERE id = $1", [syndicateId]);
    if (!syndicate.rows.length) return reply.status(404).send({ error: "Syndicate not found" });
    const existing = await query("SELECT id FROM syndicate_members WHERE player_id = $1", [playerId]);
    if (existing.rows.length) return reply.status(400).send({ error: "Already in a syndicate" });
    const countResult = await query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM syndicate_members WHERE syndicate_id = $1",
      [syndicateId]
    );
    if (parseInt(countResult.rows[0].count, 10) >= MAX_SYNDICATE_MEMBERS) return reply.status(400).send({ error: "Syndicate is full" });
    await query(
      "INSERT INTO syndicate_members (syndicate_id, player_id, role, joined_at) VALUES ($1, $2, $3, NOW())",
      [syndicateId, playerId, 'MEMBER']
    );
    // Update member count
    await query("UPDATE syndicates SET member_count = member_count + 1 WHERE id = $1", [syndicateId]);
    return reply.status(201).send({ data: { status: "JOINED", syndicate_id: syndicateId } });
  });

  // POST /syndicates/:id/kick/:playerId - Kick a member (leader only)
  fastify.post("/syndicates/:id/kick/:playerId", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const leaderId = request.player.id;
    const { id: syndicateId, playerId: targetId } = request.params as { id: string; playerId: string };
    if (leaderId === targetId) return reply.status(400).send({ error: "Leader cannot kick themselves" });
    const syndicate = await query("SELECT id FROM syndicates WHERE id = $1 AND leader_id = $2", [syndicateId, leaderId]);
    if (!syndicate.rows.length) return reply.status(403).send({ error: "Only the syndicate leader can kick members" });
    const result = await query(
      "DELETE FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2 RETURNING id",
      [syndicateId, targetId]
    );
    if (!result.rows.length) return reply.status(404).send({ error: "Member not found" });
    await query("UPDATE syndicates SET member_count = GREATEST(0, member_count - 1) WHERE id = $1", [syndicateId]);
    return reply.send({ data: { kicked: true, player_id: targetId } });
  });

  // POST /syndicates/:id/leave - Leave a syndicate
  fastify.post("/syndicates/:id/leave", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: syndicateId } = request.params as { id: string };
    const syndicate = await query("SELECT leader_id FROM syndicates WHERE id = $1", [syndicateId]);
    if (!syndicate.rows.length) return reply.status(404).send({ error: "Syndicate not found" });
    if (syndicate.rows[0].leader_id === playerId) return reply.status(400).send({ error: "Leader cannot leave. Transfer leadership or dissolve first." });
    const result = await query(
      "DELETE FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2 RETURNING id",
      [syndicateId, playerId]
    );
    if (!result.rows.length) return reply.status(404).send({ error: "Not a member" });
    await query("UPDATE syndicates SET member_count = GREATEST(0, member_count - 1) WHERE id = $1", [syndicateId]);
    return reply.send({ data: { left: true, syndicate_id: syndicateId } });
  });

  // POST /syndicates/:id/treasury/deposit - Deposit cash into syndicate treasury
  fastify.post("/syndicates/:id/treasury/deposit", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: syndicateId } = request.params as { id: string };
    const parsed = DepositSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { amount } = parsed.data;
    try {
      const result = await withTransaction(async (client) => {
        const memberCheck = await client.query("SELECT id FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, playerId]);
        if (!memberCheck.rows.length) throw Object.assign(new Error("Not a member"), { statusCode: 403 });
        const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (!playerRow.rows.length) throw Object.assign(new Error("Player not found"), { statusCode: 404 });
        if (Number(playerRow.rows[0].cash) < amount) throw Object.assign(new Error("Insufficient cash"), { statusCode: 400 });
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [amount, playerId]);
        await client.query("UPDATE syndicates SET treasury = treasury + $1 WHERE id = $2", [amount, syndicateId]);
        return { deposited: amount, syndicate_id: syndicateId };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /trust/:playerId - Get trust level with another player
  fastify.get("/trust/:playerId", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { playerId: targetId } = request.params as { playerId: string };
    // trust_levels uses player_a, player_b columns
    const result = await query(
      `SELECT trust_score, updated_at FROM trust_levels
       WHERE (player_a = $1 AND player_b = $2) OR (player_a = $2 AND player_b = $1)`,
      [playerId, targetId]
    );
    const trustScore = result.rows.length ? Number(result.rows[0].trust_score) : DEFAULT_TRUST;
    return reply.send({
      data: {
        player_id: playerId,
        target_id: targetId,
        trust_score: trustScore,
        updated_at: result.rows[0]?.updated_at ?? null,
      },
    });
  });

  // POST /trust/:playerId/update - Update trust level
  fastify.post("/trust/:playerId/update", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { playerId: targetId } = request.params as { playerId: string };
    const parsed = TrustUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { change, reason } = parsed.data;
    const [pA, pB] = [playerId, targetId].sort();
    const result = await query<{ trust_score: number }>(
      `INSERT INTO trust_levels (player_a, player_b, trust_score, betrayal_count)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (player_a, player_b)
       DO UPDATE SET trust_score = LEAST(100, GREATEST(0, trust_levels.trust_score + $4)), updated_at = NOW()
       RETURNING trust_score`,
      [pA, pB, clampTrust(DEFAULT_TRUST + change), change]
    );
    return reply.send({
      data: {
        player_id: playerId,
        target_id: targetId,
        trust_score: Number(result.rows[0].trust_score),
        change,
        reason,
      },
    });
  });

  // ─── Phase 3: Syndicate Deepening ──────────────────────────

  // POST /syndicates/:id/deposit — Deposit money into syndicate treasury
  fastify.post("/syndicates/:id/deposit", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: syndicateId } = request.params as { id: string };
    const parsed = DepositSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { amount } = parsed.data;
    try {
      const result = await withTransaction(async (client) => {
        const memberCheck = await client.query("SELECT id, role FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, playerId]);
        if (!memberCheck.rows.length) throw Object.assign(new Error("Not a member of this syndicate"), { statusCode: 403 });
        const playerRow = await client.query<{ cash: string }>("SELECT cash FROM players WHERE id = $1 FOR UPDATE", [playerId]);
        if (!playerRow.rows.length) throw Object.assign(new Error("Player not found"), { statusCode: 404 });
        if (Number(playerRow.rows[0].cash) < amount) throw Object.assign(new Error("Insufficient cash"), { statusCode: 400 });
        await client.query("UPDATE players SET cash = cash - $1 WHERE id = $2", [amount, playerId]);
        await client.query("UPDATE syndicates SET treasury = treasury + $1 WHERE id = $2", [amount, syndicateId]);
        await client.query(
          "INSERT INTO syndicate_activity_log (syndicate_id, player_id, action, details) VALUES ($1, $2, 'DEPOSIT', $3)",
          [syndicateId, playerId, JSON.stringify({ amount })]
        );
        return { deposited: amount, syndicate_id: syndicateId };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // POST /syndicates/:id/withdraw — Withdraw from treasury (leader/officer only)
  fastify.post("/syndicates/:id/withdraw", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: syndicateId } = request.params as { id: string };
    const parsed = DepositSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });
    const { amount } = parsed.data;
    try {
      const result = await withTransaction(async (client) => {
        const memberCheck = await client.query<{ role: string }>("SELECT role FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, playerId]);
        if (!memberCheck.rows.length) throw Object.assign(new Error("Not a member of this syndicate"), { statusCode: 403 });
        const role = memberCheck.rows[0].role;
        if (role !== 'LEADER' && role !== 'OFFICER') throw Object.assign(new Error("Only leaders and officers can withdraw from treasury"), { statusCode: 403 });
        const syndicateRow = await client.query<{ treasury: string }>("SELECT treasury FROM syndicates WHERE id = $1 FOR UPDATE", [syndicateId]);
        if (!syndicateRow.rows.length) throw Object.assign(new Error("Syndicate not found"), { statusCode: 404 });
        if (Number(syndicateRow.rows[0].treasury) < amount) throw Object.assign(new Error("Insufficient treasury funds"), { statusCode: 400 });
        await client.query("UPDATE syndicates SET treasury = treasury - $1 WHERE id = $2", [amount, syndicateId]);
        await client.query("UPDATE players SET cash = cash + $1 WHERE id = $2", [amount, playerId]);
        await client.query(
          "INSERT INTO syndicate_activity_log (syndicate_id, player_id, action, details) VALUES ($1, $2, 'WITHDRAW', $3)",
          [syndicateId, playerId, JSON.stringify({ amount })]
        );
        return { withdrawn: amount, syndicate_id: syndicateId };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // POST /syndicates/:id/vote-kick — Start or vote on a vote-kick
  fastify.post("/syndicates/:id/vote-kick", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: syndicateId } = request.params as { id: string };
    const body = request.body as { target_player_id?: string; vote?: 'FOR' | 'AGAINST'; vote_id?: string };
    try {
      // If vote_id is provided, this is a vote on an existing kick proposal
      if (body.vote_id && body.vote) {
        const result = await withTransaction(async (client) => {
          const memberCheck = await client.query("SELECT id FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, playerId]);
          if (!memberCheck.rows.length) throw Object.assign(new Error("Not a member"), { statusCode: 403 });
          const voteKick = await client.query<{ id: string; voters: string; votes_for: number; votes_against: number; status: string; target_player_id: string }>(
            "SELECT * FROM syndicate_vote_kicks WHERE id = $1 AND syndicate_id = $2 AND status = 'PENDING' FOR UPDATE",
            [body.vote_id, syndicateId]
          );
          if (!voteKick.rows.length) throw Object.assign(new Error("Vote kick not found or already resolved"), { statusCode: 404 });
          const vk = voteKick.rows[0];
          const voters = JSON.parse(vk.voters as string) as string[];
          if (voters.includes(playerId)) throw Object.assign(new Error("Already voted"), { statusCode: 400 });
          voters.push(playerId);
          const newFor = body.vote === 'FOR' ? vk.votes_for + 1 : vk.votes_for;
          const newAgainst = body.vote === 'AGAINST' ? vk.votes_against + 1 : vk.votes_against;
          await client.query(
            "UPDATE syndicate_vote_kicks SET votes_for = $1, votes_against = $2, voters = $3 WHERE id = $4",
            [newFor, newAgainst, JSON.stringify(voters), body.vote_id]
          );
          // Check if majority reached
          const memberCount = await client.query<{ count: string }>("SELECT COUNT(*) AS count FROM syndicate_members WHERE syndicate_id = $1", [syndicateId]);
          const total = parseInt(memberCount.rows[0].count, 10);
          const majority = Math.ceil(total / 2);
          let resolved = false;
          if (newFor >= majority) {
            await client.query("UPDATE syndicate_vote_kicks SET status = 'APPROVED', resolved_at = NOW() WHERE id = $1", [body.vote_id]);
            const targetId = vk.target_player_id;
            await client.query("DELETE FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, targetId]);
            await client.query("UPDATE syndicates SET member_count = GREATEST(0, member_count - 1) WHERE id = $1", [syndicateId]);
            await client.query(
              "INSERT INTO syndicate_activity_log (syndicate_id, player_id, action, details) VALUES ($1, $2, 'VOTE_KICKED', $3)",
              [syndicateId, targetId, JSON.stringify({ votes_for: newFor, votes_against: newAgainst })]
            );
            resolved = true;
          } else if (newAgainst > total - majority) {
            await client.query("UPDATE syndicate_vote_kicks SET status = 'REJECTED', resolved_at = NOW() WHERE id = $1", [body.vote_id]);
            resolved = true;
          }
          return { vote_id: body.vote_id, votes_for: newFor, votes_against: newAgainst, resolved, total_members: total };
        });
        return reply.send({ data: result });
      }
      // Otherwise, start a new vote-kick
      if (!body.target_player_id) return reply.status(400).send({ error: "target_player_id is required" });
      const result = await withTransaction(async (client) => {
        const memberCheck = await client.query("SELECT id FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, playerId]);
        if (!memberCheck.rows.length) throw Object.assign(new Error("Not a member"), { statusCode: 403 });
        const targetCheck = await client.query<{ role: string }>("SELECT role FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, body.target_player_id]);
        if (!targetCheck.rows.length) throw Object.assign(new Error("Target is not a member"), { statusCode: 404 });
        if (targetCheck.rows[0].role === 'LEADER') throw Object.assign(new Error("Cannot vote-kick the leader"), { statusCode: 400 });
        const existing = await client.query("SELECT id FROM syndicate_vote_kicks WHERE syndicate_id = $1 AND target_player_id = $2 AND status = 'PENDING'", [syndicateId, body.target_player_id]);
        if (existing.rows.length) throw Object.assign(new Error("A vote-kick is already pending for this player"), { statusCode: 409 });
        const vkRow = await client.query<{ id: string }>(
          "INSERT INTO syndicate_vote_kicks (syndicate_id, target_player_id, initiated_by, votes_for, votes_against, voters) VALUES ($1, $2, $3, 1, 0, $4) RETURNING id",
          [syndicateId, body.target_player_id, playerId, JSON.stringify([playerId])]
        );
        await client.query(
          "INSERT INTO syndicate_activity_log (syndicate_id, player_id, action, details) VALUES ($1, $2, 'VOTE_KICK_STARTED', $3)",
          [syndicateId, playerId, JSON.stringify({ target_player_id: body.target_player_id })]
        );
        return { vote_id: vkRow.rows[0].id, target_player_id: body.target_player_id, status: 'PENDING' };
      });
      return reply.status(201).send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // POST /syndicates/:id/promote — Promote member to officer (leader only)
  fastify.post("/syndicates/:id/promote", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: syndicateId } = request.params as { id: string };
    const { target_player_id } = request.body as { target_player_id: string };
    if (!target_player_id) return reply.status(400).send({ error: "target_player_id is required" });
    try {
      const result = await withTransaction(async (client) => {
        const leaderCheck = await client.query("SELECT id FROM syndicates WHERE id = $1 AND leader_id = $2", [syndicateId, playerId]);
        if (!leaderCheck.rows.length) throw Object.assign(new Error("Only the leader can promote members"), { statusCode: 403 });
        const memberRow = await client.query<{ role: string }>("SELECT role FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, target_player_id]);
        if (!memberRow.rows.length) throw Object.assign(new Error("Target is not a member"), { statusCode: 404 });
        if (memberRow.rows[0].role === 'OFFICER' || memberRow.rows[0].role === 'LEADER') {
          throw Object.assign(new Error("Player is already " + memberRow.rows[0].role), { statusCode: 400 });
        }
        await client.query("UPDATE syndicate_members SET role = 'OFFICER' WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, target_player_id]);
        await client.query(
          "INSERT INTO syndicate_activity_log (syndicate_id, player_id, action, details) VALUES ($1, $2, 'PROMOTED', $3)",
          [syndicateId, target_player_id, JSON.stringify({ promoted_by: playerId, new_role: 'OFFICER' })]
        );
        return { promoted: true, player_id: target_player_id, new_role: 'OFFICER' };
      });
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /syndicates/:id/activity — Get syndicate activity log
  fastify.get("/syndicates/:id/activity", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: syndicateId } = request.params as { id: string };
    const { limit: limitStr, offset: offsetStr } = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(limitStr ?? '50', 10), 100);
    const offset = parseInt(offsetStr ?? '0', 10);
    const memberCheck = await query("SELECT id FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, playerId]);
    if (!memberCheck.rows.length) return reply.status(403).send({ error: "Not a member of this syndicate" });
    const result = await query(
      `SELECT sal.id, sal.player_id, sal.action, sal.details, sal.created_at, p.username
         FROM syndicate_activity_log sal
         LEFT JOIN players p ON p.id = sal.player_id
        WHERE sal.syndicate_id = $1
        ORDER BY sal.created_at DESC
        LIMIT $2 OFFSET $3`,
      [syndicateId, limit, offset]
    );
    return reply.send({ data: result.rows });
  });

  // POST /syndicates/:id/war — Declare war on another syndicate (costs treasury money)
  fastify.post("/syndicates/:id/war", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    const { id: syndicateId } = request.params as { id: string };
    const { target_syndicate_id } = request.body as { target_syndicate_id: string };
    if (!target_syndicate_id) return reply.status(400).send({ error: "target_syndicate_id is required" });
    if (target_syndicate_id === syndicateId) return reply.status(400).send({ error: "Cannot declare war on yourself" });
    try {
      const result = await withTransaction(async (client) => {
        const memberCheck = await client.query<{ role: string }>("SELECT role FROM syndicate_members WHERE syndicate_id = $1 AND player_id = $2", [syndicateId, playerId]);
        if (!memberCheck.rows.length) throw Object.assign(new Error("Not a member"), { statusCode: 403 });
        if (memberCheck.rows[0].role !== 'LEADER' && memberCheck.rows[0].role !== 'OFFICER') {
          throw Object.assign(new Error("Only leaders and officers can declare war"), { statusCode: 403 });
        }
        const targetCheck = await client.query("SELECT id FROM syndicates WHERE id = $1 AND status = 'ACTIVE'", [target_syndicate_id]);
        if (!targetCheck.rows.length) throw Object.assign(new Error("Target syndicate not found"), { statusCode: 404 });
        const existingWar = await client.query(
          "SELECT id FROM syndicate_wars WHERE ((attacker_id = $1 AND defender_id = $2) OR (attacker_id = $2 AND defender_id = $1)) AND status = 'ACTIVE'",
          [syndicateId, target_syndicate_id]
        );
        if (existingWar.rows.length) throw Object.assign(new Error("Already at war with this syndicate"), { statusCode: 409 });
        const syndicateRow = await client.query<{ treasury: string }>("SELECT treasury FROM syndicates WHERE id = $1 FOR UPDATE", [syndicateId]);
        if (Number(syndicateRow.rows[0].treasury) < WAR_COST) {
          throw Object.assign(new Error("Insufficient treasury. War costs " + WAR_COST), { statusCode: 400 });
        }
        await client.query("UPDATE syndicates SET treasury = treasury - $1 WHERE id = $2", [WAR_COST, syndicateId]);
        const warRow = await client.query<{ id: string }>(
          "INSERT INTO syndicate_wars (attacker_id, defender_id, treasury_cost, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id",
          [syndicateId, target_syndicate_id, WAR_COST]
        );
        await client.query(
          "INSERT INTO syndicate_activity_log (syndicate_id, player_id, action, details) VALUES ($1, $2, 'WAR_DECLARED', $3)",
          [syndicateId, playerId, JSON.stringify({ target_syndicate_id, cost: WAR_COST })]
        );
        await client.query(
          "INSERT INTO syndicate_activity_log (syndicate_id, player_id, action, details) VALUES ($1, NULL, 'WAR_RECEIVED', $2)",
          [target_syndicate_id, JSON.stringify({ attacker_syndicate_id: syndicateId })]
        );
        // Decrease trust between all members of both syndicates
        const attackerMembers = await client.query<{ player_id: string }>("SELECT player_id FROM syndicate_members WHERE syndicate_id = $1", [syndicateId]);
        const defenderMembers = await client.query<{ player_id: string }>("SELECT player_id FROM syndicate_members WHERE syndicate_id = $1", [target_syndicate_id]);
        for (const am of attackerMembers.rows) {
          for (const dm of defenderMembers.rows) {
            const [pA, pB] = [am.player_id, dm.player_id].sort();
            await client.query(
              `INSERT INTO trust_levels (player_a, player_b, trust_score, betrayal_count)
               VALUES ($1, $2, 30, 0)
               ON CONFLICT (player_a, player_b)
               DO UPDATE SET trust_score = GREATEST(0, trust_levels.trust_score - 20), updated_at = NOW()`,
              [pA, pB]
            );
          }
        }
        return { war_id: warRow.rows[0].id, attacker_id: syndicateId, defender_id: target_syndicate_id, cost: WAR_COST };
      });
      return reply.status(201).send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });
}
