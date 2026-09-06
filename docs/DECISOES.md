# DECISOES.md

Documento de decisões do projeto VidaSaúde (teste Mupi Systems — Desenvolvedor Júnior Full Stack).

## Tema

**Telemedicina ("VidaSaúde")**. O formulário público é um agendamento de consulta e as opções gerenciáveis são as especialidades médicas. Escolhi porque combina um fluxo de entrada (quem agenda) com um painel de gestão com ações reais de negócio — confirmar ou cancelar um horário muda a vida de quem está esperando.

## Por que a stack (estado atual)

- **Front mantido em React/Vite/Tailwind**: já existia no repositório e estava coerente com o tema. A estética (azul `#2563EB`, verde `#10B981`, fundo `#0F172A`) é a mesma nas duas pontas.
- **Backend em Django 6 + DRF**: a spec pede explicitamente Django; a migração aproveita o que o framework resolve de fábrica — ORM com migrações, autenticação, sessões e **proteção CSRF**. DRF dá serialização, views e permissões (`IsAdminUser`) sem reescrever o mesmo código à mão.
- **Postgres 16 no Docker, SQLite no dev local**: o mesmo código ORM roda nos dois bancos; `DATABASE_URL` decide. Postgres dá paridade com produção e persistência confiável em volume; SQLite mantém o dev "clone e rode".
- **gunicorn + whitenoise servindo tudo**: um único servidor WSGI entrega API, SPA e assets estáticos (`/static/frontend/`) — simplicidade operacional num projeto desse tamanho.
- **docker compose** com `db` (Postgres, healthcheck) e `web` (Django), `depends_on: service_healthy` garantindo que o banco aceita conexão antes de migrar.
- **Dockerfile multi-stage**: estágio 1 compila o React (Node) e o estágio 2 só copia o `dist/` para a imagem Python final. Imagem pequena, sem toolchain de Node no runtime.

## Migração Express → Django (a pergunta que ficou)

Versão anterior era **Node + Express 5 + better-sqlite3**, entregue no PR #4 (branch `main`). Ela continua no histórico do git — nada foi perdido, a migração é reversível. Por que voltar atrás:

1. **O que o trabalho pede**: o teste/entrevista pede Django. Era a stack obrigatória.
2. **O que Django desbloqueia**: num projeto real o back precisaria de ORM com migrações (para evoluir o schema com deploy), autenticação e CSRF robustos, e teste de banco isolado. Tudo isso vem pronto, em vez de ser reescrito num servidor Express.
3. **O que o Express ganhou no processo**: a versão Express me serviu de **especificação executável** — o contrato de API foi desenhado e *testado primeiro* lá, e o Django replicou a mesma interface. Os 11 testes Vitest/Supertest viraram 11 testes Django `TestCase`, com os mesmos cenários.
4. **Custo da migração foi baixo — de propósito**: o front React não precisou mudar de interface. Só duas pontas técnicas: `api.ts` ganhou envio do cabeçalho `X-CSRFToken` (o Django exige os token na requisição além do cookie de sessão) e o campo `active` passou a vir `true/false` do DRF em vez de `1/0`. Rotas, payloads e ordenação são idênticos.

O que fiz com a "deixa" do Express que **não** deixei para trás na migração: anti-spam (limite por IP + travamento de duplicatas), recusa de datas passadas, recusa de opção inativa, paginação/filtro/busca server-side e exportação CSV.

## Decisões sobre ambiguidades (o que a spec não diz)

- **Painel antes de chegar registros**: cada lista tem estado vazio com mensagem ("Nenhuma solicitação encontrada"), e o dashboard mostra zeros. Não mostro um painel quebrado — mostro um painel vazio prontinho para receber pedidos.
- **Registros de uma opção desativada**: continuam visíveis na listagem do painel (o histórico não some), mas a opção deixa de aparecer na página pública e no formulário. Desativar não apaga nem altera solicitações existentes.
- **Ordenação**: listagem ordenada por data do agendamento (o que faz sentido para quem confirma consultas), ascendente, com paginação server-side para aguentar centenas de registros.
- **Data no passado**: o backend recusa agenda para datas passadas (validação nas duas pontas).

## Cortes de escopo (feitos de propósito)

- **Cadastro de pacientes e dashboard do paciente**: o scaffold tinha uma página de registro de conta. Como o tema escolhido entrega o formulário de agendamento, um sistema real de contas de paciente adicionaria escopo sem cobrir nenhum requisito do teste. Cortei as páginas e deixei o login só para administradores.
- **Notificação por e-mail**: deixei de fora. O fluxo pede feedback visual na interface; notificação real exigiria serviço de e-mail ou Mailhog.
- **Deploy hospedado**: o README cobre Docker local e o fluxo de dev com dois comandos. Deploy externo pediria conta de host e credenciais.
- **Celery/workers e fila de e-mail**: descabido para o escopo; o anti-spam e os seeds rodam no próprio processo web.

## Além do mínimo (o que adicionei e por quê)

1. **Exportação CSV** das solicitações — quem gerencia de segunda-feira de manhã quer jogar aquilo numa planilha.
2. **Anti-spam/envio duplicado** — limite por IP (token bucket) e trava de duplicata (mesmo e-mail + especialidade + data nos últimos 60s), nos mesmos moldes do Express.
3. **Estados de carregamento e vazios no painel** — skeleton loading nas listas e mensagens quando não há nada.
4. **Toasts de feedback** nas ações de confirmar/cancelar/editar — a spec pede feedback, entreguei visual consistente.
5. **Login por e-mail no Django**: usuário customizado (`accounts.User`, `AbstractUser` com `USERNAME_FIELD="email"`), para o contrato da API permanecer `email + password` sem `username`.

## Como usei IA

**O que deleguei e o que fiz à mão**: deleguei o scaffold inicial (as páginas React que já estavam no repo), a estrutura Django (models/views/serializers) e as sugestões de testes. Fiz à mão a integração das peças: o contrato de API idêntico entre Express e Django, o fluxo CSRF no `api.ts`, a mudança `active` 0/1 → `true/false`, o Dockerfile/compose e os cortes de escopo. Regra: IA escreve o esqueleto, eu decido o que entra e como as peças se encaixam.

**Duas vezes em que a IA deu algo errado (e como peguei)**:

1. No Express, a rota de fallback de SPA `app.get("*")` quebrou no Express 5 ("Missing parameter name"). Peguei pelo erro de runtime e troquei por um middleware que só intercepta GET fora de `/api`.
2. No Django, anotei `registrations` (nome que colide com a relação reversa da FK) e o campo `registrations` do serializer apontava para o `RelatedManager` — `int()` explodia em 500. Peguei no smoke test HTTP, que rodou contra a API de verdade (testes de unidade não cobriam esse caminho). Troquei por uma property `registration_count`.

**Uma decisão que tomei contra a IA**: a IA sugeriu manter as páginas de cadastro/dashboard de paciente do scaffold para "completar" o sistema e, na migração, sugeriu DRF + `ModelViewSet` com rotas automáticas. Contra isso, mantive **views function-based** (`@api_view`): o contrato de API é enxuto e específico (paths exatos, status, formato de erros `{errors: {...}}`), e viewsets criariam rotas/estado que eu não quero expor. Menos superfície, história mais limpa para explicar na conversa.

## Fluxo de branches

- `main` — versão entregue Express (PR #4).
- `development` — integração do caminho novo.
- `backend-django` — a migração Express → Django (mergeada em `development`).
- `docker` — Dockerfile, compose e docs da migração (mergeada em `development`).