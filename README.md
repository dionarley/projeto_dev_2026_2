# VidaSaúde — Telemedicina

Uma aplicação web de **agendamento de consultas online** (teste prático para a vaga de Desenvolvedor(a) Júnior Full Stack na Mupi Systems).

- **Visitante**: acessa a página pública, escolhe a especialidade, agenda e recebe confirmação visual. O agendamento é salvo como **pendente**.
- **Gestão**: a equipe faz login no painel, acompanha as solicitações, confirma ou cancela, e mantém a lista de especialidades que a página mostra.

O tema é telemedicina ("VidaSaúde"), o formulário público funciona como o "registro" pedido na especificação (um agendamento de consulta), e as especialidades são as "opções" gerenciáveis pelo painel.

## Stack

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Front | React 19 + Vite + Tailwind v4 (TS) | Scaffold já existente no repositório; renderiza a interface |
| API | Django 6 + Django REST Framework | Autenticação/sessões/CSRF e ORM com migrações vêm de fábrica |
| Banco | Postgres 16 (Docker) / SQLite (dev local) | Mesmo código ORM nos dois; Postgres para paridade do ambiente de produção |
| WSGI | gunicorn + whitenoise | Servidor de produção que também entrega o build do front |
| Testes | Django `TestCase` + DRF `APITestCase` | Testa os mesmos fluxos do contrato de API sem serviço externo |

## Layout do repositório

```
backend/                 # API (Django + DRF)
  config/                # projeto Django: settings, urls, wsgi/asgi
  accounts/              # usuário customizado com login por e-mail
  scheduling/            # domínio: Option, Registration + views/serializers
    tests/               # test_api.py (integração) + test_units.py (unitários)
  manage.py
  requirements.txt
frontend/                # SPA React (Vite + Tailwind)
  src/
    pages/               # Landing (pública), Login, AdminPanel
    lib/api.ts           # cliente HTTP tipado do front
scripts/                 # automação (check, test, smoke, start, stop, restart, status, logs, dev, seed)
docs/                    # DECISOES.md, TODO.md
.github/workflows/ci.yml # CI: gate completo + smoke em todo push/PR
Dockerfile · docker-compose.yml · docker-compose.host.yml · .gitignore · .dockerignore
```

## Pré-requisitos

- Python 3.14 (com `venv`)
- Node.js 22+ (o `frontend/.mise.toml` fixa a versão) e pnpm 10
- Docker + Docker Compose v2 (opcional — só para rodar o Postgres/container)

## Rodando em desenvolvimento

```bash
python -m venv /tmp/venv           # ou backend/.venv
pip install -r backend/requirements.txt
scripts/seed.sh                    # migra + cria catálogo e admin (idempotente)
scripts/dev.sh                     # Django :8000 + Vite :5173 (proxy /api -> :8000)
```

Ou, manualmente:

```bash
cd backend
python manage.py migrate && python manage.py seed_options && python manage.py seed_admin
python manage.py runserver 0.0.0.0:8000

cd frontend
pnpm dev:web                       # http://localhost:5173 com proxy /api -> :8000
```

Sem `DATABASE_URL` o Django usa um **SQLite local** (`data.sqlite` na raiz); com `DATABASE_URL` usa Postgres.

## Scripts de automação

| Script | Faz o quê |
|--------|-----------|
| `scripts/check.sh` | **Gate de CI local**: testes Django (unitários + integração), `tsc --noEmit`, testes unitários do front (**vitest**), build do front (com verificação de asset self-hosted), `docker compose config` e **smoke da stack**. Falha (exit != 0) se qualquer etapa quebrar. |
| `scripts/test.sh` | Testes rápidos **sem docker**: backend Django (check + migrações + testes), `tsc --noEmit`, testes unitários do front (**vitest**) e build do front (verifica que `dist/` não referencia imagens externas). |
| `scripts/smoke.sh` | **Smoke de infra**: sobe a stack via compose e valida Postgres saudável, container web no ar, DNS do host `db` e página em **HTTP 200**. Derruba a stack ao final (`SMOKE_KEEP=1` mantém). |
| `scripts/start.sh` | Sobe a stack e valida (igual ao smoke), **mantendo os containers no ar**. `REBUILD=1` força `--build`. |
| `scripts/stop.sh` | Derruba a stack preservando os dados do Postgres. `VOLUMES=1` apaga os volumes (`-v`). |
| `scripts/restart.sh` | Reinicia a stack (stop + start). Aceita `REBUILD=1` e `VOLUMES=1`. |
| `scripts/status.sh` | Mostra o estado dos containers (health e portas). |
| `scripts/logs.sh` | Acompanha os logs (`--follow`). `scripts/logs.sh web` filtra o serviço; `TAIL=50` controla o tamanho. |
| `scripts/dev.sh` | Dev local **sem docker**: migrações/seeds + Django (:8000) + Vite (:5173) juntos. |
| `scripts/seed.sh` | Migra e popula catálogo + admin (idempotente). |
| `scripts/db-shell.sh` | `psql` interativo/1 comando no Postgres com o papel de **manutenção** (`vidasaude_admin`). |
| `scripts/db-backup.sh` | `pg_dump` via papel de manutenção em `db/backups/` (`OUT=` para outra saída). |

Ciclo de vida típico com Docker:

```bash
scripts/start.sh     # sobe e valida (http://localhost:8000)
scripts/status.sh    # confere o estado
scripts/logs.sh web  # acompanha o back
scripts/stop.sh      # derruba (dados preservados)
scripts/restart.sh   # stop + start
```

```bash
scripts/check.sh            # venv fora do padrão? VENV=backend/.venv scripts/check.sh
scripts/test.sh             # testes sem docker (rápido)
scripts/smoke.sh            # smoke isolado (SKIP_BUILD=1 reusa a imagem)
scripts/seed.sh
scripts/dev.sh
```

> Sem acesso ao daemon do Docker (usuário fora do grupo `docker`), use
> `DOCKER="sudo docker" scripts/check.sh` (ou `scripts/smoke.sh`).

## Rodando com Docker (produção paridade)

```bash
docker compose up --build   # -> http://localhost:8000 (Postgres 16 + web)
```

A imagem builda o front numa etapa Node e o runtime Python roda `migrate` + seeds + gunicorn. O SPA é servido pelo Django sob `/static/frontend/`.

O **smoke** (`scripts/smoke.sh`) protege contra o boot quebrado já visto do `web` (container apagado por `failed to resolve host 'db'`): ele espera o Postgres ficar **healthy**, garante o `web` rodando, resolve o host `db` de dentro da rede do compose e só então considera OK com a página em HTTP 200.

### Banco: privilégios mínimos (Papéis Suporte/TI)

O boot do Postgres roda [`db/init/01-roles.sql`](db/init/01-roles.sql) na
primeira inicialização do volume e cria o papel de aplicação **`vidasaude_app`**
(**não-superuser**, com `CREATE` em `public` para as migrations). O Django **nunca**
conecta como superuser:

| Papel | Uso | Privilégio |
|-------|-----|------------|
| `vidasaude_app` | Aplicação (Django/migrations), via `DATABASE_URL` | Não-superuser; DML/DDL só no schema `public` |
| `vidasaude_admin` | Manutenção (TI): `scripts/db-shell.sh`, `scripts/db-backup.sh` | Superuser (bootstrap do container) |

> **Atenção**: a troca do papel superuser (numa base já iniciada) exige recriar o
> volume do Postgres (`scripts/stop.sh VOLUMES=1 && scripts/start.sh`) para o init
> re-rodar — os scripts `docker-entrypoint-initdb.d` só executam num volume vazio.

> Em daemons com NAT restrito (alguns sandboxes/CI bloqueiam o `-p`), use o override com rede do host — nada de iptables:
> `docker compose -f docker-compose.yml -f docker-compose.host.yml up --build`
> Tudo fica em `127.0.0.1` (web em `:8000`, Postgres em `:5432`).

## Segurança (tarefas: sanitizar, SQLi, XSS, MITM/DDoS, privilégios)

### Sanitização e SQLi

- Entradas de usuário passam por `strip_control_chars()` (remove `\x00..\x1f`, `\x7f`), limites de tamanho e máscaras (`validate_phone`) em `backend/scheduling/validators.py`, aplicadas tanto nos **serializers** (`scheduling/serializers.py`) quanto nos **modelos** (bloqueia a entrada também pelo Django admin).
- Nenhuma consulta usa SQL cru — tudo passa pelo **ORM parametrizado do Django**. `scripts/check.sh` converte `makemigrations --check` em teste de regressão, e `test_security.py` exercita payloads clássicos (`' OR 1=1--`, `'; DROP TABLE--`) na busca do painel.

### XSS

- Todo response ganha `Content-Security-Policy` (`default-src 'self'` + `frame-ancestors 'none'`), `Referrer-Policy: same-origin` e `Permissions-Policy` via `config/middleware.py`. A CSP só abre exceção para as **fontes do Google Fonts** (`style-src` em `fonts.googleapis.com`, `font-src` em `fonts.gstatic.com`); imagens continuam `img-src 'self' data:`.
- **Imagens self-hosted**: a foto da médica da landing é um asset do bundle (`frontend/src/assets/doctor-consulta.jpg`) — nunca uma URL remota — pois uma imagem externa (ex.: Unsplash) era bloqueada pela CSP. Um teste React (vitest) e uma checagem do `scripts/test.sh`/`check.sh` (grep no `dist/`) impedem a volta desse bug.
- O front (React) escapa por padrão; o **export CSV do painel** prefixa com `'` valores que começam com `=`, `+`, `-`, `@`, tab ou CR (evita CSV/Formula injection no Excel/Sheets).

### MITM (transporte) e DDoS (rate limit)

- `backend/config/settings.py` habilita via ambiente: `SECURE_SSL_REDIRECT`/`SECURE_PROXY_SSL_HEADER` (atrás de proxy TLS), `SECURE_HSTS_SECONDS`/preload e `SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE`; `X_Content_Type_Options nosniff`, `Referrer-Policy` e `X-Frame-Options: DENY` ficam sempre ligados.
- `RateLimitMiddleware` (`scheduling/middleware.py`) limita por IP (registro 5/min, login 30/min) e **por conta** (IP+e-mail) no login (10/15min), com suporte a `X-Forwarded-For` (`USE_X_FORWARDED_FOR=1`) para produção atrás de proxy. Limites ajustáveis por env `RATE_LIMIT_*`.

### Controle de privilégios (equipes)

- `accounts.User.role`: **`admin`** (superuser, inclui o Django admin) vs **`suporte`** (painel de operação `/api/admin/**`, acesso bloqueado ao `/admin/` por `DjangoAdminGuardMiddleware`).
- Criação de usuário da equipe de suporte: `python manage.py create_support <email> --name "... " --password "..."` (repete senha gerada quando omitida).
- Banco com **least-privilege**: aplicação roda como `vidasaude_app` (não-superuser); manutenção/backup usam `vidasaude_admin` via `scripts/db-shell.sh` / `scripts/db-backup.sh`.

## Testes

```bash
scripts/check.sh            # roda tudo; ou só os testes:
cd backend && python manage.py test   # backend Django
cd frontend && pnpm exec vitest run   # frontend (React)
```

Cobrem os fluxos da spec: registro público (salvo como `pendente`, recusa datas passadas/opções inativas/duplicados), anti-spam por IP (5 requisições/min no registro; login 30/min por IP + 10/15min por conta), autenticação do painel, mudança de status (confirmar/cancelar), gestão de opções e a camada de segurança (sanitização, SQLi, headers, RBAC suporte×admin). No front, os testes de componente validam a **imagem da médica self-hosted** na landing (regressão do bug da CSP). Detalhes em [`docs/TODO.md`](docs/TODO.md).

> Credenciais do painel criadas no seed: `admin@vidasaude.com` / `admin123`.
> Para trocar, defina `ADMIN_EMAIL`, `ADMIN_PASSWORD` no `.env` do `backend/`.

## CI / CD

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em todo
`push` (main, development, docker, backend-django) e em qualquer `pull_request`:

1. Deps Python + instalção do front (pnpm `--frozen-lockfile`).
2. **Gate local**: `scripts/check.sh` (testes Django, `tsc --noEmit`, build do
   front e `docker compose config`).
3. **Smoke da stack**: `scripts/smoke.sh` com `SMOKE_HOST=1` (override de rede
   do host, sem iptables) — sobe o Postgres, aguarda **healthy**, garante o web
   no ar e valida **HTTP 200** da página.

Concorrência por ref (cancela runs duplicados). Não há etapa de deploy de
aplicação: o Postgres roda via compose e o backend é estateless (gunicorn +
whitenoise), pronto para anexar um job de deploy (ex.: imagem + registry) quando
houver infra definida.

## Decisões de stack e o que ficou de fora

Detalhes da migração Express → Django, Docker, cortes de escopo e o uso de IA estão em [`docs/DECISOES.md`](docs/DECISOES.md).

## Algo mais?

- **Anti-spam**: o envio público tem limite por IP (5/min) e trava duplicados em sequência (mesmo e-mail + especialidade + data).
- **CSRF**: o front envia `X-CSRFToken` (cookie `csrftoken`) em toda mutação.
- **Estados vazios**: a listagem de solicitações e as especialidades tratam "nada encontrado" com mensagem clara.