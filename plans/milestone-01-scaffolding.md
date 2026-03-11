# Milestone 1: Monorepo Scaffolding

**Package(s):** root, shared, server, client
**Requirements:** Infrastructure — no REQ IDs (foundation milestone)

## Goal

Set up the monorepo with pnpm workspaces, TypeScript, Turborepo, ESLint/Prettier, Docker Compose, and the three-package skeleton so that all packages build, lint, and run tests (even if empty).

## Tasks

### 1.1 Root workspace setup
- Initialize `package.json` with pnpm workspaces (`packages/*`)
- Create `pnpm-workspace.yaml`
- Create `turbo.json` with `build`, `dev`, `lint`, `test` pipelines
- Create `tsconfig.base.json` with strict TS settings, path aliases

### 1.2 Shared package (`packages/shared/`)
- `package.json` for `@tichu/shared` (pure TS, no runtime deps)
- `tsconfig.json` extending base
- `src/index.ts` — empty barrel export
- `vitest.config.ts` — test runner config
- Placeholder test: `tests/smoke.test.ts`

### 1.3 Server package (`packages/server/`)
- `package.json` for `@tichu/server` (deps: fastify, ws, xstate, drizzle-orm, pg, zod)
- `tsconfig.json` extending base
- `src/index.ts` — minimal Fastify server with health endpoint
- `vitest.config.ts`
- Placeholder test: `tests/smoke.test.ts`

### 1.4 Client package (`packages/client/`)
- `package.json` for `@tichu/client` (Next.js + React + Tailwind + Framer Motion + Zustand)
- `tsconfig.json` extending base (Next.js compatible)
- `src/app/layout.tsx` + `src/app/page.tsx` — minimal Next.js app
- `tailwind.config.ts` + `postcss.config.js`
- `next.config.ts`

### 1.5 Linting & formatting
- `.eslintrc.js` at root (TypeScript + React rules)
- `.prettierrc` at root
- `lint-staged` + `husky` for pre-commit hooks (optional, confirm with user)

### 1.6 Docker Compose
- `docker-compose.yml` with 3 services: `client` (port 3000), `server` (port 3001), `db` (PostgreSQL 16, port 5432)
- `Dockerfile` for client and server packages
- `.dockerignore`

### 1.7 Git configuration
- `.gitignore` (node_modules, dist, .next, .env, coverage, etc.)

## Files to Create

```
package.json
pnpm-workspace.yaml
turbo.json
tsconfig.base.json
.eslintrc.js
.prettierrc
.gitignore
docker-compose.yml
packages/shared/package.json
packages/shared/tsconfig.json
packages/shared/vitest.config.ts
packages/shared/src/index.ts
packages/shared/tests/smoke.test.ts
packages/server/package.json
packages/server/tsconfig.json
packages/server/vitest.config.ts
packages/server/src/index.ts
packages/server/tests/smoke.test.ts
packages/client/package.json
packages/client/tsconfig.json
packages/client/next.config.ts
packages/client/tailwind.config.ts
packages/client/postcss.config.js
packages/client/src/app/layout.tsx
packages/client/src/app/page.tsx
packages/client/src/app/globals.css
```

## Verification

1. `pnpm install` succeeds
2. `pnpm turbo build` succeeds for all packages
3. `pnpm turbo test` runs smoke tests in shared + server
4. `pnpm turbo lint` passes
5. `docker-compose build` succeeds (optional — confirm Docker available)
6. Next.js dev server starts: `cd packages/client && pnpm dev`
7. Fastify server starts: `cd packages/server && pnpm dev`
