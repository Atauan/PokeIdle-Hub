# AGENTS.md — PokeIdle Hub

## Contexto do projeto

- Responder em português do Brasil, de forma técnica e objetiva.
- A aplicação principal está em `PokeIdle-Hub/`: Electron, JavaScript, HTML e CSS, sem framework de frontend.
- A versão nativa para macOS usa os arquivos Swift na raiz e `build.sh`.
- O renderer ativo carrega `renderer/app.js`, `renderer/live-state.js`, `renderer/src/modules/farm-afk.js` e `renderer/updates.js`. Conferir `renderer/index.html` antes de alterar módulos antigos em `renderer/src/`.
- Contas do jogo e seus logins Twitch/Kick dependem de partições persistentes. Preservar o isolamento e os dados existentes.

## Leitura antes de alterar

Conferir o estado do Git e ler `README.md`, `CHANGELOG.md`, os arquivos relacionados e a documentação pertinente em `docs/`. Relatórios históricos podem descrever comportamentos já revertidos; confirmar o estado atual no código.

Para Hunt/AFK, consultar a Wiki, a Pokédex e os relatórios matemáticos locais. Distinguir dados medidos, estimativas e hipóteses; não generalizar números de uma sessão para todas as contas.

## Skills por projeto

As 25 skills de `addyosmani/agent-skills` estão instaladas em `.agents/skills/`. A origem, a versão e o commit estão em `.agents/agent-skills.json`; a licença está em `.agents/LICENSE-agent-skills`. As referências compartilhadas ficam em `.agents/references/` e mantêm os caminhos relativos usados pelo pacote.

Selecionar a skill pertinente à tarefa e ler seu `SKILL.md` quando necessário. Não carregar todas as skills nem incorporar o conteúdo completo de `using-agent-skills` às instruções permanentes.

| Situação | Skills pertinentes |
| --- | --- |
| Funcionalidade significativa sem especificação, ou requisitos ambíguos | `spec-driven-development` |
| Especificação existente que precisa de plano e tarefas | `planning-and-task-breakdown` |
| Implementação de comportamento e seus testes | `incremental-implementation`, `test-driven-development` |
| Bug, falha de build ou regressão | `debugging-and-error-recovery` |
| Interface e acessibilidade | `frontend-ui-engineering` |
| CPU, RAM, GPU e execução prolongada | `performance-optimization`, `observability-and-instrumentation` |
| IPC, autenticação, sessões e integrações externas | `security-and-hardening`, `api-and-interface-design` |
| Revisão de código e documentação | `code-review-and-quality`, `documentation-and-adrs` |

As instruções explícitas do usuário prevalecem sobre os fluxos das skills. Sua instalação não autoriza criar commits, publicar releases, fazer deploy, remover arquivos ou alterar dados reais. Aplicar as confirmações exigidas pelo usuário imediatamente antes da ação correspondente. Não solicitar confirmação redundante para trabalho claro, reversível e já autorizado.

Para testes da aplicação Electron, usar `playwright-interactive` quando disponível na sessão; ela foi instalada no escopo do usuário. `browser-testing-with-devtools` depende de um servidor Chrome DevTools MCP configurado e não substitui automaticamente o suporte a Electron.

## Comandos e validação

Comandos existentes da aplicação, executados a partir da raiz:

```sh
npm --prefix PokeIdle-Hub run
npm --prefix PokeIdle-Hub start
npm --prefix PokeIdle-Hub run dev
npm --prefix PokeIdle-Hub run dev:reset
npm --prefix PokeIdle-Hub test
npm --prefix PokeIdle-Hub run dist:win
npm --prefix PokeIdle-Hub run dist:mac
npm --prefix PokeIdle-Hub run dist:linux
```

O `package.json` define testes com `node:test`, sem lint ou typecheck. `dev` e `npm start` preservam o perfil local separado; `dev:reset` remove todos os dados locais desse perfil, inclusive logins e configurações dos addons, sem alterar dados remotos ou de produção. Nunca executar reset sobre perfil real durante validação; usar fixtures temporárias. Para JavaScript alterado, conferir a sintaxe com `node --check` e validar o comportamento afetado com o mecanismo disponível.

Os addons possuem fontes e bundles gerados. Após alterar as fontes, atualizar o bundle correspondente e revisar o diff:

```sh
node PokeIdle-Hub/tools/build-hunt.js
node PokeIdle-Hub/tools/build-rotom.js
```

Build/execução Swift requer macOS. Login, pontos de lives, isolamento entre contas e consumo sustentado exigem validação no aplicativo; declarar quando não forem testados.

## Documentação e entrega

- Registrar mudanças não triviais em `docs/changes/YYYY-MM-DD-HHMM--slug.md`, com objetivo, arquivos, impacto, validação, rollback e pendências.
- Atualizar `CHANGELOG.md` quando houver impacto relevante e criar ADR apenas para decisão arquitetural duradoura.
- `docs/` está ignorada pelo Git; os registros nessa pasta são locais até que o usuário autorize outra política de rastreamento. `AGENTS.md` e `.agents/` podem ser versionados.
- Preservar os arquivos importados das skills. Atualizações do pacote devem registrar a revisão de origem e conferir as referências compartilhadas.
- Relatar arquivos alterados, verificações realmente executadas, limitações e sugestão de commit. Não criar commit automaticamente.
