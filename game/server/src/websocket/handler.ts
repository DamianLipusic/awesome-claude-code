import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';

// ─── Types ────────────────────────────────────────────────────

interface ClientState {
  ws: WebSocket;
  player_id: string;
  subscriptions: Set<string>;
}

// ─── State ────────────────────────────────────────────────────

// Map: client_id → ClientState
const clients = new Map<string, ClientState>();
let connectionCounter = 0;

// ─── Internal send helper ─────────────────────────────────────

function sendToSocket(ws: WebSocket, event: string, data: unknown): void {
  if (ws.readyState === 1 /* OPEN */) {
    try {
      ws.send(JSON.stringify({ event, data }));
    } catch {
      // Client may have disconnected between readyState check and send
    }
  }
}

// ─── Fastify plugin ───────────────────────────────────────────

/**
 * Register the WebSocket endpoint as a Fastify plugin using @fastify/websocket.
 *
 * Connect: GET /ws?token=<jwt>
 * Client messages:
 *   { action: 'subscribe',   channel: 'market:Ironport:uuid' }
 *   { action: 'unsubscribe', channel: 'market:Ironport:uuid' }
 *   { action: 'ping' }
 */
export async function registerWebSocketHandler(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (socket, request) => {
    const client_id = String(++connectionCounter);
    let player_id = 'anonymous';

    // Parse token from query string and verify JWT
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (token) {
      try {
        const payload = app.jwt.verify(token) as { sub: string; type?: string };
        if (!payload.type || payload.type === 'access') {
          player_id = payload.sub;
        }
      } catch {
        // Invalid or expired token — allow connection as anonymous
      }
    }

    clients.set(client_id, { ws: socket, player_id, subscriptions: new Set() });

    // Handle incoming messages
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          action?: string;
          channel?: string;
        };

        const client = clients.get(client_id);
        if (!client) return;

        if (msg.action === 'subscribe' && typeof msg.channel === 'string') {
          // Prevent subscribing to another player's private channel
          if (
            msg.channel.startsWith('player:') &&
            !msg.channel.startsWith(`player:${player_id}`)
          ) {
            sendToSocket(socket, 'error', { message: 'Forbidden: cannot subscribe to another player channel' });
            return;
          }
          client.subscriptions.add(msg.channel);
          sendToSocket(socket, 'subscribed', { channel: msg.channel });
          return;
        }

        if (msg.action === 'unsubscribe' && typeof msg.channel === 'string') {
          client.subscriptions.delete(msg.channel);
          sendToSocket(socket, 'unsubscribed', { channel: msg.channel });
          return;
        }

        if (msg.action === 'ping') {
          sendToSocket(socket, 'pong', { ts: Date.now() });
          return;
        }
      } catch {
        // Ignore malformed JSON
      }
    });

    // Clean up on disconnect
    socket.on('close', () => {
      clients.delete(client_id);
    });

    socket.on('error', () => {
      clients.delete(client_id);
    });

    // Send welcome message
    sendToSocket(socket, 'connected', { player_id, client_id });
  });
}

// ─── Exported emit helpers ────────────────────────────────────

/**
 * Send an event to all WebSocket connections belonging to a specific player.
 */
export function emitToPlayer(player_id: string, event: string, data: unknown): void {
  for (const client of clients.values()) {
    if (client.player_id === player_id) {
      sendToSocket(client.ws, event, data);
    }
  }
}

/**
 * Send an event to all subscribers of a channel.
 * Channel format examples: 'market:Ironport:<resource_uuid>', 'leaderboard', 'player:<uuid>'
 */
export function emitToChannel(channel: string, event: string, data: unknown): void {
  for (const client of clients.values()) {
    if (client.subscriptions.has(channel)) {
      sendToSocket(client.ws, event, data);
    }
  }
}

/**
 * Send a market price update to all subscribers of a market channel.
 * Channel: market:{city}:{resource_id}
 */
export function emitToMarket(city: string, resource_id: string, data: unknown): void {
  emitToChannel(`market:${city}:${resource_id}`, 'price_update', data);
}

/**
 * Send an event to every connected client regardless of subscriptions.
 */
export function emitBroadcast(event: string, data: unknown): void {
  for (const client of clients.values()) {
    sendToSocket(client.ws, event, data);
  }
}

/**
 * Returns the number of currently connected clients.
 */
export function getConnectionCount(): number {
  return clients.size;
}
