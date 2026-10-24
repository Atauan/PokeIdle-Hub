# Lista de Tarefas: Escopo de Lives por Conta e Plataforma

## Tarefa 1: Migrar favoritos e persistir exclusões por conta

**Descrição:** Atualizar o modelo puro de preferências e o estado local para armazenar favoritos por conta e provedor, carregar exclusões individuais por conta e persistir as duas estruturas sem descartar os dados existentes.

**Critérios de aceite:**
- [x] Favoritos legados por conta são convertidos para Kick e Twitch, com nomes normalizados e migração idempotente.
- [x] O estado carrega e persiste exclusões por conta sem alterar chaves de sessões ou provedores.
- [x] Entrada inválida ou ausente gera estado vazio válido.

**Verificação:** `npm --prefix PokeIdle-Hub test -- tests/live-account-preferences.test.js tests/app-state.test.js` e `node --check` nos arquivos alterados.

**Dependências:** Nenhuma.

**Arquivos prováveis:**
- `PokeIdle-Hub/live-account-preferences.js`
- `PokeIdle-Hub/renderer/app-state.js`
- `PokeIdle-Hub/tests/live-account-preferences.test.js`
- `PokeIdle-Hub/tests/app-state.test.js`

**Escopo estimado:** Médio (4 arquivos).

## Tarefa 2: Aplicar favoritos por conta e plataforma nos cards

**Descrição:** Passar o provedor junto com conta e canal entre tile, controller e funções de preferência. Atualizar o estado visual apenas para tiles da mesma conta e plataforma.

**Critérios de aceite:**
- [x] Alternar favorito num canal Kick não altera canal Twitch de mesmo nome.
- [x] Alternar favorito numa conta não altera outra conta.
- [x] Os botões atualizam ícone e título dos tiles correspondentes e preservam persistência/avisos.

**Verificação:** `npm --prefix PokeIdle-Hub test -- tests/live-account-preference-controller.test.js tests/live-tile-view.test.js` e `node --check` nos arquivos alterados.

**Dependências:** Tarefa 1.

**Arquivos prováveis:**
- `PokeIdle-Hub/renderer/live-account-preference-controller.js`
- `PokeIdle-Hub/renderer/live-tile-view.js`
- `PokeIdle-Hub/renderer/app.js`
- `PokeIdle-Hub/tests/live-account-preference-controller.test.js`
- `PokeIdle-Hub/tests/live-tile-view.test.js`

**Escopo estimado:** Médio (5 arquivos).

## Tarefa 3: Filtrar canais excluídos por conta antes de criar tiles

**Descrição:** Aplicar as exclusões por conta/plataforma no planejamento de recursos e tiles, mantendo descoberta e canais elegíveis globais.

**Critérios de aceite:**
- [x] A exclusão de uma conta não muda os canais elegíveis das outras contas.
- [x] Limites por provedor e prioridade de favoritos continuam corretos dentro de cada conta.
- [x] A lista global de canais visíveis e os modos econômicos mantêm seus contratos atuais.

**Verificação:** `npm --prefix PokeIdle-Hub test -- tests/live-policy.test.js tests/live-tile-controller.test.js` e `node --check` nos arquivos alterados.

**Dependências:** Tarefas 1 e 2.

**Arquivos prováveis:**
- `PokeIdle-Hub/live-policy.js`
- `PokeIdle-Hub/renderer/live-tile-controller.js`
- `PokeIdle-Hub/tests/live-policy.test.js`
- `PokeIdle-Hub/tests/live-tile-controller.test.js`

**Escopo estimado:** Médio (4 arquivos).

## Tarefa 4: Ordenar favoritos usando a plataforma correta

**Descrição:** Atualizar o layout por conta para consultar o favorito com conta, provedor e canal, mantendo a ordem visual existente para não favoritos.

**Critérios de aceite:**
- [x] Favorito Kick sobe somente entre as tiles Kick da conta selecionada.
- [x] Favorito Twitch de mesmo nome e tiles em outras contas não recebem prioridade indevida.
- [x] O layout sem favoritos conserva a ordem atual.

**Verificação:** `npm --prefix PokeIdle-Hub test -- tests/live-grid-layout.test.js` e `node --check` nos arquivos alterados.

**Dependências:** Tarefas 1 e 2.

**Arquivos prováveis:**
- `PokeIdle-Hub/renderer/live-grid-layout.js`
- `PokeIdle-Hub/renderer/app.js`
- `PokeIdle-Hub/tests/live-grid-layout.test.js`

**Escopo estimado:** Pequeno (3 arquivos).

## Ponto de verificação: favoritos e política

- [x] Testes focados de estado, preferências, tiles, política e layout passam.
- [x] Mesmo canal pode ser favorito somente numa das plataformas e contas.
- [x] Limites, conexões e modos econômicos mantêm os resultados existentes.

## Tarefa 5: Remover uma live somente da conta selecionada

**Descrição:** Mudar a ação de remover para registrar exclusão local da conta/plataforma, sem remover o canal das listas globais ou afetar outras contas; a adição manual global limpa as exclusões correspondentes em todas as contas.

**Critérios de aceite:**
- [x] Remover uma tile Kick mantém o canal em outras contas Kick e em Twitch.
- [x] Nova descoberta não restaura o canal na conta onde foi removido.
- [x] Adição manual global restaura o canal em todas as contas; limpar Kick/Twitch continua global por provedor.

**Verificação:** `npm --prefix PokeIdle-Hub test -- tests/live-channel-collection.test.js tests/live-tile-view.test.js` e `node --check` nos arquivos alterados.

**Dependências:** Tarefas 1 a 4.

**Arquivos prováveis:**
- `PokeIdle-Hub/renderer/live-channel-collection.js`
- `PokeIdle-Hub/renderer/app.js`
- `PokeIdle-Hub/tests/live-channel-collection.test.js`
- `PokeIdle-Hub/tests/live-tile-view.test.js`

**Escopo estimado:** Pequeno (4 arquivos).

## Tarefa 6: Limpar preferências quando uma conta for removida

**Descrição:** Estender o ciclo de vida de conta para apagar favoritos e exclusões apenas do perfil removido, sem tocar os dados das outras contas.

**Critérios de aceite:**
- [x] Remover conta elimina suas preferências e exclusões persistidas.
- [x] Contas restantes mantêm favoritos e canais excluídos.
- [x] Limpeza de sessão existente continua preservada.

**Verificação:** `npm --prefix PokeIdle-Hub test -- tests/game-account-lifecycle.test.js` e `node --check` nos arquivos alterados.

**Dependências:** Tarefas 1 e 5.

**Arquivos prováveis:**
- `PokeIdle-Hub/renderer/game-account-lifecycle.js`
- `PokeIdle-Hub/tests/game-account-lifecycle.test.js`

**Escopo estimado:** Pequeno (2 arquivos).

## Tarefa 7: Validação final e documentação

**Descrição:** Executar os testes focados e completos, validar sintaxe, atualizar changelog e registrar impacto, validação, rollback e pendências no registro local de mudança.

**Critérios de aceite:**
- [x] Testes focados e `npm --prefix PokeIdle-Hub test` passam.
- [x] Todos os JavaScript alterados passam em `node --check`.
- [x] CHANGELOG e registro de alteração descrevem o comportamento real; indicar que validação empacotada/manual depende de smoke no Windows se não puder ser executada.

**Verificação:** `git diff --check`, suíte completa e revisão do diff.

**Dependências:** Tarefas 1 a 6.

**Arquivos prováveis:**
- `CHANGELOG.md`
- `docs/changes/YYYY-MM-DD-HHMM--escopo-lives-conta-plataforma.md`

**Escopo estimado:** Pequeno (2 arquivos).

## Ponto de verificação final

- [x] Todos os critérios da especificação atendidos.
- [x] Suíte completa passa.
- [ ] Smoke manual confirma isolamento entre contas e plataformas.
- [x] Sem commits automáticos.
