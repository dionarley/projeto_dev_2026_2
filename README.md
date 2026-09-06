# VidaSaúde — Telemedicina

Uma aplicação web de **agendamento de consultas online** (teste prático para a vaga de Desenvolvedor(a) Júnior Full Stack na Mupi Systems).

- **Visitante**: acessa a página pública, escolhe a especialidade, agenda e recebe confirmação visual. O agendamento é salvo como **pendente**.
- **Gestão**: a equipe faz login no painel, acompanha as solicitações, confirma ou cancela, e mantém a lista de especialidades que a página mostra.

O tema é telemedicina ("VidaSaúde"), o formulário público funciona como o "registro" pedido na especificação (um agendamento de consulta), e as especialidades são as "opções" gerenciáveis pelo painel.

## Stack e estrutura

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Front | React 19 + Vite + Tailwind v4 (TS) | Já existia um scaffold Vite/React no repositório; é o que renderiza a interface |
| API | Node + Express 5 | JS simples de rodar e explicar, sem build no servidor |
| Banco | SQLite via better-sqlite3 | Um arquivo, zero configuração — roda na máquina de quem clonar |
| Sessão | express-session + store em SQLite | Autenticação "pronta da stack", persistente entre restarts |
| Senha | bcryptjs | Hash padrão, sem reinventar roda |
| Testes | Vitest + Supertest | Testa a API HTTP dos fluxos centrais sem precisar de banco externo |

Estrutura:

```
app/
  server/
    index.js        # ponto de entrada: cria banco, seed, sobe a API
    app.js          # rotas e validações (exportado para os testes)
    db.js           # schema + seeds iniciais
    seed.js         # CLI para criar/atualizar o admin
    sessionStore.js # sessões persistidas no SQLite
  src/
    pages/          # Landing (pública), Login, AdminPanel
    lib/api.ts      # cliente HTTP tipado do front
  tests/api.test.mjs
  .env.example
```

## Pré-requisitos

- Node.js 22+ (o `.mise.toml` fixa a versão 22)
- pnpm 10 (`npm i -g pnpm@10` ou ative via corepack)
- Um terminal. Nada mais: o banco é um arquivo local.

## Rodando em desenvolvimento

```bash
cd app
pnpm install          # instala as dependências (compila o better-sqlite3)
cp .env.example .env  # é opcional, os padrões são usados do contrário
pnpm dev              # sobe API na :3333 e front na :5173
```

Abra **http://localhost:5173**. O Vite faz proxy das chamadas `/api` para o Express, então cookies de sessão funcionam no mesmo domínio.

> Credenciais do painel (admin criado no primeiro start): `admin@vidasaude.com` / `admin123`.
> Para trocar, defina `ADMIN_EMAIL`, `ADMIN_PASSWORD` e (recomendado) `SESSION_SECRET` no `.env` e apague o banco `data.sqlite`.

## Rodando em "produção" (build + servidor único)

```bash
cd app
pnpm build            # gera o dist/ do front
pnpm start            # o Express serve a página e a API na :3333
```

Acesse **http://localhost:3333**.

## Testes

```bash
cd app
pnpm test
```

Cobrem os três fluxos que a spec pede e mais um pouco:

1. Registro válido é salvo como `pendente`; inválido é recusado (422) sem gravar nada — **criar/recusar registro**
2. Rota do painel sem sessão retorna 401, inclusive na mudança de status — **painel barrado sem auth**
3. Login + confirmação de um registro persiste o novo status, com filtro/busca/paginação — **mudança de status**
4. Gestão de opções: cria e desativa e a página pública reflete na hora

## Criar ou trocar o usuário admin

O admin é criado automaticamente no primeiro start com as variáveis do `.env`. Para gerenciar depois:

```bash
cd app
ADMIN_EMAIL=admin@vidasaude.com ADMIN_PASSWORD=sua-senha node server/seed.js
```

## Decisões e o que ficou de fora

Detalhes de stack, cortes de escopo e o uso de IA estão em [`DECISOES.md`](../DECISOES.md).

## Algo mais?

- **Exportação CSV**: o painel exporta a listagem atual de solicitações.
- **Anti-spam**: o envio público tem limite por IP e trava duplicados em sequência (mesmo e-mail + especialidade + data).
- **Estados vazios**: tanto a listagem de solicitações quanto as especialidades tratam "nada encontrado" com mensagem clara.