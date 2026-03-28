import type { WebSocket } from 'ws';

/** Connected WebSocket clients, keyed by player ID */
const clients = new Map<string, Set<WebSocket>>();

export function addClient(playerId: string, ws: WebSocket): void {
  if (!clients.has(playerId)) clients.set(playerId, new Set());
  clients.get(playerId)!.add(ws);
}

export function removeClient(playerId: string, ws: WebSocket): void {
  const set = clients.get(playerId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) clients.delete(playerId);
}

/** Broadcast a message to ALL connected clients */
export function broadcast(channel: string, data: unknown): void {
  const msg = JSON.stringify({ channel, data });
  for (const sockets of clients.values()) {
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }
}

/** Send to a specific player */
export function sendToPlayer(playerId: string, channel: string, data: unknown): void {
  const sockets = clients.get(playerId);
  if (!sockets) return;
  const msg = JSON.stringify({ channel, data });
  for (const ws of sockets) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

export function getConnectionCount(): number {
  let count = 0;
  for (const set of clients.values()) count += set.size;
  return count;
}
