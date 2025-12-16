#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v docker >/dev/null 2>&1; then
  # On Bazzite/Fedora, `docker` is often provided by podman-docker and `docker compose`
  # is delegated to podman-compose.
  if docker compose version >/dev/null 2>&1; then
    exec docker compose "$@"
  fi
fi

if command -v podman-compose >/dev/null 2>&1; then
  exec podman-compose "$@"
fi

if command -v podman >/dev/null 2>&1; then
  if podman compose version >/dev/null 2>&1; then
    exec podman compose "$@"
  fi
fi

echo "No compose implementation found. Install podman-compose or docker compose." >&2
exit 1



