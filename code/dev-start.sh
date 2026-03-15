#!/usr/bin/env bash
# Reliable dev startup: kill old processes, clean cache, start server + client
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/packages/server"
CLIENT_DIR="$SCRIPT_DIR/packages/client"

# Kill process on a given port, retrying with PowerShell if needed
kill_port() {
  local port=$1
  local pid
  pid=$(netstat -ano 2>/dev/null | grep ":$port.*LISTENING" | awk '{print $5}' | head -1)
  if [ -z "$pid" ] || [ "$pid" = "0" ]; then
    return 0
  fi
  echo "Killing PID $pid on port $port"
  # Try taskkill with tree flag first (kills children too)
  taskkill //F //T //PID "$pid" 2>/dev/null || true
  sleep 1
  # If still alive, use PowerShell
  if netstat -ano 2>/dev/null | grep -q ":$port.*LISTENING"; then
    echo "  Retrying with PowerShell..."
    powershell -Command "Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue" 2>/dev/null || true
    sleep 2
  fi
  # Final check
  if netstat -ano 2>/dev/null | grep -q ":$port.*LISTENING"; then
    echo "  ERROR: Port $port still in use!"
    return 1
  fi
  echo "  Port $port freed"
}

echo "=== Stopping existing processes ==="
for port in 3001 3000; do
  kill_port "$port"
done

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
  if [ "$i" -eq 10 ]; then
    echo "WARNING: Server may not have started on port 3001"
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
  if [ "$i" -eq 15 ]; then
    echo "WARNING: Client may not have started on port 3000"
  fi
  sleep 1
done

echo "=== Both servers running ==="
echo "  Server: http://localhost:3001 (PID $SERVER_PID)"
echo "  Client: http://localhost:3000 (PID $CLIENT_PID)"
echo "  Press Ctrl+C to stop both"

# Wait for either to exit
wait
