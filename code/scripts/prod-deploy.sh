#!/usr/bin/env bash
# REQ-F-DS06: Prod deploy script — pull latest code, build, restart services
# REQ-F-DS11: Script composability (calls prod-start.sh -> prod-build.sh)
# Usage: bash code/scripts/prod-deploy.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$CODE_DIR/.." && pwd)"

echo "=== Tichu Production Deploy ==="
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Repo: $REPO_DIR"
echo ""

# ─── 1. Pull latest code ────────────────────────────────────────────────
echo "=== Pulling latest code ==="
cd "$REPO_DIR"

# EC-002: Warn about dirty working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: Working tree has uncommitted changes:"
  git status --short
  echo ""
  echo "Git pull may fail or merge conflicts may occur."
  echo "Continuing anyway..."
  echo ""
fi

BEFORE_HASH="$(git rev-parse --short HEAD)"
git pull
AFTER_HASH="$(git rev-parse --short HEAD)"

if [ "$BEFORE_HASH" = "$AFTER_HASH" ]; then
  echo "Already up to date ($AFTER_HASH)."
else
  echo "Updated: $BEFORE_HASH -> $AFTER_HASH"
fi
echo ""

# ─── 2. Build and restart ───────────────────────────────────────────────
bash "$SCRIPT_DIR/prod-start.sh"

# ─── 3. Deploy summary ──────────────────────────────────────────────────
echo ""
echo "=== Deploy complete ==="
echo "  Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Commit: $(git rev-parse --short HEAD)"
echo "  Branch: $(git rev-parse --abbrev-ref HEAD)"
