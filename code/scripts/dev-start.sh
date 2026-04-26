#!/usr/bin/env bash
# REQ-F-DS03: Dev start script — kill stale processes, clean caches, rebuild, start server + client
# REQ-F-DS12: Prerequisite validation
# Sources .env.dev for environment variables.
# Usage: bash code/scripts/dev-start.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SHARED_DIR="$CODE_DIR/packages/shared"
SERVER_DIR="$CODE_DIR/packages/server"
CLIENT_DIR="$CODE_DIR/packages/client"

# ─── 0. Source environment ──────────────────────────────────────────────
# REQ-F-DS01: Dev environment file
if [ -f "$SCRIPT_DIR/.env.dev" ]; then
  echo "=== Loading .env.dev ==="
  set -a
  . "$SCRIPT_DIR/.env.dev"
  set +a
else
  echo "WARNING: $SCRIPT_DIR/.env.dev not found — using hardcoded defaults"
fi

# ─── 0.1 Prerequisite check ────────────────────────────────────────────
# REQ-F-DS12: Prerequisite validation
REQUIRED_NODE_MAJOR=$(cat "$CODE_DIR/.nvmrc" 2>/dev/null | tr -d '[:space:]')
if [ -z "$REQUIRED_NODE_MAJOR" ]; then
  echo "ERROR: $CODE_DIR/.nvmrc not found."
  exit 1
fi

echo "=== Checking prerequisites ==="
MISSING=""
if ! command -v node >/dev/null 2>&1; then MISSING="$MISSING node"; fi
if command -v pnpm >/dev/null 2>&1; then
  PKG_MGR="pnpm"
elif command -v npx >/dev/null 2>&1; then
  PKG_MGR="npx"
else
  MISSING="$MISSING pnpm/npx"
fi

if [ -n "$MISSING" ]; then
  echo "ERROR: Missing required tools:$MISSING"
  echo "Install Node.js ($REQUIRED_NODE_MAJOR+) and pnpm before running this script."
  exit 1
fi

# Verify Node major version meets .nvmrc requirement
ACTUAL_NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$ACTUAL_NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
  echo "ERROR: Node.js v$REQUIRED_NODE_MAJOR+ required but found $(node --version)."
  echo "Install Node.js $REQUIRED_NODE_MAJOR or higher before running."
  exit 1
fi
echo "Prerequisites OK (node $(node --version), $PKG_MGR)"

# ─── 1. Stop existing processes ─────────────────────────────────────────
echo "=== Stopping existing processes ==="
if command -v powershell >/dev/null 2>&1; then
  powershell -Command "Get-Process -Name node,turbo -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true
else
  pkill -f "tsx watch" 2>/dev/null || true
  pkill -f "next dev" 2>/dev/null || true
fi

echo "Waiting for ports to free up..."
for i in $(seq 1 15); do
  if netstat -ano 2>/dev/null | grep -E ':(3000|3001)\s' | grep -q LISTENING; then
    sleep 1
  else
    echo "Ports are free."
    break
  fi
done

if netstat -ano 2>/dev/null | grep -E ':(3000|3001)\s' | grep -q LISTENING; then
  echo "ERROR: Ports 3000/3001 still in use after 15s. Aborting."
  netstat -ano | grep -E ':(3000|3001)\s' | grep LISTENING
  exit 1
fi

# ─── 2. Clean all caches and build artifacts ─────────────────────────────
echo "=== Cleaning caches and build artifacts ==="
rm -rf "$CLIENT_DIR/.next" 2>/dev/null || true
rm -rf "$SHARED_DIR/dist" 2>/dev/null || true
rm -rf "$SERVER_DIR/dist" 2>/dev/null || true
rm -f "$CLIENT_DIR/tsconfig.tsbuildinfo" 2>/dev/null || true
rm -f "$SHARED_DIR/tsconfig.tsbuildinfo" 2>/dev/null || true
rm -f "$SERVER_DIR/tsconfig.tsbuildinfo" 2>/dev/null || true
echo "Cleaned: .next, shared/dist, server/dist, tsbuildinfo files"

# ─── 3. Rebuild packages in dependency order ─────────────────────────────
echo "=== Building shared package ==="
cd "$SHARED_DIR"
npx tsc
echo "Shared package built."

echo "=== Building server package ==="
cd "$SERVER_DIR"
npx tsc
echo "Server package built."

# Client (Next.js) builds on-the-fly during dev — no explicit build needed

# ─── 4. Start server + client ───────────────────────────────────────────
echo "=== Starting server (tsx watch — live reload) ==="
cd "$SERVER_DIR"
npx tsx watch src/index.ts &
SERVER_PID=$!

for i in $(seq 1 10); do
  if netstat -ano 2>/dev/null | grep -q ":3001.*LISTENING"; then
    echo "Server ready on port 3001 (PID $SERVER_PID)"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "WARNING: Server may not have started on port 3001"
  fi
  sleep 1
done

echo "=== Starting client (next dev) ==="
cd "$CLIENT_DIR"
npx next dev --port 3000 &
CLIENT_PID=$!

for i in $(seq 1 15); do
  if netstat -ano 2>/dev/null | grep -q ":3000.*LISTENING"; then
    echo "Client ready on port 3000 (PID $CLIENT_PID)"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "WARNING: Client may not have started on port 3000"
  fi
  sleep 1
done

# ─── Ready ───────────────────────────────────────────────────────────────
echo ""
echo "=== Both servers running ==="
echo "  Server: http://localhost:3001 (PID $SERVER_PID)"
echo "  Client: http://localhost:3000 (PID $CLIENT_PID)"
echo "  Press Ctrl+C to stop both"

wait
