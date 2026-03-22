#!/usr/bin/env bash
# dev-start.sh — Kill processes, clean all caches, rebuild, start server + client
# Works for both fresh starts and restarts.
# Usage: bash dev-start.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$SCRIPT_DIR/packages/shared"
SERVER_DIR="$SCRIPT_DIR/packages/server"
CLIENT_DIR="$SCRIPT_DIR/packages/client"

# ─── 1. Stop existing processes (was: already implemented) ────────────────
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

# ─── 2. Clean all caches and build artifacts (was: only .next; added: shared/dist, server/dist, tsconfig caches) ────
echo "=== Cleaning caches and build artifacts ==="
rm -rf "$CLIENT_DIR/.next" 2>/dev/null || true
rm -rf "$SHARED_DIR/dist" 2>/dev/null || true
rm -rf "$SERVER_DIR/dist" 2>/dev/null || true
rm -f "$CLIENT_DIR/tsconfig.tsbuildinfo" 2>/dev/null || true
rm -f "$SHARED_DIR/tsconfig.tsbuildinfo" 2>/dev/null || true
rm -f "$SERVER_DIR/tsconfig.tsbuildinfo" 2>/dev/null || true
echo "Cleaned: .next, shared/dist, server/dist, tsbuildinfo files"

# ─── 3. Rebuild packages in dependency order (was: missing — NEW) ─────────
echo "=== Building shared package ==="
cd "$SHARED_DIR"
npx tsc
echo "Shared package built."

echo "=== Building server package ==="
cd "$SERVER_DIR"
npx tsc
echo "Server package built."

# Note: Client (Next.js) builds on-the-fly during dev, no explicit build needed

# ─── 4. Start server + client (was: already implemented) ─────────────────
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

# ─── Ready ────────────────────────────────────────────────────────────────
echo ""
echo "=== Both servers running ==="
echo "  Server: http://localhost:3001 (PID $SERVER_PID)"
echo "  Client: http://localhost:3000 (PID $CLIENT_PID)"
echo "  Press Ctrl+C to stop both"

wait
