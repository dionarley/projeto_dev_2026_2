#!/usr/bin/env bash
#
# Exibe o estado da stack (containers, health, portas publicadas).
#
# Uso: HOST_NET=1 scripts/status.sh   # override docker-compose.host.yml
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOCKER="${DOCKER:-docker}"

COMPOSE=($DOCKER compose)
if [ -n "${HOST_NET:-}" ]; then
  COMPOSE+=(--file docker-compose.yml --file docker-compose.host.yml)
fi

"${COMPOSE[@]}" ps