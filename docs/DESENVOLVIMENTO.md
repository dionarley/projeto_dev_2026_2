# DESENVOLVIMENTO.md

Guia técnico do dia a dia: como o projeto é organizado, o que cada script faz, Docker, banco e os cuidados de segurança.

## Stack

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Front | React 19 + Vite + Tailwind v4 (TS) | Scaffold já existente; renderiza a interface |
| API | Django 6 + Django REST Framework | Autenticação/sessões/CSRF e ORM com migrações vêm de fábrica |
| Banco | Postgres 16 (Docker) / SQLite (dev local) | Mesmo código ORM nos dois; `DATABASE_URL` decide |
| WSGI | gunicorn + whitenoise | Servidor de produção que também entrega o build do front |
| Testes | Django `TestCase` + DRF `APITestCase` | Testa os fluxos do contrato de API |

## Estrutura do repositório

```
backend/                 # API (Django + DRF)
  config/                # settings, urls, wsgi/asgi
  accounts/              # usuário customizado, login por e-mail
  scheduling/            # domínio: Option, Registration + views/serializers
    tests/               # test_api.py (integração) + test_units.py (unitários)
  manage.py
  requirements.txt
frontend/                # SPA React (Vite + Tailwind)
  src/
    pages/               # Landing (pública), Login, AdminPanel
    lib/api.ts           # cliente HTTP tipado do front
scripts/                 # automação (ver tabela abaixo)
docs/                    # DESENVOLVIMENTO.md, DECISOES.md, TODO.md e referencias/
  referencias/           # notas de estudo: 12-factors, tdd, security-ai-code, architecture-reliability, tarefas
.env.example             # modelo de ambiente/segredos (só o .example é versionado)
.github/workflows/ci.yml # CI: gate completo + smoke em todo push/PR
Dockerfile · docker-compose.yml · docker-compose.host.yml
```

## Variáveis de ambiente e segredos

- Nenhuma senha/chave é fixa no repositório.
- `scripts/setup-dev-env.sh` gera `.env` (raiz) e `backend/.env` com senhas e `DJANGO_SECRET_KEY` **aleatórias** — idempotente e preserva edições manuais.
- Só os `.env.example` são versionados; `.env`/`.env.*` ficam no `.gitignore`.
- O compose usa `${VAR:?...}` — falha no `up` se faltar algum segredo.
- Sem `DATABASE_URL`, o Django usa um **SQLite local** (`data.sqlite` na raiz); com `DATABASE_URL`, usa Postgres.
- Sem `DJANGO_SECRET_KEY`, em DEBUG gera chave efêmera; fora do DEBUG é erro deliberado (`ImproperlyConfigured`).

## Scripts do dia a dia

| Script | Faz o quê |
|--------|-----------|
| `scripts/setup-dev-env.sh` | Gera os `.env` com segredos aleatórios (1ª vez / idempotente) |
| `scripts/dev.sh` | Dev sem Docker: migrações/seeds + Django :8000 + Vite :5173 juntos |
| `scripts/seed.sh` | Migra e popula catálogo + admin (idempotente) |
| `scripts/check.sh` | Gate de CI local: testes Django, `tsc`, vitest, build do front, `docker compose config` e smote da stack. Falha se algo quebrar |
| `scripts/test.sh` | Testes rápidos sem Docker (backend + `tsc` + vitest + build com checagem de assets self-hosted) |
| `scripts/smoke.sh` | Sobe a stack via compose e valida Postgres healthy, web no ar, DNS `db` e página HTTP 200. Derruba no fim (`SMOKE_KEEP=1` mantém) |
| `scripts/start.sh` | Sobe a stack e valida como o smoke, mantendo os containers no ar (`REBUILD=1` força build) |
| `scripts/stop.sh` | Derruba preservando os dados do Postgres (`VOLUMES=1` apaga volumes) |
| `scripts/restart.sh` | stop + start (`REBUILD=1` e `VOLUMES=1` válidos) |
| `scripts/status.sh` | Estado dos containers (health e portas) |
| `scripts/logs.sh` | Logs em follow (`logs.sh web` filtra o serviço; `TAIL=50` controla o tamanho) |
| `scripts/db-shell.sh` | `psql` no Postgres com o papel de manutenção `vidasaude_admin` |
| `scripts/db-backup.sh` | `pg_dump` via papel de manutenção em `db/backups/` (`OUT=` para outra saída) |

> Sem acesso ao daemon do Docker (fora do grupo `docker`), use
> `DOCKER="sudo docker"` antes do script, ex.: `DOCKER="sudo docker" scripts/check.sh`.

## Docker (produção paridade)

```bash
docker compose up --build   # -> http://localhost:8000 (Postgres 16 + web)
```

A imagem builda o front numa etapa Node e o runtime Python roda `migrate` + seeds + gunicorn. O SPA é servido pelo Django sob `/static/frontend/`.

- **Smoke**: `scripts/smoke.sh` protege contra o boot quebrado do `web` (espera o Postgres `healthy`, garante o `web` rodando, resolve o DNS `db` e valida HTTP 200).
- **NAT restrito** (alguns sandboxes/CI): use o override com rede do host — `docker compose -f docker-compose.yml -f docker-compose.host.yml up --build`. Tudo fica em `127.0.0.1` (web :8000, Postgres :5432).

### Banco: privilégios mínimos (Papéis Suporte/TI)

O init do Postgres (`db/init/01-roles.sh`) roda na 1ª inicialização e cria o papel de aplicação **`vidasaude_app`** (não-superuser). O Django **nunca** conecta como superuser.

| Papel | Uso | Privilégio |
|-------|-----|------------|
| `vidasaude_app` | Aplicação (Django/migrations) | Não-superuser; DML/DDL só no schema `public` |
| `vidasaude_admin` | Manutenção (TI): `db-shell.sh` e `db-backup.sh` | Superuser (bootstrap do container) |

> Trocar papel/senha numa base já iniciada exige recriar o volume do Postgres
> (`scripts/stop.sh VOLUMES=1 && scripts/start.sh`) — os scripts de init só rodam em volume vazio.

## Usuários e login

O login é por **session cookie** (sem JWT):

1. `POST /api/login` com `{"email": "...", "password": "..."}`.
2. O servidor retorna `{id, name, email, role}` e seta o cookie de sessão.
3. `GET /api/me` confirma o usuário logado e o papel.
4. Para mutations, envie `X-CSRFToken` (token obtido em `GET /api/csrf`).

| Papel | Acesso ao painel (`/api/admin/**`) | Acesso ao Django admin (`/admin/`) | Criação |
|-------|-------------------------------------|------------------------------------|---------|
| **admin** | Total | Total | `seed_admin` (idempotente) |
| **suporte** | Operações (registros, opções, status) | 403 Forbidden | `create_support` |

- **Admin** é seedado no boot: `admin@vidasaude.com` + senha do `.env` (`ADMIN_PASSWORD`, impressa pelo `setup-dev-env.sh`). Personalizável com `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` no `.env`. `seed_admin` recusa rodar sem `ADMIN_PASSWORD`.
- **Criar suporte**:

  ```bash
  sudo docker exec vidasaude-web python manage.py create_support joao@vidasaude.com --name "João Suporte"
  # sem Docker:
  cd backend && python manage.py create_support joao@vidasaude.com --name "João Suporte"
  ```

## Testes

```bash
scripts/check.sh                       # roda tudo
cd backend && python manage.py test    # backend Django
cd frontend && pnpm exec vitest run    # frontend (React)
```

Cobrem os fluxos do contrato: registro público (salvo como `pendente`, recusa datas passadas/opções inativas/duplicados), anti-spam por IP (registro 5/min; login 30/min por IP + 10/15min por conta), autenticação do painel, mudança de status, gestão de opções e a camada de segurança (sanitização, SQLi, headers, RBAC suporte×admin). O front valida a imagem da médica self-hosted (regressão do bug da CSP).

## CI / CD

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em todo push (main, development, docker, backend-django) e pull_request:

1. Deps Python + front (pnpm `--frozen-lockfile`).
2. Gate local: `scripts/check.sh`.
3. Smoke da stack: `scripts/smoke.sh` com `SMOKE_HOST=1` (rede do host, sem iptables).

Concorrência por ref cancela runs duplicados. Não há deploy de aplicação: o Postgres roda via compose e o backend é estateless, pronto para anexar um job de deploy (ex.: imagem + registry) quando houver infra.

## Segurança

### Sanitização e SQLi
- Entradas passam por `strip_control_chars()` (remove `\x00..\x1f`, `\x7f`), limites de tamanho e máscaras (`validate_phone`) em `backend/scheduling/validators.py`, aplicadas nos serializers e modelos (bloqueia também via Django admin).
- Nada de SQL cru — tudo pelo **ORM parametrizado do Django**. `check.sh` converte `makemigrations --check` em teste de regressão e `test_security.py` exercita payloads clássicos (`' OR 1=1--`, `'; DROP TABLE--`).

### XSS
- Todo response ganha `Content-Security-Policy` (`default-src 'self'` + `frame-ancestors 'none'`), `Referrer-Policy: same-origin` e `Permissions-Policy` via `config/middleware.py`. A CSP abre só para o Google Fonts; imagens seguem `img-src 'self' data:`.
- **Imagens self-hosted**: a foto da médica da landing é asset do bundle (`frontend/src/assets/doctor-consulta.jpg`) — nunca URL remota. Testes/vitest e checagem do `dist/` impedem a volta do bug.
- React escapa por padrão; o **export CSV** do painel prefixa com `'` valores que começam com `=`, `+`, `-`, `@`, tab ou CR (evita CSV/Formula injection).

### MITM e DDoS
- `backend/config/settings.py` habilita via ambiente: `SECURE_SSL_REDIRECT`, `SECURE_PROXY_SSL_HEADER`, `SECURE_HSTS_SECONDS`/preload, `SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE`; `X-Content-Type-Options nosniff`, `Referrer-Policy` e `X-Frame-Options: DENY` sempre ligados.
- `RateLimitMiddleware` (`scheduling/middleware.py`): registro 5/min por IP, login 30/min por IP e 10/15min por conta (IP+e-mail), com suporte a `X-Forwarded-For` (`USE_X_FORWARDED_FOR=1`). Limites em `RATE_LIMIT_*`.

### Controle de privilégios
`accounts.User.role`: **admin** (superuser) vs **suporte** (só o painel de operação `/api/admin/**`; acesso ao `/admin/` bloqueado por `DjangoAdminGuardMiddleware`). Banco com least-privilege (`vidasaude_app` não-superuser); manutenção/backup usam `vidasaude_admin`.

## Notas do dia a dia

- **Anti-spam**: envio público limitado por IP (5/min) e trava duplicados em sequência (mesmo e-mail + especialidade + data nos últimos 60s).
- **CSRF**: o front envia `X-CSRFToken` (cookie `csrftoken`) em toda mutação.
- **Estados vazios**: listagens tratam "nada encontrado" com mensagem clara (skeleton loading nas listas do painel).

Detalhes das decisões de arquitetura e do que ficou de fora: [DECISOES.md](DECISOES.md).