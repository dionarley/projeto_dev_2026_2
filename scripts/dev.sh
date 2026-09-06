#!/usr/bin/env bash
#
# Sobe o back (Django) e o front (Vite) juntos, com migrações + seeds
# já aplicados. Front em http://localhost:5173 (proxy /api -> :8000).
#
# Uso: VENV=/caminho/para/venv scripts/dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="${VENV:-$ROOT/backend/.venv}"

PY=(python3)
if [ -x "$VENV/bin/python" ]; then
  PY=("$VENV/bin/python")
fi

echo "==> Migrações e seeds (idempotentes)"
(
  cd "$ROOT/backend"
  "${PY[@]}" manage.py migrate
  "${PY[@]}" manage.py seed_options
  "${PY[@]}" manage.py seed_admin
)

API_PID=""
cleanup() {
  if [ -n "$API_PID" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

(
  cd "$ROOT/backend"
  "${PY[@]}" manage.py runserver 0.0.0.0:8000
) & API_PID=$!

echo "==> Django em http://localhost:8000 — subindo Vite"
cd "$ROOT/app"
pnpm dev:web