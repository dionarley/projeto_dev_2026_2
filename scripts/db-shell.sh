#!/usr/bin/env bash
#
# Shell interativo no Postgres com o papel de MANUTENÇÃO (superuser) — é a
# opção com privilégio elevado apenas para operações/backup fora da aplicação.
# A aplicação (Django) roda sempre como vidasaude_app (não-superuser).
#
# Uso:
#   scripts/db-shell.sh            # psql no compose
#   scripts/db-shell.sh "SQL ..."  # executa um comando e sai
#   DOCKER="sudo docker" scripts/db-shell.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOCKER="${DOCKER:-docker}"
$DOCKER info >/dev/null 2>&1 || {
  echo "ERRO: daemon Docker não acessível. Rode com DOCKER=\"sudo docker\"." >&2
  exit 1
}

COMPOSE=($DOCKER compose)
if [ -n "${SMOKE_HOST:-}" ]; then
  COMPOSE+=(--file docker-compose.yml --file docker-compose.host.yml)
fi

DB_HOST="${DB_HOST:-db}"
SQL="${1:-}"

if [ -n "$SQL" ]; then
  $DOCKER exec -e PGPASSWORD=vidasaude_admin "$("${COMPOSE[@]}" ps -q db)" \
    psql -U vidasaude_admin -d vidasaude -h "$DB_HOST" -c "$SQL"
else
  $DOCKER exec -it -e PGPASSWORD=vidasaude_admin "$("${COMPOSE[@]}" ps -q db)" \
    psql -U vidasaude_admin -d vidasaude -h "$DB_HOST"
fi
