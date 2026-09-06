#!/usr/bin/env bash
#
# Derruba a stack (containers + rede do compose). Por padrão preserva os
# volumes do Postgres (os dados continuam no próximo start).
#
# Uso:
#   scripts/stop.sh                  # derruba preservando os dados
#   VOLUMES=1 scripts/stop.sh        # apaga também os volumes (-v, dados do banco)
#   HOST_NET=1 scripts/stop.sh       # override docker-compose.host.yml
#   DOCKER="sudo docker" scripts/stop.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOCKER="${DOCKER:-docker}"
$DOCKER info >/dev/null 2>&1 || {
  echo "ERRO: daemon Docker não acessível. Use DOCKER=\"sudo docker\"." >&2
  exit 1
}

COMPOSE=($DOCKER compose)
if [ -n "${HOST_NET:-}" ]; then
  COMPOSE+=(--file docker-compose.yml --file docker-compose.host.yml)
fi

DOWN_ARGS=(--remove-orphans)
if [ -n "${VOLUMES:-}" ]; then
  DOWN_ARGS+=(-v)
  echo "==> derrubando stack e apagando volumes (VOLUMES=1)"
else
  echo "==> derrubando stack (dados do Postgres preservados)"
fi

"${COMPOSE[@]}" down "${DOWN_ARGS[@]}"
echo "Stack derrubada."