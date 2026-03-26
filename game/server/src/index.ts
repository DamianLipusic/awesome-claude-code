import 'dotenv/config';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
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
import pool from './db/client';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
});

async function main() {
  // ─── Plugins ──────────────────────────────────────────────────
  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  });
  await app.register(fastifyWebsocket);

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
