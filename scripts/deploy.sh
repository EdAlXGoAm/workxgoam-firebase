#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/$(basename "$ROOT")}"
BUILD_OUT="${BUILD_OUT:-$ROOT/dist/myapp/browser}"

cd "$ROOT"
if [ -f package-lock.json ]; then
  npm ci --include=dev
else
  npm install --include=dev
fi
npm run build

if [ ! -f "$BUILD_OUT/index.html" ]; then
  echo "Build output not found at $BUILD_OUT/index.html" >&2
  exit 1
fi

mkdir -p "$WEB_ROOT"
rsync -a --delete "$BUILD_OUT/" "$WEB_ROOT/"

if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "Deployed to $WEB_ROOT"
