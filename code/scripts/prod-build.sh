#!/usr/bin/env bash
# REQ-F-DS04: Prod build script — install deps, build all packages for production
# REQ-F-DS12: Prerequisite validation
# REQ-NF-DS03: All paths reference /files/.www/tichu_source
# Sources .env.prod for NEXT_PUBLIC_* build-time vars.
# Usage: bash code/scripts/prod-build.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SHARED_DIR="$CODE_DIR/packages/shared"
SERVER_DIR="$CODE_DIR/packages/server"
CLIENT_DIR="$CODE_DIR/packages/client"

export NODE_ENV=production

# ─── 0. Source production environment ────────────────────────────────────
# EC-001: Check .env.prod existence
if [ -f "$SCRIPT_DIR/.env.prod" ]; then
  echo "=== Loading .env.prod ==="
  set -a
  . "$SCRIPT_DIR/.env.prod"
  set +a
else
  echo "ERROR: $SCRIPT_DIR/.env.prod not found."
  echo "Create it from the template:"
  echo "  cp $SCRIPT_DIR/.env.prod.example $SCRIPT_DIR/.env.prod"
  echo "Then edit it with your production values (especially JWT_SECRET)."
  exit 1
fi

# ─── 0.1 Prerequisite check ─────────────────────────────────────────────
echo "=== Checking prerequisites ==="
MISSING=""
if ! command -v node >/dev/null 2>&1; then MISSING="$MISSING node"; fi
if ! command -v pnpm >/dev/null 2>&1; then MISSING="$MISSING pnpm"; fi

if [ -n "$MISSING" ]; then
  echo "ERROR: Missing required tools:$MISSING"
  echo "Install Node.js (20+) and pnpm before running this script."
  exit 1
fi
echo "Prerequisites OK (node $(node --version), pnpm $(pnpm --version))"

# ─── 1. Export NEXT_PUBLIC_* vars for client build ───────────────────────
echo "=== Exporting build-time variables ==="
export NEXT_PUBLIC_WS_URL
export NEXT_PUBLIC_API_URL
export NEXT_PUBLIC_BASE_PATH
echo "  NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL"
echo "  NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
echo "  NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH"

# ─── 2. Install dependencies ────────────────────────────────────────────
echo "=== Installing dependencies ==="
cd "$CODE_DIR"
pnpm install --frozen-lockfile
echo "Dependencies installed."

# ─── 3. Build packages in dependency order ───────────────────────────────
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

# ─── 4. Validate build outputs ──────────────────────────────────────────
echo "=== Validating build outputs ==="
VALID=true
if [ ! -d "$SHARED_DIR/dist" ]; then echo "ERROR: shared/dist missing"; VALID=false; fi
if [ ! -d "$SERVER_DIR/dist" ]; then echo "ERROR: server/dist missing"; VALID=false; fi
if [ ! -d "$CLIENT_DIR/.next" ]; then echo "ERROR: client/.next missing"; VALID=false; fi

if [ "$VALID" = false ]; then
  echo "Build validation FAILED — one or more outputs missing."
  exit 1
fi

echo "=== Build complete ==="
echo "All packages built successfully for production."
