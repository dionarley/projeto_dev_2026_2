# VidaSaúde — Telemedicina

Uma aplicação web de **agendamento de consultas online** (teste prático para a vaga de Desenvolvedor(a) Júnior Full Stack na Mupi Systems).

- **Visitante**: acessa a página pública, escolhe a especialidade, agenda e recebe confirmação visual. O agendamento é salvo como **pendente**.
- **Gestão**: a equipe faz login no painel, acompanha as solicitações, confirma ou cancela, e mantém a lista de especialidades que a página mostra.

O tema é telemedicina ("VidaSaúde"), o formulário público funciona como o "registro" pedido na especificação (um agendamento de consulta), e as especialidades são as "opções" gerenciáveis pelo painel.

## Stack e estrutura

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Front | React 19 + Vite + Tailwind v4 (TS) | Scaffold já existente no repositório; renderiza a interface |
| API | Django 6 + Django REST Framework | Autenticação/sessões/CSRF e ORM com migrações vêm de fábrica |
| Banco | Postgres 16 (Docker) / SQLite (dev local) | Mesmo código ORM nos dois; Postgres para paridade do ambiente de produção |
| WSGI | gunicorn + whitenoise | Servidor de produção que também entrega o build do front |
| Testes | Django `TestCase` + DRF `APITestCase` | Testa os mesmos fluxos do contrato de API sem serviço externo |

Estrutura:

```
backend/
  core/                # projeto Django (settings, urls, view do fallback SPA)
  accounts/            # usuário customizado com login por e-mail
  scheduling/          # domain: Option, Registration + views/serializers/testes
  manage.py
  requirements.txt
app/
  src/
    pages/             # Landing (pública), Login, AdminPanel
    lib/api.ts         # cliente HTTP tipado do front (com CSRF)
  package.json, vite.config.ts
Dockerfile             # multi-stage: build React -> runtime Python
docker-compose.yml     # db (Postgres) + web (Django), com healthcheck
```

## Pré-requisitos

- **Opção A (recomendada):** Docker com o plugin Compose (`docker compose version`).
- **Opção B (dev local):** Node.js 22+ e pnpm 10 (`.mise.toml` fixa o Node), Python 3.12–3.14.

## Rodando com Docker (produção local)

```bash
cp backend/.env.example .env   # já tem defaults seguros; troque DJANGO_SECRET_KEY
docker compose up --build
```

Acesse **http://localhost:8000**. O compose sobe Postgres, roda `migrate`, semeia o catálogo e o admin, e inicia o gunicorn — tudo idempotente.

> Credenciais do painel: `admin@vidasaude.com` / `admin123`.

## Rodando em desenvolvimento (sem Docker)

Duas pontas, como manda o 12-factor: API e front são processos separados com configuração por variáveis de ambiente.

**Backend (Django):**

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # opcional; sem .env usa SQLite e defaults
python manage.py migrate
python manage.py seed_options && python manage.py seed_admin
python manage.py runserver 0.0.0.0:8000
```

**Frontend (Vite):**

```bash
cd app
pnpm install
pnpm dev:web                    # http://localhost:5173 com proxy /api -> :8000
```

Ou, do diretório `app/`, os três comandos de atalho: `pnpm dev:api`, `pnpm dev:web` e `pnpm seed` (seed) e `pnpm test` (testes do backend).

Sem `DATABASE_URL` o Django usa um **SQLite local** (`data.sqlite` na raiz); com `DATABASE_URL` usa Postgres.

## Servindo tudo de um processo só (Python)

```bash
cd app && pnpm build            # dist do front
cd ../backend && python manage.py runserver 0.0.0.0:8000
```

O Django serve o SPA em `/`, os assets em `/static/frontend/` (whitenoise) e a API em `/api/*`. Acesse **http://localhost:8000**.

## Testes

```bash
cd backend && python manage.py test
```

11 testes cobrem os fluxos que a spec pede e mais um pouco:

1. Registro válido é salvo como `pendente`; inválido é recusado (400) sem gravar nada — **criar/recusar registro**
2. Rota do painel sem sessão retorna 401/403, inclusive na mudança de status — **painel barrado sem auth**
3. Login + confirmação de um registro persiste o novo status, com filtro/busca/paginação — **mudança de status**
4. Gestão de opções: cria e desativa e a página pública reflete na hora

## Variáveis de ambiente

| Variável | Onde | Padrão |
|----------|------|--------|
| `DJANGO_SECRET_KEY` | `backend/.env`, compose | dev (trocar em produção) |
| `DJANGO_DEBUG` | idem | `true` local / `false` no Docker |
| `DATABASE_URL` | idem | vazio → SQLite |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | idem, compose | `admin@vidasaude.com` / `admin123` |
| `API_URL` | `app/.env` | `http://localhost:8000` (proxy do Vite) |
| `VITE_BASE` | build | `/` local; `/static/frontend/` no Docker |

## Decisões e o que ficou de fora

Detalhes de stack, cortes de escopo, a **justificativa da migração Express → Django** e o uso de IA estão em [`DECISOES.md`](DECISOES.md).

## Algo mais?

- **Exportação CSV**: o painel exporta a listagem atual de solicitações.
- **Anti-spam**: o envio público tem limite por IP (token bucket por processo) e trava duplicados em sequência (mesmo e-mail + especialidade + data).
- **Estados vazios**: tanto a listagem de solicitações quanto as especialidades tratam "nada encontrado" com mensagem clara.