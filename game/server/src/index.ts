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
import { registerWebSocketHandler } from './websocket/handler';
import { startWorkers, scheduleRecurringJobs } from './jobs/queue';
import { getCurrentSeason } from './lib/season';
import pool from './db/client';

const app = Fastify({ logger: true });

async function main() {
  // Plugins
  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyJwt, { secret: process.env.JWT_SECRET || 'dev-secret' });
  await app.register(fastifyWebsocket);

  // Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(playerRoutes, { prefix: '/api/v1/players' });
  await app.register(businessRoutes, { prefix: '/api/v1/businesses' });
  await app.register(employeeRoutes, { prefix: '/api/v1/employees' });
  await app.register(marketRoutes, { prefix: '/api/v1/market' });
  await app.register(contractRoutes, { prefix: '/api/v1/contracts' });
  await app.register(crimeRoutes, { prefix: '/api/v1/crime' });
  await app.register(seasonRoutes, { prefix: '/api/v1/seasons' });

  // WebSocket
  await registerWebSocketHandler(app);

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Start BullMQ workers
  const season = await getCurrentSeason();
  if (season) {
    await startWorkers(season.id);
    await scheduleRecurringJobs(season.id);
  } else {
    console.warn('No active season found — workers not started');
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
  console.log('Server running on port', process.env.PORT || 3000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
