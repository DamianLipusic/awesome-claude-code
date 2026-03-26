"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWebSocketHandler = registerWebSocketHandler;
exports.emitToPlayer = emitToPlayer;
exports.emitToChannel = emitToChannel;
exports.emitToMarket = emitToMarket;
exports.emitBroadcast = emitBroadcast;
exports.getConnectionCount = getConnectionCount;
// ─── State ────────────────────────────────────────────────────
// Map: client_id → ClientState
const clients = new Map();
let connectionCounter = 0;
// ─── Internal send helper ─────────────────────────────────────
function sendToSocket(ws, event, data) {
    if (ws.readyState === 1 /* OPEN */) {
        try {
            ws.send(JSON.stringify({ event, data }));
        }
        catch {
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
async function registerWebSocketHandler(app) {
    app.get('/ws', { websocket: true }, (socket, request) => {
        const client_id = String(++connectionCounter);
        let player_id = 'anonymous';
        // Parse token from query string and verify JWT
        const url = new URL(request.url, 'http://localhost');
        const token = url.searchParams.get('token');
        if (token) {
            try {
                const payload = app.jwt.verify(token);
                if (!payload.type || payload.type === 'access') {
                    player_id = payload.sub;
                }
            }
            catch {
                // Invalid or expired token — allow connection as anonymous
            }
        }
        clients.set(client_id, { ws: socket, player_id, subscriptions: new Set() });
        // Handle incoming messages
        socket.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                const client = clients.get(client_id);
                if (!client)
                    return;
                if (msg.action === 'subscribe' && typeof msg.channel === 'string') {
                    // Prevent subscribing to another player's private channel
                    if (msg.channel.startsWith('player:') &&
                        !msg.channel.startsWith(`player:${player_id}`)) {
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
            }
            catch {
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
function emitToPlayer(player_id, event, data) {
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
function emitToChannel(channel, event, data) {
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
function emitToMarket(city, resource_id, data) {
    emitToChannel(`market:${city}:${resource_id}`, 'price_update', data);
}
/**
 * Send an event to every connected client regardless of subscriptions.
 */
function emitBroadcast(event, data) {
    for (const client of clients.values()) {
        sendToSocket(client.ws, event, data);
    }
}
/**
 * Returns the number of currently connected clients.
 */
function getConnectionCount() {
    return clients.size;
}
//# sourceMappingURL=handler.js.map