# TODO — fluxo de trabalho

Checklist operacional deste teste (Mupi Systems — Dev Júnior Full Stack).

## Histórico de entrega

- [x] **Etapa 1 — Express + SQLite** (deploy em `main`, PR #4): formulário público,
      painel de gestão, sessão, anti-spam. Testes Vitest/Supertest.
- [x] **Etapa 2 — Migração para Django** (branch `backend-django`): Django 6 + DRF 3.18
      replicando o contrato de API do Express. Front React praticamente intacto.
- [x] **Etapa 3 — Docker** (branch `docker`): Dockerfile multi-stage e docker-compose
      (Postgres 16 + gunicorn/whitenoise), validado de ponta a ponta.

## Estado atual

- [x] PRs por-branch (#5, #6, #7) fechadas — consolidação é única.
- [x] Testes de integração do contrato portados para Django `TestCase` (`scheduling/tests/test_api.py`).
- [x] Testes unitários de serializers, usuário e anti-spam (`scheduling/tests/test_units.py`, `accounts/tests.py`).
- [x] Scripts de automação: `scripts/check.sh` (gate CI local), `scripts/dev.sh`, `scripts/seed.sh`.
- [x] Scripts de serviço: `start.sh`, `stop.sh`, `restart.sh`, `status.sh`, `logs.sh` (ciclo de vida da stack com docker compose).
- [x] `scripts/test.sh` — testes rápidos sem docker (backend + `tsc` + vitest + build + checagem de assets externos no `dist/`).
- [x] **Segurança** (commit `fd2cb9a`): sanitização (validators/serializers/models), testes de SQLi/XSS, headers+CSP, rate limit, RBAC `admin`×`suporte` + guarda no `/admin/`, banco least-privilege (`vidasaude_app`), `create_support`, CSV-injection no painel.
- [x] **Correção imagem da médica**: self-host do asset na landing + exceção de CSP só para o Google Fonts, com **testes de regressão** — `Landing.test.tsx` (vitest) e checagem no `test.sh`/`check.sh` de que o `dist/` não referencia imagens externas.
- [x] **Segmentos sem hardcoded** (commit `6ea1059`): `scripts/setup-dev-env.sh` gera `.env`/`backend/.env` com senhas e `DJANGO_SECRET_KEY` aleatórias; compose usa `${VAR:?}` (falha sem segredo); `db/init/01-roles.sh` injeta a senha do ambiente; `seed_admin` exige `ADMIN_PASSWORD`; `settings.py` recusa rodar sem `DJANGO_SECRET_KEY` fora do DEBUG; db-shell/backup leem o `.env`; `.env`/`.env.*` ignorados (só `.env.example` versionados).
- [x] **CI** (`.github/workflows/ci.yml`): gate completo + smoke em todo push/PR.
- [x] Gate completo verde (testes + `tsc` + vitest + build + `docker compose config`).
- [x] **Smoke de infra** (`scripts/smoke.sh`) no gate: db `healthy` + web no ar + DNS do host `db` + HTTP 200 da página — evita o crash `failed to resolve host 'db'` no boot do `web`.
- [x] Branches `backend-django` e `docker` mergeadas em `development`.
- [ ] **PR única** `development` -> `main` criada e aberta.
- [ ] Resposta a comentários da revisão (se houver).

## Gate antes de merge / PR

```bash
VENV=backend/.venv scripts/check.sh   # testes + tsc + build + compose config + smoke da stack
```
> Sem grupo `docker`, use `DOCKER="sudo docker" scripts/check.sh`.

## Notas

- Local sem Docker: `scripts/dev.sh` (Django :8000 + Vite :5173) ou dois terminais.
- Docker: `docker compose up --build` → http://localhost:8000.
- Admin padrão: `admin@vidasaude.com` / `admin123` (variáveis `ADMIN_*`).