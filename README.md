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
| `scripts/check.sh` | **Gate de CI local**: testes Django (unitários + integração), `tsc --noEmit`, build do front, `docker compose config` e **smoke da stack**. Falha (exit != 0) se qualquer etapa quebrar. |
| `scripts/test.sh` | Testes rápidos **sem docker**: backend Django (check + migrações + testes), `tsc --noEmit` e build do front. |
| `scripts/smoke.sh` | **Smoke de infra**: sobe a stack via compose e valida Postgres saudável, container web no ar, DNS do host `db` e página em **HTTP 200**. Derruba a stack ao final (`SMOKE_KEEP=1` mantém). |
| `scripts/start.sh` | Sobe a stack e valida (igual ao smoke), **mantendo os containers no ar**. `REBUILD=1` força `--build`. |
| `scripts/stop.sh` | Derruba a stack preservando os dados do Postgres. `VOLUMES=1` apaga os volumes (`-v`). |
| `scripts/restart.sh` | Reinicia a stack (stop + start). Aceita `REBUILD=1` e `VOLUMES=1`. |
| `scripts/status.sh` | Mostra o estado dos containers (health e portas). |
| `scripts/logs.sh` | Acompanha os logs (`--follow`). `scripts/logs.sh web` filtra o serviço; `TAIL=50` controla o tamanho. |
| `scripts/dev.sh` | Dev local **sem docker**: migrações/seeds + Django (:8000) + Vite (:5173) juntos. |
| `scripts/seed.sh` | Migra e popula catálogo + admin (idempotente). |

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

> Em daemons com NAT restrito (alguns sandboxes/CI bloqueiam o `-p`), use o override com rede do host — nada de iptables:
> `docker compose -f docker-compose.yml -f docker-compose.host.yml up --build`
> Tudo fica em `127.0.0.1` (web em `:8000`, Postgres em `:5432`).

## Testes

```bash
scripts/check.sh            # roda tudo; ou só os testes:
cd backend && python manage.py test
```

Cobrem os fluxos da spec: registro público (salvo como `pendente`, recusa datas passadas/opções inativas/duplicados), anti-spam por IP (5 requisições/min), autenticação do painel, mudança de status (confirmar/cancelar) e gestão de opções. Detalhes em [`docs/TODO.md`](docs/TODO.md).

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