# Tichu Web Card Game — Master Implementation Plan

**Date:** 2026-03-10
**Feature branch:** `feature/tichu-web-game`
**Parent branch:** `main`

## Context

Build a web-based 4-player Tichu card game with real-time multiplayer, bot opponents, and a polished modern UI. Supports any combination of human/bot players, room-based matchmaking with public lobby, guest + optional accounts, responsive desktop/mobile play.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Next.js (App Router), Tailwind CSS + CSS Modules, Framer Motion, @dnd-kit, Zustand |
| Backend | Node.js + TypeScript + Fastify, ws library, XState v5 |
| Database | PostgreSQL + Drizzle ORM |
| Shared | Zod validation, pure TS game engine |
| Build | Turborepo, pnpm workspaces, Docker Compose |
| i18n | next-intl |

## Architecture Summary

- **Monorepo** with 3 packages: `@tichu/shared`, `@tichu/server`, `@tichu/client`
- **All game logic** in `@tichu/shared` as pure functions (runs on both client and server)
- **Server** is authoritative; clients receive projected state (own hand only)
- **WebSocket** protocol with Zod-validated JSON messages
- **Hierarchical FSM** (XState v5) for game lifecycle

## Milestone Overview

| # | Milestone | Subplan | Package(s) |
|---|---|---|---|
| 1 | Monorepo scaffolding | [milestone-01-scaffolding.md](milestone-01-scaffolding.md) | root, all |
| 2 | Shared types + Deck | [milestone-02-types-deck.md](milestone-02-types-deck.md) | shared |
| 3 | Combination engine | [milestone-03-combination-engine.md](milestone-03-combination-engine.md) | shared |
| 4 | Phoenix resolver | [milestone-04-phoenix-resolver.md](milestone-04-phoenix-resolver.md) | shared |
| 5 | Hand filter | [milestone-05-hand-filter.md](milestone-05-hand-filter.md) | shared |
| 6 | Scoring + rules | [milestone-06-scoring-rules.md](milestone-06-scoring-rules.md) | shared |
| 7 | Game state machine | [milestone-07-state-machine.md](milestone-07-state-machine.md) | server |
| 8 | Server WebSocket layer | [milestone-08-websocket.md](milestone-08-websocket.md) | server |
| 9 | Game manager | [milestone-09-game-manager.md](milestone-09-game-manager.md) | server |
| 10 | Bot framework + EasyBot | [milestone-10-bots.md](milestone-10-bots.md) | server |
| 11 | Client foundation | [milestone-11-client-foundation.md](milestone-11-client-foundation.md) | client |
| 12 | Client gameplay UI | [milestone-12-gameplay-ui.md](milestone-12-gameplay-ui.md) | client |
| 13 | Room & lobby system | [milestone-13-room-lobby.md](milestone-13-room-lobby.md) | server, client |
| 14 | Auth + persistence | [milestone-14-auth-persistence.md](milestone-14-auth-persistence.md) | server, client |
| 15 | Polish | [milestone-15-polish.md](milestone-15-polish.md) | all |

**Milestones 2-6** are purely `@tichu/shared` with 100% unit test coverage before any networking code.

## Key Game Rules & Edge Cases

- Dragon gift: auto-select if only one opponent remains; no gift when bomb wins trick
- Mahjong wish: tracked until fulfilled or no player can fulfill
- Phoenix: never forms bombs, never acts as Dragon/Dog/Mahjong, value cannot equal or be lower than Mahjong (1). Leading single = 1.5 always. Auto-resolve when unambiguous.
- Disconnect: remaining players vote (wait / replace with bot / abandon)
- Turn timer: optional, auto-pass on timeout
- Target score: customizable (default 1000)

## Verification Strategy

1. **Unit tests** (M2-6): Vitest, exhaustive coverage for game engine
2. **Integration tests** (M7-9): State machine transitions, WebSocket flows
3. **Bot smoke tests** (M10): Full bot-vs-bot games to completion
4. **E2E tests** (M11-15): Playwright for lobby→room→game→scoring
5. **Manual play testing**: All edge cases with human + bot combinations
6. **Responsive testing**: Desktop + mobile at 640/1024px breakpoints

## Future Considerations (designed for, not in scope)

- React Native mobile app (shared package + Zustand + WS protocol are portable)
- Game replay/review (events_log in DB)
- i18n (next-intl from day 1)
- Stronger bots (strategy interface supports drop-in)
- Cloud deployment (Docker Compose → container orchestration)
