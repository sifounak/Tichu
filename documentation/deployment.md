# Deployment Guide

This guide covers setting up the Tichu game for both local development and production deployment at `sifounakis.com/tichu`.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime |
| pnpm | 9+ | Package manager |
| Git | Any | Version control |

Production additionally requires:
- Linux server with systemd (Debian/Ubuntu recommended)
- Apache 2.4+ with `mod_proxy`, `mod_proxy_http`, `mod_proxy_wstunnel`, `mod_rewrite`
- SSL already configured on Apache for your domain

## Repository Structure

All scripts live in `code/scripts/`:

```
code/scripts/
├── .env.dev              # Dev environment variables
├── .env.prod.example     # Prod build-time template (committed)
├── .env.prod             # Prod build-time vars (gitignored — you create this)
├── dev-start.sh          # Dev: build + launch
├── prod-build.sh         # Prod: install + build all packages
├── prod-start.sh         # Prod: build + restart systemd services
├── prod-deploy.sh        # Prod: git pull + build + restart
├── systemd/
│   ├── tichu-server.service  # Fastify server unit
│   ├── tichu-client.service  # Next.js client unit
│   ├── env.server            # Server runtime env template
│   └── env.client            # Client runtime env template
└── apache/
    └── tichu.conf        # Reverse proxy config snippet
```

## Local Development

```bash
bash code/scripts/dev-start.sh
```

This will:
1. Load environment variables from `.env.dev`
2. Check prerequisites (node, pnpm/npx)
3. Kill any stale node processes
4. Clean build artifacts (`.next`, `dist/`, `tsbuildinfo`)
5. Build `shared` and `server` packages
6. Start the server with `tsx watch` on port 3001
7. Start the client with `next dev` on port 3000

Access the game at `http://localhost:3000`.

## Production Server Setup

### 1. Clone the repository

```bash
cd /files/.www
git clone <repo-url> tichu_source
cd tichu_source
```

### 2. Create the environment files

**Build-time** (for `NEXT_PUBLIC_*` vars baked into the client):

```bash
cp code/scripts/.env.prod.example /files/.www/tichu/.env.prod
nano /files/.www/tichu/.env.prod
```

**Runtime** (separate files for each service):

```bash
sudo cp code/scripts/systemd/env.server /files/.www/tichu/env.server
sudo cp code/scripts/systemd/env.client /files/.www/tichu/env.client
sudo nano /files/.www/tichu/env.server
```

Edit `env.server` and set real values:
- **`JWT_SECRET`** — generate a random secret: `openssl rand -hex 32`
- **`DATABASE_PATH`** — verify the path is writable by the `www-data` user
- **`CORS_ORIGIN`** — your domain (e.g., `https://sifounakis.com`)

Secure the files:

```bash
sudo chown www-data:www-data /files/.www/tichu/env.server /files/.www/tichu/env.client
sudo chmod 600 /files/.www/tichu/env.server /files/.www/tichu/env.client
```

### 3. Install systemd services

```bash
sudo cp code/scripts/systemd/tichu-server.service /etc/systemd/system/
sudo cp code/scripts/systemd/tichu-client.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tichu-server tichu-client
```

### 4. Configure Apache

Ensure required modules are enabled:

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite
```

Add the proxy rules to your existing SSL vhost (the one handling `sifounakis.com`):

```bash
# Option A: Include the config snippet
sudo cp code/scripts/apache/tichu.conf /etc/apache2/conf-available/
sudo a2enconf tichu

# Option B: Paste the contents of tichu.conf directly into your vhost
sudo nano /etc/apache2/sites-available/your-ssl-vhost.conf
```

Reload Apache:

```bash
sudo systemctl reload apache2
```

### 5. First deploy

```bash
bash code/scripts/prod-deploy.sh
```

### 6. Verify

- Visit `https://sifounakis.com/tichu` — the game lobby should load
- Open browser DevTools Network tab — WebSocket connection to `/tichu/ws` should succeed
- Check service status: `systemctl status tichu-server tichu-client`

## Script Reference

### `dev-start.sh`

Local development. Kills existing processes, cleans, builds, starts in watch mode.

### `prod-build.sh`

Builds all packages for production. Requires `.env.prod` to exist. Validates build outputs.

```bash
bash code/scripts/prod-build.sh
```

### `prod-start.sh`

Calls `prod-build.sh`, then restarts systemd services. Use when you've already pulled the latest code.

```bash
bash code/scripts/prod-start.sh
```

### `prod-deploy.sh`

Full deploy: `git pull` + `prod-start.sh`. Use for routine updates.

```bash
bash code/scripts/prod-deploy.sh
```

**Composability chain:** `prod-deploy.sh` -> `prod-start.sh` -> `prod-build.sh`

## Environment Variables

| Variable | Dev Value | Prod Value | Env File | Used By |
|----------|-----------|------------|----------|---------|
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3001/ws` | `wss://sifounakis.com/tichu/ws` | `.env.prod` | Client (build-time) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | `https://sifounakis.com/tichu/api` | `.env.prod` | Client (build-time) |
| `NEXT_PUBLIC_BASE_PATH` | *(empty)* | `/tichu` | `.env.prod` | Client (build-time) |
| `PORT` | `3001` | `3001` / `3000` | `env.server` / `env.client` | Server / Client (runtime) |
| `HOSTNAME` | — | `0.0.0.0` | `env.client` | Client (runtime) |
| `CORS_ORIGIN` | `http://localhost:3000` | `https://sifounakis.com` | `env.server` | Server (runtime) |
| `DATABASE_PATH` | `./data/tichu.sqlite` | `/files/.www/tichu/data/tichu.sqlite` | `env.server` | Server (runtime) |
| `JWT_SECRET` | `tichu-dev-secret` | *(random secret)* | `env.server` | Server (runtime) |

## Troubleshooting

### Ports still in use after dev-start.sh

The script waits up to 15 seconds for ports to free. If the problem persists:

```bash
# Windows
powershell "Get-Process node | Stop-Process -Force"

# Linux
pkill -f node
```

### WebSocket connection fails in production

1. Verify Apache modules: `apache2ctl -M | grep -E 'proxy|rewrite'`
2. Check the RewriteRule in your vhost handles the WebSocket upgrade
3. Check server logs: `journalctl -u tichu-server -f`

### Build fails

1. Verify Node.js version: `node --version` (need 20+)
2. Verify pnpm is installed: `pnpm --version`
3. Check if `.env.prod` exists (for prod builds)
4. Try a clean build: remove all `dist/`, `.next/`, `node_modules/` and re-run

### Service won't start

1. Check logs: `journalctl -u tichu-server -n 50`
2. Verify the `WorkingDirectory` path exists in the service file
3. Verify `www-data` user can read the project directory
4. Verify env files are readable: `sudo -u www-data cat /files/.www/tichu/env.server`

### Game loads but API calls fail

1. Check `CORS_ORIGIN` in `env.server` matches your domain exactly (no trailing slash)
2. Check Apache ProxyPass rules are inside the correct `<VirtualHost>` block
3. Verify the server is running: `curl http://localhost:3001/api/leaderboard`
