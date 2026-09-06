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

DB_ID=$("${COMPOSE[@]}" ps -q db 2>/dev/null || true)
[ -n "$DB_ID" ] || { echo "ERRO: container db não está rodando." >&2; exit 1; }

DB_HOST="${DB_HOST:-db}"
OUT="${OUT:-db/backups/vidasaude-$(date +%Y%m%d-%H%M%S).sql}"
mkdir -p "$(dirname "$OUT")"

$DOCKER exec -e PGPASSWORD=vidasaude_admin "$DB_ID" \
  pg_dump -U vidasaude_admin -d vidasaude -h "$DB_HOST" > "$OUT"

echo "Backup salvo em $OUT"
