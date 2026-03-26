import 'dotenv/config';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyHelmet from '@fastify/helmet';
import { authRoutes } from './routes/auth';
import { playerRoutes } from './routes/players';
import { businessRoutes } from './routes/businesses';
import { employeeRoutes } from './routes/employees';
import { marketRoutes } from './routes/market';
import { contractRoutes } from './routes/contracts';
import { crimeRoutes } from './routes/crime';
import { seasonRoutes } from './routes/seasons';
import managerRoutes from './routes/managers';
import logisticsRoutes from './routes/logistics';
import eventRoutes from './routes/events';
import locationRoutes from './routes/locations';
import { reputationRoutes } from './routes/reputation';
import { allianceRoutes } from './routes/alliances';
import { rivalryRoutes } from './routes/rivalry';
import { intelligenceRoutes } from './routes/intelligence';
import businessListingRoutes from './routes/businessListings';
import { registerWebSocketHandler } from './websocket/handler';
import { startWorkers, scheduleRecurringJobs } from './jobs/queue';
import { runGameTick } from './jobs/gameTick';
import pool from './db/client';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
  bodyLimit: 102400, // 100KB max request body
});

async function main() {
  // ─── Plugins ──────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // CSP handled by frontend
  });
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8080,http://187.124.18.170:8080,http://187.124.18.170').split(',');
  await app.register(fastifyCors, {
    origin: allowedOrigins,
    credentials: true,
  });
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  await app.register(fastifyJwt, {
    secret: jwtSecret || 'dev-only-secret-not-for-production',
  });
  await app.register(fastifyWebsocket);
  await app.register(fastifyRateLimit, {
    global: false, // only apply where explicitly configured
  });

  // ─── Routes ───────────────────────────────────────────────────
  await app.register(authRoutes,     { prefix: '/api/v1/auth' });
  await app.register(playerRoutes,   { prefix: '/api/v1/players' });
  await app.register(businessRoutes, { prefix: '/api/v1/businesses' });
  await app.register(employeeRoutes, { prefix: '/api/v1/employees' });
  await app.register(marketRoutes,   { prefix: '/api/v1/market' });
  await app.register(contractRoutes, { prefix: '/api/v1/contracts' });
  await app.register(crimeRoutes,    { prefix: '/api/v1/crime' });
  await app.register(seasonRoutes,   { prefix: '/api/v1/seasons' });
  await app.register(managerRoutes,  { prefix: '/api/v1/managers' });
  await app.register(logisticsRoutes, { prefix: '/api/v1/logistics' });
  await app.register(eventRoutes,    { prefix: '/api/v1/events' });
  await app.register(locationRoutes, { prefix: '/api/v1/locations' });
  await app.register(reputationRoutes,    { prefix: '/api/v1/reputation' });
  await app.register(allianceRoutes,      { prefix: '/api/v1/alliances' });
  await app.register(rivalryRoutes,       { prefix: '/api/v1/rivalry' });
  await app.register(intelligenceRoutes,  { prefix: '/api/v1/intelligence' });
  await app.register(businessListingRoutes, { prefix: '/api/v1/business-listings' });

  // ─── WebSocket ────────────────────────────────────────────────
  await registerWebSocketHandler(app);

  // ─── Health check ─────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // ─── Dev: trigger game tick instantly ─────────────────────────
  app.post('/dev/tick', async (_request, reply) => {
    const start = Date.now();
    await runGameTick();
    return reply.send({ ok: true, duration_ms: Date.now() - start });
  });

  // ─── Dev: economy snapshot ──────────────────────────────────
  app.get('/dev/snapshot', async (_request, reply) => {
    const q = (sql: string) => pool.query(sql).then(r => r.rows);
    const [counts, recentSales, recentNpc, lastTick, topPlayers] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM players)::int AS players,
          (SELECT COUNT(*) FROM players WHERE is_npc = true)::int AS npcs,
          (SELECT COUNT(*) FROM businesses WHERE status = 'ACTIVE')::int AS businesses,
          (SELECT COUNT(*) FROM employees WHERE business_id IS NOT NULL)::int AS employees_hired,
          (SELECT COUNT(*) FROM employees WHERE business_id IS NULL)::int AS employees_pool,
          (SELECT COUNT(*) FROM market_listings WHERE status = 'OPEN')::int AS open_listings,
          (SELECT COUNT(*) FROM criminal_operations)::int AS crime_ops
      `).then(r => r.rows[0]),
      q(`SELECT a.message, a.created_at FROM alerts a
         WHERE a.type = 'MARKET_SOLD' ORDER BY a.created_at DESC LIMIT 10`),
      q(`SELECT co.op_type::text, co.status::text, co.dirty_money_yield::int, co.started_at AS created_at,
                p.username FROM criminal_operations co
         JOIN players p ON p.id = co.player_id
         ORDER BY co.started_at DESC LIMIT 10`),
      q(`SELECT completed_at, duration_ms, npc_actions_count FROM game_ticks
         ORDER BY completed_at DESC LIMIT 1`),
      q(`SELECT p.username, p.cash::int, p.net_worth::int, p.is_npc,
                (SELECT COUNT(*) FROM businesses b WHERE b.owner_id = p.id AND b.status = 'ACTIVE')::int AS biz_count
         FROM players p ORDER BY p.net_worth DESC LIMIT 15`),
    ]);
    reply.header('Access-Control-Allow-Origin', '*');
    return reply.send({ counts, recentSales, recentNpc, lastTick: lastTick[0] || null, topPlayers });
  });

  // ─── Dev: run smoke test (async, non-blocking) ──────────────
  let smokeResult: { running: boolean; ok?: boolean; passed?: number; failed?: number; output?: string } = { running: false };
  app.post('/dev/smoke', async (_request, reply) => {
    if (smokeResult.running) {
      reply.header('Access-Control-Allow-Origin', '*');
      return reply.send({ running: true, message: 'Smoke test already in progress' });
    }
    smokeResult = { running: true };
    const { spawn } = await import('child_process');
    const child = spawn('node', ['/root/awesome-claude-code/game/tests/smoke.mjs'], {
      timeout: 60000, env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
    let out = '';
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { out += d.toString(); });
    child.on('close', (code: number | null) => {
      const passed = (out.match(/PASS/g) || []).length;
      const failed = (out.match(/FAIL/g) || []).length;
      smokeResult = { running: false, ok: code === 0, passed, failed, output: out };
    });
    reply.header('Access-Control-Allow-Origin', '*');
    return reply.send({ running: true, message: 'Smoke test started' });
  });
  app.get('/dev/smoke', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    return reply.send(smokeResult);
  });

  // ─── BullMQ workers ───────────────────────────────────────────
  try {
    await startWorkers();
    await scheduleRecurringJobs();
    app.log.info('BullMQ workers started and recurring jobs scheduled.');
  } catch (err) {
    app.log.warn({ err }, 'BullMQ workers could not start (Redis may be unavailable)');
  }

  // ─── Graceful shutdown ────────────────────────────────────────
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT',  () => { void shutdown('SIGINT'); });

  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Server listening on port ${port}`);
}

main().catch((err) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
