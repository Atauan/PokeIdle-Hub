# Lista de Tarefas: Botão de Reset de Dados Locais e Reinicialização## Tarefa 1: Implementar o manipulador IPC 'reset-app-data' e expor no preload

**Descrição:** Implementar o manipulador IPC `'reset-app-data'` em [session-maintenance-service.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/session-maintenance-service.js) que valida o remetente confiável, chama `clearStorageData()` em todas as sessões conhecidas, purga arquivos em `userData` (preservando lock files de runtime) e aciona `relaunch()`. Expor `resetAppData` no [preload.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/preload.js).

**Critérios de aceite:**
- [x] Chamada de remetente não confiável (`isTrustedSender: false`) retorna `{ ok: false }` imediatamente.
- [x] Todas as partições conhecidas têm `clearStorageData()` executado.
- [x] Arquivos em `userData` são apagados com segurança, respeitando validação de symlink e preservando `Singleton*` e `lockfile`.
- [x] `relaunch()` é invocado após a limpeza.
- [x] `window.pf.resetAppData()` está exposto em [preload.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/preload.js).

**Verificação:** `node --check PokeIdle-Hub/session-maintenance-service.js` e `node --check PokeIdle-Hub/preload.js`.

**Dependências:** Nenhuma.

**Arquivos prováveis:**
- `PokeIdle-Hub/session-maintenance-service.js`
- `PokeIdle-Hub/preload.js`

**Escopo estimado:** Pequeno (2 arquivos).

---

## Tarefa 2: Adicionar testes unitários do serviço de manutenção

**Descrição:** Adicionar testes em [tests/session-maintenance-service.test.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/tests/session-maintenance-service.test.js) cobrindo todos os cenários do canal `'reset-app-data'`.

**Critérios de aceite:**
- [x] Teste cobre recusa para remetente não confiável.
- [x] Teste cobre limpeza de sessões, remoção de arquivos sintéticos e chamada de relaunch.
- [x] Teste cobre tratamento de erro caso `relaunch` falhe.

**Verificação:** `node --test PokeIdle-Hub/tests/session-maintenance-service.test.js`.

**Dependências:** Tarefa 1.

**Arquivos prováveis:**
- `PokeIdle-Hub/tests/session-maintenance-service.test.js`

**Escopo estimado:** Pequeno (1 arquivo).

---

## Ponto de Verificação 1: Processo Principal
- [x] Testes de `session-maintenance-service.test.js` passando.
- [x] Sintaxe `node --check` validada.

---

## Tarefa 3: Adicionar a linha de reset no HTML e estilos de alerta no CSS

**Descrição:** Adicionar a linha de reset com o botão `#cfg-reset-app-data-btn` em [renderer/index.html](file:///g:/PokeIdle-Hub/PokeIdle-Hub/renderer/index.html) e o estilo `.btn-danger` em [renderer/styles.css](file:///g:/PokeIdle-Hub/PokeIdle-Hub/renderer/styles.css).

**Critérios de aceite:**
- [x] Elemento `#cfg-reset-app-data-btn` existe na aba Configurações dentro do cartão de manutenção.
- [x] Texto e descrição explicam claramente o impacto da perda de logins locais.
- [x] Estilo visual condizente com botão destrutivo/perigo no tema escuro.

**Verificação:** Inspeção visual de sintaxe e verificação de seletores.

**Dependências:** Nenhuma.

**Arquivos prováveis:**
- `PokeIdle-Hub/renderer/index.html`
- `PokeIdle-Hub/renderer/styles.css`

**Escopo estimado:** Pequeno (2 arquivos).

---

## Tarefa 4: Conectar o controlador de preferências e testes de interface

**Descrição:** Implementar no módulo [renderer/settings-preferences.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/renderer/settings-preferences.js) a função `resetAppDataNow()`, com diálogo de confirmação `confirm()`, desabilitação do botão, feedback visual e despacho para o callback `resetAppData()`. Injetar o método em [renderer/app.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/renderer/app.js) e criar testes em [tests/settings-preferences.test.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/tests/settings-preferences.test.js).

**Critérios de aceite:**
- [x] Recusa na confirmação não aciona `resetAppData()` nem desabilita o botão.
- [x] Aceitação na confirmação desabilita o botão, exibe feedback e invoca `resetAppData()`.
- [x] Falha reportada pelo IPC exibe mensagem de erro e restaura o botão.

**Verificação:** `node --test PokeIdle-Hub/tests/settings-preferences.test.js` e `node --check` nos JS do renderer.

**Dependências:** Tarefas 1 e 3.

**Arquivos prováveis:**
- `PokeIdle-Hub/renderer/settings-preferences.js`
- `PokeIdle-Hub/renderer/app.js`
- `PokeIdle-Hub/tests/settings-preferences.test.js`

**Escopo estimado:** Médio (3 arquivos).

---

## Ponto de Verificação 2: Interface
- [x] Testes de interface passando.
- [x] Sintaxe sem erros em todos os arquivos de renderer.

---

## Tarefa 5: Atualizar teste de contrato e executar suíte completa

**Descrição:** Atualizar [tests/session-maintenance-contract.test.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/tests/session-maintenance-contract.test.js) para assegurar o novo canal IPC e elemento do DOM. Executar toda a suíte de testes do projeto.

**Critérios de aceite:**
- [x] Contrato valida canal `'reset-app-data'` no serviço e preload, e `#cfg-reset-app-data-btn` no HTML.
- [x] Todos os 449+ testes passam em `npm --prefix PokeIdle-Hub test`.

**Verificação:** `npm --prefix PokeIdle-Hub test`.

**Dependências:** Tarefas 1 a 4.

**Arquivos prováveis:**
- `PokeIdle-Hub/tests/session-maintenance-contract.test.js`

**Escopo estimado:** Pequeno (1 arquivo).

---

## Tarefa 6: Documentação e registro de alteração

**Descrição:** Registrar a alteração em `docs/changes/YYYY-MM-DD-HHMM--botao-reset-dados-locais.md` e atualizar o [CHANGELOG.md](file:///g:/PokeIdle-Hub/CHANGELOG.md).

**Critérios de aceite:**
- [x] Documento em `docs/changes/` com objetivo, arquivos, impacto, validação e rollback.
- [x] Entrada em [CHANGELOG.md](file:///g:/PokeIdle-Hub/CHANGELOG.md) sob [Não publicado].

**Verificação:** `git status` e verificação de formato.

**Dependências:** Tarefa 5.

**Arquivos prováveis:**
- `docs/changes/2026-10-23-1340--botao-reset-dados-locais.md`
- `CHANGELOG.md`

**Escopo estimado:** Pequeno (2 arquivos).

---

## Ponto de Verificação Final
- [x] Suíte completa passando (453 testes).
- [x] Documentação completa e sem pendências.
- [x] Sem commits automáticos.
