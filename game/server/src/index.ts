import 'dotenv/config';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/game';
import { runGameTick } from './jobs/gameTick';
import pool from './db/client';

const app = Fastify({
  logger: { level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' },
});

async function main() {
  await app.register(fastifyCors, { origin: true, credentials: true });
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'dev-only-secret-not-for-production',
  });
  await app.register(fastifyRateLimit, {
    global: false, // Don't apply globally, only to specific routes
  });

  // Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(gameRoutes, { prefix: '/api/v1/game' });

  // Health
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Dev: manual tick
  app.post('/dev/tick', async (_req, reply) => {
    const result = await runGameTick();
    return reply.send({ ok: true, ...result });
  });

  // Dev: snapshot
  app.get('/dev/snapshot', async (_req, reply) => {
    const q = (sql: string) => pool.query(sql).then(r => r.rows);
    const [counts, topPlayers, lastTick] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM players)::int AS players,
          (SELECT COUNT(*) FROM businesses)::int AS businesses,
          (SELECT COUNT(*) FROM workers)::int AS workers
      `).then(r => r.rows[0]),
      q(`SELECT username, cash::int, net_worth::int,
           (SELECT COUNT(*) FROM businesses b WHERE b.owner_id = p.id)::int AS biz_count
         FROM players p ORDER BY p.net_worth DESC LIMIT 10`),
      q(`SELECT completed_at, duration_ms, businesses_processed, goods_produced
         FROM game_ticks ORDER BY completed_at DESC LIMIT 1`),
    ]);
    reply.header('Access-Control-Allow-Origin', '*');
    return reply.send({ counts, topPlayers, lastTick: lastTick[0] || null });
  });

  // Dev: validation status
  app.get('/dev/validation', async (_req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    try {
      const resultsPath = join(__dirname, '../../tests/validation-results/latest.json');
      const data = JSON.parse(readFileSync(resultsPath, 'utf8'));
      return reply.send(data);
    } catch {
      return reply.send({ status: 'NO_DATA', message: 'No validation results found. Run: ./tests/validate.sh' });
    }
  });

  // Dev: project intelligence
  app.get('/dev/intel', async (_req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    try {
      const intelDir = join(__dirname, '../../.intel');
      const state = JSON.parse(readFileSync(join(intelDir, 'project_state.json'), 'utf8'));
      const tasks = JSON.parse(readFileSync(join(intelDir, 'tasks.json'), 'utf8'));

      // Read last 20 lines of execution log
      const logLines = readFileSync(join(intelDir, 'execution.log'), 'utf8')
        .split('\n').filter(l => l.startsWith('[')).slice(-20);

      return reply.send({
        state,
        tasks: tasks.meta,
        running_tasks: tasks.tasks.filter((t: { status: string }) => t.status === 'running'),
        next_tasks: tasks.tasks.filter((t: { status: string }) => t.status === 'pending').slice(0, 5),
        recent_log: logLines,
      });
    } catch (err) {
      return reply.send({ status: 'NO_DATA', message: 'Project intelligence not initialized. Create .intel/ files.' });
    }
  });

  // Auto-tick every 2 minutes
  const TICK_INTERVAL = 2 * 60 * 1000;
  setInterval(async () => {
    try {
      const r = await runGameTick();
      if (r.produced > 0) app.log.info(`[tick] ${r.businesses} businesses, ${r.produced} goods, ${r.duration_ms}ms`);
    } catch (e) {
      app.log.error(e, '[tick] failed');
    }
  }, TICK_INTERVAL);

  // Graceful shutdown
  const shutdown = async (sig: string) => {
    app.log.info(`${sig} received, shutting down`);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`EmpireOS v2 listening on port ${port}`);
}

main().catch((err) => {
  console.error('[startup] Fatal:', err);
  process.exit(1);
});
