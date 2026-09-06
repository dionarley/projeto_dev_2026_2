# DECISOES.md

Documento de decisões do projeto VidaSaúde (teste Mupi Systems — Desenvolvedor Júnior Full Stack).

## Tema

**Telemedicina ("VidaSaúde")**. O formulário público é um agendamento de consulta e as opções gerenciáveis são as especialidades médicas. Escolhi porque combina um fluxo de entrada (quem agenda) com um painel de gestão com ações reais de negócio — confirmar ou cancelar um horário muda a vida de quem está esperando.

## Por que a stack

O repositório já trazia um scaffold React + Vite + Tailwind com páginas bem desenvolvidas visualmente. O trabalho foi agregar a outra metade do sistema.

- **Front mantido em React/Vite/Tailwind**: a interface já existia e estava coerente com o tema. Recomeçar em outra stack jogaria fora o que já estava bom. Mantive a estética (azul `#2563EB`, verde `#10B981`, fundo `#0F172A`) para o produto parecer um produto só.
- **API em Node + Express**: JS puro roda com `node` sem build. O servidor é um arquivo que dá para ler inteiro em uma sentada — importante para poder explicar na conversa.
- **SQLite (better-sqlite3)**: um arquivo, zero configuração, sem serviço externo. O avaliador clona, segue o README e sobe. Síncrono e simples, suficiente para o volume do teste.
- **express-session + store em SQLite**: autenticação pronta da stack, como a spec permite. O store próprio em SQLite evita usar o módulo `sqlite3` (outro nativo) só para guardar sessão.
- **bcryptjs**: hash de senha padrão.

**O que ganhei**: one-command dev, banco portátil, testes de API diretos. **O que perdi**: escala para milhares de acessos simultâneos e ferramentas de migração de banco — irrelevantes para o escopo.

## Decisões sobre ambiguidades (o que a spec não diz)

- **Painel antes de chegar registros**: cada lista tem estado vazio com mensagem ("Nenhuma solicitação encontrada"), e o dashboard mostra zeros. Não mostro um painel quebrado — mostro um painel vazio prontinho para receber pedidos.
- **Registros de uma opção desativada**: continuam visíveis na listagem do painel (o histórico não some), mas a opção deixa de aparecer na página pública e no formulário. Desativar não apaga nem altera solicitações existentes.
- **Ordenação**: listagem ordenada por data do agendamento (o que faz sentido para quem confirma consultas), ascendente, com paginação server-side para aguentar centenas de registros.
- **Data no passado**: o backend recusa agenda para datas passadas (validação nas duas pontas).

## Cortes de escopo (feitos de propósito)

- **Cadastro de pacientes e dashboard do paciente**: o scaffold tinha uma página de registro de conta. Como o tema escolhido entrega o formulário de agendamento, um sistema real de contas de paciente adicionaria escopo (mais tabelas, permissões) sem cobrir nenhum requisito do teste. Cortei as páginas `Register`/`PatientDashboard` e deixei o login só para administradores. Se sobrasse tempo, o passo seguinte seria exatamente esse.
- **Notificação por e-mail**: deixei de fora. O fluxo pede feedback visual na interface, que existe; e notificação real exigiria um serviço de e-mail ou Mailhog, o que torna o README mais frágil.
- **Deploy hospedado**: não subi para um domínio público. O README cobre local com um comando, que é o que a spec considera o piso; deploy externo pediria conta de host e credenciais.

## Além do mínimo (o que adicionei e por quê)

1. **Exportação CSV** das solicitações — quem gerencia de segunda-feira de manhã quer jogar aquilo numa planilha.
2. **Anti-spam/envio duplicado** — limite por IP e trava de duplicata (mesmo e-mail + especialidade + data nos últimos 60s).
3. **Estados de carregamento e vazios no painel** — skeleton loading nas listas e mensagens quando não há nada, para o painel nunca parecer detalhe esquecido.
4. **Toasts de feedback** nas ações de confirmar/cancelar/editar — a spec pede feedback, entreguei visual consistente.

## Como usei IA

**O que deleguei e o que fiz à mão**: deleguei à IA o scaffold inicial (as páginas React que já estavam no repo), a estrutura do Express/SQLite e as sugestões de testes. Fiz à mão a integração das peças: o cliente HTTP tipado, a ligação do formulário da página pública ao banco, a proteção de rota com sessão, os estados de vazio/loading e os cortes de escopo. Regra: IA escreve o esqueleto, eu decido o que entra e como as peças se encaixam.

**Uma vez em que a IA deu algo errado**: a rota de fallback de SPA para o front foi escrita no estilo do Express 4 (`app.get("*")`). No Express 5 (versão instalada), o path-to-regexp mudou e essa sintaxe quebra o servidor na inicialização — os testes falharam com "Missing parameter name". Percebi pelo erro de runtime, e a correção foi trocar por um middleware de fallback (`app.use`) que só intercepta GET fora de `/api`. Ficou até mais claro.

**Uma decisão que tomei contra a IA**: a IA sugeriu manter as páginas de cadastro/dashboard de paciente do scaffold para "completar" o sistema. Contra essa sugestão, cortei as duas páginas, porque o teste pede um registro (solicitação) gerenciado por um painel — não uma conta de pessoa física completa. Menos código morto, história mais limpa para explicar na conversa.