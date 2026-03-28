import 'dotenv/config';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyWebSocket from '@fastify/websocket';
import { authRoutes } from './routes/auth.js';
import { businessRoutes } from './routes/businesses.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { locationRoutes } from './routes/locations.js';
import { employeeRoutes } from './routes/employees.js';
import { inventoryRoutes } from './routes/inventory.js';
import { marketRoutes } from './routes/market.js';
import { discoveryRoutes } from './routes/discovery.js';
import { gameInfoRoutes } from './routes/game-info.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { actionRoutes } from './routes/actions.js';
import { eventsRoutes } from './routes/events.js';
import { crimeRoutes } from './routes/crime.js';
import { managerRoutes } from './routes/managers.js';
import { intelRoutes } from './routes/intel.js';
import { setupQueues, shutdownQueues } from './jobs/queue.js';
import pool from './db/client.js';
import { addClient, removeClient, getConnectionCount } from './websocket/connections.js';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url?.replace(/token=[^&]+/g, 'token=REDACTED'),
          hostname: req.hostname,
          remoteAddress: req.ip,
        };
      },
    },
  },
});

async function main() {
  // CORS
  await app.register(fastifyCors, {
    origin: [
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:19006',
      'http://187.124.18.170:8080',
      'http://187.124.18.170',
    ],
    credentials: true,
  });

  // JWT
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'dev-only-secret-not-for-production',
  });

  // Rate limit (global: false — only applied per-route)
  await app.register(fastifyRateLimit, {
    global: false,
  });

  // WebSocket
  await app.register(fastifyWebSocket);

  // ─── WebSocket endpoint ────────────────────────────────────────
  app.get('/ws', { websocket: true }, (socket, req) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    if (!token) { socket.close(4001, 'Missing token'); return; }

    let playerId: string;
    try {
      const decoded = app.jwt.verify<{ sub: string; type: string }>(token);
      if (decoded.type !== 'access') { socket.close(4003, 'Invalid token type'); return; }
      playerId = decoded.sub;
    } catch {
      socket.close(4002, 'Invalid token');
      return;
    }

    addClient(playerId, socket);
    socket.send(JSON.stringify({ channel: 'connected', data: { playerId } }));

    socket.on('close', () => removeClient(playerId, socket));
    socket.on('error', () => removeClient(playerId, socket));
  });

  // ─── Routes ────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(locationRoutes, { prefix: '/api/v1/locations' });
  await app.register(businessRoutes, { prefix: '/api/v1/businesses' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(employeeRoutes, { prefix: '/api/v1/employees' });
  await app.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
  await app.register(marketRoutes, { prefix: '/api/v1/market' });
  await app.register(discoveryRoutes, { prefix: '/api/v1/discovery' });
  await app.register(gameInfoRoutes, { prefix: '/api/v1/game/info' });
  await app.register(leaderboardRoutes, { prefix: '/api/v1/leaderboard' });
  await app.register(actionRoutes, { prefix: '/api/v1/actions' });
  await app.register(eventsRoutes, { prefix: '/api/v1' });
  await app.register(crimeRoutes, { prefix: '/api/v1/crime' });
  await app.register(managerRoutes, { prefix: '/api/v1' });
  await app.register(intelRoutes, { prefix: '/api/v1/intel' });

  // ─── Health ────────────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    version: 'v3',
    timestamp: new Date().toISOString(),
    ws_connections: getConnectionCount(),
  }));

  // ─── Dev endpoints ─────────────────────────────────────────────
  app.post('/dev/tick/:type', async (req, reply) => {
    const { type } = req.params as { type: string };
    if (type === 'production') {
      const { runProductionTick } = await import('./jobs/production.js');
      const result = await runProductionTick();
      return reply.send({ ok: true, ...result });
    }
    if (type === 'economy') {
      const { runEconomyTick } = await import('./jobs/economy.js');
      const result = await runEconomyTick();
      return reply.send({ ok: true, ...result });
    }
    if (type === 'autosell') {
      const { runAutosellTick } = await import('./jobs/autosell.js');
      const result = await runAutosellTick();
      return reply.send({ ok: true, ...result });
    }
    if (type === 'daily') {
      const { runDailyTick } = await import('./jobs/daily.js');
      const result = await runDailyTick();
      return reply.send({ ok: true, ...result });
    }
    return reply.send({ ok: true, tick_type: type, message: 'tick not yet implemented' });
  });

  app.get('/dev/snapshot', async (_req, reply) => {
    const q = (sql: string) => pool.query(sql).then(r => r.rows);
    const [counts] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM players)::int AS players,
          (SELECT COUNT(*) FROM businesses)::int AS businesses,
          (SELECT COUNT(*) FROM employees)::int AS employees,
          (SELECT COUNT(*) FROM market_listings WHERE status = 'open')::int AS open_listings
      `).then(r => r.rows[0]),
    ]);
    reply.header('Access-Control-Allow-Origin', '*');
    return reply.send({ counts });
  });

  // ─── BullMQ setup (stub) ──────────────────────────────────────
  await setupQueues();

  // ─── Graceful shutdown ─────────────────────────────────────────
  const shutdown = async (sig: string) => {
    app.log.info(`${sig} received, shutting down`);
    await shutdownQueues();
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // ─── Listen ────────────────────────────────────────────────────
  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`EmpireOS v3 listening on port ${port}`);
}

main().catch((err) => {
  console.error('[startup] Fatal:', err);
  process.exit(1);
});
