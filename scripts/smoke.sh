#!/usr/bin/env bash
#
# Smoke test de infraestrutura (docker compose): sobe a stack e valida o
# que já quebrou em produção local — container web no ar, Postgres saudável,
# DNS do host "db" resolvendo de dentro da rede do compose e a página
# respondendo HTTP 200 no navegador. Falha com exit != 0 se algo falhar.
#
# Uso:
#   scripts/smoke.sh                  # build + sobe a stack + valida -> http://localhost:8000
#   SKIP_BUILD=1 scripts/smoke.sh     # reusa imagem já buildada (mais rápido)
#   SMOKE_HOST=1 scripts/smoke.sh     # override docker-compose.host.yml (network host)
#   SMOKE_KEEP=1 scripts/smoke.sh     # não derruba a stack ao final (debug)
#   SMOKE_TIMEOUT=180 scripts/smoke.sh
#   DOCKER="sudo docker" scripts/smoke.sh   # usuário fora do grupo docker
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOCKER="${DOCKER:-docker}"
$DOCKER info >/dev/null 2>&1 || {
  echo "ERRO: daemon Docker não acessível. Se o usuário não está no grupo" >&2
  echo "      'docker', rode com DOCKER=\"sudo docker\"." >&2
  exit 1
}

COMPOSE=($DOCKER compose)
if [ -n "${SMOKE_HOST:-}" ]; then
  COMPOSE+=(--file docker-compose.yml --file docker-compose.host.yml)
fi

UP_ARGS=()
if [ -z "${SKIP_BUILD:-}" ]; then
  UP_ARGS+=(--build)
fi

TIMEOUT="${SMOKE_TIMEOUT:-120}"
PORT="${SMOKE_PORT:-8000}"
URL="http://127.0.0.1:${PORT}/"

cleanup() {
  if [ -z "${SMOKE_KEEP:-}" ]; then
    echo "==> derrubando a stack (SMOKE_KEEP=1 para manter)"
    "${COMPOSE[@]}" down --remove-orphans
  fi
}
trap cleanup EXIT

fail() {
  echo "ERRO: $1" >&2
  exit 1
}

wait_healthy() {
  local deadline=$(( $(date +%s) + TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    local db_id status
    db_id=$("${COMPOSE[@]}" ps -q db 2>/dev/null || true)
    if [ -n "$db_id" ]; then
      status=$($DOCKER inspect --format='{{.State.Health.Status}}' "$db_id" 2>/dev/null || true)
      [ "$status" = "healthy" ] && return 0
    fi
    sleep 3
  done
  return 1
}

wait_http() {
  local deadline=$(( $(date +%s) + TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if python3 -c 'import sys,urllib.request
try:
    urllib.request.urlopen(sys.argv[1], timeout=3)
except Exception:
    sys.exit(1)
' "$URL" 2>/dev/null || curl -fsS -o /dev/null "$URL" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

echo "==> 1/5 docker compose config"
"${COMPOSE[@]}" config -q

echo "==> 2/5 subindo a stack (db + web)"
"${COMPOSE[@]}" up --detach "${UP_ARGS[@]}"

echo "==> 3/5 aguardando Postgres saudável (healthcheck)"
wait_healthy || fail "Postgres não ficou saudável em ${TIMEOUT}s"

echo "==> 4/5 web no ar e alcançando o host 'db'"
WEB_ID=$("${COMPOSE[@]}" ps --status running -q web 2>/dev/null || true)
[ -n "$WEB_ID" ] || fail "container web não está rodando (crash — confira 'docker compose logs web')"

STATE=$($DOCKER inspect --format='{{.State.Status}}' "$WEB_ID")
[ "$STATE" = "running" ] || fail "container web em estado '$STATE'"

if [ -z "${SMOKE_HOST:-}" ]; then
  # Resolve o host 'db' de dentro da rede do compose — foi o DNS que quebrou
  # ('failed to resolve host db') e derrubou o migrate no boot do web.
  # Com network mode host ('db' vira 127.0.0.1) essa checagem não se aplica.
  if ! $DOCKER exec "$WEB_ID" python -c "import socket; socket.gethostbyname('db')"; then
    fail "host 'db' não resolve de dentro do container web (rede do compose ausente?)"
  fi
fi

echo "==> 5/5 página respondendo HTTP 200 ($URL)"
wait_http || fail "página não respondeu 200 em ${TIMEOUT}s"

echo
echo "SMOKE OK — stack completa saudável."