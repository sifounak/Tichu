#!/usr/bin/env bash
# Production deploy script — copy build/ artifacts to a target directory and restart services.
#
# Usage:
#   bash code/scripts/prod-deploy.sh <target-directory>
#
# Example:
#   bash code/scripts/prod-deploy.sh /files/.www/tichu/built
#
# Prerequisites:
#   - Run prod-build.sh first to create the build/ directory.
#   - Place .env.production in the target's parent directory (e.g., /files/.www/tichu/.env.production).
#   - The target's parent should also contain a data/ directory for the SQLite database.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$CODE_DIR/.." && pwd)"
BUILD_DIR="$CODE_DIR/build"

# ─── 0. Validate arguments ──────────────────────────────────────────────
TARGET="${1:?Usage: bash code/scripts/prod-deploy.sh <target-directory>}"

echo "=== Tichu Production Deploy ==="
echo "  Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Source: $BUILD_DIR"
echo "  Target: $TARGET"
echo ""

# ─── 1. Validate build/ exists ──────────────────────────────────────────
if [ ! -f "$BUILD_DIR/server/dist/index.js" ] || [ ! -d "$BUILD_DIR/client" ]; then
  echo "ERROR: build/ directory is missing or incomplete."
  echo "Run prod-build.sh first:"
  echo "  bash code/scripts/prod-build.sh [path/to/.env.prod]"
  exit 1
fi
echo "Build directory OK."

# ─── 2. Validate environment ────────────────────────────────────────────
PARENT_DIR="$(cd "$(dirname "$TARGET")" && pwd)"
ENV_FILE="$PARENT_DIR/.env.production"
DATA_DIR="$PARENT_DIR/data"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "Create it from the template:"
  echo "  sudo cp $SCRIPT_DIR/systemd/.env.production $ENV_FILE"
  echo "Then edit it with your production values (especially JWT_SECRET)."
  exit 1
fi
echo "Environment file OK: $ENV_FILE"

# Ensure persistent data directory exists
if [ ! -d "$DATA_DIR" ]; then
  echo "Creating data directory: $DATA_DIR"
  mkdir -p "$DATA_DIR"
fi
echo "Data directory OK: $DATA_DIR"

# ─── 3. Deploy build artifacts ──────────────────────────────────────────
echo ""
echo "=== Deploying to $TARGET ==="

# Remove old deployment (server/ and client/ only — preserve start.sh and other files)
rm -rf "$TARGET/server" "$TARGET/client"
mkdir -p "$TARGET"

echo "  Copying server..."
cp -r "$BUILD_DIR/server" "$TARGET/server"

echo "  Copying client..."
cp -r "$BUILD_DIR/client" "$TARGET/client"

echo "  Copying start script..."
cp "$SCRIPT_DIR/systemd/start.sh" "$TARGET/start.sh"
chmod +x "$TARGET/start.sh"

echo "Deploy complete."

# ─── 4. Restart systemd service ─────────────────────────────────────────
echo ""
echo "=== Restarting systemd service ==="

if ! command -v systemctl >/dev/null 2>&1; then
  echo "WARNING: systemctl not available (not on a systemd Linux system)."
  echo "Deploy completed successfully — start the service manually."
  exit 0
fi

if ! systemctl list-unit-files tichu.service >/dev/null 2>&1; then
  echo "WARNING: tichu.service is not installed."
  echo "Install it first:"
  echo "  sudo cp $SCRIPT_DIR/systemd/tichu.service /etc/systemd/system/"
  echo "  sudo systemctl daemon-reload"
  echo "  sudo systemctl enable tichu"
  echo ""
  echo "Deploy completed successfully — install the service and start manually."
  exit 0
fi

sudo systemctl restart tichu
echo "tichu restarted."

# ─── 5. Show status ─────────────────────────────────────────────────────
echo ""
echo "=== Service status ==="
systemctl status tichu --no-pager -l || true

echo ""
echo "=== Deploy summary ==="
echo "  Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Target: $TARGET"
if command -v git >/dev/null 2>&1 && [ -d "$REPO_DIR/.git" ]; then
  echo "  Commit: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
  echo "  Branch: $(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)"
fi
