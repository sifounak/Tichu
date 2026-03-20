# Specification: Room-Scoped Persistent Chat History

**Date:** 2026-03-20
**Type:** Enhancement
**Confidence:** High

## Goal

Make chat history persistent within game rooms so that all players — including late joiners and reconnecting players — see the full conversation history. Chat history is tied to the room lifecycle: created with the room, destroyed when the room is destroyed.

## Requirements

### Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| REQ-F-CH01 | Server stores chat messages in memory, scoped per room | Each room has its own message array; messages include `from` (seat), `text`, and `timestamp` |
| REQ-F-CH02 | Different rooms have independent chat histories | Sending a message in Room A does not appear in Room B's history |
| REQ-F-CH03 | Full chat history sent to players on room join/rejoin | Server sends `CHAT_HISTORY` message containing all stored messages when a player joins or reconnects |
| REQ-F-CH04 | Client replaces local chat state with server history on room join | Client clears existing chat messages and loads received history, preventing duplicates or stale data from previous rooms |
| REQ-F-CH05 | Chat history deleted when room is destroyed | When `destroyRoom()` is called, the associated chat history is removed; a new room with the same code starts fresh |
| REQ-F-CH06 | Server adds timestamp to chat messages | Timestamp is set server-side (`Date.now()`) for consistency across all clients |

### Non-Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| REQ-NF-CH01 | Chat history capped at 200 messages per room | When limit is reached, oldest messages are dropped (FIFO) |
| REQ-NF-CH02 | No database persistence required | Chat is in-memory only, tied to room lifecycle |

## Protocol Changes

### New Server → Client message: `CHAT_HISTORY`

```typescript
z.object({
  type: z.literal('CHAT_HISTORY'),
  messages: z.array(z.object({
    from: seatSchema,
    text: z.string(),
    timestamp: z.number(),
  })),
})
```

### Modified Server → Client message: `CHAT_RECEIVED`

Add `timestamp` field (server-generated):

```typescript
z.object({
  type: z.literal('CHAT_RECEIVED'),
  from: seatSchema,
  text: z.string(),
  timestamp: z.number(),
})
```

## Implementation Scope

### In Scope
- Server-side in-memory chat storage per room (Map<roomCode, ChatMessage[]>)
- New `CHAT_HISTORY` server message type in protocol
- Add `timestamp` to `CHAT_RECEIVED` protocol message
- Server sends chat history on join/rejoin
- Client handles `CHAT_HISTORY` to replace local state
- Client clears chat state when leaving/switching rooms
- Chat history cleanup on room destruction
- Message cap (200 per room)

### Out of Scope
- Database persistence for chat
- Chat in the lobby page (lobby has no chat currently)
- Chat message editing or deletion
- Player name display in chat (uses seat labels)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Memory growth from large rooms | Low | Low | 200-message cap per room; rooms auto-cleanup when stale |

## Success Metrics

1. Late-joining player sees all prior chat messages immediately
2. Reconnecting player sees full chat history
3. Switching rooms shows correct room's chat (not previous room's)
4. Room destruction removes chat history
5. New room with recycled code has empty chat
