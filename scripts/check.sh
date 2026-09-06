#!/usr/bin/env bash
#
# Gate de validação (CI local): testes Django + unitários, TypeScript,
# testes unitários do frontend (vitest), build do frontend (com verificação
# de não-referenciar assets externos), validade do docker-compose e smoke
# da stack (db saudável + web no ar + DNS do host "db" + HTTP 200 da página).
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

echo "==> 1/6 Testes do backend (unitários + integração)"
(
  cd "$ROOT/backend"
  "${PY[@]}" manage.py check
  "${PY[@]}" manage.py makemigrations --check --dry-run
  "${PY[@]}" manage.py test
)

echo "==> 2/6 TypeScript (tsc --noEmit)"
(
  cd "$ROOT/frontend"
  pnpm exec tsc --noEmit
)

echo "==> 3/6 Testes unitários do frontend (vitest)"
(
  cd "$ROOT/frontend"
  pnpm exec vitest run
)

echo "==> 4/6 Build do frontend (Vite) + verificação de integridade"
(
  cd "$ROOT/frontend"
  pnpm build
  # Regressão: a imagem da médica é self-hosted (CSP é img-src 'self' data:).
  # Qualquer referência a um host externo no bundle indica um asset não self-hosted
  # que seria bloqueado em produção.
  if grep -rq "images\.unsplash\.com" dist; then
    echo "ERRO: dist/ contém referência externa para Unsplash (imagem não self-hosted)." >&2
    exit 1
  fi
)

echo "==> 5/6 docker-compose config"
if command -v docker >/dev/null 2>&1; then
  (
    cd "$ROOT"
    docker compose config -q
  )
  echo "    compose OK"
else
  echo "    docker não encontrado — pulando"
fi

echo "==> 6/6 Smoke do compose (sobe stack + DNS 'db' + HTTP 200)"
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
