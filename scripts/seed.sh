#!/usr/bin/env bash
#
# Aplica migrações e popula o catálogo + admin (idempotente).
# Use antes do primeiro run quando for usar SQLite local.
#
# Uso: VENV=/caminho/para/venv scripts/seed.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="${VENV:-$ROOT/backend/.venv}"

PY=(python3)
if [ -x "$VENV/bin/python" ]; then
  PY=("$VENV/bin/python")
fi

cd "$ROOT/backend"
"${PY[@]}" manage.py migrate
"${PY[@]}" manage.py seed_options
"${PY[@]}" manage.py seed_admin
echo "Seed concluído."