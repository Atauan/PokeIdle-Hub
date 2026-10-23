# Especificação: Botão de Reset de Dados Locais e Reinicialização

- Data: 2026-10-23
- Status: Proposta para aprovação (Fase 1: Specify)
- Escopo: PokeIdle Hub (Interface Renderer, Preload e Processo Principal Electron)
- Módulo: `app-data-reset`

---

## 1. Contexto e Alinhamento com Mudanças Recentes

O PokeIdle Hub passou recentemente por modularizações profundas e melhorias documentadas em `CHANGELOG.md` e em `docs/changes/`:
1. **Modularização do Processo Principal:** Funções de ciclo de vida, sessões e manutenção foram desacopladas em módulos dedicados, como `session-maintenance-service.js`, `app-lifecycle.js` e `electron-session-service.js`.
2. **Modularização do Renderer:** A interface foi separada em módulos autocontidos carregados sequencialmente antes de `app.js`, como `settings-preferences.js`, `account-management-settings.js` e `app-state.js`.
3. **Gerenciamento de Recursos e Manutenção:** Foram introduzidos utilitários de limpeza de cache HTTP, monitoramento de métricas agregadas de lives, e o utilitário nativo de liberação de working set (`win-memory-trimmer`).
4. **Isolamento de Ambientes:** Perfis separados para Produção, Desenvolvimento (`dev`, `dev:reset`) e QA (`npm run dist:win:qa`).

A solicitação atual é incorporar diretamente na interface do usuário (na aba de Configurações) um botão dedicado para apagar todos os dados locais do aplicativo e reiniciá-lo do zero.

---

## 2. Premissas Identificadas (Assumptions)

> [!IMPORTANT]
> **Premissas adotadas nesta especificação:**
> 1. O botão deve ficar na aba **Configurações**, na seção de Manutenção de dados (`#tab-settings`), com indicação visual clara de ação destrutiva.
> 2. O reset deve exigir **confirmação explícita** do usuário antes de qualquer exclusão (para evitar perda acidental de logins e configurações).
> 3. O escopo da exclusão abrange **todos os dados locais persistidos no cliente**: cookies e partições de contas do jogo, sessões salvas da Twitch/Kick, preferências locais (`localStorage` do renderer, contas cadastradas, limites de lives, regras de mercado, histórico de telemetria) e arquivos temporários/caches dentro do diretório de dados do usuário (`userData`).
> 4. O reset local **não altera nem exclui contas ou dados nos servidores remotos** (Pokeidle, Twitch ou Kick).
> 5. A reinicialização (`app.relaunch()` + encerramento) deve ser disparada imediatamente após a limpeza para que o aplicativo abra como uma instalação virgem.
> 6. No Windows, arquivos travados por processos em execução (locks de sessão SQLite/Chromium) devem ser tratados de forma segura: o Electron limpa os armazenamentos via API de sessão, remove arquivos de dados autorizados e, caso necessário, orquestra a limpeza completa dos arquivos remanescentes no ciclo de reinicialização.
>
> *Caso alguma dessas premissas precise de ajuste, corrija antes da aprovação.*

---

## 3. Objetivo

Disponibilizar na aba de Configurações do PokeIdle Hub um botão de **Reset** que:
1. Alerte o usuário sobre a irreversibilidade da exclusão de dados locais.
2. Apague integralmente todos os armazenamentos, partições e configurações mantidos localmente pela aplicação no perfil em uso.
3. Reinicie o PokeIdle Hub automaticamente, entregando a tela de boas-vindas/login inicial como uma nova instalação.

---

## 4. Stack e Comandos

- **Stack:** Electron (v33), Node.js (v20), JavaScript puro (CommonJS no processo principal e IIFE no renderer, sem frameworks).
- **Comandos de validação:**
  - Verificação de sintaxe:
    `node --check PokeIdle-Hub/session-maintenance-service.js`
    `node --check PokeIdle-Hub/renderer/settings-preferences.js`
    `node --check PokeIdle-Hub/preload.js`
  - Testes automatizados:
    `npm --prefix PokeIdle-Hub test`
    `node --test PokeIdle-Hub/tests/session-maintenance-service.test.js`
    `node --test PokeIdle-Hub/tests/session-maintenance-contract.test.js`
    `node --test PokeIdle-Hub/tests/settings-preferences.test.js`

---

## 5. Estrutura e Arquivos Envolvidos

```text
PokeIdle-Hub/
├── renderer/
│   ├── index.html                  → Linha/botão de reset na seção de Configurações
│   ├── styles.css                  → Estilo de alerta/destrutivo para a ação de reset
│   ├── settings-preferences.js     → Handler do botão, diálogo de confirmação e chamada IPC
│   └── app.js                      → Injeção do callback pf.resetAppData
├── preload.js                      → Exposição de resetAppData() via contextBridge
├── session-maintenance-service.js  → Handler do canal IPC 'reset-app-data', limpeza e relaunch
├── main.js                         → Injeção de dependências do serviço de manutenção
└── tests/
    ├── session-maintenance-contract.test.js  → Verificação dos canais IPC e IDs da UI
    ├── session-maintenance-service.test.js   → Testes do manipulador e sanitização de dados
    └── settings-preferences.test.js          → Testes de interação, diálogo e feedback na UI
```

---

## 6. Estilo de Código

Seguir o padrão estrito do repositório:
- `'use strict';` no topo de todos os arquivos.
- Validação estrita de remetente confiável: `isTrustedSender(event)`.
- Funções puras e injeção explícita de dependências nos factories.
- Nenhuma dependência externa ou framework adicional.
- Mensagens e diálogos na interface em português do Brasil, objetivos e sem emojis.

Exemplo de padrão de integração no serviço:
```javascript
ipcMain.handle('reset-app-data', async (event) => {
  if (!isTrustedSender(event)) return { ok: false };
  try {
    await purgeLocalData();
    relaunch();
    return { ok: true };
  } catch (_) {
    return { ok: false };
  }
});
```

---

## 7. Estratégia de Testes

1. **Testes Unitários de Serviço (`tests/session-maintenance-service.test.js`):**
   - Rejeição de chamadas IPC provenientes de remetentes não confiáveis (`isTrustedSender: false`).
   - Limpeza invocada em todas as partições conhecidas (`persist:pokeidlehub`, `persist:pokeidlehub-acc-*` e sessão padrão).
   - Validação de que a deleção de arquivos no diretório `userData` não segue links simbólicos nem ultrapassa a raiz permitida.
   - Chamada da função `relaunch` após a limpeza bem-sucedida.
2. **Testes de Contrato (`tests/session-maintenance-contract.test.js`):**
   - Garantir que o canal `'reset-app-data'` está registrado no serviço e exposto em `preload.js`.
   - Garantir que o botão `#cfg-reset-app-data-btn` está presente em `renderer/index.html`.
3. **Testes de Interface (`tests/settings-preferences.test.js`):**
   - Cancelamento do diálogo de confirmação não executa chamada ao IPC nem desabilita o botão.
   - Aceitação do diálogo desabilita o botão, exibe feedback ("Apagando dados e reiniciando...") e chama `resetAppData()`.
   - Tratamento de erro caso o IPC retorne falha.

---

## 8. Limites (Boundaries)

- **Sempre:**
  - Exigir confirmação explícita antes de apagar qualquer dado.
  - Validar a identidade do remetente do IPC.
  - Restringir a remoção estritamente à pasta `userData` do perfil ativo em execução.
  - Preservar arquivos de exclusividade de instância se a remoção ocorrer antes do encerramento do processo.
- **Consultar primeiro:**
  - Inclusão de diálogo secundário de confirmação com texto digitado (ex.: digitar "RESET").
- **Nunca:**
  - Tentar deletar arquivos fora da pasta de dados da aplicação (`userData`).
  - Executar reset sem confirmação do usuário.
  - Deixar o app em estado parcialmente corrompido sem reiniciar ou notificar o usuário.

---

## 9. Critérios de Aceite

- [ ] A aba Configurações possui uma linha dedicada na seção de manutenção com título, descrição do impacto e botão `#cfg-reset-app-data-btn`.
- [ ] O clique no botão exibe um diálogo de confirmação claro e formal.
- [ ] Ao confirmar, todas as sessões do Electron têm seus dados locais de armazenamento limpos (`clearStorageData`).
- [ ] Os dados de `localStorage` do renderer e arquivos gravados em `userData` são apagados.
- [ ] O aplicativo é reiniciado automaticamente via `app.relaunch()` e `app.quit()`.
- [ ] Ao reiniciar, o aplicativo apresenta o estado limpo de primeira execução (sem contas configuradas, sem sessões salvas, configurações padrão).
- [ ] A suíte automatizada de testes passa com 100% de sucesso sem regressões.

---

## 10. Perguntas em Aberto (Open Questions)

1. **Nível de confirmação:** Um diálogo simples nativo `confirm()` ("Tem certeza de que deseja apagar todos os dados locais e reiniciar o PokeIdle Hub? Esta ação não pode ser desfeita.") é suficiente, ou você prefere uma confirmação reforçada (ex.: diálogo personalizado ou dupla confirmação)?
2. **Ambiente Portátil / Portable:** Na versão portátil (`Data/`), o reset deve limpar os dados da pasta local de dados mantendo o executável intacto. Confirma que este é o comportamento desejado?
