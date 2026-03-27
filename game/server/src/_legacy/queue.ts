import { runGameTick } from './gameTick';
import { Queue, Worker, Job, type ConnectionOptions } from 'bullmq';
import {
  economy_update,
  market_refresh,
  crime_action_resolve,
  laundering_tick,
  heat_decay,
  daily_costs,
  progressive_tax,
  season_reset,
  employee_production,
} from './simulation';
import { query } from '../db/client';

// ─── Redis Connection ─────────────────────────────────────────
// Pass plain RedisOptions to BullMQ to avoid ioredis version conflicts
// (bullmq bundles its own ioredis internally)

export function createRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  } catch {
    return {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
}

// ─── Queue Definitions ────────────────────────────────────────

let simulationQueue: Queue;
let dailyQueue: Queue;
let settlementsQueue: Queue;
let productionQueue: Queue;

export function initQueues(): void {
  const connection = createRedisConnection();

  simulationQueue = new Queue('simulation', { connection });
  dailyQueue = new Queue('daily', { connection });
  settlementsQueue = new Queue('settlements', { connection });
  productionQueue = new Queue('production', { connection });

  console.log('[queue] Queues initialized.');
}

export function getSimulationQueue(): Queue {
  return simulationQueue;
}

export function getSettlementsQueue(): Queue {
  return settlementsQueue;
}

export function getProductionQueue(): Queue {
  return productionQueue;
}

// ─── Schedule Repeating Jobs ──────────────────────────────────

export async function scheduleRepeatingJobs(): Promise<void> {
  // Remove existing repeatable jobs first to prevent duplicates on restart
  const existingSimJobs = await simulationQueue.getRepeatableJobs();
  for (const job of existingSimJobs) {
    await simulationQueue.removeRepeatableByKey(job.key);
  }

  const existingDailyJobs = await dailyQueue.getRepeatableJobs();
  for (const job of existingDailyJobs) {
    await dailyQueue.removeRepeatableByKey(job.key);
  }

  // NOTE: economy_tick removed — processMarketPrices in gameTick handles pricing + supply regen

  // Market refresh every 60 minutes
  await simulationQueue.add(
    'market_refresh',
    { type: 'market_refresh' },
    {
      repeat: { every: 60 * 60 * 1000 }, // 60 min in ms
      jobId: 'market_refresh_repeat',
    }
  );

  // Heat decay every hour
  await simulationQueue.add(
    'heat_decay',
    { type: 'heat_decay' },
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: 'heat_decay_repeat',
    }
  );

  // Daily costs every 24 hours
  await dailyQueue.add(
    'daily_costs',
    { type: 'daily_costs' },
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: 'daily_costs_repeat',
    }
  );

  // Progressive tax every 24 hours (offset by 1 hour from daily costs)
  await dailyQueue.add(
    'progressive_tax',
    { type: 'progressive_tax' },
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      delay: 60 * 60 * 1000, // offset 1 hour
      jobId: 'progressive_tax_repeat',
    }
  );

  // Game tick every 5 minutes (new enhanced system)
  await simulationQueue.add(
    'game_tick',
    { type: 'game_tick' },
    {
      repeat: { every: 5 * 60 * 1000 }, // 5 min in ms
      jobId: 'game_tick_repeat',
    }
  );

  console.log('[queue] Repeating jobs scheduled.');
}

// ─── Get Active Season ────────────────────────────────────────

async function getActiveSeasonId(): Promise<string | null> {
  const res = await query<{ id: string }>(
    `SELECT id FROM season_profiles WHERE status='ACTIVE' LIMIT 1`
  );
  return res.rows[0]?.id ?? null;
}

// ─── Workers (internal — called via startWorkers() wrapper below) ────────────

// ─── Job Schedulers for Triggered Jobs ───────────────────────

export async function scheduleCrimeResolveJob(
  operation_id: string,
  completes_at: Date
): Promise<void> {
  const delay = Math.max(0, completes_at.getTime() - Date.now());
  await settlementsQueue.add(
    'crime_resolve',
    { type: 'crime_resolve', operation_id },
    { delay, jobId: `crime_resolve_${operation_id}`, attempts: 3 }
  );
}

export async function scheduleLaunderingJob(
  process_id: string,
  completes_at: Date
): Promise<void> {
  const delay = Math.max(0, completes_at.getTime() - Date.now());
  await settlementsQueue.add(
    'laundering_complete',
    { type: 'laundering_complete', process_id },
    { delay, jobId: `laundering_${process_id}`, attempts: 3 }
  );
}

export async function scheduleProductionJob(business_id: string): Promise<void> {
  await productionQueue.add(
    'employee_production',
    { type: 'employee_production', business_id },
    { attempts: 2 }
  );
}

// ─── index.ts-compatible entry points ────────────────────────
// These wrappers accept an optional season_id for forward compatibility
// and delegate to the underlying queue initialisation functions.

export async function startWorkers(_seasonId?: string): Promise<void> {
  initQueues();
  startWorkersInternal();
}

export async function scheduleRecurringJobs(_seasonId?: string): Promise<void> {
  await scheduleRepeatingJobs();
}

// Rename internal functions to avoid collision with the exported wrappers above
function startWorkersInternal(): void {
  const connection = createRedisConnection();

  // Simulation worker
  new Worker(
    'simulation',
    async (job: Job) => {
      const seasonId = await getActiveSeasonId();
      if (!seasonId && job.data.type !== 'heat_decay' && job.data.type !== 'game_tick') {
        console.warn(`[worker:simulation] No active season found for job: ${job.name}`);
        return;
      }
      switch (job.data.type ?? job.name) {
        case 'market_refresh':
          if (seasonId) await market_refresh(seasonId);
          break;
        case 'heat_decay':
          await heat_decay();
          break;
        case 'game_tick':
          await runGameTick();
          break;
        default:
          console.warn(`[worker:simulation] Unknown job type: ${job.data.type ?? job.name}`);
      }
    },
    { connection, concurrency: 1 }
  );

  // Daily worker
  new Worker(
    'daily',
    async (job: Job) => {
      const seasonId = await getActiveSeasonId();
      if (!seasonId) {
        console.warn(`[worker:daily] No active season found for job: ${job.name}`);
        return;
      }
      switch (job.data.type ?? job.name) {
        case 'daily_costs':
          await daily_costs(seasonId);
          break;
        case 'progressive_tax':
          await progressive_tax(seasonId);
          break;
        case 'season_reset':
          await season_reset(job.data.season_id);
          break;
        default:
          console.warn(`[worker:daily] Unknown job type: ${job.data.type ?? job.name}`);
      }
    },
    { connection: createRedisConnection(), concurrency: 1 }
  );

  // Settlements worker
  new Worker(
    'settlements',
    async (job: Job) => {
      switch (job.data.type ?? job.name) {
        case 'crime_resolve':
          await crime_action_resolve(job.data.operation_id);
          break;
        case 'laundering_complete':
          await laundering_tick();
          break;
        default:
          console.warn(`[worker:settlements] Unknown job type: ${job.data.type ?? job.name}`);
      }
    },
    { connection: createRedisConnection(), concurrency: 5 }
  );

  // Production worker
  new Worker(
    'production',
    async (job: Job) => {
      switch (job.data.type ?? job.name) {
        case 'employee_production':
          await employee_production(job.data.business_id);
          break;
        default:
          console.warn(`[worker:production] Unknown job type: ${job.data.type ?? job.name}`);
      }
    },
    { connection: createRedisConnection(), concurrency: 10 }
  );

  console.log('[queue] Workers started (internal).');
}
