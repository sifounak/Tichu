# Server Deployment Guide

Step-by-step guide for deploying Tichu on `sifounakis.com`, tailored to this server's directory layout.

## Directory Layout

```
/files/.www/tichu/
├── .env.prod           ← production environment config (secrets — not in git)
├── data/               ← SQLite database (auto-created on first run)
├── source/             ← cloned repository
│   └── code/
│       ├── scripts/    ← build & deploy scripts
│       └── packages/   ← shared, server, client
└── built/              ← deployed artifacts (created by deploy script)
    ├── server/
    └── client/
```

## Where `.env.prod` lives

**Location: `/files/.www/tichu/.env.prod`** (the parent of `built/`).

This is the right place because:
- Both systemd service files already reference `EnvironmentFile=/files/.www/tichu/.env.prod`
- The deploy script (`prod-deploy.sh`) looks for `.env.prod` in the parent of the target directory — since the target is `/files/.www/tichu/built`, that parent is `/files/.www/tichu/`
- It's outside the git repo (`source/`), so secrets never get committed
- It's next to `data/` and `built/`, keeping all deployment state in one place

## Prerequisites

- **Node.js 22+** — check with `node --version`
- **pnpm** — check with `pnpm --version`
- **Apache 2.4+** with SSL configured for `sifounakis.com`

---

## Phase 1: Build & Deploy

### Step 1 — Clone the repository (if not already done)

```bash
cd /files/.www/tichu
git clone <repo-url> source
```

### Step 2 — Create `.env.prod`

The build script needs this file for the `NEXT_PUBLIC_*` variables that get baked into the client at build time. The server reads it at runtime for the remaining variables.

```bash
# Check if .env.prod already exists
if [ ! -f /files/.www/tichu/.env.prod ]; then
  cp /files/.www/tichu/source/code/scripts/.env.prod.example /files/.www/tichu/.env.prod
  echo ""
  echo "==> .env.prod has been created at /files/.www/tichu/.env.prod"
  echo "==> Edit it now before proceeding:"
  echo "      nano /files/.www/tichu/.env.prod"
  echo ""
  echo "    At minimum, set:"
  echo "      JWT_SECRET  — run: openssl rand -hex 32"
  echo "      DATABASE_PATH — should be /files/.www/tichu/data/tichu.sqlite"
  echo "      CORS_ORIGIN — https://sifounakis.com"
  echo ""
  echo "    Do NOT proceed until the file is updated."
fi
```

The expected contents (with your values filled in):

```bash
# ─── Client build-time variables ────────────────────────────────────────
NEXT_PUBLIC_WS_URL=wss://sifounakis.com/tichu/ws
NEXT_PUBLIC_API_URL=https://sifounakis.com/tichu/api
NEXT_PUBLIC_BASE_PATH=/tichu

# ─── Server runtime variables ───────────────────────────────────────────
PORT=3001
CORS_ORIGIN=https://sifounakis.com
DATABASE_PATH=/files/.www/tichu/data/tichu.sqlite
JWT_SECRET=<paste output of: openssl rand -hex 32>
```

### Step 3 — Build

```bash
cd /files/.www/tichu/source
bash code/scripts/prod-build.sh /files/.www/tichu/.env.prod
```

This will:
1. Source `.env.prod` to pick up the `NEXT_PUBLIC_*` variables
2. Install dependencies with `pnpm install --frozen-lockfile`
3. Compile shared -> server -> client
4. Assemble a portable `build/` directory inside `source/code/build/`
5. Validate all expected outputs exist

If it fails, check the [Troubleshooting](#troubleshooting) section at the bottom.

### Step 4 — Deploy to target directory

```bash
bash code/scripts/prod-deploy.sh /files/.www/tichu/built
```

This will:
1. Verify the `build/` directory from Step 3 exists
2. Check that `/files/.www/tichu/.env.prod` exists (errors if not)
3. Create `/files/.www/tichu/data/` if it doesn't exist
4. Copy server and client artifacts to `/files/.www/tichu/built/`
5. Attempt to restart systemd services (will gracefully skip if not installed yet)

---

## Phase 2: Manual Verification (before systemd)

Before setting up systemd, verify the game works by running the processes manually.

### Step 5 — Start the server manually

Open a terminal:

```bash
cd /files/.www/tichu/built/server
set -a && . /files/.www/tichu/.env.prod && set +a
NODE_ENV=production node dist/index.js
```

You should see log output indicating the server started on port 3001. Verify:

```bash
# In another terminal:
curl http://localhost:3001/health
```

You should get a JSON response.

### Step 6 — Start the client manually

Open another terminal:

```bash
cd /files/.www/tichu/built/client/packages/client
set -a && . /files/.www/tichu/.env.prod && set +a
NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 node server.js
```

### Step 7 — Configure Apache (if not already done)

Enable required modules:

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite
```

Add the proxy rules to your existing SSL vhost for `sifounakis.com`. Either include the config snippet or paste its contents directly:

```bash
# Option A: Copy and include
sudo cp /files/.www/tichu/source/code/scripts/apache/tichu.conf /etc/apache2/conf-available/
sudo a2enconf tichu

# Option B: Paste into your vhost manually
sudo nano /etc/apache2/sites-available/your-ssl-vhost.conf
# Paste the contents of source/code/scripts/apache/tichu.conf
# inside the <VirtualHost *:443> block
```

Reload Apache:

```bash
sudo systemctl reload apache2
```

### Step 8 — Test in browser

1. Visit `https://sifounakis.com/tichu` — the game lobby should load
2. Open browser DevTools -> Network tab — the WebSocket connection to `/tichu/ws` should connect
3. Try creating a room and joining it

Once verified, `Ctrl+C` both terminal processes from Steps 5 and 6.

---

## Phase 3: Systemd Setup (run on boot)

Now that the game is verified working, set up systemd so it runs automatically.

### Step 9 — Install service files

```bash
sudo cp /files/.www/tichu/source/code/scripts/systemd/tichu-server.service /etc/systemd/system/
sudo cp /files/.www/tichu/source/code/scripts/systemd/tichu-client.service /etc/systemd/system/
sudo systemctl daemon-reload
```

The service files are pre-configured for this directory layout:
- `WorkingDirectory` points to `/files/.www/tichu/built/server` and `.../client/packages/client`
- `EnvironmentFile` points to `/files/.www/tichu/.env.prod`
- Both run as `www-data` user

If your user isn't `www-data`, edit the service files before enabling.

### Step 10 — Ensure `www-data` has access

```bash
# The www-data user needs read access to the deployment and execute on node
sudo chown -R www-data:www-data /files/.www/tichu/built
sudo chown -R www-data:www-data /files/.www/tichu/data
sudo chown www-data:www-data /files/.www/tichu/.env.prod
sudo chmod 600 /files/.www/tichu/.env.prod
```

### Step 11 — Enable and start

```bash
sudo systemctl enable tichu-server tichu-client
sudo systemctl start tichu-server
sudo systemctl start tichu-client
```

### Step 12 — Verify services

```bash
sudo systemctl status tichu-server
sudo systemctl status tichu-client
curl http://localhost:3001/health
```

Check logs if anything is wrong:

```bash
sudo journalctl -u tichu-server -f
sudo journalctl -u tichu-client -f
```

---

## Routine Updates

After pulling new code on the server:

```bash
cd /files/.www/tichu/source
git pull
bash code/scripts/prod-build.sh /files/.www/tichu/.env.prod
bash code/scripts/prod-deploy.sh /files/.www/tichu/built
```

The deploy script restarts both systemd services automatically.

---

## Troubleshooting

### Build fails: `.env.prod not found`

The build script accepts the env file path as an argument. Make sure you pass it:

```bash
bash code/scripts/prod-build.sh /files/.www/tichu/.env.prod
```

### Build fails: `pnpm install` errors

Try a clean build:

```bash
cd /files/.www/tichu/source/code
rm -rf node_modules packages/*/node_modules packages/*/dist packages/client/.next
pnpm install
bash scripts/prod-build.sh /files/.www/tichu/.env.prod
```

### WebSocket connection fails

1. Verify Apache modules: `apache2ctl -M | grep -E 'proxy|rewrite'`
2. The WebSocket RewriteRule must come **before** the ProxyPass rules in your vhost
3. Check server logs: `sudo journalctl -u tichu-server -f`

### Service won't start

1. Check logs: `sudo journalctl -u tichu-server -n 50`
2. Verify paths in the service file match your layout
3. Verify `www-data` can read the files: `sudo -u www-data ls /files/.www/tichu/built/server/dist/`
4. Verify the env file is readable: `sudo -u www-data cat /files/.www/tichu/.env.prod`

### Game loads but API calls fail

1. Check `CORS_ORIGIN` in `.env.prod` — must match your domain exactly, no trailing slash
2. Verify the server is running: `curl http://localhost:3001/health`
3. Check Apache ProxyPass rules are inside the correct `<VirtualHost>` block

### Database permission errors

The SQLite database is at the path set in `DATABASE_PATH`. Ensure the directory is writable:

```bash
sudo chown -R www-data:www-data /files/.www/tichu/data
```
