#!/usr/bin/env bash
# restart-dev.sh — Kill all Tichu dev processes and restart them
# Usage: bash restart-dev.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Stopping all node/turbo processes ==="
powershell -Command "Get-Process -Name node,turbo -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true

# Wait for ports to be released
echo "Waiting for ports to free up..."
for i in {1..15}; do
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

echo ""
echo "=== Starting dev servers ==="
npm run dev
