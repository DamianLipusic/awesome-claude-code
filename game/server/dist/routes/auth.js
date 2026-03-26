"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("../db/client");
const season_1 = require("../lib/season");
const RegisterSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username: alphanumeric and underscores only'),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).max(100),
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
const RefreshSchema = zod_1.z.object({
    refresh_token: zod_1.z.string().min(1),
});
const SALT_ROUNDS = 12;
const REFRESH_TOKEN_EXP_MS = 30 * 24 * 60 * 60 * 1000;
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
async function issueTokenPair(app, playerId, username, seasonId) {
    const access_token = app.jwt.sign({ sub: playerId, username, type: 'access', season_id: seasonId }, { expiresIn: '15m' });
    const rawRefreshToken = crypto_1.default.randomBytes(48).toString('hex');
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXP_MS);
    await (0, client_1.query)(`INSERT INTO refresh_tokens (player_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`, [playerId, tokenHash, expiresAt.toISOString()]);
    // Encode playerid:rawToken as base64url so client can send it back
    const refresh_token = Buffer.from(`${playerId}:${rawRefreshToken}`).toString('base64url');
    return { access_token, refresh_token, expires_in: 15 * 60 };
}
async function authRoutes(app) {
    // POST /auth/register
    app.post('/register', async (request, reply) => {
        const parsed = RegisterSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.errors[0].message });
        }
        const { username, email, password } = parsed.data;
        // Check uniqueness
        const existing = await (0, client_1.query)(`SELECT id FROM players WHERE email = $1 OR username = $2`, [email, username]);
        if (existing.rows.length > 0) {
            return reply.status(409).send({ error: 'Username or email already taken' });
        }
        const season = await (0, season_1.getCurrentSeason)();
        const password_hash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
        const playerId = await (0, client_1.withTransaction)(async (client) => {
            const startingCash = season ? Number(season.starting_cash) : 25000;
            const playerRes = await client.query(`INSERT INTO players
           (username, email, password_hash, season_id, cash, net_worth, business_slots,
            reputation_score, alignment, meta_points, season_history, cosmetics, veteran_bonus_cash)
         VALUES ($1,$2,$3,$4,$5,$5,3,0,'LEGAL',0,'[]','{}',0)
         RETURNING id`, [username, email, password_hash, season?.id ?? null, startingCash]);
            const pid = playerRes.rows[0].id;
            if (season) {
                await client.query(`INSERT INTO heat_scores (player_id, season_id, score, level, decay_rate)
           VALUES ($1,$2,0,'COLD',2.0)`, [pid, season.id]);
                await client.query(`INSERT INTO dirty_money_balances (player_id, season_id, total_dirty, total_earned, total_laundered)
           VALUES ($1,$2,0,0,0)`, [pid, season.id]);
                await client.query(`UPDATE season_profiles SET total_players = total_players + 1 WHERE id = $1`, [season.id]);
            }
            return pid;
        });
        const tokens = await issueTokenPair(app, playerId, username, season?.id ?? null);
        return reply.status(201).send({
            data: { player_id: playerId, username, ...tokens },
        });
    });
    // POST /auth/login
    app.post('/login', async (request, reply) => {
        const parsed = LoginSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.errors[0].message });
        }
        const { email, password } = parsed.data;
        const res = await (0, client_1.query)(`SELECT id, username, password_hash, season_id FROM players WHERE email = $1`, [email]);
        if (res.rows.length === 0) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const player = res.rows[0];
        const valid = await bcrypt_1.default.compare(password, player.password_hash);
        if (!valid) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const tokens = await issueTokenPair(app, player.id, player.username, player.season_id);
        return reply.send({ data: { player_id: player.id, username: player.username, ...tokens } });
    });
    // POST /auth/refresh
    app.post('/refresh', async (request, reply) => {
        const parsed = RefreshSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'refresh_token required' });
        }
        let playerId;
        let rawToken;
        try {
            const decoded = Buffer.from(parsed.data.refresh_token, 'base64url').toString();
            const colonIdx = decoded.indexOf(':');
            if (colonIdx === -1)
                throw new Error('bad format');
            playerId = decoded.slice(0, colonIdx);
            rawToken = decoded.slice(colonIdx + 1);
        }
        catch {
            return reply.status(401).send({ error: 'Invalid refresh token' });
        }
        const tokenHash = hashToken(rawToken);
        const tokenRes = await (0, client_1.query)(`SELECT id, expires_at FROM refresh_tokens
        WHERE player_id = $1 AND token_hash = $2`, [playerId, tokenHash]);
        if (tokenRes.rows.length === 0) {
            return reply.status(401).send({ error: 'Invalid or expired refresh token' });
        }
        if (new Date(tokenRes.rows[0].expires_at) < new Date()) {
            await (0, client_1.query)(`DELETE FROM refresh_tokens WHERE id = $1`, [tokenRes.rows[0].id]);
            return reply.status(401).send({ error: 'Refresh token expired' });
        }
        // Rotate
        await (0, client_1.query)(`DELETE FROM refresh_tokens WHERE id = $1`, [tokenRes.rows[0].id]);
        const playerRes = await (0, client_1.query)(`SELECT username, season_id FROM players WHERE id = $1`, [playerId]);
        if (playerRes.rows.length === 0) {
            return reply.status(401).send({ error: 'Player not found' });
        }
        const tokens = await issueTokenPair(app, playerId, playerRes.rows[0].username, playerRes.rows[0].season_id);
        return reply.send({ data: tokens });
    });
    // POST /auth/logout
    app.post('/logout', async (request, reply) => {
        const parsed = RefreshSchema.safeParse(request.body);
        if (parsed.success) {
            try {
                const decoded = Buffer.from(parsed.data.refresh_token, 'base64url').toString();
                const colonIdx = decoded.indexOf(':');
                if (colonIdx !== -1) {
                    const pid = decoded.slice(0, colonIdx);
                    const raw = decoded.slice(colonIdx + 1);
                    const tokenHash = hashToken(raw);
                    await (0, client_1.query)(`DELETE FROM refresh_tokens WHERE player_id = $1 AND token_hash = $2`, [pid, tokenHash]);
                }
            }
            catch {
                // Ignore parse errors on logout
            }
        }
        return reply.send({ data: { message: 'Logged out successfully' } });
    });
}
//# sourceMappingURL=auth.js.map