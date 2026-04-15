# Implementation Plan: Deployment Scripts & Apache Configuration

**Spec:** `specifications/2026-04-15-deployment-scripts.md`
**RTM:** `specifications/RTM-deployment-scripts.md`
**Branch:** `feature/deployment-scripts`
**Parent:** `main`

## Milestone 1: Environment Files & .gitignore (REQ-F-DS01, REQ-F-DS02, REQ-NF-DS02)

Create the environment variable files and update .gitignore.

**Files to create:**
- `code/scripts/.env.dev` — all 7 dev env vars
- `code/scripts/.env.prod.example` — prod template with placeholder JWT_SECRET

**Files to modify:**
- `.gitignore` — add `.env.prod` pattern

**Testing:** Verify `.env.prod` pattern is gitignored; verify env files have correct vars.

## Milestone 2: Dev Start Script (REQ-F-DS03, REQ-F-DS10, REQ-F-DS12, REQ-NF-DS01, REQ-NF-DS04)

Create the new dev-start.sh and remove the old one.

**Files to create:**
- `code/scripts/dev-start.sh` — sources `.env.dev`, kills stale processes, cleans caches, builds shared+server, starts tsx watch + next dev

**Files to delete:**
- `code/dev-start.sh` — replaced by new script

**Key behaviors to preserve from old dev-start.sh:**
- PowerShell process kill on Windows
- Port availability check with retry
- Clean build artifacts (shared/dist, server/dist, .next, tsbuildinfo)
- Build shared then server in order
- Start server with tsx watch, client with next dev
- Wait for ports to become available
- Print summary with PIDs

**New behaviors:**
- Source `.env.dev` for environment variables
- Prerequisite check (node, pnpm/npx)

**Testing:** Run on Windows, verify both servers start on :3000 and :3001.

## Milestone 3: Production Scripts (REQ-F-DS04, REQ-F-DS05, REQ-F-DS06, REQ-F-DS11, REQ-F-DS12, REQ-NF-DS01, REQ-NF-DS03, REQ-NF-DS04)

Create the three composable production scripts.

**Files to create:**
- `code/scripts/prod-build.sh` — sources .env.prod, exports NEXT_PUBLIC_* vars, pnpm install --frozen-lockfile, builds shared→server→client, validates outputs
- `code/scripts/prod-start.sh` — calls prod-build.sh, systemctl restart, shows status
- `code/scripts/prod-deploy.sh` — git pull, calls prod-start.sh, shows summary

**Composability chain:** `prod-deploy.sh` → `prod-start.sh` → `prod-build.sh`

**Edge case handling:**
- EC-001: prod-build.sh checks for .env.prod existence
- EC-002: prod-deploy.sh warns about dirty working tree
- EC-004: prod-start.sh checks if systemd services are installed
- EC-005: set -e ensures early exit on build failure

**Testing:** Run prod-build.sh locally to verify build succeeds (systemctl commands will only work on Linux).

## Milestone 4: systemd & Apache Configuration (REQ-F-DS07, REQ-F-DS08, REQ-F-DS09, REQ-NF-DS03)

Create the infrastructure configuration files.

**Files to create:**
- `code/scripts/systemd/tichu-server.service` — runs Fastify, env from .env.prod, Restart=always
- `code/scripts/systemd/tichu-client.service` — runs Next.js, env from .env.prod, After=tichu-server
- `code/scripts/apache/tichu.conf` — WebSocket rewrite + ProxyPass rules for /tichu

**All paths reference `/files/.www/tichu_source`.**

**Testing:** Validate systemd unit syntax with `systemd-analyze verify` (Linux only). Apache config is a reference snippet — tested when deployed.

## Milestone 5: Documentation (REQ-F-DS13)

Create the deployment guide.

**Files to create:**
- `documentation/deployment.md` — first-time setup checklist, script reference, Apache setup, troubleshooting

**Content covers:**
- Prerequisites (Node, pnpm, git)
- Server setup steps (clone, env file, systemd install, Apache config)
- Script usage (dev-start, prod-build, prod-start, prod-deploy)
- Verification steps
- Troubleshooting common issues

**Testing:** Review for accuracy against created files.
