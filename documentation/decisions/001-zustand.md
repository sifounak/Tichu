# ADR-001: Zustand for Client State Management

**Date:** 2026-03
**Status:** Accepted

## Context

The client is a React 19 application with four distinct stores (game, room, auth, UI)
that must reactively update in response to real-time WebSocket messages. The state
management solution needs to handle frequent, fine-grained updates without causing
unnecessary re-renders across the component tree.

## Decision

Use Zustand as the client-side state management library.

## Rationale

- Minimal boilerplate compared to Redux (no action creators, reducers, or provider wrappers)
- Works seamlessly with React 19 concurrent features without compatibility shims
- No context providers needed, so stores can be consumed anywhere without wrapping the tree
- Built-in selectors enable granular subscriptions, preventing re-renders in unrelated components
- Devtools middleware provides Redux DevTools integration for debugging state changes
- Redux is overkill for a four-store application of this size
- Jotai's atomic model is less intuitive for interconnected game state where a single
  WebSocket message may update multiple related fields simultaneously

## Consequences

- Each domain (game, room, auth, UI) gets its own independent store, keeping concerns separated
- WebSocket handlers can update stores directly without dispatching actions through a middleware layer
- If the application grows to need cross-store middleware or saga-like side effects,
  we would need to add custom subscription logic or reconsider the architecture
