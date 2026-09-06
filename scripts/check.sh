#!/usr/bin/env bash
#
# Gate de validação (CI local): testes Django + unitários, TypeScript,
# build do frontend e validade do docker-compose.
# Falha com exit != 0 se qualquer etapa quebrar.
#
# Uso: VENV=/caminho/para/venv scripts/check.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="${VENV:-$ROOT/backend/.venv}"

PY=(python3)
if [ -x "$VENV/bin/python" ]; then
  PY=("$VENV/bin/python")
fi

echo "==> 1/4 Testes do backend (unitários + integração)"
(
  cd "$ROOT/backend"
  "${PY[@]}" manage.py check
  "${PY[@]}" manage.py makemigrations --check --dry-run
  "${PY[@]}" manage.py test
)

echo "==> 2/4 TypeScript (tsc --noEmit)"
(
  cd "$ROOT/frontend"
  pnpm exec tsc --noEmit
)

echo "==> 3/4 Build do frontend (Vite)"
(
  cd "$ROOT/frontend"
  pnpm build
)

echo "==> 4/4 docker-compose config"
if command -v docker >/dev/null 2>&1; then
  (
    cd "$ROOT"
    docker compose config -q
  )
  echo "    compose OK"
else
  echo "    docker não encontrado — pulando"
fi

echo
echo "GATE OK — tudo passou."