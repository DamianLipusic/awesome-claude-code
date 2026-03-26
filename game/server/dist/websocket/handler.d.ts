import type { FastifyInstance } from 'fastify';
/**
 * Register the WebSocket endpoint as a Fastify plugin using @fastify/websocket.
 *
 * Connect: GET /ws?token=<jwt>
 * Client messages:
 *   { action: 'subscribe',   channel: 'market:Ironport:uuid' }
 *   { action: 'unsubscribe', channel: 'market:Ironport:uuid' }
 *   { action: 'ping' }
 */
export declare function registerWebSocketHandler(app: FastifyInstance): Promise<void>;
/**
 * Send an event to all WebSocket connections belonging to a specific player.
 */
export declare function emitToPlayer(player_id: string, event: string, data: unknown): void;
/**
 * Send an event to all subscribers of a channel.
 * Channel format examples: 'market:Ironport:<resource_uuid>', 'leaderboard', 'player:<uuid>'
 */
export declare function emitToChannel(channel: string, event: string, data: unknown): void;
/**
 * Send a market price update to all subscribers of a market channel.
 * Channel: market:{city}:{resource_id}
 */
export declare function emitToMarket(city: string, resource_id: string, data: unknown): void;
/**
 * Send an event to every connected client regardless of subscriptions.
 */
export declare function emitBroadcast(event: string, data: unknown): void;
/**
 * Returns the number of currently connected clients.
 */
export declare function getConnectionCount(): number;
//# sourceMappingURL=handler.d.ts.map