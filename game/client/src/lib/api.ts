import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://localhost:3000/api/v1';

const WS_BASE_URL =
  (Constants.expoConfig?.extra?.wsBaseUrl as string | undefined) ??
  'ws://localhost:3000/ws';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// ─── Storage helpers (SecureStore on native, localStorage on web) ──

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require('expo-secure-store');
  await SecureStore.setItemAsync(key, value);
}

async function storageDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require('expo-secure-store');
  await SecureStore.deleteItemAsync(key);
}

// ─── Token helpers ────────────────────────────────────────────

export async function getStoredToken(): Promise<string | null> {
  return storageGet(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  await storageSet(TOKEN_KEY, token);
}

export async function setStoredRefreshToken(token: string): Promise<void> {
  await storageSet(REFRESH_TOKEN_KEY, token);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return storageGet(REFRESH_TOKEN_KEY);
}

export async function clearStoredTokens(): Promise<void> {
  await storageDelete(TOKEN_KEY);
  await storageDelete(REFRESH_TOKEN_KEY);
}

// ─── Core fetch ───────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

async function attemptRefresh(): Promise<string | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      await clearStoredTokens();
      return null;
    }

    const data = await response.json();
    const newToken: string = data.data?.token ?? data.token;
    if (newToken) {
      await setStoredToken(newToken);
      if (data.data?.refresh_token ?? data.refresh_token) {
        await setStoredRefreshToken(data.data?.refresh_token ?? data.refresh_token);
      }
      return newToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  retry = true
): Promise<T> {
  const token = await getStoredToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && retry) {
    const newToken = await attemptRefresh();
    if (newToken) {
      return request<T>(method, path, body, false);
    }
    throw new ApiError(401, 'Unauthorized — please log in again');
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      message = errorData.error ?? errorData.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json();
  // Unwrap { data: T } envelope if present
  return (json.data !== undefined ? json.data : json) as T;
}

// ─── ApiError ─────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Public API client ────────────────────────────────────────

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>('GET', path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, body);
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PUT', path, body);
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, body);
  },
  delete<T>(path: string): Promise<T> {
    return request<T>('DELETE', path);
  },
};

// ─── WebSocket client ─────────────────────────────────────────

type MessageCallback = (channel: string, data: unknown) => void;

export class GameWebSocket {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<MessageCallback>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;
  private url: string;

  constructor(private readonly wsBaseUrl: string = WS_BASE_URL) {
    this.url = wsBaseUrl;
  }

  async connect(): Promise<void> {
    const token = await getStoredToken();
    this.url = `${this.wsBaseUrl}?token=${token ?? ''}`;
    this._createConnection();
  }

  private _createConnection(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectDelay = 2000;
        // Re-subscribe to all channels after reconnect
        for (const channel of this.subscriptions.keys()) {
          this._sendSubscribe(channel);
        }
      };

      this.ws.onmessage = (event: WebSocketMessageEvent) => {
        try {
          const parsed = JSON.parse(event.data as string) as {
            channel?: string;
            type?: string;
            data?: unknown;
          };
          const channel = parsed.channel ?? parsed.type ?? 'global';
          const callbacks = this.subscriptions.get(channel);
          if (callbacks) {
            callbacks.forEach((cb) => cb(channel, parsed.data ?? parsed));
          }
          // Also fire wildcard listeners
          const wildcard = this.subscriptions.get('*');
          if (wildcard) {
            wildcard.forEach((cb) => cb(channel, parsed.data ?? parsed));
          }
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onerror = () => {
        // Error handled in onclose
      };

      this.ws.onclose = () => {
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectDelay = Math.min(
              this.reconnectDelay * 2,
              this.maxReconnectDelay
            );
            this._createConnection();
          }, this.reconnectDelay);
        }
      };
    } catch {
      // Failed to create WebSocket — will retry
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => {
          this._createConnection();
        }, this.reconnectDelay);
      }
    }
  }

  subscribe(channel: string, callback: MessageCallback): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      if (this.ws?.readyState === WebSocket.OPEN) {
        this._sendSubscribe(channel);
      }
    }
    this.subscriptions.get(channel)!.add(callback);

    return () => {
      const set = this.subscriptions.get(channel);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.subscriptions.delete(channel);
          this._sendUnsubscribe(channel);
        }
      }
    };
  }

  private _sendSubscribe(channel: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'subscribe', channel }));
    }
  }

  private _sendUnsubscribe(channel: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'unsubscribe', channel }));
    }
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton WebSocket instance
export const gameSocket = new GameWebSocket();
