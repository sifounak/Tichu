#!/usr/bin/env bash
# Launches both Tichu server and client processes.
# Used by tichu.service — do not run directly.
#
# Expects environment variables from .env.production (loaded by systemd).
# Uses SERVER_PORT/CLIENT_PORT instead of PORT to avoid conflicts.
set -e

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── Start game server ──────────────────────────────────────────────────
cd "$DEPLOY_DIR/server"
PORT=${SERVER_PORT:-3001} node dist/index.js &
SERVER_PID=$!
echo "Server started (PID $SERVER_PID, port ${SERVER_PORT:-3001})"

# ─── Start web client ───────────────────────────────────────────────────
cd "$DEPLOY_DIR/client/packages/client"
PORT=${CLIENT_PORT:-3000} HOSTNAME=${CLIENT_HOSTNAME:-0.0.0.0} node server.js &
CLIENT_PID=$!
echo "Client started (PID $CLIENT_PID, port ${CLIENT_PORT:-3000})"

# ─── Signal handling ────────────────────────────────────────────────────
cleanup() {
  echo "Stopping Tichu processes..."
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null
  wait "$SERVER_PID" "$CLIENT_PID" 2>/dev/null
}
trap cleanup SIGTERM SIGINT

# Wait for either process to exit — if one dies, stop both and let systemd restart
wait -n "$SERVER_PID" "$CLIENT_PID" 2>/dev/null
EXIT_CODE=$?
echo "A process exited (code $EXIT_CODE), shutting down..."
cleanup
exit "$EXIT_CODE"
