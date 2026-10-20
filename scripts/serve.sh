#!/bin/sh
set -eu

# Resolve paths from the launcher, even when invoked from another directory.
cd -- "$(dirname -- "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Necesitas instalar Node.js 20 o posterior para servir el curso.' >&2
  exit 1
fi

node scripts/build.mjs
exec node scripts/server.mjs
