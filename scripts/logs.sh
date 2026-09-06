#!/usr/bin/env bash
#
# Acompanha os logs da stack. Aceita o nome do serviço como argumento
# (padrão: todos) e o número de linhas via TAIL.
#
# Uso:
#   scripts/logs.sh                  # logs de todos os serviços (---follow)
#   scripts/logs.sh web              # só o serviço web
#   TAIL=50 scripts/logs.sh web
#   HOST_NET=1 scripts/logs.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOCKER="${DOCKER:-docker}"
SERVICE="${1:-}"
TAIL="${TAIL:-100}"

COMPOSE=($DOCKER compose)
if [ -n "${HOST_NET:-}" ]; then
  COMPOSE+=(--file docker-compose.yml --file docker-compose.host.yml)
fi

ARGS=(logs --follow --tail="$TAIL")
[ -n "$SERVICE" ] && ARGS+=("$SERVICE")

"${COMPOSE[@]}" "${ARGS[@]}"