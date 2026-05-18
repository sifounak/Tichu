// REQ-NF-A03: Zod validation on WebSocket messages
// REQ-F-RAD03, REQ-F-RAD04, REQ-F-RAD06: ACK/NACK + idempotency

import type { WebSocket } from 'ws';
import type { ClientMessage } from '@tichu/shared';
import { clientMessageSchema } from '@tichu/shared';
import type { ConnectionManager } from './connection-manager.js';
import type { Broadcaster } from './broadcaster.js';
import type { IdempotencyMap } from './idempotency-map.js';

/** Handler function type for a specific client message type */
export type MessageHandler<T extends ClientMessage['type'] = ClientMessage['type']> = (
  ws: WebSocket,
  message: Extract<ClientMessage, { type: T }>,
) => void | Promise<void>;

/** Registry of handlers by message type */
export type HandlerRegistry = Partial<Record<ClientMessage['type'], MessageHandler>>;

/**
 * REQ-NF-A03: Parses incoming WebSocket JSON, validates with Zod,
 * and routes to the appropriate handler.
 * REQ-F-RAD03/04/06: Sends ACK/NACK and enforces idempotency when messageId present.
 */
export class MessageRouter {
  private readonly handlers: HandlerRegistry = {};

  constructor(
    private readonly connections: ConnectionManager,
    private readonly broadcaster: Broadcaster,
    private readonly idempotencyMap?: IdempotencyMap,
  ) {}

  /** Register a handler for a specific message type */
  on<T extends ClientMessage['type']>(type: T, handler: MessageHandler<T>): void {
    this.handlers[type] = handler as unknown as MessageHandler;
  }

  /** Process a raw WebSocket message string */
  async handleMessage(ws: WebSocket, data: string): Promise<void> {
    // Step 1: Parse JSON — extract messageId early (before Zod validation)
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      this.broadcaster.sendError(ws, 'INVALID_JSON', 'Message is not valid JSON');
      return;
    }

    // Extract messageId from raw parsed data (available even if Zod rejects)
    const rawMessageId = (typeof parsed === 'object' && parsed !== null && 'messageId' in parsed)
      ? (parsed as Record<string, unknown>).messageId as string | undefined
      : undefined;

    // Step 2: Validate with Zod schema
    const result = clientMessageSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues.map(i => i.message).join('; ');
      if (rawMessageId) {
        this.broadcaster.sendNack(ws, rawMessageId, 'INVALID_MESSAGE', `Validation failed: ${issues}`);
      } else {
        this.broadcaster.sendError(ws, 'INVALID_MESSAGE', `Validation failed: ${issues}`);
      }
      return;
    }

    const message = result.data;
    const messageId = message.messageId;

    // Step 3: Check that client is authenticated
    const info = this.connections.getClientInfo(ws);
    if (!info) {
      if (messageId) {
        this.broadcaster.sendNack(ws, messageId, 'NOT_AUTHENTICATED', 'Connection not authenticated');
      } else {
        this.broadcaster.sendError(ws, 'NOT_AUTHENTICATED', 'Connection not authenticated');
      }
      return;
    }

    // Step 4: Route to handler
    const handler = this.handlers[message.type];
    if (!handler) {
      if (messageId) {
        this.broadcaster.sendNack(ws, messageId, 'UNKNOWN_TYPE', `No handler for message type: ${message.type}`);
      } else {
        this.broadcaster.sendError(ws, 'UNKNOWN_TYPE', `No handler for message type: ${message.type}`);
      }
      return;
    }

    // HEARTBEAT_PONG: never ACK, never track in idempotency map
    if (message.type === 'HEARTBEAT_PONG') {
      try {
        await handler(ws, message as never);
      } catch {
        // Heartbeat errors are silent
      }
      return;
    }

    // Step 5: Idempotency check (only when messageId present and map available)
    if (messageId && this.idempotencyMap) {
      const roomKey = info.roomCode ?? '__lobby';
      const existing = this.idempotencyMap.get(roomKey, messageId);
      if (existing) {
        // Replay stored result
        if (existing.result === 'ack') {
          this.broadcaster.sendAck(ws, messageId);
        } else {
          this.broadcaster.sendNack(ws, messageId, existing.nackCode ?? 'HANDLER_ERROR', existing.nackMessage ?? 'Previously failed');
        }
        return;
      }
    }

    // Step 6: Execute handler
    try {
      await handler(ws, message as never);
      // Success — send ACK if messageId present
      if (messageId) {
        const roomKey = info.roomCode ?? '__lobby';
        if (this.idempotencyMap) {
          this.idempotencyMap.set(roomKey, messageId, { result: 'ack' });
        }
        this.broadcaster.sendAck(ws, messageId);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Internal server error';
      if (messageId) {
        const roomKey = info.roomCode ?? '__lobby';
        if (this.idempotencyMap) {
          this.idempotencyMap.set(roomKey, messageId, { result: 'nack', nackCode: 'HANDLER_ERROR', nackMessage: errorMsg });
        }
        this.broadcaster.sendNack(ws, messageId, 'HANDLER_ERROR', errorMsg);
      } else {
        this.broadcaster.sendError(ws, 'HANDLER_ERROR', errorMsg);
      }
    }
  }
}
