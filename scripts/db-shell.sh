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

# Credenciais de manutenção vêm do .env da raiz (nunca fixas no script).
# env_get: extrai KEY=VAL do .env (vazio se ausente).
env_get() {
  local key="$1"
  [ -f .env ] || return 0
  grep -E "^[[:space:]]*${key}=" .env | tail -1 | cut -d= -f2- | sed 's/^[[:space:]]*//'
}

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="$(env_get POSTGRES_USER)"
DB_PASSWORD="$(env_get POSTGRES_PASSWORD)"
DB_NAME="$(env_get POSTGRES_DB)"
if [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
  echo "ERRO: .env sem credenciais completas do Postgres — rode scripts/setup-dev-env.sh." >&2
  exit 1
fi

SQL="${1:-}"

if [ -n "$SQL" ]; then
  $DOCKER exec -e "PGPASSWORD=$DB_PASSWORD" "$("${COMPOSE[@]}" ps -q db)" \
    psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "$SQL"
else
  $DOCKER exec -it -e "PGPASSWORD=$DB_PASSWORD" "$("${COMPOSE[@]}" ps -q db)" \
    psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT"
fi
