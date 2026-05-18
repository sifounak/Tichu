// REQ-NF-A03: WebSocket hook with Zod validation and typed messages
// REQ-F-RAD01: Client assigns messageId to outbound messages via PendingActionManager
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@tichu/shared';
import { serverMessageSchema } from '@tichu/shared';
import { PendingActionManager, type UISnapshot, type ResolutionResult } from '../services/PendingActionManager';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface UseWebSocketOptions {
  url: string;
  /** Called for every validated server message */
  onMessage: (msg: ServerMessage) => void;
  /** Called when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Called when spinner should be shown for a pending action */
  onSpinnerNeeded?: (messageId: string) => void;
  /** Called when a pending action is resolved (ack or nack) */
  onResolved?: (result: ResolutionResult, messageId: string, snapshot?: UISnapshot, code?: string, message?: string) => void;
  /** Max reconnection attempts (default: 10) */
  maxRetries?: number;
  /** Enable auto-reconnection (default: true) */
  autoReconnect?: boolean;
  /** Defer connection until true (default: true). Use to wait for auth before connecting. */
  enabled?: boolean;
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
  onSpinnerNeeded,
  onResolved,
  maxRetries = 10,
  autoReconnect = true,
  enabled = true,
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
  const onSpinnerNeededRef = useRef(onSpinnerNeeded);
  onSpinnerNeededRef.current = onSpinnerNeeded;
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  // REQ-F-RAD02: PendingActionManager tracks in-flight actions
  const pendingManagerRef = useRef<PendingActionManager | null>(null);
  if (!pendingManagerRef.current) {
    pendingManagerRef.current = new PendingActionManager({
      rawSend: (payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload));
          return true;
        }
        return false;
      },
      onSpinnerNeeded: (messageId) => onSpinnerNeededRef.current?.(messageId),
      onResolved: (result, messageId, snapshot, code, message) => onResolvedRef.current?.(result, messageId, snapshot, code, message),
    });
  }

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
      const wasReconnecting = retryCountRef.current > 0;
      retryCountRef.current = 0;
      updateStatus('connected');
      // REQ-F-RAD09: Re-send pending actions on reconnection
      if (wasReconnecting) {
        pendingManagerRef.current?.retryAll();
      }
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
          // REQ-F-RAD10: ACK resolves pending action
          if (result.data.type === 'ACK') {
            pendingManagerRef.current?.handleAck(result.data.messageId);
            return;
          }
          // REQ-F-RAD11: NACK resolves pending action with error
          if (result.data.type === 'NACK') {
            pendingManagerRef.current?.handleNack(result.data.messageId, result.data.code, result.data.message);
            return;
          }
          // Server is about to restart — reset retry count and allow auto-reconnect
          if (result.data.type === 'SERVER_SHUTTING_DOWN') {
            retryCountRef.current = 0;
            intentionalCloseRef.current = false;
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
    pendingManagerRef.current?.cancelAll();
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

  // REQ-F-RAD01: All outbound messages except HEARTBEAT_PONG get tracked with messageId
  const send = useCallback((message: ClientMessage, snapshot?: UISnapshot): boolean => {
    // HEARTBEAT_PONG bypasses tracking — no messageId, no retry
    if (message.type === 'HEARTBEAT_PONG') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
        return true;
      }
      return false;
    }
    // REQ-F-RAD12: All other messages (including chat) tracked via PendingActionManager
    if (pendingManagerRef.current) {
      pendingManagerRef.current.submit(message, snapshot);
      return true;
    }
    return false;
  }, []);

  // Connect on mount (when enabled), disconnect on unmount
  useEffect(() => {
    if (!enabled) return;
    intentionalCloseRef.current = false;
    connect();
    return disconnect;
  }, [enabled, connect, disconnect]);

  // REQ-F-SGP03: Reconnect when page becomes visible again (mobile phone wake)
  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wsRef.current) {
        retryCountRef.current = 0;
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, connect]);

  return { status, send, disconnect, reconnect: connect, pendingActions: pendingManagerRef.current };
}

export type { UISnapshot } from '../services/PendingActionManager';

