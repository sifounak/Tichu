// REQ-NF-A03: WebSocket hook with Zod validation and typed messages
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@tichu/shared';
import { serverMessageSchema } from '@tichu/shared';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface UseWebSocketOptions {
  url: string;
  /** Called for every validated server message */
  onMessage: (msg: ServerMessage) => void;
  /** Called when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Max reconnection attempts (default: 10) */
  maxRetries?: number;
  /** Enable auto-reconnection (default: true) */
  autoReconnect?: boolean;
}

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 15_000;

function backoffDelay(attempt: number): number {
  const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  // Add jitter: +/- 25%
  return delay * (0.75 + Math.random() * 0.5);
}

export function useWebSocket({
  url,
  onMessage,
  onStatusChange,
  maxRetries = 10,
  autoReconnect = true,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  // Keep stable refs for callbacks to avoid reconnection loops
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const updateStatus = useCallback((next: ConnectionStatus) => {
    setStatus(next);
    onStatusChangeRef.current?.(next);
  }, []);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    updateStatus(retryCountRef.current > 0 ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCountRef.current = 0;
      updateStatus('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const raw = JSON.parse(event.data as string);
        const result = serverMessageSchema.safeParse(raw);
        if (result.success) {
          // Application-level heartbeat: respond immediately, don't bubble to game logic
          if (result.data.type === 'HEARTBEAT_PING') {
            ws.send(JSON.stringify({ type: 'HEARTBEAT_PONG' }));
            return;
          }
          onMessageRef.current(result.data);
        } else {
          console.warn('[WS] Invalid server message:', result.error.issues);
        }
      } catch {
        console.warn('[WS] Failed to parse message:', event.data);
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return; // Stale socket — ignore
      wsRef.current = null;
      if (intentionalCloseRef.current) {
        updateStatus('disconnected');
        return;
      }
      if (autoReconnect && retryCountRef.current < maxRetries) {
        const delay = backoffDelay(retryCountRef.current);
        retryCountRef.current += 1;
        updateStatus('reconnecting');
        retryTimerRef.current = setTimeout(connect, delay);
      } else {
        updateStatus('disconnected');
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror — reconnection handled there
    };
  }, [url, autoReconnect, maxRetries, updateStatus]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    updateStatus('disconnected');
  }, [updateStatus]);

  const send = useCallback((message: ClientMessage): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('[WS] Cannot send — not connected');
    return false;
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    intentionalCloseRef.current = false;
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { status, send, disconnect, reconnect: connect };
}
