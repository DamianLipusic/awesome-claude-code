import type { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client';

export interface JwtPayload {
  sub: string;      // player id
  username: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    player: {
      id: string;
      username: string;
      season_id: string | null;
    };
  }
}

/**
 * requireAuth — Fastify preHandler hook that verifies the JWT access token
 * and attaches the authenticated player to request.player.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as JwtPayload;

    if (payload.type !== 'access') {
      return reply.status(401).send({ error: 'Invalid token type' });
    }

    // Verify player still exists and update last_active
    const res = await query<{ id: string; username: string; season_id: string }>(
      `UPDATE players SET last_active = NOW()
        WHERE id = $1
       RETURNING id, username, season_id`,
      [payload.sub]
    );

    if (res.rows.length === 0) {
      return reply.status(401).send({ error: 'Player not found' });
    }

    request.player = {
      id: res.rows[0].id,
      username: res.rows[0].username,
      season_id: res.rows[0].season_id,
    };
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}
