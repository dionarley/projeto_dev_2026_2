# VidaSaúde — Telemedicina

Sistema de **agendamento de consultas online** (teste prático da vaga Júnior Full Stack — Mupi Systems).

- **Visitante**: entra na página, escolhe a especialidade e agenda. O pedido fica salvo como *pendente*.
- **Equipe**: loga no painel, acompanha as solicitações, confirma ou cancela e mantém a lista de especialidades.

## Começando rápido

**Requisitos**: Python 3.14, Node 22+ e pnpm 10. Docker só é preciso se quiser usar Postgres.

### Sem Docker (dev local rápido)

```bash
python -m venv /tmp/venv
pip install -r backend/requirements.txt

scripts/setup-dev-env.sh   # 1ª vez: gera .env com senhas aleatórias
scripts/seed.sh            # migra o banco e cria catálogo + admin
scripts/dev.sh             # sobe a API (:8000) e o front (:5173)
```

Abra **http://localhost:5173**. Para entrar no painel: `admin@vidasaude.com` + a senha que o `setup-dev-env.sh` imprime no terminal.

### Com Docker (Postgres — paridade com produção)

```bash
scripts/setup-dev-env.sh
scripts/start.sh            # Postgres + web em http://localhost:8000
```

### Testes

```bash
scripts/check.sh            # testes Django + typecheck + build + smoke da stack
```

## Onde está cada coisa

| Pasta      | Conteúdo                                        |
|------------|-------------------------------------------------|
| `backend/` | API Django (usuários, agendamentos)             |
| `frontend/`| SPA React (página pública, painel)              |
| `scripts/` | Automação do dia a dia (dev, start, test, backup) |
| `docs/`    | Documentação                                    |

Stack em uma linha: React + Vite + Tailwind (front) · Django + DRF (API) · Postgres / SQLite.

## Documentação

- [**DESENVOLVIMENTO.md**](docs/DESENVOLVIMENTO.md) — guia técnico do dia a dia: estrutura, scripts, Docker, banco e segurança.
- [**DECISOES.md**](docs/DECISOES.md) — o porquê das escolhas de stack e o que ficou de fora.
- [**TODO.md**](docs/TODO.md) — fluxo de trabalho e pendências.