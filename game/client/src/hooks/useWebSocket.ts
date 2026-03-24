import { useEffect, useRef, useCallback } from 'react';
import { gameSocket } from '../lib/api';

interface UseWebSocketOptions {
  channels: string[];
  onMessage: (channel: string, data: unknown) => void;
  enabled?: boolean;
}

export function useWebSocket({ channels, onMessage, enabled = true }: UseWebSocketOptions) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  useEffect(() => {
    if (!enabled) return;

    // Connect the WebSocket if not already connected
    gameSocket.connect().catch(() => {
      // Connection error — will auto-retry internally
    });

    const unsubscribeFns: Array<() => void> = [];

    for (const channel of channelsRef.current) {
      const unsub = gameSocket.subscribe(channel, (ch: string, data: unknown) => {
        onMessageRef.current(ch, data);
      });
      unsubscribeFns.push(unsub);
    }

    return () => {
      unsubscribeFns.forEach((unsub) => unsub());
    };
  }, [enabled, channels.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useWebSocketChannel(
  channel: string,
  onMessage: (data: unknown) => void,
  enabled = true
) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    gameSocket.connect().catch(() => {});

    const unsub = gameSocket.subscribe(channel, (_ch: string, data: unknown) => {
      onMessageRef.current(data);
    });

    return unsub;
  }, [channel, enabled]);
}
