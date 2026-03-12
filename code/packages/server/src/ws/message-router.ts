// REQ-NF-A03: Zod validation on WebSocket messages

import type { WebSocket } from 'ws';
import type { ClientMessage } from '@tichu/shared';
import { clientMessageSchema } from '@tichu/shared';
import type { ConnectionManager } from './connection-manager.js';
import type { Broadcaster } from './broadcaster.js';

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
 */
export class MessageRouter {
  private readonly handlers: HandlerRegistry = {};

  constructor(
    private readonly connections: ConnectionManager,
    private readonly broadcaster: Broadcaster,
  ) {}

  /** Register a handler for a specific message type */
  on<T extends ClientMessage['type']>(type: T, handler: MessageHandler<T>): void {
    this.handlers[type] = handler as unknown as MessageHandler;
  }

  /** Process a raw WebSocket message string */
  async handleMessage(ws: WebSocket, data: string): Promise<void> {
    // Step 1: Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      this.broadcaster.sendError(ws, 'INVALID_JSON', 'Message is not valid JSON');
      return;
    }

    // Step 2: Validate with Zod schema
    const result = clientMessageSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues.map(i => i.message).join('; ');
      this.broadcaster.sendError(ws, 'INVALID_MESSAGE', `Validation failed: ${issues}`);
      return;
    }

    const message = result.data;

    // Step 3: Check that client is authenticated
    const info = this.connections.getClientInfo(ws);
    if (!info) {
      this.broadcaster.sendError(ws, 'NOT_AUTHENTICATED', 'Connection not authenticated');
      return;
    }

    // Step 4: Route to handler
    const handler = this.handlers[message.type];
    if (!handler) {
      this.broadcaster.sendError(ws, 'UNKNOWN_TYPE', `No handler for message type: ${message.type}`);
      return;
    }

    try {
      await handler(ws, message as never);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Internal server error';
      this.broadcaster.sendError(ws, 'HANDLER_ERROR', errorMsg);
    }
  }
}
