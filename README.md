# Tichu Web Game

A real-time multiplayer implementation of the [Tichu](https://en.wikipedia.org/wiki/Tichu) card game, built as a TypeScript monorepo.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript (strict, ES2022, ESM) |
| Frontend | Next.js 15, React 19, Zustand 5, Framer Motion 12 |
| Backend | Fastify 5, ws (WebSocket), XState 5 |
| Database | SQLite via Drizzle ORM + better-sqlite3 |
| Auth | bcryptjs + JWT |
| Validation | Zod (all WebSocket messages) |
| Testing | Vitest 3 + @testing-library/react |
| Style | CSS Modules + Tailwind v4 + CSS custom properties |

## Quick Start

**Prerequisites:** Node.js 20+, pnpm 9+

```bash
# Install dependencies
cd code && pnpm install

# Start dev servers (builds shared → starts server:3001 + client:3000)
bash code/scripts/dev-start.sh

# Open http://localhost:3000
```

## Repository Structure

```
code/                    # Application source
  packages/
    shared/              # Pure game engine + types (zero UI/server deps)
    client/              # Next.js frontend (port 3000)
    server/              # Fastify backend + WebSocket (port 3001)
documentation/           # Architecture docs, codebase index, deployment guide
specifications/          # Feature specs + Requirements Traceability Matrices
conversations/           # Development transcript archive
results/                 # Milestone test results + coverage reports
plans/                   # Implementation plans
```

## Documentation

- [Codebase Index](documentation/codebase-index.md) — full architecture, file layout, WebSocket protocol, state machine
- [Deployment Guide](documentation/deployment.md) — production setup with systemd + Apache
- [Architecture Decisions](documentation/decisions/) — rationale for key technology choices
- [Bot Strategy](documentation/bot-strategy.md) — ExpertBot 12-module strategy system

## Development Workflow

All changes follow the `/diligent-developer` workflow defined in [CLAUDE.md](CLAUDE.md). Run tests with:

```bash
cd code && pnpm test           # All packages
cd code && pnpm test:coverage  # With coverage reports
cd code && pnpm build          # Full build
cd code && pnpm typecheck      # Type checking only
```
