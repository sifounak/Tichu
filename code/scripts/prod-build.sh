#!/usr/bin/env bash
# Production build script — compile all packages and assemble portable build/ artifact.
# Sources .env.prod for NEXT_PUBLIC_* build-time vars.
#
# Usage:
#   bash code/scripts/prod-build.sh [path/to/.env.prod]
#
# If no .env.prod path is given, falls back to $SCRIPT_DIR/.env.prod.
# The build output goes to <repo>/code/build/ (gitignored).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SHARED_DIR="$CODE_DIR/packages/shared"
SERVER_DIR="$CODE_DIR/packages/server"
CLIENT_DIR="$CODE_DIR/packages/client"
BUILD_DIR="$CODE_DIR/build"

export NODE_ENV=production

# ─── 0. Source production environment ────────────────────────────────────
ENV_FILE="${1:-$SCRIPT_DIR/.env.prod}"
if [ -f "$ENV_FILE" ]; then
  echo "=== Loading $ENV_FILE ==="
  set -a
  . "$ENV_FILE"
  set +a
else
  echo "ERROR: $ENV_FILE not found."
  echo "Usage: bash code/scripts/prod-build.sh [path/to/.env.prod]"
  echo ""
  echo "Create one from the template:"
  echo "  cp $SCRIPT_DIR/.env.prod.example /your/deploy/dir/.env.prod"
  echo "Then edit it with your production values (especially JWT_SECRET)."
  exit 1
fi

# ─── 0.1 Prerequisite check ─────────────────────────────────────────────
REQUIRED_NODE_MAJOR=$(cat "$CODE_DIR/.nvmrc" 2>/dev/null | tr -d '[:space:]')
if [ -z "$REQUIRED_NODE_MAJOR" ]; then
  echo "ERROR: $CODE_DIR/.nvmrc not found."
  exit 1
fi

echo "=== Checking prerequisites ==="
MISSING=""
if ! command -v node >/dev/null 2>&1; then MISSING="$MISSING node"; fi
if ! command -v pnpm >/dev/null 2>&1; then MISSING="$MISSING pnpm"; fi

if [ -n "$MISSING" ]; then
  echo "ERROR: Missing required tools:$MISSING"
  echo "Install Node.js ($REQUIRED_NODE_MAJOR+) and pnpm before running this script."
  exit 1
fi

# Verify Node major version meets .nvmrc requirement
ACTUAL_NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$ACTUAL_NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
  echo "ERROR: Node.js v$REQUIRED_NODE_MAJOR+ required but found $(node --version)."
  echo "Install Node.js $REQUIRED_NODE_MAJOR or higher before building."
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

# Force recompilation of native addons against the current Node ABI.
# pnpm install may reuse store-cached binaries compiled for an older
# Node version. pnpm deploy hardlinks from the store, so the rebuild
# must happen here in the workspace before the deploy step.
# Delete the cached binary first — pnpm rebuild may skip recompilation
# if it considers the existing binary up to date.
echo "  Rebuilding better-sqlite3 for Node $(node -p process.versions.modules) ABI..."
find "$CODE_DIR/node_modules/.pnpm" -path "*/better-sqlite3/build/Release/better_sqlite3.node" -delete 2>/dev/null || true
pnpm rebuild better-sqlite3
# Verify the binary was actually rebuilt for the current Node ABI
EXPECTED_ABI=$(node -p process.versions.modules)
SQLITE_NODE=$(find "$CODE_DIR/node_modules/.pnpm" -path "*/better-sqlite3/build/Release/better_sqlite3.node" | head -1)
node -e "require('$SQLITE_NODE')" 2>/dev/null \
  || { echo "ERROR: better-sqlite3 binary does not match Node ABI $EXPECTED_ABI after rebuild."; exit 1; }
echo "  better-sqlite3 verified for ABI $EXPECTED_ABI."
echo "Dependencies installed."

# ─── 3. Build packages in dependency order ───────────────────────────────
echo "=== Building shared package ==="
cd "$SHARED_DIR"
pnpm exec tsc
echo "Shared package built."

echo "=== Building server package ==="
cd "$SERVER_DIR"
pnpm exec tsc
echo "Server package built."

echo "=== Building client package (production) ==="
cd "$CLIENT_DIR"
pnpm exec next build
echo "Client package built."

# ─── 4. Validate compile outputs ────────────────────────────────────────
echo "=== Validating compile outputs ==="
VALID=true
if [ ! -d "$SHARED_DIR/dist" ]; then echo "ERROR: shared/dist missing"; VALID=false; fi
if [ ! -d "$SERVER_DIR/dist" ]; then echo "ERROR: server/dist missing"; VALID=false; fi
if [ ! -d "$CLIENT_DIR/.next/standalone" ]; then echo "ERROR: client/.next/standalone missing"; VALID=false; fi

if [ "$VALID" = false ]; then
  echo "Compile validation FAILED — one or more outputs missing."
  exit 1
fi

# ─── 5. Assemble portable build/ directory ───────────────────────────────
echo "=== Assembling build directory ==="
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Server: use pnpm deploy to resolve workspace deps into real files
echo "  Assembling server..."
cd "$CODE_DIR"
pnpm --filter @tichu/server deploy "$BUILD_DIR/server" --prod

# pnpm deploy does not copy the package's own dist/ — copy it manually
cp -r "$SERVER_DIR/dist" "$BUILD_DIR/server/dist"

# Client: copy Next.js standalone output
echo "  Assembling client..."
cp -r "$CLIENT_DIR/.next/standalone/." "$BUILD_DIR/client/"

# Standalone does NOT include static assets — copy them into the right location
mkdir -p "$BUILD_DIR/client/packages/client/.next"
cp -r "$CLIENT_DIR/.next/static" "$BUILD_DIR/client/packages/client/.next/static"

# ─── 6. Validate build outputs ──────────────────────────────────────────
echo "=== Validating build outputs ==="
VALID=true
if [ ! -f "$BUILD_DIR/server/dist/index.js" ]; then echo "ERROR: build/server/dist/index.js missing"; VALID=false; fi
if [ ! -d "$BUILD_DIR/server/node_modules" ]; then echo "ERROR: build/server/node_modules missing"; VALID=false; fi
if [ ! -f "$BUILD_DIR/client/packages/client/server.js" ]; then echo "ERROR: build/client/packages/client/server.js missing"; VALID=false; fi
if [ ! -d "$BUILD_DIR/client/packages/client/.next/static" ]; then echo "ERROR: build/client/.next/static missing"; VALID=false; fi

if [ "$VALID" = false ]; then
  echo "Build assembly validation FAILED."
  exit 1
fi

echo ""
echo "=== Build complete ==="
echo "Portable build artifact: $BUILD_DIR/"
echo "Deploy with: bash code/scripts/prod-deploy.sh <target-directory>"
