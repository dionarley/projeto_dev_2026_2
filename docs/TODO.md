# TODO — fluxo de trabalho

Checklist operacional do teste (Mupi Systems — Dev Júnior Full Stack).

## Pendências

- [ ] PR única `development` → `main` criada e aberta.
- [ ] Resposta a comentários da revisão (se houver).

## Estado atual

Entregue e validado: Express + SQLite (etapa 1) → migração para Django + DRF (etapa 2) → Docker/Postgres (etapa 3). Branches `backend-django` e `docker` mergeadas em `development`; PRs por-branch fechadas — consolidação é única.

- [x] Testes de integração do contrato portados para Django `TestCase`.
- [x] Testes unitários de serializers, usuário e anti-spam.
- [x] Scripts de automação (`check.sh`, `dev.sh`, `seed.sh`, `test.sh`) e de serviço (`start/stop/restart/status/logs`).
- [x] Segurança: sanitização, SQLi, XSS/CSV-injection, headers+CSP, rate limit, RBAC admin×suporte, banco least-privilege, `create_support`.
- [x] Correção imagem da médica (self-host + CSP fontes) com testes de regressão.
- [x] Segredos parametrizados (`.env` aleatórios, `${VAR:?}`, `seed_admin` exige `ADMIN_PASSWORD`, `.env` ignorado).
- [x] CI no `.github/workflows/ci.yml`: gate completo + smoke da stack.
- [x] Gate completo verde (testes + `tsc` + vitest + build + `docker compose config` + smoke).

## Gate antes de merge / PR

```bash
VENV=backend/.venv scripts/check.sh   # testes + tsc + build + compose config + smoke
```
> Sem grupo `docker`, use `DOCKER="sudo docker" scripts/check.sh`.

## Notas do dia a dia

- Sem Docker: `scripts/dev.sh` (Django :8000 + Vite :5173).
- Com Docker: `scripts/start.sh` → http://localhost:8000.
- Admin padrão: `admin@vidasaude.com` / senha gerada no `.env` (`ADMIN_*`).