import type { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client';

export interface JwtPayload {
  sub: string;
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
    };
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as JwtPayload;
    if (payload.type !== 'access') {
      return reply.status(401).send({ error: 'Invalid token type' });
    }

    const res = await query<{ id: string; username: string }>(
      `UPDATE players SET last_active = NOW() WHERE id = $1 RETURNING id, username`,
      [payload.sub]
    );
    if (res.rows.length === 0) {
      return reply.status(401).send({ error: 'Player not found' });
    }

    request.player = { id: res.rows[0].id, username: res.rows[0].username };
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}
