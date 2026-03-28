import { Queue, type ConnectionOptions } from 'bullmq';
export declare function createRedisConnection(): ConnectionOptions;
export declare function initQueues(): void;
export declare function getSimulationQueue(): Queue;
export declare function getSettlementsQueue(): Queue;
export declare function getProductionQueue(): Queue;
export declare function scheduleRepeatingJobs(): Promise<void>;
export declare function scheduleCrimeResolveJob(operation_id: string, completes_at: Date): Promise<void>;
export declare function scheduleLaunderingJob(process_id: string, completes_at: Date): Promise<void>;
export declare function scheduleProductionJob(business_id: string): Promise<void>;
export declare function startWorkers(_seasonId?: string): Promise<void>;
export declare function scheduleRecurringJobs(_seasonId?: string): Promise<void>;
//# sourceMappingURL=queue.d.ts.map