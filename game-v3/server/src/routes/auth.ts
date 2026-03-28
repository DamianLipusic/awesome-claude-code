import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import crypto from 'crypto';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const RegisterSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric and underscores only'),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const SALT_ROUNDS = 12;
const REFRESH_EXP_MS = 30 * 24 * 60 * 60 * 1000;
const STARTING_CASH = 75000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueTokenPair(
  app: FastifyInstance, playerId: string, username: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const access_token = app.jwt.sign(
    { sub: playerId, username, type: 'access' },
    { expiresIn: '15m' },
  );
  const rawRefresh = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawRefresh);
  const expiresAt = new Date(Date.now() + REFRESH_EXP_MS);

  await query(
    `INSERT INTO refresh_tokens (player_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [playerId, tokenHash, expiresAt.toISOString()],
  );

  const refresh_token = Buffer.from(`${playerId}:${rawRefresh}`).toString('base64url');
  return { access_token, refresh_token, expires_in: 15 * 60 };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const authRateLimit = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  };

  // POST /register
  app.post('/register', authRateLimit, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
    const { username, email, password } = parsed.data;

    const existing = await query(`SELECT id FROM players WHERE email = $1 OR username = $2`, [email, username]);
    if (existing.rows.length > 0) return reply.status(409).send({ error: 'Username or email already taken' });

    // Fetch active season for the new player
    const seasonRes = await query<{ id: string }>(`SELECT id FROM seasons WHERE status = 'active' LIMIT 1`);
    const seasonId = seasonRes.rows[0]?.id;

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const res = await query<{ id: string }>(
      `INSERT INTO players (username, email, password_hash, cash, season_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [username, email, password_hash, STARTING_CASH, seasonId ?? null],
    );
    const playerId = res.rows[0].id;

    const tokens = await issueTokenPair(app, playerId, username);
    return reply.status(201).send({ data: { player_id: playerId, username, ...tokens } });
  });

  // POST /login
  app.post('/login', authRateLimit, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
    const { email, password } = parsed.data;

    const res = await query<{ id: string; username: string; password_hash: string }>(
      `SELECT id, username, password_hash FROM players WHERE email = $1`, [email],
    );
    if (!res.rows.length) return reply.status(401).send({ error: 'Invalid credentials' });

    const player = res.rows[0];
    const valid = await bcrypt.compare(password, player.password_hash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    const tokens = await issueTokenPair(app, player.id, player.username);
    return reply.send({ data: { player_id: player.id, username: player.username, ...tokens } });
  });

  // POST /refresh
  app.post('/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'refresh_token required' });

    let playerId: string, rawToken: string;
    try {
      const decoded = Buffer.from(parsed.data.refresh_token, 'base64url').toString();
      const idx = decoded.indexOf(':');
      if (idx === -1) throw new Error();
      playerId = decoded.slice(0, idx);
      rawToken = decoded.slice(idx + 1);
    } catch { return reply.status(401).send({ error: 'Invalid refresh token' }); }

    const tokenHash = hashToken(rawToken);
    const tokenRes = await query<{ id: string; expires_at: string }>(
      `SELECT id, expires_at FROM refresh_tokens WHERE player_id = $1 AND token_hash = $2`, [playerId, tokenHash],
    );
    if (!tokenRes.rows.length) return reply.status(401).send({ error: 'Invalid refresh token' });
    if (new Date(tokenRes.rows[0].expires_at) < new Date()) {
      await query(`DELETE FROM refresh_tokens WHERE id = $1`, [tokenRes.rows[0].id]);
      return reply.status(401).send({ error: 'Refresh token expired' });
    }

    await query(`DELETE FROM refresh_tokens WHERE id = $1`, [tokenRes.rows[0].id]);
    const playerRes = await query<{ username: string }>(`SELECT username FROM players WHERE id = $1`, [playerId]);
    if (!playerRes.rows.length) return reply.status(401).send({ error: 'Player not found' });

    const tokens = await issueTokenPair(app, playerId, playerRes.rows[0].username);
    return reply.send({ data: tokens });
  });

  // POST /logout
  app.post('/logout', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = RefreshSchema.safeParse(req.body);
    if (parsed.success) {
      try {
        const decoded = Buffer.from(parsed.data.refresh_token, 'base64url').toString();
        const idx = decoded.indexOf(':');
        if (idx !== -1) {
          const pid = decoded.slice(0, idx);
          const raw = decoded.slice(idx + 1);
          await query(`DELETE FROM refresh_tokens WHERE player_id = $1 AND token_hash = $2`, [pid, hashToken(raw)]);
        }
      } catch { /* ignore */ }
    }
    return reply.send({ data: { message: 'Logged out' } });
  });

  // GET /me
  app.get('/me', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const res = await query(
      `SELECT id, username, cash, bank_balance, xp, level, season_id, created_at FROM players WHERE id = $1`,
      [req.player.id],
    );
    if (!res.rows.length) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ data: res.rows[0] });
  });
}
