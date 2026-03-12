# Tichu Web Game — Planning Conversation

**Date:** 2026-03-10
**Phase:** Planning (Phase 1.4-1.5)

## Summary

Created a master implementation plan with 15 milestone subplans and a Requirements Traceability Matrix (RTM) mapping 82 requirements to their implementation milestones.

## Key Planning Decisions

### Architecture
- Monorepo with 3 packages: @tichu/shared (pure TS), @tichu/server (Fastify+WS), @tichu/client (Next.js)
- All game logic in shared package — runs on both client (UX) and server (authoritative)
- XState v5 hierarchical FSM for game lifecycle
- Zustand for client state management
- Zod for WebSocket message validation

### Implementation Strategy
- Milestones 2-6: Pure game engine in shared package with 100% test coverage BEFORE any networking
- Milestones 7-9: Server infrastructure (FSM, WebSocket, game manager)
- Milestone 10: Bot framework enabling full-game testing
- Milestones 11-12: Client UI
- Milestones 13-14: Room/lobby and auth
- Milestone 15: Polish (animations, responsive, accessibility)

### Critical Algorithm Design
- Combination detector: discriminated union types, exhaustive pattern matching
- Phoenix resolver: per-combination-type resolution with auto-determine and choose modes
- Hand filter: progressive filtering using prefix matching and valid-play enumeration
- Scoring: standard Tichu rules with 1-2 finish, Tichu/Grand Tichu bonuses

## Files Created
- `plans/2026-03-10-tichu-web-game.md` (master plan)
- `plans/milestone-01-scaffolding.md` through `plans/milestone-15-polish.md` (15 subplans)
- `specifications/RTM-tichu-web-game.md` (requirements traceability matrix)
