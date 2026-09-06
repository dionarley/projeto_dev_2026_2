-- Least-privilege no Postgres (tarefa: "controle de privilégios ... banco de dados").
--
-- O usuário que o Django usa (vidasaude_app) NÃO é superusuário: tem acesso
-- pleno apenas ao esquema público da base `vidasaude` (DML + DDL de tabelas
-- via migrations), sem ALTER ROLE, sem criação de papéis, sem outros bancos.
-- O papel superuser criado pelo entrypoint (vidasaude_admin=POSTGRES_USER)
-- fica fora da aplicação e é usado só por db-shell/db-backup (manutenção).

\set ON_ERROR_STOP on

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vidasaude_app') THEN
      CREATE ROLE vidasaude_app LOGIN PASSWORD 'vidasaude_app';
   END IF;
END
$$;

GRANT CONNECT ON DATABASE vidasaude TO vidasaude_app;
-- O schema public do PG15+ só vem com USAGE p/ PUBLIC: o app precisa de
-- CREATE para aplicar migrations/criar tabelas próprias.
GRANT CREATE ON SCHEMA public TO vidasaude_app;
GRANT USAGE ON SCHEMA public TO vidasaude_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vidasaude_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO vidasaude_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO vidasaude_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vidasaude_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vidasaude_app;
