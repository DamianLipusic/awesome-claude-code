// EmpireOS V3 — BullMQ queue setup
// 4 queues: production, economy, autosell, daily

import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { runProductionTick } from './production.js';
import { runEconomyTick } from './economy.js';
import { runAutosellTick } from './autosell.js';
import { runDailyTick } from './daily.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const QUEUE_DEFS = [
  { name: 'production', interval: 60_000 },       // every 1 min
  { name: 'economy',    interval: 300_000 },       // every 5 min
  { name: 'autosell',   interval: 1_800_000 },     // every 30 min
  { name: 'daily',      interval: 86_400_000 },    // every 24 hours
];

const JOB_OPTS = { removeOnComplete: 10, removeOnFail: 50 };
const queues: Queue[] = [];
const workers: Worker[] = [];

export async function setupQueues(): Promise<void> {
  const handlers: Record<string, () => Promise<void>> = {
    production: async () => {
      const r = await runProductionTick();
      if (r.produced > 0) console.log(`[tick:production] ${r.businesses} biz, ${r.produced} produced, ${r.duration_ms}ms`);
    },
    economy: async () => {
      const r = await runEconomyTick();
      console.log(`[tick:economy] ${r.listings_added} listings, ${r.prices_updated} prices, ${r.duration_ms}ms`);
    },
    autosell: async () => {
      const r = await runAutosellTick();
      if (r.total_revenue > 0) console.log(`[tick:autosell] ${r.businesses_sold} biz, $${r.total_revenue.toFixed(2)}, ${r.duration_ms}ms`);
    },
    daily: async () => {
      const r = await runDailyTick();
      console.log(`[tick:daily] ${r.players_charged} charged, ${r.employees_generated} emps, ${r.phases_upgraded} upgrades, ${r.duration_ms}ms`);
    },
  };

  for (const def of QUEUE_DEFS) {
    const queue = new Queue(def.name, { connection: connection.duplicate() });
    await queue.obliterate({ force: true });
    await queue.add(`tick:${def.name}`, { type: def.name }, { repeat: { every: def.interval }, ...JOB_OPTS });
    queues.push(queue);

    const worker = new Worker(def.name, handlers[def.name] ?? (async () => {}), {
      connection: connection.duplicate(),
      concurrency: 1,
    });
    worker.on('failed', (job, err) => console.error(`[queue:${def.name}] Failed:`, err.message));
    workers.push(worker);
  }
  console.log(`[queues] ${QUEUE_DEFS.length} BullMQ queues registered`);
}

export async function shutdownQueues(): Promise<void> {
  for (const w of workers) await w.close();
  for (const q of queues) await q.close();
  connection.disconnect();
  console.log('[queues] All queues shut down');
}
