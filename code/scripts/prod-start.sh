#!/usr/bin/env bash
# REQ-F-DS05: Prod start script — build then restart systemd services
# REQ-F-DS11: Script composability (calls prod-build.sh)
# Usage: bash code/scripts/prod-start.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── 1. Run production build ────────────────────────────────────────────
echo "=== Running production build ==="
bash "$SCRIPT_DIR/prod-build.sh"

# ─── 2. Restart systemd services ────────────────────────────────────────
echo ""
echo "=== Restarting systemd services ==="

# EC-004: Check if systemd services are installed
if ! command -v systemctl >/dev/null 2>&1; then
  echo "WARNING: systemctl not available (not on a systemd Linux system)."
  echo "Build completed successfully — start the services manually."
  exit 0
fi

if ! systemctl list-unit-files tichu-server.service >/dev/null 2>&1; then
  echo "ERROR: tichu-server.service is not installed."
  echo "Install the systemd services first:"
  echo "  sudo cp $SCRIPT_DIR/systemd/tichu-server.service /etc/systemd/system/"
  echo "  sudo cp $SCRIPT_DIR/systemd/tichu-client.service /etc/systemd/system/"
  echo "  sudo systemctl daemon-reload"
  echo "  sudo systemctl enable tichu-server tichu-client"
  exit 1
fi

sudo systemctl restart tichu-server
echo "tichu-server restarted."

sudo systemctl restart tichu-client
echo "tichu-client restarted."

# ─── 3. Show status ─────────────────────────────────────────────────────
echo ""
echo "=== Service status ==="
systemctl status tichu-server --no-pager -l || true
echo ""
systemctl status tichu-client --no-pager -l || true

echo ""
echo "=== Production services restarted successfully ==="
