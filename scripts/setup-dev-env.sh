#!/usr/bin/env bash
#
# Prepara o ambiente de desenvolvimento local (idempotente):
#   * gera/cria o `.env` da raiz (lido pelo docker-compose e pelos scripts de
#     manutenção) com senhas ALEATÓRIAS quando as linhas estão vazias/ausentes;
#   * cria `backend/.env` (para rodar o Django fora do Docker) partilhando os
#     mesmos segredos.
#
# Segurança: nenhuma senha é hardcoded no repositório — apenas os `.env.example`
# (modelos) são versionados; `.env` fica no `.gitignore` (não sobe para o git).
#
# Uso:
#   scripts/setup-dev-env.sh          # gera/atualiza os .env (idempotente)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

genpw() {
  python3 - <<'PY'
import secrets
import string
alphabet = string.ascii_letters + string.digits
print("".join(secrets.choice(alphabet) for _ in range(24)))
PY
}

# Carrega KEY=VALOR de um .env numa associative array (via nameref),
# preservando edições manuais. Ignora comentários/linhas vazias.
load_env() {
  local -n map="$1"
  local file="$2"
  local k v
  [ -f "$file" ] || return 0
  while IFS='=' read -r k v; do
    k="${k#"${k%%[![:space:]]*}"}"
    case "$k" in "" | \#*) continue ;; esac
    [ -n "$v" ] && map["$k"]="$v"
  done < "$file"
}

declare -A root_env

# Valores padrão (senhas geradas uma única vez).
root_env[POSTGRES_DB]="vidasaude"
root_env[POSTGRES_USER]="vidasaude_admin"
root_env[POSTGRES_PASSWORD]="$(genpw)"
root_env[POSTGRES_APP_USER]="vidasaude_app"
root_env[POSTGRES_APP_PASSWORD]="$(genpw)"
root_env[DJANGO_SECRET_KEY]="$(genpw)"
root_env[DJANGO_DEBUG]="true"
root_env[DJANGO_ALLOWED_HOSTS]="localhost,127.0.0.1"
root_env[CSRF_TRUSTED_ORIGINS]="http://localhost:8000,http://127.0.0.1:8000"
root_env[ADMIN_EMAIL]="admin@vidasaude.com"
root_env[ADMIN_NAME]="Administrador (VidaSaude)"
root_env[ADMIN_PASSWORD]="$(genpw)"

# Preserva o que já foi editado manualmente no .env atual.
load_env root_env .env

ROOT_KEYS=(POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD POSTGRES_APP_USER
  POSTGRES_APP_PASSWORD DJANGO_SECRET_KEY DJANGO_DEBUG DJANGO_ALLOWED_HOSTS
  CSRF_TRUSTED_ORIGINS ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD)

{
  echo "# Gerado por scripts/setup-dev-env.sh — NUNCA commite .env (está no .gitignore)."
  echo "# Para regenerar uma senha, apague a linha correspondente e rode o script de novo."
  for k in "${ROOT_KEYS[@]}"; do
    printf '%s=%s\n' "$k" "${root_env[$k]}"
  done
} > .env

echo "==> .env (raiz) escrito — usado por docker-compose, db-shell e db-backup."

# ---------------------------------------------------------------------------
# backend/.env (Django fora do Docker — SQLite ou Postgres via DATABASE_URL)
# ---------------------------------------------------------------------------
declare -A be_env
load_env be_env backend/.env
be_env[DJANGO_SECRET_KEY]="${be_env[DJANGO_SECRET_KEY]:-${root_env[DJANGO_SECRET_KEY]}}"
be_env[DJANGO_DEBUG]="${be_env[DJANGO_DEBUG]:-${root_env[DJANGO_DEBUG]}}"
if [ -n "${be_env[DJANGO_ALLOWED_HOSTS]:-}" ]; then
  :
else
  be_env[DJANGO_ALLOWED_HOSTS]="${root_env[DJANGO_ALLOWED_HOSTS]},testserver"
fi
be_env[CSRF_TRUSTED_ORIGINS]="${be_env[CSRF_TRUSTED_ORIGINS]:-${root_env[CSRF_TRUSTED_ORIGINS]}}"
be_env[ADMIN_EMAIL]="${be_env[ADMIN_EMAIL]:-${root_env[ADMIN_EMAIL]}}"
be_env[ADMIN_NAME]="${be_env[ADMIN_NAME]:-${root_env[ADMIN_NAME]}}"
be_env[ADMIN_PASSWORD]="${be_env[ADMIN_PASSWORD]:-${root_env[ADMIN_PASSWORD]}}"

APP_URL="postgres://${root_env[POSTGRES_APP_USER]}:${root_env[POSTGRES_APP_PASSWORD]}@127.0.0.1:5432/${root_env[POSTGRES_DB]}"
{
  echo "# Gerado por scripts/setup-dev-env.sh — partilha os segredos do .env (raiz)."
  echo "# Sem DATABASE_URL o Django usa SQLite local (data.sqlite)."
  echo "DJANGO_SECRET_KEY=${be_env[DJANGO_SECRET_KEY]}"
  echo "DJANGO_DEBUG=${be_env[DJANGO_DEBUG]}"
  echo "DJANGO_ALLOWED_HOSTS=${be_env[DJANGO_ALLOWED_HOSTS]}"
  echo "CSRF_TRUSTED_ORIGINS=${be_env[CSRF_TRUSTED_ORIGINS]}"
  echo "ADMIN_EMAIL=${be_env[ADMIN_EMAIL]}"
  echo "ADMIN_NAME=${be_env[ADMIN_NAME]}"
  echo "ADMIN_PASSWORD=${be_env[ADMIN_PASSWORD]}"
  echo "# DATABASE_URL=${APP_URL}"
} > backend/.env

echo "==> backend/.env escrito — Django standalone com os mesmos segredos."
echo
echo "Pronto! Suba a stack com:  scripts/start.sh"
echo
echo "Credenciais do painel (admin):"
echo "  Email:    ${root_env[ADMIN_EMAIL]}"
echo "  Senha:    ${root_env[ADMIN_PASSWORD]}"
echo
echo "Postgres (manutenção/TI):"
echo "  Admin:    ${root_env[POSTGRES_USER]} / ${root_env[POSTGRES_PASSWORD]}"
echo "  App role: ${root_env[POSTGRES_APP_USER]} / ${root_env[POSTGRES_APP_PASSWORD]}"
echo
echo "Importante: leia o .env gerado — nenhuma senha é fixa."