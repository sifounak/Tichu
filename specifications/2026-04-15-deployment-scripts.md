# Specification: Deployment Scripts & Apache Configuration

**Version:** 1.0
**Date:** 2026-04-15
**Status:** Draft
**Confidence:** High — All requirements are well-defined from planning discussion; no open design questions remain. Cannot verify production behavior until Linux server access is available.

## 1. Goal

Create deployment automation scripts and configuration files to serve the Tichu web game at `sifounakis.com/tichu` behind Apache on a separate Linux server, and to streamline the local development workflow. The repo will live at `/files/.www/tichu_source` on the server, with systemd managing the Node.js processes and Apache acting as a reverse proxy.

## 2. Context & Background

The Tichu game is a monorepo with three packages:
- **@tichu/client** — Next.js 15 app (SSR, port 3000)
- **@tichu/server** — Fastify 5 + WebSocket server (port 3001)
- **@tichu/shared** — Pure TypeScript game engine

The client reads three build-time env vars (`NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BASE_PATH`) and the server reads runtime env vars (`PORT`, `CORS_ORIGIN`, `DATABASE_PATH`, `JWT_SECRET`). The client's `next.config.ts` already supports `basePath` via `NEXT_PUBLIC_BASE_PATH`.

**Current state:**
- `code/dev-start.sh` exists for local dev (kills processes, cleans, builds, starts in watch mode)
- No production build/deploy scripts exist
- No Apache configuration exists
- No systemd service files exist
- No environment files exist (env vars are hardcoded defaults in source)

**Target deployment:**
- Dev: localhost on Windows (no Apache)
- Prod: `sifounakis.com/tichu` on a separate Linux server with SSL already configured

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-DS01 | Dev environment file (`.env.dev`) centralizes all development env vars | Must | File exists at `code/scripts/.env.dev` with all 7 env vars; dev-start.sh sources it |
| REQ-F-DS02 | Prod environment template (`.env.prod.example`) provides a committable template for production env vars | Must | File committed to git with placeholder JWT_SECRET; `.env.prod` is gitignored |
| REQ-F-DS03 | Dev start script builds and launches the development environment | Must | Running `bash code/scripts/dev-start.sh` kills stale processes, cleans caches, rebuilds shared+server, starts server (tsx watch :3001) + client (next dev :3000) |
| REQ-F-DS04 | Prod build script compiles all packages for production | Must | Running `bash code/scripts/prod-build.sh` installs deps, exports NEXT_PUBLIC_* vars, builds shared→server→client in order, validates outputs exist |
| REQ-F-DS05 | Prod start script builds and launches production services | Must | Running `bash code/scripts/prod-start.sh` calls prod-build.sh, then restarts systemd services, shows status |
| REQ-F-DS06 | Prod deploy script pulls latest code, builds, and launches | Must | Running `bash code/scripts/prod-deploy.sh` does git pull, calls prod-start.sh, shows summary with timestamp and commit hash |
| REQ-F-DS07 | systemd unit file for game server runs Fastify on port 3001 | Must | `tichu-server.service` starts node, reads env from .env.prod, restarts on crash, starts after network.target |
| REQ-F-DS08 | systemd unit file for web client runs Next.js on port 3000 | Must | `tichu-client.service` starts next, reads env from .env.prod, restarts on crash, starts after tichu-server.service |
| REQ-F-DS09 | Apache config snippet proxies `/tichu` to the Node processes | Must | Config handles: WebSocket upgrade at `/tichu/ws` → :3001/ws, API at `/tichu/api` → :3001/api, all other `/tichu/*` → :3000/tichu |
| REQ-F-DS10 | Existing `code/dev-start.sh` is replaced by the new `code/scripts/dev-start.sh` | Must | Old file removed; new file sources `.env.dev` and provides equivalent functionality |
| REQ-F-DS11 | Scripts are composable — start scripts call build scripts | Should | `prod-start.sh` sources `prod-build.sh`; `prod-deploy.sh` calls `prod-start.sh` |
| REQ-F-DS12 | Scripts validate prerequisites before running (Node, pnpm, etc.) | Should | Scripts check for required tools and print clear errors if missing |
| REQ-F-DS13 | First-time server setup is documented with step-by-step instructions | Must | README or doc file covers: Node install, pnpm, repo clone, .env.prod creation, systemd install, Apache module setup |

### 3.2 Non-Functional Requirements

| ID | Requirement | Category | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-NF-DS01 | Scripts are portable bash (no bashisms beyond POSIX+common extensions) | Portability | Scripts run on both Git Bash (Windows) for dev and Linux (Debian/Ubuntu) for prod |
| REQ-NF-DS02 | Production secrets never committed to git | Security | `.env.prod` is in `.gitignore`; only `.env.prod.example` is committed |
| REQ-NF-DS03 | All paths in systemd and scripts reference `/files/.www/tichu_source` | Correctness | Absolute paths are consistent throughout all config files |
| REQ-NF-DS04 | Scripts provide clear output (progress messages, error messages, success confirmation) | Usability | Each major step echoes what it's doing; errors are caught and reported |

### 3.3 Constraints

- **Server location:** Repo at `/files/.www/tichu_source` on the Linux server
- **URL path:** `sifounakis.com/tichu` (subpath, not root)
- **SSL:** Already configured on Apache — scripts use `wss://` and `https://` URLs
- **No Docker:** All processes run natively with systemd
- **No remote access now:** All files created locally; production testing deferred

### 3.4 Assumptions

- **A1:** Linux server runs a systemd-based distribution (Debian/Ubuntu) — *if not, systemd unit files need adaptation*
- **A2:** Node.js 20+ and pnpm are installed (or will be) on the server — *scripts check but don't install*
- **A3:** Apache has `mod_proxy`, `mod_proxy_http`, `mod_proxy_wstunnel`, `mod_rewrite` available — *config snippet requires all four*
- **A4:** The user has sudo access on the Linux server for systemd and Apache config — *required for service installation*
- **A5:** Git is available on the server and the repo will be cloned there — *prod-deploy.sh requires git*

## 4. Scope

### 4.1 In Scope

- Environment files (`.env.dev`, `.env.prod.example`)
- Dev start script (replaces existing `dev-start.sh`)
- Prod build, start, and deploy scripts
- systemd service unit files for server and client
- Apache reverse proxy configuration snippet
- `.gitignore` updates for `.env.prod`
- Setup documentation

### 4.2 Out of Scope

- **CI/CD automation** (GitHub Actions, webhooks) — future consideration
- **Database backup scripts** — separate concern
- **SSL certificate management** — already handled by existing Apache config
- **Monitoring/alerting** — future consideration
- **Docker/container support** — explicitly excluded per user preference
- **pm2 configuration** — replaced by systemd

## 5. Edge Cases & Boundary Conditions

| ID | Scenario | Expected Behavior |
|----|---------|------------------|
| EC-001 | `prod-build.sh` run without `.env.prod` | Script exits with clear error message pointing to `.env.prod.example` |
| EC-002 | `prod-deploy.sh` run with uncommitted local changes | Git pull may fail; script should warn about dirty working tree |
| EC-003 | Port 3000 or 3001 already in use when dev-start.sh runs | Script kills existing processes first (existing behavior preserved) |
| EC-004 | `prod-start.sh` run when systemd services not yet installed | Script exits with error explaining how to install the services |
| EC-005 | Build fails mid-way (e.g., shared compiles but server fails) | Script exits immediately (set -e); partial build artifacts may remain |
| EC-006 | `NEXT_PUBLIC_BASE_PATH` not set at client build time | Next.js builds with empty basePath (works for localhost, breaks for /tichu) |

## 6. Risks & Concerns

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R-001 | Apache proxy config doesn't work with existing vhost setup | Medium | High | Provide config as a snippet with clear comments; document required modules; test on server when access available |
| R-002 | systemd service paths wrong for target server | Low | Medium | All paths use `/files/.www/tichu_source` consistently; easy to find-and-replace if wrong |
| R-003 | Next.js standalone output mode needed for production but not configured | Medium | High | Verify `next start` works without standalone; add `output: 'standalone'` to next.config.ts if needed |
| R-004 | WebSocket proxy drops connections or fails upgrade | Medium | High | Apache config uses dedicated RewriteRule for ws:// before general ProxyPass rules |
| R-005 | `.env.prod` accidentally committed with real secrets | Low | Critical | Added to `.gitignore`; only `.env.prod.example` with placeholder committed |

## 7. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Dev workflow | Single command starts full dev environment | Run `bash code/scripts/dev-start.sh`, verify both servers respond |
| Prod build | Single command produces deployable build | Run `bash code/scripts/prod-build.sh`, verify all dist/build outputs exist |
| Prod deploy | Single command updates running production | Run `bash code/scripts/prod-deploy.sh` on server, verify game accessible at sifounakis.com/tichu |
| Auto-recovery | Services restart after crash | Kill a node process, verify systemd restarts it within 5 seconds |
| Boot persistence | Services start on server reboot | Reboot server, verify game accessible without manual intervention |

## 8. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `code/scripts/.env.dev` | Create | Dev environment variables |
| `code/scripts/.env.prod.example` | Create | Prod environment template (committed) |
| `code/scripts/dev-start.sh` | Create | Dev build + launch script |
| `code/scripts/prod-build.sh` | Create | Prod build script |
| `code/scripts/prod-start.sh` | Create | Prod build + launch script |
| `code/scripts/prod-deploy.sh` | Create | Pull + build + launch script |
| `code/scripts/systemd/tichu-server.service` | Create | systemd unit for Fastify server |
| `code/scripts/systemd/tichu-client.service` | Create | systemd unit for Next.js client |
| `code/scripts/apache/tichu.conf` | Create | Apache reverse proxy config snippet |
| `code/dev-start.sh` | Delete | Replaced by `code/scripts/dev-start.sh` |
| `.gitignore` | Modify | Add `.env.prod` pattern |
| `documentation/deployment.md` | Create | Setup guide and operational docs |

## 9. Open Questions

None — all design decisions resolved during planning conversation.
