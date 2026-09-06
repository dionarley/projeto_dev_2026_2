#!/usr/bin/env bash
#
# Testes rápidos (sem docker): Django (check + migrações + testes), typecheck
# TypeScript e build do frontend. É o que o CI roda por serviço.
# Para o gate completo (inclui o smoke do compose), use scripts/check.sh.
#
# Uso: VENV=/caminho/para/venv scripts/test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="${VENV:-$ROOT/backend/.venv}"

PY=(python3)
if [ -x "$VENV/bin/python" ]; then
  PY=("$VENV/bin/python")
fi

echo "==> 1/3 Testes do backend (unitários + integração)"
(
  cd "$ROOT/backend"
  "${PY[@]}" manage.py check
  "${PY[@]}" manage.py makemigrations --check --dry-run
  "${PY[@]}" manage.py test
)

echo "==> 2/3 TypeScript (tsc --noEmit)"
(
  cd "$ROOT/frontend"
  pnpm exec tsc --noEmit
)

echo "==> 3/3 Build do frontend (Vite)"
(
  cd "$ROOT/frontend"
  pnpm build
)

echo
echo "TESTES OK — tudo passou."