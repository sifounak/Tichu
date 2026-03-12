# Tichu Web Game — Specification Conversation

**Date:** 2026-03-10
**Phase:** Specification (Phase 1.2)

## Summary of Key Decisions

### Game Rules
- Standard 4-player Tichu with 56-card deck
- Customizable target score (default 1000)
- Fixed seat partnerships (North/South vs East/West)
- Standard card passing (1 to each other player)
- Both four-of-a-kind and straight-flush bombs with interrupt rules

### Phoenix Rules (Critical)
- Never forms bombs of any kind
- Never acts as Dragon, Dog, or Mahjong
- Value cannot equal or be lower than Mahjong (rank 1); minimum rank = 2
- Leading single Phoenix = 1.5 always
- On existing trick = current leader + 0.5
- Auto-determine value when only one valid option exists
- Present only valid values when multiple exist

### Dragon Gift Rules
- Dragon wins trick → must give to opponent
- Auto-select if only one opponent remains in play
- Bomb overrides Dragon: no gift when bomb wins trick containing Dragon

### Player Modes
- Any combination of 0-4 humans + bots
- Room codes + public lobby for matchmaking
- Guest + optional account authentication
- Bot difficulty: easy/medium/hard (start with rule-based EasyBot)
- Disconnect: remaining players vote (wait/replace with bot/abandon)

### UX Decisions
- Progressive card filtering (grey out invalid cards as you select)
- Click-to-select AND drag-and-drop
- Clean modern UI, some realistic textures, fast animations (configurable speed/off)
- Responsive desktop + mobile
- Optional turn timer
- In-game text chat
- Spectator mode

### Tech Stack
- React + Next.js (App Router), Tailwind + CSS Modules, Framer Motion, @dnd-kit, Zustand
- Node.js + TypeScript + Fastify, ws library, XState v5
- PostgreSQL + Drizzle ORM, Zod validation
- Turborepo, pnpm workspaces, Docker Compose
- next-intl for i18n readiness

### Deployment
- Local-first (Docker Compose), cloud-deployable later

### Future (not in scope)
- React Native mobile app
- Game replay/review
- Multi-language translations
- HardBot AI
- Cloud deployment config
