#!/usr/bin/env bash
#
# Backup do banco (Postgres) feito com o papel superuser de manutenção —
# a aplicação nunca roda DDL/backup (least-privilege).
#
# Uso:
#   scripts/db-backup.sh                    # dump em db/backups/<timestamp>.sql
#   OUT=/tmp/backup.sql scripts/db-backup.sh
#   DOCKER="sudo docker" scripts/db-backup.sh
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

DB_ID=$("${COMPOSE[@]}" ps -q db 2>/dev/null || true)
[ -n "$DB_ID" ] || { echo "ERRO: container db não está rodando." >&2; exit 1; }

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="$(env_get POSTGRES_USER)"
DB_PASSWORD="$(env_get POSTGRES_PASSWORD)"
DB_NAME="$(env_get POSTGRES_DB)"
if [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
  echo "ERRO: .env sem credenciais completas do Postgres — rode scripts/setup-dev-env.sh." >&2
  exit 1
fi

OUT="${OUT:-db/backups/vidasaude-$(date +%Y%m%d-%H%M%S).sql}"
mkdir -p "$(dirname "$OUT")"

$DOCKER exec -e "PGPASSWORD=$DB_PASSWORD" "$DB_ID" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" > "$OUT"

echo "Backup salvo em $OUT"
