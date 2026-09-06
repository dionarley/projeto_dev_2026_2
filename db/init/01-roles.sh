#!/usr/bin/env bash
#
# Least-privilege no Postgres (tarefa: "controle de privilégios ... banco").
# Roda no boot do volume (docker-entrypoint-initdb.d) como superuser.
#
# Cria o papel de aplicação (vidasaude_app) NÃO-superuser com acesso pleno
# apenas ao schema public da base (DML + DDL via migrations), sem ALTER ROLE,
# sem criação de papéis. A senha vem do ambiente (POSTGRES_APP_PASSWORD,
# configurada no .env da raiz e passada pelo docker-compose) — nunca fixa.
#
# O superuser de bootstrap (POSTGRES_USER) fica fora da aplicação: é usado só
# por db-shell/db-backup (manutenção/TI).

set -euo pipefail

APP_USER="${POSTGRES_APP_USER:-vidasaude_app}"
: "${POSTGRES_APP_PASSWORD:?Defina POSTGRES_APP_PASSWORD no .env (scripts/setup-dev-env.sh)}"
: "${POSTGRES_USER:?POSTGRES_USER ausente}"

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
     -v app_user="$APP_USER" \
     -v app_password="$POSTGRES_APP_PASSWORD" \
     -v app_db="$POSTGRES_DB" <<-'EOSQL'

-- Cria o papel uma única vez (idempotente).
SELECT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app_user') AS app_exists \gset
\if :app_exists
\else
   CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';
\endif

GRANT CONNECT ON DATABASE :"app_db" TO :"app_user";
-- O schema public do PG15+ só vem com USAGE p/ PUBLIC: o app precisa de
-- CREATE para aplicar migrations/criar tabelas próprias.
GRANT CREATE ON SCHEMA public TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO :"app_user";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
EOSQL

echo "Papel de aplicação '$APP_USER' configurado (least-privilege)."