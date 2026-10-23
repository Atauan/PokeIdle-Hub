# Plano de Implementação: Botão de Reset de Dados Locais e Reinicialização

- Spec de referência: [SPEC-app-data-reset.md](file:///g:/PokeIdle-Hub/SPEC-app-data-reset.md)
- Status: Planejamento pronto para execução

## 1. Visão Geral

Adicionar um botão de reset na aba Configurações que permite ao usuário apagar completamente todos os dados locais mantidos pelo PokeIdle Hub (sessões, cookies, LocalStorage, histórico, contas cadastradas e caches) e reiniciar a aplicação como uma nova instalação, com confirmação prévia formal e garantias de segurança contra exclusão indevida.

## 2. Decisões de Arquitetura

1. **Canal IPC e Serviço:**
   - Registrar o canal `reset-app-data` em [session-maintenance-service.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/session-maintenance-service.js).
   - Validar remetente autorizado via `isTrustedSender(event)`.
   - Executar `session.clearStorageData()` em todas as partições conhecidas (`persist:pokeidlehub`, partições `persist:pokeidlehub-acc-*` e sessão default).
   - Remover com segurança os arquivos e subdiretórios de `userData` (`getUserDataPath()`), preservando apenas os arquivos de exclusividade de runtime do Electron (`SingletonCookie`, `SingletonLock`, `SingletonSocket`, `lockfile`).
   - Validar que o caminho a ser limpo é estritamente a pasta `userData` do app, impedindo symlinks ou caminhos externos.
   - Invocar o callback de reinicialização (`relaunch()`).
2. **Exposição no Preload:**
   - Adicionar `resetAppData: () => ipcRenderer.invoke('reset-app-data')` em [preload.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/preload.js).
3. **Interface e Interação:**
   - Adicionar no [renderer/index.html](file:///g:/PokeIdle-Hub/PokeIdle-Hub/renderer/index.html) na seção de manutenção uma linha com título "Apagar todos os dados e reiniciar", aviso de impacto e botão `#cfg-reset-app-data-btn`.
   - Adicionar classe de estilo `.btn-danger` em [renderer/styles.css](file:///g:/PokeIdle-Hub/PokeIdle-Hub/renderer/styles.css) para destacar a ação de risco.
   - Em [renderer/settings-preferences.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/renderer/settings-preferences.js), conectar o evento de clique com chamada ao `confirm()` nativo, feedback visual e despacho para `resetAppData()`.
   - Em [renderer/app.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/renderer/app.js), injetar `resetAppData` no factory de `createSettingsPreferences`.
4. **Estratégia de Validação:**
   - Testes unitários com mocks em [tests/session-maintenance-service.test.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/tests/session-maintenance-service.test.js).
   - Testes unitários da UI em [tests/settings-preferences.test.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/tests/settings-preferences.test.js).
   - Testes de contrato estático em [tests/session-maintenance-contract.test.js](file:///g:/PokeIdle-Hub/PokeIdle-Hub/tests/session-maintenance-contract.test.js).
   - Execução completa da suíte de 449+ testes com `npm test`.

## 3. Ordem das Fases e Tarefas

### Fase 1: Serviço e IPC no Processo Principal
- **Tarefa 1:** Implementar o manipulador `reset-app-data` em `session-maintenance-service.js` e expor no `preload.js`.
- **Tarefa 2:** Adicionar testes unitários em `tests/session-maintenance-service.test.js`.

### Ponto de Verificação 1: Processo Principal
- [ ] Testes unitários do serviço de manutenção passando com cobertura de remetente não confiável, limpeza de dados e chamada a `relaunch`.
- [ ] Sintaxe validada com `node --check`.

### Fase 2: Interface, Estilo e Interação no Renderer
- **Tarefa 3:** Adicionar a linha e botão `#cfg-reset-app-data-btn` em `renderer/index.html` e estilização `.btn-danger` em `renderer/styles.css`.
- **Tarefa 4:** Implementar o controlador em `renderer/settings-preferences.js`, injeção em `renderer/app.js` e testes em `tests/settings-preferences.test.js`.

### Ponto de Verificação 2: Interface
- [ ] Testes de `settings-preferences.test.js` passando (confirmação, cancelamento, feedback).
- [ ] Sintaxe validada em todos os arquivos de renderer.

### Fase 3: Contrato, Validação Integrada e Documentação
- **Tarefa 5:** Atualizar `tests/session-maintenance-contract.test.js` com o novo canal e elemento do DOM, e executar a suíte completa de testes.
- **Tarefa 6:** Registrar a alteração em `docs/changes/YYYY-MM-DD-HHMM--botao-reset-dados-locais.md`.

### Ponto de Verificação Final
- [ ] Suíte completa `npm test` verde (449+ testes passando).
- [ ] `git diff` limpo e pontual.
- [ ] Documentação registrada.

## 4. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Apagar arquivos fora do diretório de dados do app | Alto | Validar rigorosamente o caminho retornado por `getUserDataPath()`, verificar `fs.realpathSync` e rejeitar qualquer link simbólico. |
| Arquivos travados no Windows no momento da exclusão | Médio | Executar `session.clearStorageData()` primeiro para fechar bancos do Chromium; capturar erros de arquivos individuais e permitir que a reinicialização continue. |
| Clique acidental do usuário | Alto | Caixa de diálogo de confirmação explícita (`confirm()`) com texto de alerta em caixa alta/enfático. |
