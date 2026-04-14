#!/usr/bin/env bash
# prod-start.sh — Kill processes, clean all caches, rebuild for production, start server + client
# Works for both fresh starts and restarts.
# Usage: bash prod-start.sh
set -e

export NODE_ENV=production

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$SCRIPT_DIR/packages/shared"
SERVER_DIR="$SCRIPT_DIR/packages/server"
CLIENT_DIR="$SCRIPT_DIR/packages/client"

# ─── 1. Stop existing processes ─────────────────────────────────────────
echo "=== Stopping existing processes ==="
powershell -Command "Get-Process -Name node,turbo -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true

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

# ─── 3. Build all packages for production ────────────────────────────────
echo "=== Building shared package ==="
cd "$SHARED_DIR"
npx tsc
echo "Shared package built."

echo "=== Building server package ==="
cd "$SERVER_DIR"
npx tsc
echo "Server package built."

echo "=== Building client package (production) ==="
cd "$CLIENT_DIR"
npx next build
echo "Client package built."

# ─── 4. Start server + client (production) ──────────────────────────────
echo "=== Starting server (production — node) ==="
cd "$SERVER_DIR"
node dist/index.js &
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

echo "=== Starting client (production — next start) ==="
cd "$CLIENT_DIR"
npx next start --port 3000 &
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

# ─── Ready ────────────────────────────────────────────────────────────────
echo ""
echo "=== Both servers running (production) ==="
echo "  Server: http://localhost:3001 (PID $SERVER_PID)"
echo "  Client: http://localhost:3000 (PID $CLIENT_PID)"
echo "  Press Ctrl+C to stop both"

wait
