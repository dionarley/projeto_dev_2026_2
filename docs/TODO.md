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
- [x] Gate completo verde (testes + `tsc` + build + `docker compose config`).
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