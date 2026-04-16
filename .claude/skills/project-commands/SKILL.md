---
name: project-commands
description: Canonical commands, build order, common pitfalls, and troubleshooting for the Tichu development workflow. Use when running build/test/dev/lint commands or when a command fails unexpectedly.
---

# Project Commands

## Working Directory

**All commands below run from `code/`.** From the repo root: `cd code`.

## Full Command Reference

### All Packages (Turbo-orchestrated)

| Task | Command |
|---|---|
| Install deps | `pnpm install` |
| Build all | `pnpm build` |
| Dev server | `bash scripts/dev-start.sh` |
| Run all tests | `pnpm test` |
| Test + coverage | `pnpm test:coverage` |
| Type check | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Clean | `pnpm clean` |

### Single-Package Commands

Use `--filter` to target one package:

```bash
pnpm --filter @tichu/shared test
pnpm --filter @tichu/server test
pnpm --filter @tichu/client test
```

Replace `test` with any of: `build`, `typecheck`, `lint`, `test:coverage`, `clean`.

### Package-Specific Notes

- **shared** — Pure TypeScript library. `pnpm build` runs `tsc`. Output: `dist/`.
- **server** — Fastify + WebSocket backend. `pnpm build` runs `tsc`. Output: `dist/`. Dev mode uses `tsx watch` for live reload on port 3001.
- **client** — Next.js 15 frontend. `pnpm build` runs `next build`. Output: `.next/`. Dev mode runs on port 3000.

## Build Order & Dependencies

Turbo handles build ordering automatically when you use `pnpm build`, `pnpm test`, etc. from the root. The dependency graph is:

```
shared (no deps)
  ├── server (depends on shared)
  └── client (depends on shared)
```

**If building manually** (without Turbo), you MUST build shared first:
```bash
cd packages/shared && pnpm build
cd ../server && pnpm build    # or test, typecheck, etc.
cd ../client && pnpm build
```

## Decision Logic — When to Use What

| Scenario | Command |
|---|---|
| Changed shared types/logic | `pnpm build` then `pnpm test` (full rebuild needed) |
| Changed only server code | `pnpm --filter @tichu/server test` |
| Changed only client code | `pnpm --filter @tichu/client test` |
| Before committing | `pnpm test && pnpm typecheck && pnpm lint` |
| Starting a dev session | `bash scripts/dev-start.sh` |
| After pulling or changing deps | `pnpm install` then `pnpm build` |
| Debugging a flaky build | `pnpm clean` then `pnpm install` then `pnpm build` |

## Common Pitfalls

### Wrong directory
All pnpm/turbo commands must run from `code/`, not the repo root. If you see "no pnpm-workspace.yaml" or "missing script", you're in the wrong directory.

### Stale shared types
If you edit files in `packages/shared/src/`, downstream packages (server, client) won't see the changes until shared is rebuilt. Always run `pnpm build` (which rebuilds all in order) or `pnpm --filter @tichu/shared build` before testing downstream.

### Port conflicts
- Client: port 3000
- Server: port 3001
- `dev-start.sh` automatically kills stale processes and waits for ports to free
- Manual `pnpm dev` does NOT kill stale processes — if ports are busy, kill them yourself or use `dev-start.sh`

### Windows shell scripts
The scripts in `code/scripts/` are bash scripts. On Windows, run them through Git Bash, WSL, or a bash-compatible shell. They will not work in PowerShell or cmd.exe directly.

### Package manager
This project uses **pnpm**, not npm or yarn. Do not use `npm install`, `npm test`, etc. — they will not resolve workspace dependencies correctly.

## Troubleshooting

### "Cannot find module '@tichu/shared'"
Shared package needs to be built. Run:
```bash
pnpm --filter @tichu/shared build
```
Or just `pnpm build` to rebuild everything.

### "Port 3000/3001 already in use"
Find and kill the stale process:
```bash
# Find what's using the port
lsof -i :3000   # or :3001

# Kill it
kill <PID>
```
Or use `bash scripts/dev-start.sh` which handles this automatically.

### Tests timeout or hang
- Check if a dev server is running and consuming the port the test needs
- Run `pnpm clean` then `pnpm build` to clear stale artifacts
- Run the specific failing test in isolation: `pnpm --filter @tichu/server test -- <test-file>`

### "pnpm: command not found"
Ensure pnpm 10.x is installed:
```bash
corepack enable
corepack prepare pnpm@latest --activate
```
Requires Node.js 20+.

### Build succeeds but types are wrong
TypeScript build info can get stale. Clean and rebuild:
```bash
pnpm clean && pnpm build
```

## Test Framework Details

- **Runner:** Vitest 3.x across all packages
- **Coverage:** v8 provider, 80% statement threshold enforced
- **Client environment:** jsdom (browser simulation via @testing-library/react)
- **Server/Shared environment:** Node.js
- **Coverage reporters:** text (terminal), HTML, JSON
