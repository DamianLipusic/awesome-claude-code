"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisConnection = createRedisConnection;
exports.initQueues = initQueues;
exports.getSimulationQueue = getSimulationQueue;
exports.getSettlementsQueue = getSettlementsQueue;
exports.getProductionQueue = getProductionQueue;
exports.scheduleRepeatingJobs = scheduleRepeatingJobs;
exports.scheduleCrimeResolveJob = scheduleCrimeResolveJob;
exports.scheduleLaunderingJob = scheduleLaunderingJob;
exports.scheduleProductionJob = scheduleProductionJob;
exports.startWorkers = startWorkers;
exports.scheduleRecurringJobs = scheduleRecurringJobs;
const bullmq_1 = require("bullmq");
const simulation_1 = require("./simulation");
const client_1 = require("../db/client");
// ─── Redis Connection ─────────────────────────────────────────
// Pass plain RedisOptions to BullMQ to avoid ioredis version conflicts
// (bullmq bundles its own ioredis internally)
function createRedisConnection() {
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
    }
    catch {
        return {
            host: 'localhost',
            port: 6379,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };
    }
}
// ─── Queue Definitions ────────────────────────────────────────
let simulationQueue;
let dailyQueue;
let settlementsQueue;
let productionQueue;
function initQueues() {
    const connection = createRedisConnection();
    simulationQueue = new bullmq_1.Queue('simulation', { connection });
    dailyQueue = new bullmq_1.Queue('daily', { connection });
    settlementsQueue = new bullmq_1.Queue('settlements', { connection });
    productionQueue = new bullmq_1.Queue('production', { connection });
    console.log('[queue] Queues initialized.');
}
function getSimulationQueue() {
    return simulationQueue;
}
function getSettlementsQueue() {
    return settlementsQueue;
}
function getProductionQueue() {
    return productionQueue;
}
// ─── Schedule Repeating Jobs ──────────────────────────────────
async function scheduleRepeatingJobs() {
    // Remove existing repeatable jobs first to prevent duplicates on restart
    const existingSimJobs = await simulationQueue.getRepeatableJobs();
    for (const job of existingSimJobs) {
        await simulationQueue.removeRepeatableByKey(job.key);
    }
    const existingDailyJobs = await dailyQueue.getRepeatableJobs();
    for (const job of existingDailyJobs) {
        await dailyQueue.removeRepeatableByKey(job.key);
    }
    // Economy tick every 5 minutes
    await simulationQueue.add('economy_tick', { type: 'economy_tick' }, {
        repeat: { every: 5 * 60 * 1000 }, // 5 min in ms
        jobId: 'economy_tick_repeat',
    });
    // Market refresh every 60 minutes
    await simulationQueue.add('market_refresh', { type: 'market_refresh' }, {
        repeat: { every: 60 * 60 * 1000 }, // 60 min in ms
        jobId: 'market_refresh_repeat',
    });
    // Heat decay every hour
    await simulationQueue.add('heat_decay', { type: 'heat_decay' }, {
        repeat: { every: 60 * 60 * 1000 },
        jobId: 'heat_decay_repeat',
    });
    // Daily costs every 24 hours
    await dailyQueue.add('daily_costs', { type: 'daily_costs' }, {
        repeat: { every: 24 * 60 * 60 * 1000 },
        jobId: 'daily_costs_repeat',
    });
    // Progressive tax every 24 hours (offset by 1 hour from daily costs)
    await dailyQueue.add('progressive_tax', { type: 'progressive_tax' }, {
        repeat: { every: 24 * 60 * 60 * 1000 },
        delay: 60 * 60 * 1000, // offset 1 hour
        jobId: 'progressive_tax_repeat',
    });
    console.log('[queue] Repeating jobs scheduled.');
}
// ─── Get Active Season ────────────────────────────────────────
async function getActiveSeasonId() {
    const res = await (0, client_1.query)(`SELECT id FROM season_profiles WHERE status='ACTIVE' LIMIT 1`);
    return res.rows[0]?.id ?? null;
}
// ─── Workers (internal — called via startWorkers() wrapper below) ────────────
// ─── Job Schedulers for Triggered Jobs ───────────────────────
async function scheduleCrimeResolveJob(operation_id, completes_at) {
    const delay = Math.max(0, completes_at.getTime() - Date.now());
    await settlementsQueue.add('crime_resolve', { type: 'crime_resolve', operation_id }, { delay, jobId: `crime_resolve_${operation_id}`, attempts: 3 });
}
async function scheduleLaunderingJob(process_id, completes_at) {
    const delay = Math.max(0, completes_at.getTime() - Date.now());
    await settlementsQueue.add('laundering_complete', { type: 'laundering_complete', process_id }, { delay, jobId: `laundering_${process_id}`, attempts: 3 });
}
async function scheduleProductionJob(business_id) {
    await productionQueue.add('employee_production', { type: 'employee_production', business_id }, { attempts: 2 });
}
// ─── index.ts-compatible entry points ────────────────────────
// These wrappers accept an optional season_id for forward compatibility
// and delegate to the underlying queue initialisation functions.
async function startWorkers(_seasonId) {
    initQueues();
    startWorkersInternal();
}
async function scheduleRecurringJobs(_seasonId) {
    await scheduleRepeatingJobs();
}
// Rename internal functions to avoid collision with the exported wrappers above
function startWorkersInternal() {
    const connection = createRedisConnection();
    // Simulation worker
    new bullmq_1.Worker('simulation', async (job) => {
        const seasonId = await getActiveSeasonId();
        if (!seasonId && job.data.type !== 'heat_decay') {
            console.warn(`[worker:simulation] No active season found for job: ${job.name}`);
            return;
        }
        switch (job.data.type ?? job.name) {
            case 'economy_tick':
                if (seasonId)
                    await (0, simulation_1.economy_update)(seasonId);
                break;
            case 'market_refresh':
                if (seasonId)
                    await (0, simulation_1.market_refresh)(seasonId);
                break;
            case 'heat_decay':
                await (0, simulation_1.heat_decay)();
                break;
            default:
                console.warn(`[worker:simulation] Unknown job type: ${job.data.type ?? job.name}`);
        }
    }, { connection, concurrency: 1 });
    // Daily worker
    new bullmq_1.Worker('daily', async (job) => {
        const seasonId = await getActiveSeasonId();
        if (!seasonId) {
            console.warn(`[worker:daily] No active season found for job: ${job.name}`);
            return;
        }
        switch (job.data.type ?? job.name) {
            case 'daily_costs':
                await (0, simulation_1.daily_costs)(seasonId);
                break;
            case 'progressive_tax':
                await (0, simulation_1.progressive_tax)(seasonId);
                break;
            case 'season_reset':
                await (0, simulation_1.season_reset)(job.data.season_id);
                break;
            default:
                console.warn(`[worker:daily] Unknown job type: ${job.data.type ?? job.name}`);
        }
    }, { connection: createRedisConnection(), concurrency: 1 });
    // Settlements worker
    new bullmq_1.Worker('settlements', async (job) => {
        switch (job.data.type ?? job.name) {
            case 'crime_resolve':
                await (0, simulation_1.crime_action_resolve)(job.data.operation_id);
                break;
            case 'laundering_complete':
                await (0, simulation_1.laundering_tick)();
                break;
            default:
                console.warn(`[worker:settlements] Unknown job type: ${job.data.type ?? job.name}`);
        }
    }, { connection: createRedisConnection(), concurrency: 5 });
    // Production worker
    new bullmq_1.Worker('production', async (job) => {
        switch (job.data.type ?? job.name) {
            case 'employee_production':
                await (0, simulation_1.employee_production)(job.data.business_id);
                break;
            default:
                console.warn(`[worker:production] Unknown job type: ${job.data.type ?? job.name}`);
        }
    }, { connection: createRedisConnection(), concurrency: 10 });
    console.log('[queue] Workers started (internal).');
}
//# sourceMappingURL=queue.js.map