# Deployment Scripts — Specification Conversation

## Summary

**Goal:** Create deployment automation scripts and configuration to serve Tichu at `sifounakis.com/tichu` behind Apache on a separate Linux server.

### Key Decisions

1. **Architecture:** Apache acts as a reverse proxy to two Node.js processes (Next.js on :3000, Fastify on :3001). Not a static file server.
2. **Deployment location:** `/files/.www/tichu_source` on the Linux server — adjacent to web root, not inside it.
3. **Process management:** systemd over pm2 — already on the server, native journald logging, auto-start on boot, no extra dependency.
4. **Dev environment:** Stays local on Windows at localhost:3000/3001, no Apache involvement.
5. **Environment files:** `.env.dev` and `.env.prod` centralize all config. `.env.prod` never committed (contains JWT_SECRET).
6. **Script design:** Separate composable scripts (prod-deploy calls prod-start calls prod-build).
7. **Build strategy:** Build in place — `git pull → build → systemctl restart`. ~5-10s downtime acceptable for a card game.
8. **SSL:** Already configured on Apache — production URLs use wss:// and https://.

### Scripts Planned

| Script | Purpose |
|--------|---------|
| `dev-start.sh` | Build + launch dev (replaces existing `code/dev-start.sh`) |
| `prod-build.sh` | Build all packages for production |
| `prod-start.sh` | Build + restart systemd services |
| `prod-deploy.sh` | Git pull + build + restart |

### Also Planned
- systemd unit files (`tichu-server.service`, `tichu-client.service`)
- Apache config snippet (`tichu.conf`)
- Setup documentation (`documentation/deployment.md`)

### Specification Output
- 13 functional requirements (REQ-F-DS01 through DS13)
- 4 non-functional requirements (REQ-NF-DS01 through DS04)
- 6 edge cases, 5 risks identified
- Confidence: High
- Written to `specifications/2026-04-15-deployment-scripts.md`
