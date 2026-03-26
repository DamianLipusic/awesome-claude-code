import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";

const REPUTATION_AXES = ["BUSINESS","CRIMINAL","NEGOTIATION","EMPLOYEE","COMMUNITY","RELIABILITY"] as const;
type ReputationAxis = (typeof REPUTATION_AXES)[number];
const DEFAULT_SCORE = 50;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

const ReputationEventSchema = z.object({
  axis: z.enum(REPUTATION_AXES),
  impact: z.number().min(-100).max(100),
  reason: z.string().min(1).max(255),
  target_player_id: z.string().uuid().optional(),
});

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function ensureReputationProfile(playerId: string): Promise<void> {
  for (const axis of REPUTATION_AXES) {
    await query(
      `INSERT INTO reputation_profiles (player_id, axis, score)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, axis) DO NOTHING`,
      [playerId, axis, DEFAULT_SCORE],
    );
  }
}

export async function reputationRoutes(fastify: FastifyInstance): Promise<void> {

  // GET / - Get current player reputation across all axes
  fastify.get("/", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = request.player.id;
    await ensureReputationProfile(playerId);
    const result = await query(
      `SELECT axis, score, updated_at FROM reputation_profiles
       WHERE player_id = $1 ORDER BY axis`,
      [playerId],
    );
    return reply.send({ data: result.rows });
  });

  // GET /:playerId - View another player public reputation
  fastify.get("/:playerId", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { playerId } = request.params as { playerId: string };
    const playerCheck = await query(`SELECT id, username FROM players WHERE id = $1`, [playerId]);
    if (!playerCheck.rows.length) {
      return reply.status(404).send({ error: "Player not found" });
    }
    await ensureReputationProfile(playerId);
    const result = await query(
      `SELECT axis, score, updated_at FROM reputation_profiles
       WHERE player_id = $1 ORDER BY axis`,
      [playerId],
    );
    return reply.send({
      data: { player_id: playerId, username: playerCheck.rows[0].username, reputation: result.rows },
    });
  });

  // POST /events - Log a reputation event
  fastify.post("/events", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const callerId = request.player.id;
    const seasonId = request.player.season_id;
    const parsed = ReputationEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }
    const { axis, impact, reason, target_player_id } = parsed.data;
    const targetId = target_player_id ?? callerId;
    await ensureReputationProfile(targetId);
    const current = await query<{ score: number }>(
      `SELECT score FROM reputation_profiles
       WHERE player_id = $1 AND axis = $2`,
      [targetId, axis],
    );
    if (!current.rows.length) {
      return reply.status(404).send({ error: "Reputation profile not found" });
    }
    const oldScore = Number(current.rows[0].score);
    const newScore = clamp(oldScore + impact, MIN_SCORE, MAX_SCORE);
    await query(
      `UPDATE reputation_profiles SET score = $1, updated_at = NOW()
       WHERE player_id = $2 AND axis = $3`,
      [newScore, targetId, axis],
    );
    await query(
      `INSERT INTO reputation_events (player_id, event_type, axis, impact, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [targetId, 'PLAYER_ACTION', axis, impact, reason],
    );
    return reply.send({
      data: { player_id: targetId, axis, old_score: oldScore, new_score: newScore, impact, reason },
    });
  });

  // GET /leaderboard/:axis - Top 20 players for a specific axis
  fastify.get("/leaderboard/:axis", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { axis } = request.params as { axis: string };
    const seasonId = request.player.season_id;
    const upperAxis = axis.toUpperCase() as ReputationAxis;
    if (!REPUTATION_AXES.includes(upperAxis)) {
      return reply.status(400).send({
        error: "Invalid axis. Must be one of: " + REPUTATION_AXES.join(", "),
      });
    }
    const result = await query(
      `SELECT rs.player_id, p.username, rs.score
       FROM reputation_profiles rs JOIN players p ON p.id = rs.player_id
       WHERE rs.axis = $1
       ORDER BY rs.score DESC LIMIT 20`,
      [upperAxis],
    );
    return reply.send({ data: { axis: upperAxis, leaderboard: result.rows } });
  });
}
