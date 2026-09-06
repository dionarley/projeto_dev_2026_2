#!/usr/bin/env bash
#
# Sobe a stack completa (db + web) via docker compose e valida o estado
# (Postgres healthy + página em HTTP 200) usando a mesma lógica do smoke.
# Mantém os containers no ar ao final.
#
# Uso:
#   scripts/start.sh                 # sobe com a imagem já construída
#   REBUILD=1 scripts/start.sh       # força --build
#   HOST_NET=1 scripts/start.sh      # override docker-compose.host.yml (network host)
#   DOCKER="sudo docker" scripts/start.sh   # usuário fora do grupo docker
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export SMOKE_KEEP=1
[ -n "${REBUILD:-}" ] || export SKIP_BUILD=1
[ -n "${HOST_NET:-}" ] && export SMOKE_HOST=1

exec "$ROOT/scripts/smoke.sh"