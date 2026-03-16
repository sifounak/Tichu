#!/usr/bin/env bash
# dev-start.sh — Kill any existing dev processes, clean cache, start server + client
# Works for both fresh starts and restarts.
# Usage: bash dev-start.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/packages/server"
CLIENT_DIR="$SCRIPT_DIR/packages/client"

# --- Stop existing processes ---
echo "=== Stopping existing processes ==="
# Kill all node/turbo processes (covers tsx watch, next dev, etc.)
powershell -Command "Get-Process -Name node,turbo -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true

# Wait for ports to be released
echo "Waiting for ports to free up..."
for i in $(seq 1 15); do
  if netstat -ano 2>/dev/null | grep -E ':(3000|3001)\s' | grep -q LISTENING; then
    sleep 1
  else
    echo "Ports are free."
    break
  fi
done

# Final check
if netstat -ano 2>/dev/null | grep -E ':(3000|3001)\s' | grep -q LISTENING; then
  echo "ERROR: Ports 3000/3001 still in use after 15s. Aborting."
  netstat -ano | grep -E ':(3000|3001)\s' | grep LISTENING
  exit 1
fi

# --- Clean cache ---
echo "=== Cleaning .next cache ==="
rm -rf "$CLIENT_DIR/.next" 2>/dev/null || true

# --- Start server ---
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

# --- Start client ---
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

# --- Ready ---
echo ""
echo "=== Both servers running ==="
echo "  Server: http://localhost:3001 (PID $SERVER_PID)"
echo "  Client: http://localhost:3000 (PID $CLIENT_PID)"
echo "  Press Ctrl+C to stop both"

wait
