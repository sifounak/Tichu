#!/usr/bin/env bash
# Reliable dev startup: kill old processes, clean cache, start server + client
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/packages/server"
CLIENT_DIR="$SCRIPT_DIR/packages/client"

echo "=== Stopping existing processes ==="
# Kill any node processes on our ports
for port in 3000 3001; do
  pid=$(netstat -ano 2>/dev/null | grep ":$port.*LISTENING" | awk '{print $5}' | head -1)
  if [ -n "$pid" ] && [ "$pid" != "0" ]; then
    echo "Killing PID $pid on port $port"
    taskkill //F //PID "$pid" 2>/dev/null || true
  fi
done

# Brief pause to let file handles release
sleep 2

echo "=== Cleaning .next cache ==="
rm -rf "$CLIENT_DIR/.next" 2>/dev/null || true

echo "=== Starting server ==="
cd "$SERVER_DIR"
node dist/index.js &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 10); do
  if netstat -ano 2>/dev/null | grep -q ":3001.*LISTENING"; then
    echo "Server ready on port 3001 (PID $SERVER_PID)"
    break
  fi
  sleep 1
done

echo "=== Starting client ==="
cd "$CLIENT_DIR"
npx next dev --port 3000 &
CLIENT_PID=$!

# Wait for client to be ready
for i in $(seq 1 15); do
  if netstat -ano 2>/dev/null | grep -q ":3000.*LISTENING"; then
    echo "Client ready on port 3000 (PID $CLIENT_PID)"
    break
  fi
  sleep 1
done

echo "=== Both servers running ==="
echo "  Server: http://localhost:3001 (PID $SERVER_PID)"
echo "  Client: http://localhost:3000 (PID $CLIENT_PID)"
echo "  Press Ctrl+C to stop both"

# Wait for either to exit
wait
