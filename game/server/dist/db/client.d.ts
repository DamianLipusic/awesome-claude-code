import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
declare const pool: Pool;
export declare function query<T extends QueryResultRow = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
export declare function getClient(): Promise<PoolClient>;
export declare function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
export default pool;
//# sourceMappingURL=client.d.ts.map