#!/usr/bin/env bash
#
# Gate de validação (CI local): testes Django + unitários, TypeScript,
# build do frontend, validade do docker-compose e smoke da stack (db saudável
# + web no ar + DNS do host "db" + HTTP 200 da página).
# Falha com exit != 0 se qualquer etapa quebrar.
#
# Uso: VENV=/caminho/para/venv scripts/check.sh
#      SKIP_BUILD=1 scripts/check.sh    # reusa imagem do smoke (mais rápido)
#      SKIP_SMOKE=1 scripts/check.sh    # pula o smoke do compose
#      DOCKER="sudo docker" scripts/check.sh   # usuário fora do grupo docker
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="${VENV:-$ROOT/backend/.venv}"

PY=(python3)
if [ -x "$VENV/bin/python" ]; then
  PY=("$VENV/bin/python")
fi

echo "==> 1/5 Testes do backend (unitários + integração)"
(
  cd "$ROOT/backend"
  "${PY[@]}" manage.py check
  "${PY[@]}" manage.py makemigrations --check --dry-run
  "${PY[@]}" manage.py test
)

echo "==> 2/5 TypeScript (tsc --noEmit)"
(
  cd "$ROOT/frontend"
  pnpm exec tsc --noEmit
)

echo "==> 3/5 Build do frontend (Vite)"
(
  cd "$ROOT/frontend"
  pnpm build
)

echo "==> 4/5 docker-compose config"
if command -v docker >/dev/null 2>&1; then
  (
    cd "$ROOT"
    docker compose config -q
  )
  echo "    compose OK"
else
  echo "    docker não encontrado — pulando"
fi

echo "==> 5/5 Smoke do compose (sobe stack + DNS 'db' + HTTP 200)"
if command -v docker >/dev/null 2>&1; then
  if [ -n "${SKIP_SMOKE:-}" ]; then
    echo "    SKIP_SMOKE definido — pulando smoke"
  else
    (
      cd "$ROOT"
      "./scripts/smoke.sh"
    )
  fi
else
  echo "    docker não encontrado — pulando smoke"
fi

echo
echo "GATE OK — tudo passou."