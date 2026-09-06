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
scripts/                 # automação (check, dev, seed)
docs/                    # DECISOES.md, TODO.md
Dockerfile · docker-compose.yml · .gitignore · .dockerignore
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
| `scripts/check.sh` | **Gate de CI local**: testes Django (unitários + integração), `tsc --noEmit`, build do front e `docker compose config`. Falha (exit != 0) se qualquer etapa quebrar. |
| `scripts/dev.sh` | Aplica migrações/seeds e sobe Django (:8000) + Vite (:5173) juntos. |
| `scripts/seed.sh` | Migra e popula catálogo + admin (idempotente). |

```bash
scripts/check.sh            # venv fora do padrão? VENV=backend/.venv scripts/check.sh
scripts/dev.sh
```

## Rodando com Docker (produção paridade)

```bash
docker compose up --build   # -> http://localhost:8000 (Postgres 16 + web)
```

A imagem builda o front numa etapa Node e o runtime Python roda `migrate` + seeds + gunicorn. O SPA é servido pelo Django sob `/static/frontend/`.

## Testes

```bash
scripts/check.sh            # roda tudo; ou só os testes:
cd backend && python manage.py test
```

Cobrem os fluxos da spec: registro público (salvo como `pendente`, recusa datas passadas/opções inativas/duplicados), anti-spam por IP (5 requisições/min), autenticação do painel, mudança de status (confirmar/cancelar) e gestão de opções. Detalhes em [`docs/TODO.md`](docs/TODO.md).

> Credenciais do painel criadas no seed: `admin@vidasaude.com` / `admin123`.
> Para trocar, defina `ADMIN_EMAIL`, `ADMIN_PASSWORD` no `.env` do `backend/`.

## Decisões de stack e o que ficou de fora

Detalhes da migração Express → Django, Docker, cortes de escopo e o uso de IA estão em [`docs/DECISOES.md`](docs/DECISOES.md).

## Algo mais?

- **Anti-spam**: o envio público tem limite por IP (5/min) e trava duplicados em sequência (mesmo e-mail + especialidade + data).
- **CSRF**: o front envia `X-CSRFToken` (cookie `csrftoken`) em toda mutação.
- **Estados vazios**: a listagem de solicitações e as especialidades tratam "nada encontrado" com mensagem clara.